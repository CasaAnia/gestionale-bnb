import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numeriOggi, testoOccupate } from './numeriOggi.ts'
import { oggiARoma } from './spese/adattatore.ts'

const OGGI = '2026-09-05'
const b = (id: string, room_id: string, check_in: string, check_out: string, extra: Partial<{ status: string; group_id: string; guest_id: string }> = {}) =>
  ({ id, room_id, check_in, check_out, status: 'confermata', ...extra })
const camere = [{ id: 'amelia', active: true }, { id: 'allegra', active: true }, { id: 'ambra', active: true }, { id: 'lena', active: true }, { id: 'archiviata', active: false }]

test('tre numeri: arrivi e partenze di oggi, camere occupate stanotte su quelle attive', () => {
  const n = numeriOggi([
    b('a', 'amelia', '2026-09-05', '2026-09-08'),      // arriva oggi, dorme stanotte
    b('p', 'allegra', '2026-09-02', '2026-09-05'),     // parte oggi: stanotte libera
    b('d', 'ambra', '2026-09-03', '2026-09-07'),       // in casa
    b('f', 'lena', '2026-09-06', '2026-09-08'),        // arriva domani
    b('att', 'lena', '2026-09-05', '2026-09-07', { status: 'in_attesa' }),   // esclusa
    b('ann', 'lena', '2026-09-05', '2026-09-07', { status: 'annullata' }),   // esclusa
  ], camere, OGGI)
  assert.deepEqual(n, { arriviOggi: 1, partenzeOggi: 1, camereOccupate: 2, camereTotali: 4 })
  assert.equal(testoOccupate(n), '2 su 4')
})

test('tre numeri: un cambio camera di oggi non è né un arrivo né una partenza, e la camera si conta una volta', () => {
  const n = numeriOggi([
    b('s1', 'ambra', '2026-09-03', '2026-09-05', { group_id: 'g' }),
    b('s2', 'lena', '2026-09-05', '2026-09-07', { group_id: 'g' }),      // stesso soggiorno: cambio camera oggi
    b('x', 'amelia', '2026-09-05', '2026-09-06'),                        // vero arrivo
    // due prenotazioni sulla stessa camera stanotte (dato sporco): la camera conta una volta
    b('y1', 'allegra', '2026-09-04', '2026-09-06'), b('y2', 'allegra', '2026-09-05', '2026-09-06'),
  ], camere, OGGI)
  assert.equal(n.arriviOggi, 2)      // x e y2; s2 no
  assert.equal(n.partenzeOggi, 0)    // s1 parte oggi ma è un cambio camera
  assert.equal(n.camereOccupate, 3)  // lena (s2), amelia, allegra
  assert.equal(n.camereTotali, 4)
})

test('tre numeri: cambio camera riconosciuto anche dal solo cliente (guest_id) come nella riga «⇄ CAMBIO»', () => {
  const n = numeriOggi([
    b('s1', 'ambra', '2026-09-03', '2026-09-05', { guest_id: 'c' }),
    b('s2', 'lena', '2026-09-05', '2026-09-07', { guest_id: 'c' }),
  ], camere, OGGI)
  assert.deepEqual([n.arriviOggi, n.partenzeOggi, n.camereOccupate], [0, 0, 1])
})

test('tre numeri: il giorno è quello di Roma, non quello in UTC', () => {
  const istante = new Date('2026-09-04T22:30:00Z')     // 00:30 del 5 settembre a Roma
  const oggi = oggiARoma(istante)
  assert.equal(oggi, '2026-09-05')
  const n = numeriOggi([b('a', 'amelia', '2026-09-05', '2026-09-08'), b('p', 'ambra', '2026-09-02', '2026-09-04')], camere, oggi)
  assert.deepEqual([n.arriviOggi, n.partenzeOggi, n.camereOccupate], [1, 0, 1])
})

test('tre numeri: senza prenotazioni tutto a zero ma le camere restano', () => {
  assert.deepEqual(numeriOggi([], camere, OGGI), { arriviOggi: 0, partenzeOggi: 0, camereOccupate: 0, camereTotali: 4 })
})

// ── Striscia della settimana: STESSA regola della pagina Pulizie (08/09/2026) ──
import { strisciaSettimane, etichettaGiornoBreve, ultimoGiornoStriscia, testoCasella } from './numeriOggi.ts'
import { conteggioGiorno, statoCameraGiorno, pulizieAperte, attive, type Decisione } from './pulizie.ts'

const CAMERE = [{ id: 'amelia' }, { id: 'allegra' }, { id: 'ambra' }, { id: 'lena' }]
let seq = 0
const pren = (room_id: string, check_in: string, check_out: string, over: Record<string, unknown> = {}) =>
  ({ id: `p${++seq}`, room_id, guest_id: `g${seq}`, check_in, check_out, status: 'confermata', linen_next_date: null, ...over })

// Scenario (oggi 2026-09-05): partenza il 7 (Amelia), cambio camera il 9 (Ambra → Lena,
// stesso ospite), soggiorno lungo in Allegra dal 3 al 20 (cambio biancheria il 7, poi
// rettifica di Ania: fatta l'8 → prossimo il 12), partenza dell'11 (Lena) rimandata al 13,
// in attesa e annullata mai contate, partenza di oggi in Ambra già segnata fatta.
const SCENARIO = () => {
  seq = 0
  const bookings = [
    pren('amelia', '2026-09-04', '2026-09-07'),
    pren('ambra', '2026-09-05', '2026-09-09', { guest_id: 'lucia' }),
    pren('lena', '2026-09-09', '2026-09-11', { guest_id: 'lucia' }),           // cambio camera il 9
    pren('allegra', '2026-09-03', '2026-09-20'),                              // soggiorno lungo
    pren('lena', '2026-09-20', '2026-09-22', { status: 'in_attesa' }),
    pren('amelia', '2026-09-10', '2026-09-12', { status: 'annullata' }),
    pren('ambra', '2026-09-02', '2026-09-05', { guest_id: 'oggiOut' }),       // parte oggi
  ]
  const events: Decisione[] = [
    { id: 'e1', room_id: 'allegra', booking_id: 'p4', tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-09-07', data_effettiva: '2026-09-08', created_at: '2026-09-08T10:00:00Z' },
    { id: 'e2', room_id: 'lena', booking_id: 'p3', tipo: 'fine_soggiorno', stato: 'rimandata', data_prevista: '2026-09-11', prossima_data: '2026-09-13', created_at: '2026-09-05T09:00:00Z' },
    { id: 'e3', room_id: 'ambra', booking_id: 'p7', tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-09-05', data_effettiva: '2026-09-05', created_at: '2026-09-05T11:00:00Z' },
  ]
  return { bookings, events }
}

test('striscia = pagina Pulizie: per ognuno dei 28 giorni da fare e fatte coincidono con la funzione condivisa; valori dello scenario a mano', () => {
  const { bookings, events } = SCENARIO()
  const oggi = '2026-09-05'
  const s = strisciaSettimane(CAMERE, bookings, events, oggi)
  assert.equal(s.length, 28)
  for (const g of s) {
    const c = conteggioGiorno(CAMERE, bookings, events, g.giorno, oggi)
    assert.deepEqual([g.daFare, g.fatte], [c.daFare, c.fatte], `giorno ${g.giorno}`)
  }
  // Oggi: le camere «da fare» sono quelle con pulizie aperte non automatiche (la sezione «Oggi» della pagina)
  const aperteOggi = CAMERE.filter(r => pulizieAperte(attive(bookings), r.id, oggi, events).some(p => !p.automatica)).length
  assert.equal(s[0].daFare, aperteOggi)
  const per = Object.fromEntries(s.map(g => [g.giorno, `${g.daFare}/${g.fatte}`]))
  assert.equal(per['2026-09-05'], '0/1')   // Ambra: partenza di oggi segnata fatta e arrivo di Lucia in camera pronta → ✓; le altre: nulla
  assert.equal(per['2026-09-06'], '0/0')   // niente
  assert.equal(per['2026-09-07'], '1/0')   // Amelia parte; il cambio biancheria di Allegra è stato spostato dalla rettifica (fatta l'8)
  assert.equal(per['2026-09-08'], '0/1')   // Allegra: cambio biancheria segnato fatto l'8 → ✓
  assert.equal(per['2026-09-09'], '1/1')   // Ambra: cambio camera da fare (Lucia va in Lena); Lena: arrivo in camera senza partenze da chiudere → pronta (fatta)
  assert.equal(per['2026-09-11'], '0/0')   // partenza da Lena rimandata…
  assert.equal(per['2026-09-13'], '1/0')   // …al 13
  assert.equal(per['2026-09-12'], '1/0')   // Allegra: cambio biancheria (8 + 4 notti)
  assert.equal(per['2026-09-20'], '1/0')   // Allegra parte (l'in attesa in Lena non conta)
  assert.deepEqual(s.filter(g => g.inizioSettimana).map(g => g.giorno), ['2026-09-12', '2026-09-19', '2026-09-26'])
  assert.equal(s[0].oggi, true); assert.equal(s.filter(g => g.oggi).length, 1)
})

test('caso di Ania (08/09/2026): due arrivi domani in camere già pulite e segnate fatte → «✓», non «2»; se una non è segnata → «1»', () => {
  seq = 0
  const oggi = '2026-09-05'
  const bookings = [
    pren('amelia', '2026-09-01', '2026-09-04'), pren('amelia', '2026-09-06', '2026-09-09'),   // partita il 4, pulita e segnata; arrivo domani
    pren('ambra', '2026-09-02', '2026-09-05'), pren('ambra', '2026-09-06', '2026-09-08'),     // parte oggi, pulita e segnata oggi; arrivo domani
  ]
  const fatte: Decisione[] = [
    { id: 'f1', room_id: 'amelia', booking_id: 'p1', tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-09-04', data_effettiva: '2026-09-04', created_at: '2026-09-04T12:00:00Z' },
    { id: 'f2', room_id: 'ambra', booking_id: 'p3', tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-09-05', data_effettiva: '2026-09-05', created_at: '2026-09-05T12:00:00Z' },
  ]
  const domani = strisciaSettimane(CAMERE, bookings, fatte, oggi)[1]
  assert.deepEqual([domani.daFare, domani.fatte], [0, 2])
  assert.deepEqual(testoCasella(domani), { testo: '✓', tono: 'fatto' })
  // Senza la seconda segnatura: la partenza di oggi in Ambra è automatica (nuovo ospite domani) → vale fatta lo stesso
  const senzaAmbra = strisciaSettimane(CAMERE, bookings, fatte.slice(0, 1), oggi)
  assert.deepEqual([senzaAmbra[0].daFare, senzaAmbra[0].fatte], [0, 1])     // oggi: Ambra automatica = fatta
  assert.deepEqual([senzaAmbra[1].daFare, senzaAmbra[1].fatte], [0, 2])
  // Partita il 4 e MAI segnata, senza arrivo entro il giorno dopo: in ritardo oggi, e domani la camera dell'arrivo non è pronta
  const senzaAmelia = strisciaSettimane(CAMERE, bookings, fatte.slice(1), oggi)
  assert.equal(senzaAmelia[0].daFare, 1)      // Amelia in ritardo oggi
  assert.deepEqual([senzaAmelia[1].daFare, senzaAmelia[1].fatte], [1, 1])
  assert.deepEqual(testoCasella(senzaAmelia[1]), { testo: '1', tono: 'numero' })
  assert.deepEqual(testoCasella({ daFare: 0, fatte: 0 }), { testo: '—', tono: 'niente' })
  assert.equal(statoCameraGiorno(attive(bookings), 'lena', '2026-09-06', oggi, fatte), 'nessuna')
})

test('etichette e limiti della striscia', () => {
  assert.equal(etichettaGiornoBreve('2026-09-05'), 'sab 5')
  assert.equal(etichettaGiornoBreve('2026-10-01'), 'gio 1')
  assert.equal(ultimoGiornoStriscia('2026-09-05'), '2026-10-02')
})
