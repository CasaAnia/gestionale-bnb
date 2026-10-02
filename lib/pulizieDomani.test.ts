// Pulizie di domani e dei giorni dopo, e il riquadro della striscia in Home
// (riferimento approvato da Ania il 02/10/2026, docs/design/pulizie-domani-
// riferimento.html; checklist pulizie-domani-checklist.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { giornoDaMostrare, giornoPrima, giornoDopo, indirizzoGiorno, contoGiornoFuturo, daFareIl, nienteNelGiorno, GIORNI_AVANTI } from './pulizieGiorni.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const OGGI = '2026-10-01' // giovedì

test('D1 · il giorno sta nell’indirizzo: senza parametro è oggi, mai prima di oggi', () => {
  assert.equal(giornoDaMostrare(null, OGGI), OGGI)
  assert.equal(giornoDaMostrare('2026-10-02', OGGI), '2026-10-02')
  assert.equal(giornoDaMostrare('2026-09-30', OGGI), OGGI, 'un giorno passato riporta a oggi')
  assert.equal(giornoDaMostrare('domani', OGGI), OGGI)
  // i link della striscia della Home arrivano a 28 giorni: oltre, oggi
  assert.equal(giornoDaMostrare('2026-10-28', OGGI), '2026-10-28')
  assert.equal(giornoDaMostrare('2026-10-29', OGGI), OGGI)
  assert.equal(indirizzoGiorno(OGGI, OGGI), '/pulizie')
  assert.equal(indirizzoGiorno('2026-10-02', OGGI), '/pulizie?giorno=2026-10-02')
})

test('D1 · le frecce: «‹» mai prima di oggi, «›» fino a 13 giorni avanti', () => {
  assert.equal(GIORNI_AVANTI, 13)
  assert.equal(giornoPrima(OGGI, OGGI), null, 'su oggi «‹» non c’è')
  assert.equal(giornoPrima('2026-10-02', OGGI), OGGI)
  assert.equal(giornoDopo(OGGI, OGGI), '2026-10-02')
  assert.equal(giornoDopo('2026-10-13', OGGI), '2026-10-14')
  assert.equal(giornoDopo('2026-10-14', OGGI), null, 'dopo 13 giorni «›» non c’è')
  // a cavallo del mese
  assert.equal(giornoDopo('2026-10-31', '2026-10-30'), '2026-11-01')
})

test('D1 · sotto la data: «domani · 2 da fare», «sabato · 1 da fare», «niente da fare»', () => {
  assert.equal(contoGiornoFuturo('2026-10-02', OGGI, 2), 'domani · 2 da fare')
  assert.equal(contoGiornoFuturo('2026-10-03', OGGI, 1), 'sabato · 1 da fare')
  assert.equal(contoGiornoFuturo('2026-10-06', OGGI, 0), 'martedì · niente da fare')
  assert.equal(contoGiornoFuturo('2026-10-02', OGGI, 0), 'domani · niente da fare')
})

test('D1 · in fondo alla scheda «Da fare domani» / «Da fare sabato 3»; nel grafico «niente domani» / «niente quel giorno»', () => {
  assert.equal(daFareIl('2026-10-02', OGGI), 'Da fare domani')
  assert.equal(daFareIl('2026-10-03', OGGI), 'Da fare sabato 3')
  assert.equal(nienteNelGiorno(OGGI, OGGI), 'niente oggi')
  assert.equal(nienteNelGiorno('2026-10-02', OGGI), 'niente domani')
  assert.equal(nienteNelGiorno('2026-10-04', OGGI), 'niente quel giorno')
})

test('D1 · la pagina: frecce ai lati della data (44 × 44, 26 px leggere), link «Oggi», giorno nell’indirizzo con pushState e popstate', () => {
  const pagina = leggi('app/pulizie/page.tsx')
  assert.match(pagina, /data-freccia="prima"/)
  assert.match(pagina, /data-freccia="dopo"/)
  assert.match(pagina, /window\.history\.pushState\(null, '', indirizzoGiorno\(g, td\)\)/)
  assert.match(pagina, /addEventListener\('popstate', leggi\)/)
  assert.match(pagina, /data-torna-oggi/)
  const css = leggi('app/pulizie.css')
  assert.match(css, /\.pul-giorno-nav \{ display: grid; grid-template-columns: 44px 1fr 44px;/)
  assert.match(css, /\.pul-freccia \{[^}]*width: 44px; height: 44px;[^}]*font-size: 26px; font-weight: 300;/)
})

// ── D1 · il grafico e le schede di un giorno che deve venire ─────────────
import { pulizieDelGiorno, conteggioGiorno, prossimoArrivo, prioritaDi } from './pulizie.ts'
import { rigaGiornata } from './giornataPulizie.ts'
import { orariScheda, etichettaScheda } from './pulizieSchede.ts'
import { prossimePulizie } from './pulizieVista.ts'

let n = 0
const pr = (room_id: string, check_in: string, check_out: string, nome: string, extra: Record<string, unknown> = {}) => ({ id: `d${++n}`, room_id, check_in, check_out, status: 'confermata', guest_name: nome, guest_id: nome, num_guests: 2, ...extra })
const room = (id: string) => ({ id, name: id })
const DOMANI = '2026-10-02'
const casa = () => [
  pr('lena', '2026-09-28', DOMANI, 'Elena Esposito', { check_out_time: '10:00:00' }),
  pr('lena', DOMANI, '2026-10-05', 'Giovanni Serra', { check_in_time: '16:00', bagagli_alle: '11:00:00' }),
  pr('ambra', '2026-09-28', '2026-10-06', 'Lucia Ferri'),          // 4ª notte: cambio biancheria il 2
  pr('amelia', '2026-09-29', OGGI, 'Mario Rossi'),                  // parte oggi, pulizia ancora da fare
]

test('D1 · le camere di domani: Lena (cambio ospite) e Ambra (resta); la pulizia di oggi di Amelia NON si sposta a domani', () => {
  const p = casa()
  assert.deepEqual(pulizieDelGiorno(p as never, 'lena', DOMANI, OGGI, []).map(x => [x.tipo, x.due, x.ritardo]), [['fine_soggiorno', DOMANI, 0]])
  assert.deepEqual(pulizieDelGiorno(p as never, 'ambra', DOMANI, OGGI, []).map(x => [x.tipo, x.due]), [['soggiorno', DOMANI]])
  assert.deepEqual(pulizieDelGiorno(p as never, 'amelia', DOMANI, OGGI, []), [], 'Amelia resta in «oggi», non va a domani')
  assert.equal(pulizieDelGiorno(p as never, 'amelia', OGGI, OGGI, []).length, 1, 'su oggi le pulizie aperte di sempre')
  // stesso numero della striscia della Home
  assert.equal(conteggioGiorno(['lena', 'ambra', 'amelia', 'allegra'].map(room), p as never, [], DOMANI, OGGI).daFare, 2)
  // e le stesse di «Prossime pulizie» per quella data
  const prossime = prossimePulizie(p as never, ['lena', 'ambra'], OGGI, []).filter(x => x.data === DOMANI)
  assert.deepEqual(prossime.map(x => [x.roomId, x.tipo]).sort(), [['ambra', 'soggiorno'], ['lena', 'fine_soggiorno']])
})

test('D1 · il grafico di domani: stesso disegno di oggi (parte fino alle 10, 6 ore, bagagli 11, filo Serra 16:00), chi resta in lilla, «niente» sulle altre', () => {
  const p = casa()
  const lena = rigaGiornata(room('lena'), 'Lena', p as never, [], DOMANI, true, pulizieDelGiorno(p as never, 'lena', DOMANI, OGGI, []))
  assert.deepEqual(lena.segmenti, [{ tipo: 'parte', da: 480, a: 600, indicativo: false, testo: 'Esposito' }, { tipo: 'finestra', da: 600, a: 960, libera: false, testo: '6 ore' }])
  assert.deepEqual(lena.segni, [{ tipo: 'arrivo', ora: 960, indicativo: false, testo: 'Serra 16:00' }, { tipo: 'bagagli', ora: 660, testo: 'bagagli 11:00' }])
  const ambra = rigaGiornata(room('ambra'), 'Ambra', p as never, [], DOMANI, true, pulizieDelGiorno(p as never, 'ambra', DOMANI, OGGI, []))
  assert.deepEqual(ambra.segmenti, [{ tipo: 'resta', testo: 'Lucia Ferri resta · biancheria della 4ª notte' }])
  const amelia = rigaGiornata(room('amelia'), 'Amelia', p as never, [], DOMANI, true, pulizieDelGiorno(p as never, 'amelia', DOMANI, OGGI, []))
  assert.equal(amelia.vuota, true)
  // senza l'ora di partenza: alle 10:00 col «?»
  const senza = [pr('lena', '2026-09-28', DOMANI, 'Elena Esposito')]
  const r = rigaGiornata(room('lena'), 'Lena', senza as never, [], DOMANI, true, pulizieDelGiorno(senza as never, 'lena', DOMANI, OGGI, []))
  assert.deepEqual(r.segmenti[0], { tipo: 'parte', da: 480, a: 600, indicativo: true, testo: 'Esposito ?' })
})

test('D1 · le schede di domani: priorità, tipo e orari dello stesso giorno (Parte · Bagagli · Arriva)', () => {
  const p = casa()
  const [lena] = pulizieDelGiorno(p as never, 'lena', DOMANI, OGGI, [])
  const arrivo = prossimoArrivo(p as never, 'lena', DOMANI)
  assert.equal(etichettaScheda(lena, arrivo, prioritaDi(lena, arrivo)), 'Urgente · cambio ospite')
  assert.deepEqual(orariScheda(lena, arrivo, DOMANI, true).map(o => [o.etichetta, o.ora]), [['Parte Esposito', '10:00'], ['Bagagli Serra', '11:00'], ['Arriva Serra', '16:00']])
})

test('D1 · la pagina su un giorno futuro: grafico senza linea dell’ora, schede solo da guardare, niente spazi comuni, prossime e rinvii', () => {
  const pagina = leggi('app/pulizie/page.tsx')
  const futuro = pagina.slice(pagina.indexOf('{futuro && <>'), pagina.indexOf('{!futuro && <>'))
  assert.match(futuro, /<GraficoGiornata righe=\{graficoFuturo\} spazi=\{\[\]\} adesso=\{false\} niente=\{nienteNelGiorno\(giorno, td\)\} \/>/)
  assert.match(futuro, /daFare=\{daFareIl\(giorno, td\)\}/)
  for (const vietato of ['SpaziComuniOggi', 'Prossime pulizie', 'Rinvii e salti', 'fatteOggi', 'Anticipa']) assert.ok(!futuro.includes(vietato), vietato)
  const scheda = leggi('components/pulizie/SchedaCameraOggi.tsx')
  // con `daFare` al posto dei comandi (timer, Pulita, Pulita e recuperato, Rimanda o salta, Minuti a mano) la riga ottone
  assert.match(scheda, /\{daFare \? <p className="pul-prev" data-da-fare-il>\{daFare\}<\/p> : <ControlliPulizia /)
  assert.match(scheda, /data-whatsapp="chiedi-partenza"/, '«Chiedi orario» resta')
  const grafico = leggi('components/pulizie/GraficoGiornata.tsx')
  assert.match(grafico, /\{adesso && <div className="tl-ora" aria-hidden><Adesso \/><\/div>\}/)
  assert.match(leggi('app/pulizie.css'), /\.pul-prev \{ font-size: 11px; letter-spacing: \.16em; text-transform: uppercase; color: var\(--p-ott2\);/)
})
