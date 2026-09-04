import { test } from 'node:test'
import assert from 'node:assert/strict'
import { riassuntoInterventi, testoMediaGiorno, testoOgniGiorni, testoDettaglio } from './pulizieStatistiche.ts'

const AMBRA = 'room-ambra', LENA = 'room-lena'
const ev = (roomId: string, date: string) => ({ roomId, date })

test('giorno con una pulizia e un cambio biancheria = 2 interventi, 2 al giorno', () => {
  const r = riassuntoInterventi([ev(AMBRA, '2026-09-03')], [ev(LENA, '2026-09-03')], '2026-09-03', '2026-09-03', '2026-09-04')
  assert.equal(r.interventi, 2)
  assert.equal(r.pulizie, 1)
  assert.equal(r.cambi, 1)
  assert.equal(r.giorni, 1)
  assert.equal(r.alGiorno, 2)
  assert.equal(testoMediaGiorno(r), 'In media 2 interventi al giorno')
  assert.equal(testoOgniGiorni(r), '')
  assert.equal(testoDettaglio(r), 'di cui 1 pulizia, 1 cambio biancheria')
})

test('settimana mista: pulizie (anche automatiche) + cambi, fuori periodo esclusi, media sui giorni trascorsi', () => {
  const pulizie = [ev(AMBRA, '2026-08-31'), ev(LENA, '2026-09-01'), ev(AMBRA, '2026-09-03'), ev(LENA, '2026-09-07')]  // il 7 è fuori
  const cambi = [ev(AMBRA, '2026-09-02'), ev(LENA, '2026-08-30')]                                                   // il 30 è fuori
  // settimana 31 ago – 6 set, oggi 4 set → 5 giorni trascorsi
  const r = riassuntoInterventi(pulizie, cambi, '2026-08-31', '2026-09-06', '2026-09-04')
  assert.equal(r.pulizie, 3)
  assert.equal(r.cambi, 1)
  assert.equal(r.interventi, 4)
  assert.equal(r.giorni, 5)
  assert.equal(r.alGiorno, 0.8)
  assert.equal(r.ogniGiorni, 1.3)
  assert.equal(testoMediaGiorno(r), 'In media 0,8 interventi al giorno')
  assert.equal(testoOgniGiorni(r), 'un intervento ogni 1,3 giorni')
  assert.equal(testoDettaglio(r), 'di cui 3 pulizie, 1 cambio biancheria')
  // settimana già conclusa: contano tutti i 7 giorni
  assert.equal(riassuntoInterventi(pulizie, cambi, '2026-08-31', '2026-09-06', '2026-09-20').giorni, 7)
})

test('mese senza interventi: zero, nessuna media', () => {
  const r = riassuntoInterventi([ev(AMBRA, '2026-06-10')], [ev(LENA, '2026-08-02')], '2026-07-01', '2026-07-31', '2026-09-04')
  assert.equal(r.interventi, 0)
  assert.equal(r.alGiorno, null)
  assert.equal(r.ogniGiorni, null)
  assert.equal(testoMediaGiorno(r), 'Nessun intervento in questo periodo')
  assert.equal(testoOgniGiorni(r), '')
  assert.equal(testoDettaglio(r), 'di cui 0 pulizie, 0 cambi biancheria')
})

test('esattamente un intervento al giorno', () => {
  const r = riassuntoInterventi([ev(AMBRA, '2026-09-01'), ev(AMBRA, '2026-09-02')], [ev(LENA, '2026-09-03')], '2026-09-01', '2026-09-03', '2026-09-04')
  assert.equal(r.alGiorno, 1)
  assert.equal(testoMediaGiorno(r), 'In media un intervento al giorno')
})
