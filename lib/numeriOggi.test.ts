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
import { strisciaSettimane, etichettaGiornoBreve, ultimoGiornoStriscia } from './numeriOggi.ts'
import { pulizieAperte, pulizieDelGiorno, camereDaPreparareGiorno, statoFineSoggiorno, cicloCambio, attive, continuaIn, CUTOFF_STORICO, type Decisione } from './pulizie.ts'

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

test('striscia = pagina Pulizie: per ognuno dei 28 giorni il numero coincide col conteggio delle camere con un lavoro', () => {
  const { bookings, events } = SCENARIO()
  const oggi = '2026-09-05'
  const s = strisciaSettimane(CAMERE, bookings, events, oggi)
  assert.equal(s.length, 28)
  // Conteggio «come la pagina»: oggi = camere con pulizie aperte; dopo = camere con una
  // partenza/cambio camera in scadenza quel giorno (rimandi compresi) o un cambio biancheria
  const attive_ = attive(bookings)
  for (const g of s) {
    const attesa = CAMERE.filter(r => {
      if (g.giorno === oggi) return pulizieAperte(attive_, r.id, oggi, events).length > 0
      const partenza = attive_.some(b => b.room_id === r.id && b.check_out <= g.giorno && b.check_out >= CUTOFF_STORICO && !continuaIn(attive_, b)
        && (() => { const st = statoFineSoggiorno(attive_, b, events); return !st.chiusa && st.due === g.giorno })())
      const inCorso = attive_.find(b => b.room_id === r.id && b.check_in <= g.giorno && b.check_out > g.giorno)
      const biancheria = !!inCorso && cicloCambio(attive_, inCorso, events).due === g.giorno
      return partenza || biancheria
    }).length
    assert.equal(g.camere, attesa, `giorno ${g.giorno}`)
    assert.equal(g.camere, camereDaPreparareGiorno(CAMERE, bookings, events, g.giorno, oggi), `funzione condivisa, giorno ${g.giorno}`)
  }
  // I valori attesi dello scenario, a mano
  const per = Object.fromEntries(s.map(g => [g.giorno, g.camere]))
  assert.equal(per['2026-09-05'], 0)   // la partenza di oggi in Ambra è già segnata fatta
  assert.equal(per['2026-09-07'], 1)   // Amelia parte; il cambio biancheria di Allegra è stato fatto l'8 (rettifica)
  assert.equal(per['2026-09-09'], 1)   // Ambra: cambio camera (Lucia va in Lena); Lena non conta (arrivo)
  assert.equal(per['2026-09-11'], 0)   // partenza da Lena rimandata…
  assert.equal(per['2026-09-13'], 1)   // …al 13
  assert.equal(per['2026-09-12'], 1)   // Allegra: cambio biancheria (8 + 4 notti)
  assert.equal(per['2026-09-20'], 1)   // Allegra parte (l'in attesa in Lena non conta)
  assert.equal(per['2026-09-06'], 0)
  assert.deepEqual(s.filter(g => g.inizioSettimana).map(g => g.giorno), ['2026-09-12', '2026-09-19', '2026-09-26'])
  assert.equal(s[0].oggi, true); assert.equal(s.filter(g => g.oggi).length, 1)
})

test('lavori di un giorno: partenza e arrivo nella stessa camera = 1; cambio camera conta la camera lasciata; oggi include i ritardi', () => {
  seq = 0
  const bookings = [
    pren('amelia', '2026-09-02', '2026-09-06'), pren('amelia', '2026-09-06', '2026-09-08'),   // stessa camera: 1
    pren('ambra', '2026-09-01', '2026-09-03'),                                                // partenza il 3, mai segnata: in ritardo oggi
  ]
  assert.equal(camereDaPreparareGiorno(CAMERE, bookings, [], '2026-09-06', '2026-09-05'), 1)
  assert.deepEqual(pulizieDelGiorno(attive(bookings), 'amelia', '2026-09-06', '2026-09-05', []).map(p => p.tipo), ['fine_soggiorno'])
  assert.equal(camereDaPreparareGiorno(CAMERE, bookings, [], '2026-09-05', '2026-09-05'), 1)   // Ambra in ritardo
  assert.deepEqual(pulizieDelGiorno(attive(bookings), 'ambra', '2026-09-05', '2026-09-05', []).map(p => [p.tipo, p.ritardo]), [['fine_soggiorno', 2]])
  assert.equal(etichettaGiornoBreve('2026-09-05'), 'sab 5')
  assert.equal(etichettaGiornoBreve('2026-10-01'), 'gio 1')
  assert.equal(ultimoGiornoStriscia('2026-09-05'), '2026-10-02')
})
