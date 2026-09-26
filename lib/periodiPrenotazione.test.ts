import { test } from 'node:test'
import assert from 'node:assert/strict'
import { riepilogoPeriodi } from './periodiPrenotazione.ts'
import { rigaGrandeScheda, caselleSoggiorno } from './schedaPrenotazione.ts'
import { percorsoTesta } from './testaScheda.ts'
import { causaleBonifico } from './causale.ts'
import buildWhatsappMsg from './messaggiPrenotazione.ts'

const uno = { id: 'a', room_id: 'allegra', group_id: 'g1', prenotazione_id: 'p', check_in: '2026-10-01', check_out: '2026-10-02', num_guests: 2, status: 'confermata', guest_name: 'Leo Esempio', rooms: { name: 'Allegra' }, total_amount: 70, price_per_night: 70 }
const due = { ...uno, id: 'b', room_id: 'amelia', group_id: 'g2', check_in: '2026-10-05', check_out: '2026-10-07', num_guests: 1, rooms: { name: 'Amelia' }, total_amount: 100, price_per_night: 50 }

test('due visite: tre notti, due periodi e ospiti variabili, anche con righe invertite', () => {
  const r = riepilogoPeriodi([due, uno])
  assert.equal(r.notti, 3)
  assert.equal(r.ospiti, 2)
  assert.equal(r.ospitiVariabili, true)
  assert.deepEqual(r.periodi, [{ arrivo: '2026-10-01', partenza: '2026-10-02' }, { arrivo: '2026-10-05', partenza: '2026-10-07' }])
  assert.equal(r.separati, true)
})

test('scheda: nessuna freccia o cambio camera fra visite separate', () => {
  for (const group_id of ['g1', 'g2']) {
    const righe = [uno, { ...due, group_id }]
    assert.deepEqual(rigaGrandeScheda(righe), { ospiti: 2, camere: 'Allegra · Amelia', cambi: 0, insieme: false })
    assert.match(percorsoTesta(righe).sopra, /2 periodi separati/)
    assert.equal(caselleSoggiorno(righe, '2026-09-26').filter(n => n.cambia).length, 0)
  }
})

test('un cambio contiguo conserva la freccia; camere contemporanee conservano il più', () => {
  const contiguo = { ...due, check_in: uno.check_out, group_id: uno.group_id }
  assert.equal(rigaGrandeScheda([uno, contiguo]).camere, 'Allegra ⇄ Amelia')
  assert.equal(riepilogoPeriodi([uno, contiguo]).separati, false)
  const parallelo = { ...due, check_in: uno.check_in, check_out: uno.check_out }
  assert.equal(rigaGrandeScheda([uno, parallelo]).camere, 'Allegra + Amelia')
  assert.equal(riepilogoPeriodi([uno, parallelo]).ospiti, 3)
  assert.equal(riepilogoPeriodi([uno, parallelo]).notti, 1)
})

test('righe annullate non riempiono la pausa; un soggiorno sovrapposto invece la copre', () => {
  const ponte = { ...uno, id: 'c', check_in: '2026-10-02', check_out: '2026-10-05' }
  assert.equal(riepilogoPeriodi([uno, due, { ...ponte, status: 'annullata' }]).notti, 3)
  assert.equal(riepilogoPeriodi([uno, due, ponte]).separati, false)
})

for (const tipo of ['conferma', 'modifica'] as const) test(`${tipo}: ogni camera con arrivo, partenza e ospiti, tre notti e costo invariato`, () => {
  const t = buildWhatsappMsg(uno, tipo, [uno, due])
  assert.match(t, /Periodi separati della prenotazione/)
  assert.match(t, /Check-in: \*giovedì 1 ottobre 2026\*/)
  assert.match(t, /Check-out: \*venerdì 2 ottobre 2026\*/)
  assert.match(t, /Check-in: \*lunedì 5 ottobre 2026\*/)
  assert.match(t, /Check-out: \*mercoledì 7 ottobre 2026\*/)
  assert.match(t, /1 notte · 2 ospiti/)
  assert.match(t, /2 notti · 1 ospite/)
  assert.match(t, /Notti: \*3\*/)
  assert.match(t, /Totale soggiorno: 170,00 €/)
  assert.doesNotMatch(t, /cambio camera|3 adulti|Notti: \*6\*/)
})

test('anche la causale distingue le due visite', () => {
  assert.equal(causaleBonifico([uno, due], 'Leo Esempio'), 'Allegra + Amelia · 1–2 ott / 5–7 ott · Esempio')
})
