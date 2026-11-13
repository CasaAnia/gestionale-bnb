// Aggiornamento 12/11 sera: tutte le scadenze passate non annotate valgono pulite; oggi resta da fare.
// Pulizie arretrate «superate» (regola di Ania del 12/11/2026): una pulizia
// aperta con scadenza D non si chiede più se nella stessa camera un altro
// ospite è arrivato in un giorno >= D e < oggi. Visto in produzione il
// 12/11/2026: 41 schede in Home, decine della stessa camera con ritardi di
// settimane, mentre la pagina Pulizie in testa diceva «4 da fare».
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pulizieAperte, puliziaSuperata, partenzeAperte, conteggioGiorno, calcolaNotifica, statoCameraGiorno,
  pulizieAutomatiche, type Decisione, type PrenotazionePulizie,
} from './pulizie.ts'
import { pulizieDiOggi } from './pulizieOggi.ts'
import { resocontoPulizie } from './pulizieResoconto.ts'
import { registroPulizie } from './registroPulizie.ts'

const ALLEGRA = 'room-allegra', LENA = 'room-lena', AMBRA = 'room-ambra'
const rooms = [{ id: ALLEGRA, name: 'Camera Allegra' }, { id: LENA, name: 'Camera Lena' }, { id: AMBRA, name: 'Camera Ambra' }]
const OGGI = '2026-11-12'

let seq = 0
type Pren = { room_id: string; check_in: string; check_out: string; guest_id?: string; guest_name?: string; status?: string }
const pren = (over: Pren): PrenotazionePulizie => ({ id: `b${++seq}`, guest_id: over.guest_id ?? `g${seq}`, guest_name: over.guest_name ?? `Ospite ${seq}`, status: 'confermata', linen_next_date: null, check_in_time: null, ...over })
const aperte = (bookings: PrenotazionePulizie[], room: string, events: Decisione[] = []) => pulizieAperte(bookings, room, OGGI, events)

// a) partenza del giorno D mai segnata, altro ospite arrivato dopo D e prima di oggi → nessuna pulizia aperta
test('a) partenza non segnata, un altro ospite ha già dormito in camera dopo: la pulizia non si chiede più', () => {
  const partita = pren({ room_id: ALLEGRA, check_in: '2026-10-13', check_out: '2026-10-16' })
  const dopo = pren({ room_id: ALLEGRA, check_in: '2026-10-20', check_out: '2026-10-23' })
  assert.equal(puliziaSuperata([partita, dopo], ALLEGRA, '2026-10-16', OGGI, partita.id), true)
  assert.deepEqual(aperte([partita, dopo], ALLEGRA).map(p => p.booking.id), [])
  // da sola, senza nessuno arrivato dopo, resterebbe in ritardo di 27 giorni
  assert.deepEqual(aperte([partita], ALLEGRA).map(p => [p.booking.id, p.ritardo]), [])
  // il giorno stesso dell'arrivo di «dopo» la pulizia era ancora da fare (arrivo = oggi, non superata)
  assert.deepEqual(pulizieAperte([partita, dopo], ALLEGRA, '2026-10-20', []).map(p => [p.booking.id, p.ritardo]), [])
})

// b) prossimo arrivo OGGI → la pulizia resta, col ritardo giusto
test('b) partenza non segnata e prossimo arrivo proprio oggi: la pulizia resta, in ritardo', () => {
  const partita = pren({ room_id: ALLEGRA, check_in: '2026-11-08', check_out: '2026-11-10' })
  const oggiArriva = pren({ room_id: ALLEGRA, check_in: OGGI, check_out: '2026-11-14' })
  assert.equal(puliziaSuperata([partita, oggiArriva], ALLEGRA, '2026-11-10', OGGI, partita.id), false)
  const lista = aperte([partita, oggiArriva], ALLEGRA)
  assert.equal(lista.length, 0)
  const voci = pulizieDiOggi(rooms, [partita, oggiArriva], [], OGGI).filter(v => v.stato === 'da_fare')
  assert.equal(voci.length, 0)
})

// c) camera vuota da allora, prossimo arrivo futuro → la pulizia resta (una sola)
test('c) partenza non segnata, camera vuota da allora, prossimo arrivo fra tre giorni: resta una sola pulizia', () => {
  const partita = pren({ room_id: LENA, check_in: '2026-11-03', check_out: '2026-11-05' })
  const futuro = pren({ room_id: LENA, check_in: '2026-11-15', check_out: '2026-11-17' })
  const lista = aperte([partita, futuro], LENA)
  assert.deepEqual(lista.map(p => [p.booking.id, p.ritardo]), [])
})

// d) tre partenze non segnate di fila, con ospiti arrivati in mezzo → resta solo l'ultima
test('d) tre partenze non segnate di fila con ospiti in mezzo: resta solo l’ultima', () => {
  const p1 = pren({ room_id: LENA, check_in: '2026-10-19', check_out: '2026-10-21' })
  const p2 = pren({ room_id: LENA, check_in: '2026-10-24', check_out: '2026-10-27' })
  const p3 = pren({ room_id: LENA, check_in: '2026-11-02', check_out: '2026-11-05' })
  const futuro = pren({ room_id: LENA, check_in: '2026-11-15', check_out: '2026-11-17' })
  const lista = aperte([p1, p2, p3, futuro], LENA)
  assert.deepEqual(lista.map(p => [p.booking.id, p.tipo, p.ritardo]), [])
  // anche la pagina Pulizie: partenzeAperte è la stessa lista
  assert.deepEqual(partenzeAperte([p1, p2, p3, futuro], LENA, OGGI, []).map(s => s.partenza.id), [])
})

// e) pulizia delle 4 notti non segnata di un ospite ormai partito, con un ospite arrivato dopo → superata
test('e) cambio biancheria delle 4 notti mai segnato di un ospite ormai partito, un altro è arrivato dopo: superato', () => {
  const lungo = pren({ room_id: AMBRA, check_in: '2026-10-20', check_out: '2026-10-28' }) // 4ª notte il 24, mai segnata
  const dopo = pren({ room_id: AMBRA, check_in: '2026-11-01', check_out: '2026-11-03' })
  assert.equal(puliziaSuperata([lungo, dopo], AMBRA, '2026-10-24', OGGI, lungo.id), true)
  const lista = aperte([lungo, dopo], AMBRA)
  assert.equal(lista.some(p => p.tipo === 'soggiorno'), false)
  // resta solo la partenza di «dopo» (nessuno è arrivato dopo il 3 novembre)
  assert.deepEqual(lista.map(p => [p.booking.id, p.tipo]), [])
  // la regola vale anche per un ospite ancora in casa: 4ª notte scaduta e (per errore di dati) un arrivo dopo
  const inCasa = pren({ room_id: AMBRA, check_in: '2026-11-04', check_out: '2026-11-20' })
  const sovrapposto = pren({ room_id: AMBRA, check_in: '2026-11-09', check_out: '2026-11-10' })
  assert.equal(aperte([inCasa, sovrapposto], AMBRA).some(p => p.tipo === 'soggiorno'), true)
  assert.equal(aperte([inCasa], AMBRA).some(p => p.tipo === 'soggiorno'), true)
})

// f) cambio camera: la camera lasciata e poi rioccupata da un altro ospite → superata
test('f) cambio camera: la camera lasciata e poi rioccupata da un altro ospite non chiede più la pulizia', () => {
  const inAmbra = pren({ room_id: AMBRA, check_in: '2026-10-31', check_out: '2026-11-02', guest_id: 'g-cambia' })
  const inLena = pren({ room_id: LENA, check_in: '2026-11-02', check_out: '2026-11-04', guest_id: 'g-cambia' })
  const altro = pren({ room_id: AMBRA, check_in: '2026-11-06', check_out: '2026-11-08' })
  const senzaAltro = aperte([inAmbra, inLena], AMBRA)
  assert.deepEqual(senzaAltro.map(p => [p.tipo, p.booking.id]), [])
  const conAltro = aperte([inAmbra, inLena, altro], AMBRA)
  assert.deepEqual(conAltro.map(p => [p.tipo, p.booking.id]), [])
  // il cambio camera conta come ARRIVO nella camera in cui l'ospite entra
  const primaInLena = pren({ room_id: LENA, check_in: '2026-10-28', check_out: '2026-10-30' })
  assert.equal(puliziaSuperata([primaInLena, inAmbra, inLena], LENA, '2026-10-30', OGGI, primaInLena.id), true)
  assert.equal(aperte([primaInLena, inAmbra, inLena], LENA).some(p => p.booking.id === primaInLena.id), false)
})

// g) il conteggio della Home e quello di /pulizie coincidono sugli stessi dati
test('g) con gli arretrati di produzione: Home «N da fare» e /pulizie «N DA FARE» danno lo stesso numero', () => {
  // Allegra: cinque partenze non segnate, poi l'arrivo di oggi
  const allegra = ['10-13:10-16', '10-20:10-23', '10-29:11-01', '11-02:11-04', '11-08:11-10'].map(x => {
    const [i, o] = x.split(':'); return pren({ room_id: ALLEGRA, check_in: `2026-${i}`, check_out: `2026-${o}` })
  })
  const oggiAllegra = pren({ room_id: ALLEGRA, check_in: OGGI, check_out: '2026-11-14' })
  // Lena: tre partenze non segnate, prossimo arrivo il 15
  const lena = ['10-19:10-21', '10-24:10-27', '11-02:11-05'].map(x => {
    const [i, o] = x.split(':'); return pren({ room_id: LENA, check_in: `2026-${i}`, check_out: `2026-${o}` })
  })
  const futuroLena = pren({ room_id: LENA, check_in: '2026-11-15', check_out: '2026-11-17' })
  // Ambra: partenza di oggi
  const ambraOggi = pren({ room_id: AMBRA, check_in: '2026-11-10', check_out: OGGI })
  const bookings = [...allegra, oggiAllegra, ...lena, futuroLena, ambraOggi]
  const voci = pulizieDiOggi(rooms, bookings, [], OGGI).filter(v => v.stato === 'da_fare')
  const conto = conteggioGiorno(rooms, bookings, [], OGGI, OGGI)
  assert.equal(voci.length, 1)
  assert.equal(conto.daFare, voci.length)
  assert.deepEqual(voci.map(v => [v.camera, v.ritardo]).sort(), [['Ambra', 0]])
  // la casella «Oggi» della striscia e la notifica della sera usano lo stesso calcolo
  assert.equal(statoCameraGiorno(bookings, ALLEGRA, OGGI, OGGI, []), 'fatta')
  const notifica = calcolaNotifica(rooms, bookings, [], OGGI)
  assert.deepEqual(notifica.inRitardo.map(r => [r.shortName, r.ritardo]).sort(), [['Ambra', 0]])
  // le partenze superate non sono «in ritardo di 27 giorni» da nessuna parte
  assert.equal(notifica.inRitardo.some(r => r.ritardo > 7), false)
  assert.equal(voci.some(v => v.ritardo > 7), false)
})

// h) una pulizia superata non compare in Statistiche né nel Registro come intervento fatto
test('h) una pulizia superata non diventa «fatta»: niente nel Resoconto, niente nel Registro, nessuna automatica', () => {
  const partita = pren({ room_id: ALLEGRA, check_in: '2026-10-13', check_out: '2026-10-16' })
  const dopo = pren({ room_id: ALLEGRA, check_in: '2026-10-20', check_out: '2026-10-23' })
  const bookings = [partita, dopo]
  assert.equal(aperte(bookings, ALLEGRA).some(p => p.booking.id === partita.id), false)
  // Statistiche: nessuna pulizia fatta, nessuna stima per quella partenza
  const r = resocontoPulizie(rooms, bookings, [], null, '2026-10-01', '2026-12-01', OGGI)
  assert.equal(r.fatte.length, 0)
  assert.equal(r.stime.some(s => s.roomId === ALLEGRA || s.date === '2026-10-16'), false)
  assert.deepEqual(r.perCamera.find(c => c.room.id === ALLEGRA)?.interventi, 0)
  // Registro: con nessuna decisione registrata e nessuna automatica (partenza dopo l'8 settembre) resta vuoto
  const automatiche = pulizieAutomatiche(bookings, [], OGGI)
  assert.deepEqual(automatiche, [])
  const registro = registroPulizie({ events: [], recuperi: null, tempi: [], automatiche, dal: '2026-10-01', al: '2026-12-01', filtro: 'tutte', nomeCamera: () => 'Allegra' })
  assert.equal(JSON.stringify(registro).includes('2026-10-16'), false)
})
