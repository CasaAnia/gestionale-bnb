// «Pulizie di oggi» in Home (07/09/2026): voci da spuntare, automatiche, fatte
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pulizieDiOggi, riassuntoPulizieOggi, testoRitardo, dataBreve } from './pulizieOggi.ts'
import { NOTA_AUTOMATICA_CORRETTA, type Decisione } from './pulizie.ts'

const AMBRA = 'room-ambra', LENA = 'room-lena', AMELIA = 'room-amelia', ALLEGRA = 'room-allegra'
const rooms = [
  { id: AMELIA, name: 'Camera Amelia' }, { id: ALLEGRA, name: 'Camera Allegra' }, { id: AMBRA, name: 'Camera Ambra' }, { id: LENA, name: 'Camera Lena' },
]
const OGGI = '2026-09-07'
let seq = 0
type Pren = { room_id: string; check_in: string; check_out: string; guest_name?: string; check_in_time?: string | null }
const pren = (over: Pren) => ({ id: `b${++seq}`, guest_id: `g${seq}`, guest_name: over.guest_name ?? `Ospite ${seq}`, status: 'confermata', linen_next_date: null, check_in_time: null, ...over })
let evSeq = 0
const dec = (over: Partial<Decisione>): Decisione => ({ id: `e${++evSeq}`, created_at: `2026-09-07T08:${String(10 + evSeq).padStart(2, '0')}:00Z`, room_id: AMBRA, booking_id: null, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: OGGI, ...over })

test('partenza di oggi senza arrivo vicino: da fare, con la pulizia da segnare', () => {
  const rossi = pren({ room_id: AMBRA, check_in: '2026-09-04', check_out: OGGI, guest_name: 'Mario Rossi' })
  const bianchi = pren({ room_id: AMBRA, check_in: '2026-09-10', check_out: '2026-09-12', guest_name: 'Luca Bianchi' })
  const voci = pulizieDiOggi(rooms, [rossi, bianchi], [], OGGI)
  assert.equal(voci.length, 1)
  const v = voci[0]
  assert.equal(v.stato, 'da_fare'); assert.equal(v.camera, 'Ambra'); assert.equal(v.riga, 'è partito Mario Rossi'); assert.equal(v.ritardo, 0)
  assert.deepEqual(v.daSegnare, { room_id: AMBRA, booking_id: rossi.id, tipo: 'fine_soggiorno', data_prevista: OGGI })
  assert.equal(riassuntoPulizieOggi(voci), '1 da fare')
})

test('in ritardo: partenza di due giorni fa mai segnata, con l’arrivo di oggi alle 16', () => {
  const vecchia = pren({ room_id: LENA, check_in: '2026-09-01', check_out: '2026-09-05', guest_name: 'Anna Verdi' })
  const arrivo = pren({ room_id: LENA, check_in: OGGI, check_out: '2026-09-09', guest_name: 'Piotr Nowak', check_in_time: '16:00' })
  const voci = pulizieDiOggi(rooms, [vecchia, arrivo], [], OGGI)
  assert.equal(voci.length, 1)
  assert.equal(voci[0].stato, 'da_fare'); assert.equal(voci[0].ritardo, 2); assert.equal(voci[0].priorita, 'urgente')
  assert.equal(voci[0].riga, 'partenza del 5 settembre · Anna Verdi · arriva Piotr Nowak alle 16:00')
  assert.equal(riassuntoPulizieOggi(voci), '1 da fare · 1 in ritardo')
  assert.equal(testoRitardo(2), 'in ritardo di 2 giorni'); assert.equal(testoRitardo(1), 'in ritardo di 1 giorno'); assert.equal(testoRitardo(0), '')
})

test('cambio ospite lo stesso giorno: automatica, niente da spuntare', () => {
  const parte = pren({ room_id: AMELIA, check_in: '2026-09-03', check_out: OGGI, guest_name: 'Ewa Lis' })
  const entra = pren({ room_id: AMELIA, check_in: OGGI, check_out: '2026-09-10', guest_name: 'Jan Buco' })
  const voci = pulizieDiOggi(rooms, [parte, entra], [], OGGI)
  assert.equal(voci.length, 1)
  assert.equal(voci[0].stato, 'automatica'); assert.equal(voci[0].daSegnare, undefined); assert.equal(voci[0].annullabile, false)
  assert.equal(voci[0].riga, 'è partito Ewa Lis · arriva Jan Buco · registrata da sola')
  assert.equal(riassuntoPulizieOggi(voci), 'tutte fatte')
})

test('cambio biancheria delle 4 notti scaduto oggi: da fare, «resta · cambio biancheria»', () => {
  const lungo = pren({ room_id: ALLEGRA, check_in: '2026-09-03', check_out: '2026-09-12', guest_name: 'Marta Ricovero' })
  const voci = pulizieDiOggi(rooms, [lungo], [], OGGI)
  assert.equal(voci.length, 1)
  assert.equal(voci[0].stato, 'da_fare'); assert.equal(voci[0].tipo, 'soggiorno'); assert.equal(voci[0].riga, 'Marta Ricovero resta · cambio biancheria')
  assert.equal(voci[0].daSegnare?.data_prevista, OGGI)
})

test('segnata fatta oggi: voce «fatta» con l’ora di Roma, annullabile; rimandata a domani: sparisce', () => {
  const rossi = pren({ room_id: AMBRA, check_in: '2026-09-04', check_out: OGGI, guest_name: 'Mario Rossi' })
  const fatta = dec({ booking_id: rossi.id, data_effettiva: OGGI, created_at: '2026-09-07T08:40:00Z' })
  const voci = pulizieDiOggi(rooms, [rossi], [fatta], OGGI)
  assert.equal(voci.length, 1)
  assert.equal(voci[0].stato, 'fatta'); assert.equal(voci[0].oraFatta, '10:40'); assert.equal(voci[0].annullabile, true)
  assert.equal(voci[0].riga, 'è partito Mario Rossi · fatta alle 10:40'); assert.equal(voci[0].decisione, fatta)
  assert.equal(riassuntoPulizieOggi(voci), 'tutte fatte')
  const rimandata = dec({ booking_id: rossi.id, stato: 'rimandata', prossima_data: '2026-09-08' })
  assert.deepEqual(pulizieDiOggi(rooms, [rossi], [rimandata], OGGI), [])
  // correzione di un'automatica (con nota): fatta ma NON annullabile
  const corretta = dec({ booking_id: rossi.id, data_effettiva: OGGI, note: NOTA_AUTOMATICA_CORRETTA })
  assert.equal(pulizieDiOggi(rooms, [rossi], [corretta], OGGI)[0].annullabile, false)
})

test('ordine: da fare per urgenza e ritardo, poi automatiche, poi fatte; camere inattive escluse', () => {
  const ambraOut = pren({ room_id: AMBRA, check_in: '2026-09-04', check_out: OGGI, guest_name: 'A Ambra' })
  // Lena: partita il 4, nuovo arrivo oggi → non è un cambio ospite automatico (più di un giorno): da fare, urgente, 3 giorni di ritardo
  const lenaOut = pren({ room_id: LENA, check_in: '2026-09-01', check_out: '2026-09-04', guest_name: 'B Lena' })
  const lenaIn = pren({ room_id: LENA, check_in: OGGI, check_out: '2026-09-09', guest_name: 'C Lena' })
  const ameliaOut = pren({ room_id: AMELIA, check_in: '2026-09-03', check_out: OGGI, guest_name: 'D Amelia' })
  const ameliaIn = pren({ room_id: AMELIA, check_in: OGGI, check_out: '2026-09-10', guest_name: 'E Amelia' })
  const allegraOut = pren({ room_id: ALLEGRA, check_in: '2026-09-02', check_out: OGGI, guest_name: 'F Allegra' })
  const fatta = dec({ room_id: ALLEGRA, booking_id: allegraOut.id, data_effettiva: OGGI })
  const voci = pulizieDiOggi(rooms, [ambraOut, lenaOut, lenaIn, ameliaOut, ameliaIn, allegraOut], [fatta], OGGI)
  assert.deepEqual(voci.map(v => `${v.stato}:${v.camera}`), ['da_fare:Lena', 'da_fare:Ambra', 'automatica:Amelia', 'fatta:Allegra'])
  assert.equal(voci[0].ritardo, 3); assert.equal(voci[0].priorita, 'urgente')
  // partita ieri e arrivo oggi = cambio ospite automatico di IERI: non è lavoro di oggi, non compare (come la striscia)
  const ieriOut = pren({ room_id: LENA, check_in: '2026-09-01', check_out: '2026-09-06', guest_name: 'G Lena' })
  assert.deepEqual(pulizieDiOggi(rooms, [ieriOut, lenaIn], [], OGGI), [])
  assert.equal(riassuntoPulizieOggi(voci), '2 da fare · 1 in ritardo')
  const senzaLena = pulizieDiOggi(rooms.map(r => (r.id === LENA ? { ...r, active: false } : r)), [ambraOut, lenaOut, lenaIn], [], OGGI)
  assert.deepEqual(senzaLena.map(v => v.camera), ['Ambra'])
  assert.equal(riassuntoPulizieOggi([]), '')
  assert.equal(dataBreve('2026-09-05'), '5 settembre')
})
