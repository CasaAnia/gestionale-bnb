import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { databasePulizieFinto } from './pulizie-db-finto.mjs'
import { eseguiOperazionePulizia } from '../../lib/pulizieOperazioni.ts'
import { pulizieDiOggi } from '../../lib/pulizieOggi.ts'
import { resocontoPulizie } from '../../lib/pulizieResoconto.ts'
import { vuoto } from '../../lib/biancheria.ts'

// Render dei componenti veri con React. Solo gli adattatori browser/rete
// sono isolati: le scritture sotto usano custodia e SQL vere in PGlite.
const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
const cache = new Map()
const adapters = new Set(['biancheriaDati', 'pulizieServizio', 'numeriOggiDati', 'daControllareDati', 'supabase', 'pulizieTempiDati'])
function carica(file) {
  if (cache.has(file)) return cache.get(file)
  const modulo = { exports: {} }
  const localRequire = name => {
    if (name === './SalvataggiPulizie') return { __esModule: true, default: () => React.createElement('aside', { 'data-ripresa-pendente': true }) }
    if (name === '@/lib/pulizieTempiDati') return { useTimerPulizie: () => ({ timer: [], stato: 'pronto', scarto: 0 }) }
    if (name.startsWith('@/lib/') && adapters.has(name.slice(6))) return {}
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(file), name)
    const target = [base, `${base}.ts`, `${base}.tsx`].find(existsSync)
    assert.ok(target, `Modulo trovato: ${name}`)
    return carica(target)
  }
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText
  runInNewContext(output, { require: localRequire, module: modulo, exports: modulo.exports }, { filename: file })
  cache.set(file, modulo.exports)
  return modulo.exports
}
const Home = carica(resolve(root, 'components/PulizieOggi.tsx')).default
const render = (rooms, bookings, events, oggi) => renderToStaticMarkup(React.createElement(Home, {
  dati: { stato: 'pronto', oggi, pulizieOggi: pulizieDiOggi(rooms, bookings, events, oggi) },
}))

test('Home vera: conferma SQL con e senza recupero, due riaperture, registro e nuovo ciclo', async () => {
  const oggi = '2026-09-08'
  const rooms = ['Amelia', 'Allegra'].map(name => ({ id: randomUUID(), name }))
  const bookings = rooms.map((r, i) => ({ id: randomUUID(), room_id: r.id, guest_id: `prova-${i}`, num_guests: 3, status: 'confermata', check_in: '2026-09-01', check_out: i ? '2026-09-30' : oggi }))
  const db = await databasePulizieFinto(rooms, bookings, [])
  const righe = async table => (await db.query(`select row_to_json(r) as r from ${table} r order by created_at,id`)).rows.map(x => x.r)
  const memoria = new Map()
  const dispositivo = { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k) }
  const trasporto = async (id, r) => {
    try { return { data: (await db.query('select gestisci_pulizia($1,$2::jsonb) as r', [id, JSON.stringify(r)])).rows[0].r, error: null } }
    catch (e) { return { data: null, error: { code: e.code, message: e.message } } }
  }
  try {
    const prima = render(rooms, bookings, [], oggi)
    assert.match(prima, /data-camera="Amelia"/)
    assert.match(prima, /data-pulita="true">Pulita</)
    assert.match(prima, /data-recuperato="true">Pulita e recuperato</)
    assert.doesNotMatch(prima, /Tutte le pulizie|href="\/pulizie"/)
    for (const [i, r] of rooms.entries()) {
      const voce = pulizieDiOggi(rooms, bookings, await righe('cleanings'), oggi).find(v => v.roomId === r.id && v.stato === 'da_fare')
      const risposta = await eseguiOperazionePulizia(r.id, {
        azione: 'registra', ultima_id: null,
        pulizia: { ...voce.daSegnare, stato: 'fatta', data_effettiva: oggi, persone_servite: 3, cambio_biancheria: true },
        recupero: i ? { ...vuoto(), telo_doccia: 3, asciugamano_viso: 3, asciugamano_mani: 3 } : null,
      }, dispositivo, trasporto, randomUUID)
      assert.equal(risposta.errore, null)
      // Ricrea Home e dati ogni volta, mantenendo lo stesso database.
      for (let apertura = 0; apertura < 2; apertura++) {
        const html = render(rooms, bookings, await righe('cleanings'), oggi)
        assert.doesNotMatch(html, new RegExp(`data-camera="${r.name}"`))
        if (i === 0) assert.match(html, /data-camera="Allegra"/)
        else { assert.doesNotMatch(html, /data-pulizie-oggi/); assert.match(html, /data-ripresa-pendente/) }
      }
    }
    const events = await righe('cleanings')
    const report = resocontoPulizie(rooms, bookings, events, await righe('biancheria_recuperata'), '2026-09-01', '2026-10-01', oggi)
    assert.equal(report.fatte.length, 2)
    assert.equal(report.pezzi, 9)
    assert.doesNotMatch(render(rooms, bookings, events, '2026-09-09'), /data-camera=/)
    assert.match(render(rooms, bookings, events, '2026-09-12'), /data-camera="Allegra"/)
  } finally { await db.close() }
})

// Requisito ricostruito il 30/09/2026 (R5 dell'audit Codex): fino al 27/09 la
// pulizia con l'arrivo lo stesso giorno era «automatica» e la Home restava
// vuota. Dal 28/09 (6d3ac7c, Home Maison «novità 3», confermata in
// lib/pulizie.test.ts) è una voce da fare come le altre. Restano fuori dalla
// Home le stime storiche: il giorno dopo, con l'ospite nuovo già arrivato, la
// partenza mai segnata non torna come pulizia in ritardo.
test('cambio ospite lo stesso giorno: voce da fare in Home; il giorno dopo le stime storiche restano fuori', () => {
  const rooms = [{ id: 'r', name: 'Amelia' }]
  const bookings = [
    { id: 'uscita', room_id: 'r', status: 'confermata', check_in: '2026-09-01', check_out: '2026-09-07' },
    { id: 'arrivo', room_id: 'r', status: 'confermata', check_in: '2026-09-07', check_out: '2026-09-09' },
  ]
  const oggi = pulizieDiOggi(rooms, bookings, [], '2026-09-07')
  assert.equal(oggi.length, 1)
  assert.equal(oggi[0].stato, 'da_fare')
  assert.equal(oggi[0].ritardo, 0)
  const conLavoro = render(rooms, bookings, [], '2026-09-07')
  assert.match(conLavoro, /data-pulizie-oggi/)
  assert.match(conLavoro, /data-camera="Amelia"/)
  assert.match(conLavoro, /data-ripresa-pendente/)

  assert.deepEqual(pulizieDiOggi(rooms, bookings, [], '2026-09-08'), [])
  const senzaLavoro = render(rooms, bookings, [], '2026-09-08')
  assert.doesNotMatch(senzaLavoro, /data-pulizie-oggi/)
  assert.match(senzaLavoro, /data-ripresa-pendente/, 'la ripresa di un salvataggio resta montata anche senza lavoro')
})

test('Home: il recupero porta alla scheda il numero di ospiti del soggiorno', () => {
  const source = readFileSync(resolve(root, 'components/ControlliPulizia.tsx'), 'utf8')
  const tree = ts.createSourceFile('controlli.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let fn
  const visita = n => { if (ts.isFunctionDeclaration(n) && n.name?.text === 'apriRecupero') fn = n; ts.forEachChild(n, visita) }
  visita(tree)
  const code = ts.transpileModule(fn.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  let aperta
  runInNewContext(`${code}; apriRecupero()`, { blocco: { current: false }, pendente: false, confermata: null, pulizia: { booking_id: 'soggiorno', tipo: 'soggiorno' }, persone: 3, setErrore: () => {}, setScheda: v => { aperta = v } })
  assert.equal(aperta.persone_servite, 3)
  assert.equal(aperta.booking_id, 'soggiorno')
})

test('Home: rilettura in primo piano conserva la scheda aperta, cambio giorno la invalida', () => {
  const source = readFileSync(resolve(root, 'lib/numeriOggiDati.ts'), 'utf8')
  const updater = source.match(/setStato\((s => s\.stato === 'pronto'[^\n]+)\)/)?.[1]
  assert.ok(updater)
  const aggiorna = runInNewContext(updater, { oggi: '2026-09-27' })
  const pronto = { stato: 'pronto', oggi: '2026-09-27', pulizieOggi: [{ camera: 'Amelia' }] }
  assert.equal(aggiorna(pronto), pronto)
  assert.equal(aggiorna({ ...pronto, oggi: '2026-09-26' }).stato, 'caricamento')
  assert.equal(aggiorna({ stato: 'errore', oggi: pronto.oggi }).stato, 'caricamento')
})
