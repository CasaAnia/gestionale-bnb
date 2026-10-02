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
