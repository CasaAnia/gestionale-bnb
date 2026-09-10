import { test } from 'node:test'
import assert from 'node:assert/strict'
import { righeStorico, testoCamere } from './storicoCliente.ts'

const s = (id: string, camera: string, check_in: string, check_out: string, extra: Record<string, unknown> = {}) =>
  ({ id, rooms: { name: `Camera ${camera}` }, check_in, check_out, status: 'confermata', total_amount: 100, ...extra })

test('storico: una riga per soggiorno, cambio camera = riga sola con le camere in ordine, dal più recente, apre il primo segmento', () => {
  const righe = righeStorico([
    s('b2', 'Lena', '2026-08-03', '2026-08-06', { group_id: 'g', total_amount: 300 }),
    s('b1', 'Ambra', '2026-08-01', '2026-08-03', { group_id: 'g', total_amount: 200 }),
    s('a', 'Amelia', '2026-09-01', '2026-09-03', { extra_bed: true }),
    s('x', 'Allegra', '2026-07-01', '2026-07-02', { status: 'annullata', cancelled_reason: 'Prova' }),
  ])
  assert.deepEqual(righe.map(r => [r.chiave, r.prenotazioneId, testoCamere(r), r.check_in, r.check_out, r.totaleCent, r.status, r.extra_bed]), [
    ['a', 'a', 'Amelia', '2026-09-01', '2026-09-03', 10000, 'confermata', true],
    ['g', 'b1', 'Ambra → Lena', '2026-08-01', '2026-08-06', 50000, 'confermata', false],
    ['x', 'x', 'Allegra', '2026-07-01', '2026-07-02', 10000, 'annullata', false],
  ])
  assert.equal(righe[2].cancelled_reason, 'Prova')
  assert.equal(righe[1].segmenti.length, 2)
})

test('storico: un soggiorno con un segmento annullato e uno valido resta valido (le camere e il totale solo dai validi)', () => {
  const [r] = righeStorico([
    s('v', 'Ambra', '2026-08-01', '2026-08-03', { group_id: 'g', total_amount: 200 }),
    s('ann', 'Lena', '2026-08-03', '2026-08-05', { group_id: 'g', status: 'annullata', total_amount: 999 }),
  ])
  assert.deepEqual([r.status, testoCamere(r), r.totaleCent, r.prenotazioneId], ['confermata', 'Ambra', 20000, 'v'])
})

// ============================================================================
// Camere parallele (10/09/2026): `prenotazione_id` tiene insieme le camere
// prese insieme, `group_id` resta il cambio camera.
// ============================================================================

test('storico: due camere della stessa prenotazione sono UNA riga, con il «+» e non la freccia', () => {
  const righe = righeStorico([
    s('r1', 'Ambra', '2026-08-01', '2026-08-04', { prenotazione_id: 'p', total_amount: 240 }),
    s('r2', 'Lena', '2026-08-01', '2026-08-04', { prenotazione_id: 'p', total_amount: 320 }),
  ])
  assert.equal(righe.length, 1)
  assert.deepEqual([righe[0].chiave, testoCamere(righe[0]), righe[0].totaleCent], ['p', 'Ambra + Lena', 56000])
  assert.deepEqual(righe[0].linee, [['Ambra'], ['Lena']])
  assert.equal(righe[0].segmenti.length, 2)
})

test('storico: camere parallele di durata diversa → arrivo più vecchio e partenza più lontana, anche se non è dell\'ultimo arrivo', () => {
  const [r] = righeStorico([
    s('lunga', 'Lena', '2026-08-01', '2026-08-10', { prenotazione_id: 'p' }),
    s('corta', 'Ambra', '2026-08-03', '2026-08-05', { prenotazione_id: 'p' }),
  ])
  assert.deepEqual([r.check_in, r.check_out], ['2026-08-01', '2026-08-10'])
  assert.equal(r.prenotazioneId, 'lunga')
})

test('storico: un cambio camera più una camera in parallelo → «Ambra → Lena + Amelia»', () => {
  const [r] = righeStorico([
    s('g1a', 'Ambra', '2026-08-01', '2026-08-03', { prenotazione_id: 'p', group_id: 'g1' }),
    s('g1b', 'Lena', '2026-08-03', '2026-08-06', { prenotazione_id: 'p', group_id: 'g1' }),
    s('par', 'Amelia', '2026-08-01', '2026-08-06', { prenotazione_id: 'p' }),
  ])
  assert.equal(testoCamere(r), 'Ambra → Lena + Amelia')
  assert.deepEqual(r.camere, ['Ambra', 'Lena', 'Amelia'])
  assert.deepEqual([r.check_in, r.check_out], ['2026-08-01', '2026-08-06'])
})

test('storico: due prenotazioni indipendenti dello stesso cliente sulle stesse date restano DUE righe', () => {
  const righe = righeStorico([
    s('uno', 'Ambra', '2026-08-01', '2026-08-04'),
    s('due', 'Lena', '2026-08-01', '2026-08-04'),
  ])
  assert.equal(righe.length, 2)
  assert.deepEqual(righe.map(r => r.chiave).sort(), ['due', 'uno'])
})

test('storico: camere parallele con una annullata → la riga resta valida; se sono annullate tutte restano ragione e importo storico', () => {
  const [parziale] = righeStorico([
    s('viva', 'Ambra', '2026-08-01', '2026-08-04', { prenotazione_id: 'p', total_amount: 240 }),
    s('morta', 'Lena', '2026-08-01', '2026-08-04', { prenotazione_id: 'p', status: 'annullata', total_amount: 320, cancelled_reason: 'Ha disdetto una camera' }),
  ])
  assert.deepEqual([parziale.status, testoCamere(parziale), parziale.totaleCent, parziale.cancelled_reason], ['confermata', 'Ambra', 24000, null])

  const [tutta] = righeStorico([
    s('m1', 'Ambra', '2026-08-01', '2026-08-04', { prenotazione_id: 'q', status: 'annullata', total_amount: 240, cancelled_reason: 'Ha disdetto tutto' }),
    s('m2', 'Lena', '2026-08-01', '2026-08-04', { prenotazione_id: 'q', status: 'annullata', total_amount: 320 }),
  ])
  assert.deepEqual([tutta.status, testoCamere(tutta), tutta.totaleCent, tutta.cancelled_reason], ['annullata', 'Ambra + Lena', 56000, 'Ha disdetto tutto'])
})

test('storico: le prenotazioni vecchie senza prenotazione_id non cambiano (una linea sola, con la freccia)', () => {
  const [r] = righeStorico([
    s('b2', 'Lena', '2026-08-03', '2026-08-06', { group_id: 'g', total_amount: 300 }),
    s('b1', 'Ambra', '2026-08-01', '2026-08-03', { group_id: 'g', total_amount: 200 }),
  ])
  assert.deepEqual([r.chiave, testoCamere(r), r.totaleCent], ['g', 'Ambra → Lena', 50000])
  assert.deepEqual(r.linee, [['Ambra', 'Lena']])
  assert.equal(testoCamere({ ...r, linee: undefined }), 'Ambra → Lena')  // firma vecchia: senza linee funziona lo stesso
})

test('storico: una camera annullata NON allunga le date del soggiorno rimasto; se è annullata tutta le date restano quelle scritte', () => {
  const [r] = righeStorico([
    s('viva', 'Ambra', '2026-08-02', '2026-08-04', { prenotazione_id: 'p', total_amount: 240 }),
    s('morta', 'Lena', '2026-08-01', '2026-08-20', { prenotazione_id: 'p', status: 'annullata', total_amount: 999 }),
  ])
  assert.deepEqual([r.check_in, r.check_out, testoCamere(r), r.totaleCent], ['2026-08-02', '2026-08-04', 'Ambra', 24000])

  const [tutta] = righeStorico([
    s('m1', 'Ambra', '2026-08-02', '2026-08-04', { prenotazione_id: 'q', status: 'annullata', total_amount: 240 }),
    s('m2', 'Lena', '2026-08-01', '2026-08-20', { prenotazione_id: 'q', status: 'annullata', total_amount: 999, cancelled_reason: 'Disdetta' }),
  ])
  assert.deepEqual([tutta.check_in, tutta.check_out, tutta.status, tutta.cancelled_reason], ['2026-08-01', '2026-08-20', 'annullata', 'Disdetta'])
})
