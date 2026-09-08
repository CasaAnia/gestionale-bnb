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
const adapters = new Set(['biancheriaDati', 'pulizieServizio', 'numeriOggiDati', 'daControllareDati'])
function carica(file) {
  if (cache.has(file)) return cache.get(file)
  const modulo = { exports: {} }
  const localRequire = name => {
    if (name === './SalvataggiPulizie') return { __esModule: true, default: () => React.createElement('aside', { 'data-ripresa-pendente': true }) }
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

test('Home senza lavoro: le stime storiche restano fuori, la ripresa di un salvataggio resta montata', () => {
  const rooms = [{ id: 'r', name: 'Amelia' }]
  const bookings = [
    { id: 'uscita', room_id: 'r', status: 'confermata', check_in: '2026-09-01', check_out: '2026-09-07' },
    { id: 'arrivo', room_id: 'r', status: 'confermata', check_in: '2026-09-07', check_out: '2026-09-09' },
  ]
  assert.equal(pulizieDiOggi(rooms, bookings, [], '2026-09-07')[0].stato, 'automatica')
  const html = render(rooms, bookings, [], '2026-09-07')
  assert.doesNotMatch(html, /data-pulizie-oggi/)
  assert.match(html, /data-ripresa-pendente/)
})
