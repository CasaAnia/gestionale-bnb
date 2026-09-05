// Matrice di test dell'audit Pulizie (24 agosto 2026), approvata da Ania.
// Gira con `npm test`. I due casi reali del 23 agosto sono in fondo:
// se una modifica futura li rompe, si vede qui prima di pubblicare.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attive, cicloCambio, statoFineSoggiorno, partenzaAperta, pulizieAperte,
  prossimoArrivo, prioritaDi, testoArrivo, calcolaNotifica, addDaysStr,
  cronologiaCamera, pulizieAutomatiche, NOTA_AUTOMATICA_CORRETTA, NOTA_AUTOMATICA_TOLTA,
  type Decisione,
} from './pulizie.ts'

const AMBRA = 'room-ambra'
const LENA = 'room-lena'
const AMELIA = 'room-amelia'
const rooms = [
  { id: AMBRA, name: 'Camera Ambra' },
  { id: LENA, name: 'Camera Lena' },
  { id: AMELIA, name: 'Camera Amelia' },
]

let seq = 0
function prenotazione(over: any) {
  return {
    id: `b${++seq}`, guest_id: over.guest_id ?? `g${seq}`, guest_name: over.guest_name ?? `Ospite ${seq}`,
    status: 'confermata', linen_next_date: null, check_in_time: null, ...over,
  }
}
let evSeq = 0
function decisione(over: Partial<Decisione>): Decisione {
  return {
    id: `e${++evSeq}`, created_at: `2026-08-01T00:00:${String(++evSeq).padStart(2, '0')}Z`,
    room_id: over.room_id ?? AMBRA, booking_id: over.booking_id ?? null,
    tipo: over.tipo ?? 'soggiorno', stato: over.stato ?? 'fatta',
    data_prevista: over.data_prevista ?? '2026-08-20', ...over,
  }
}

// Soggiorno lungo base: ospite in Ambra dal 16 agosto al 1 settembre
const lungo = prenotazione({ room_id: AMBRA, check_in: '2026-08-16', check_out: '2026-09-01' })

test('prevista il 20 e fatta il 20 → prossima il 24', () => {
  const events = [decisione({ booking_id: lungo.id, stato: 'fatta', data_prevista: '2026-08-20', data_effettiva: '2026-08-20' })]
  assert.equal(cicloCambio([lungo], lungo, events).due, '2026-08-24')
})

test('rimandata di 1 giorno (20 → 21), poi fatta il 21 → prossima il 25', () => {
  const events = [
    decisione({ booking_id: lungo.id, stato: 'rimandata', data_prevista: '2026-08-20', prossima_data: '2026-08-21' }),
    decisione({ booking_id: lungo.id, stato: 'fatta', data_prevista: '2026-08-21', data_effettiva: '2026-08-21' }),
  ]
  assert.equal(cicloCambio([lungo], lungo, events).due, '2026-08-25')
})

test('rimandata di 2 giorni, fatta il 22 → prossima il 26', () => {
  const events = [
    decisione({ booking_id: lungo.id, stato: 'rimandata', data_prevista: '2026-08-20', prossima_data: '2026-08-22' }),
    decisione({ booking_id: lungo.id, stato: 'fatta', data_prevista: '2026-08-22', data_effettiva: '2026-08-22' }),
  ]
  assert.equal(cicloCambio([lungo], lungo, events).due, '2026-08-26')
})

test('rimandata più volte (20 → 22 → 23): resta aperta e lo storico tiene i 2 rinvii', () => {
  const events = [
    decisione({ booking_id: lungo.id, stato: 'rimandata', data_prevista: '2026-08-20', prossima_data: '2026-08-22' }),
    decisione({ booking_id: lungo.id, stato: 'rimandata', data_prevista: '2026-08-22', prossima_data: '2026-08-23' }),
  ]
  const ciclo = cicloCambio([lungo], lungo, events)
  assert.equal(ciclo.due, '2026-08-23')
  assert.equal(ciclo.rinvii.length, 2)
  assert.equal(ciclo.prevista, '2026-08-20') // la scadenza originale, per "rimandata dal 20 al 23"
})

test('saltata il 20 → proposta il 24; fatta davvero il 25 → prossima il 29 (esempio di Ania)', () => {
  const salto = [decisione({ booking_id: lungo.id, stato: 'saltata', data_prevista: '2026-08-20', prossima_data: '2026-08-24' })]
  assert.equal(cicloCambio([lungo], lungo, salto).due, '2026-08-24')
  const poi = [...salto, decisione({ booking_id: lungo.id, stato: 'fatta', data_prevista: '2026-08-24', data_effettiva: '2026-08-25' })]
  assert.equal(cicloCambio([lungo], lungo, poi).due, '2026-08-29')
})

test('due salti di fila (20 e 24) → proposta il 28', () => {
  const events = [
    decisione({ booking_id: lungo.id, stato: 'saltata', data_prevista: '2026-08-20', prossima_data: '2026-08-24' }),
    decisione({ booking_id: lungo.id, stato: 'saltata', data_prevista: '2026-08-24', prossima_data: '2026-08-28' }),
  ]
  assert.equal(cicloCambio([lungo], lungo, events).due, '2026-08-28')
})

test('soggiorno prolungato: le 4 notti non ripartono e al confine non c\'è nessuna finta partenza', () => {
  const a = prenotazione({ guest_id: 'g-p', room_id: AMBRA, check_in: '2026-08-16', check_out: '2026-08-20' })
  const b = prenotazione({ guest_id: 'g-p', room_id: AMBRA, check_in: '2026-08-20', check_out: '2026-08-28' })
  const ciclo = cicloCambio([a, b], b, [])
  assert.equal(ciclo.due, '2026-08-20') // check-in del PRIMO segmento + 4
  // Il 20 agosto non è una partenza aperta (il soggiorno continua)
  assert.equal(partenzaAperta([a, b], AMBRA, '2026-08-24', []), null)
})

test('nessun cambio se cadrebbe alla partenza o dopo', () => {
  const corto = prenotazione({ room_id: AMBRA, check_in: '2026-08-20', check_out: '2026-08-24' })
  assert.equal(cicloCambio([corto], corto, []).due, null)
})

test('partenza senza prossimo arrivo: nessuna fretta, e resta in lista anche nei giorni dopo', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-22', check_out: '2026-08-25' })
  const oggi = '2026-08-25'
  const aperte = pulizieAperte([p], AMBRA, oggi, [])
  assert.equal(aperte.length, 1)
  assert.equal(prioritaDi(aperte[0], prossimoArrivo([p], AMBRA, oggi)), 'nessuna_fretta')
  assert.equal(testoArrivo(prossimoArrivo([p], AMBRA, oggi)), 'Nessun arrivo previsto')
  // due giorni dopo, mai segnata fatta: è ancora lì, in ritardo
  const dopo = pulizieAperte([p], AMBRA, '2026-08-27', [])
  assert.equal(dopo.length, 1)
  assert.equal(dopo[0].ritardo, 2)
  // segnata fatta → sparisce
  const fatta = [decisione({ booking_id: p.id, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-08-25', data_effettiva: '2026-08-27' })]
  assert.equal(pulizieAperte([p], AMBRA, '2026-08-27', fatta).length, 0)
})

test('partenza + arrivo lo stesso giorno → URGENTE', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-22', check_out: '2026-08-25' })
  const a = prenotazione({ room_id: AMBRA, check_in: '2026-08-25', check_out: '2026-08-28', check_in_time: '15:00' })
  const oggi = '2026-08-25'
  const aperte = pulizieAperte([p, a], AMBRA, oggi, [])
  const arrivo = prossimoArrivo([p, a], AMBRA, oggi)
  assert.equal(prioritaDi(aperte[0], arrivo), 'urgente')
  assert.equal(testoArrivo(arrivo), 'Prossimo arrivo: oggi alle 15:00')
})

test('partenza + arrivo domani → ALTA; tra 3 giorni → FLESSIBILE', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-22', check_out: '2026-08-25' })
  const domani = prenotazione({ room_id: AMBRA, check_in: '2026-08-26', check_out: '2026-08-28' })
  const oggi = '2026-08-25'
  assert.equal(prioritaDi(pulizieAperte([p, domani], AMBRA, oggi, [])[0], prossimoArrivo([p, domani], AMBRA, oggi)), 'alta')
  const tra3 = prenotazione({ room_id: AMBRA, check_in: '2026-08-28', check_out: '2026-08-30' })
  assert.equal(prioritaDi(pulizieAperte([p, tra3], AMBRA, oggi, [])[0], prossimoArrivo([p, tra3], AMBRA, oggi)), 'flessibile')
})

test('cambio camera: la partenza è tipo cambio_camera e l\'arrivo sa da dove viene', () => {
  const prima = prenotazione({ guest_id: 'g-rosa', guest_name: 'Rosa', room_id: AMBRA, check_in: '2026-09-01', check_out: '2026-09-07' })
  const dopo = prenotazione({ guest_id: 'g-rosa', guest_name: 'Rosa', room_id: AMELIA, check_in: '2026-09-07', check_out: '2026-09-11' })
  const st = statoFineSoggiorno([prima, dopo], prima, [])
  assert.equal(st.tipo, 'cambio_camera')
  assert.equal(st.cambioCameraVerso?.id, dopo.id)
  const arrivo = prossimoArrivo([prima, dopo], AMELIA, '2026-09-07')
  assert.equal(arrivo?.cambioDa?.id, prima.id)
  assert.equal(prioritaDi(pulizieAperte([prima, dopo], AMBRA, '2026-09-07', [])[0], null), 'nessuna_fretta')
})

test('fine soggiorno rimandata a una data: fino ad allora non è "da fare oggi"', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-22', check_out: '2026-08-25' })
  const rimando = [decisione({ booking_id: p.id, tipo: 'fine_soggiorno', stato: 'rimandata', data_prevista: '2026-08-25', prossima_data: '2026-08-27' })]
  assert.equal(pulizieAperte([p], AMBRA, '2026-08-26', rimando).length, 0)
  const il27 = pulizieAperte([p], AMBRA, '2026-08-27', rimando)
  assert.equal(il27.length, 1)
  assert.equal(il27[0].due, '2026-08-27')
})

// ---------------------------------------------------------- casi reali 23/08

test('CASO REALE 1 · Ambra e Lena, scadenza 22/08 mai segnata: una sola sera di "domani", poi solo "in ritardo"', () => {
  // Ambra: Rosa dal 6/08 all'1/09, data salvata nell'app = 22/08
  const rosa = prenotazione({ guest_id: 'g-rosa', guest_name: 'Rosa Macauda', room_id: AMBRA, check_in: '2026-08-06', check_out: '2026-09-01', linen_next_date: '2026-08-22' })
  // Lena: Mario dal 18/08 al 29/08, nessuna data → regola base 18 + 4 = 22
  const mario = prenotazione({ guest_id: 'g-mario', guest_name: 'Mario Tornatore', room_id: LENA, check_in: '2026-08-18', check_out: '2026-08-29' })
  const bookings = [rosa, mario]

  // Sera del 21: notifica corretta, entrambe in scadenza domani (22)
  const sera21 = calcolaNotifica(rooms, bookings, [], '2026-08-21')
  assert.equal(sera21.domani.filter(r => r.tipo === 'soggiorno').length, 2)

  // Sere del 22 e del 23: NIENTE più "domani"; compaiono solo come arretrato
  for (const oggi of ['2026-08-22', '2026-08-23']) {
    const n = calcolaNotifica(rooms, bookings, [], oggi)
    assert.equal(n.domani.length, 0, `nessuna riga "domani" la sera del ${oggi}`)
    assert.equal(n.inRitardo.length, 2)
  }
  const sera23 = calcolaNotifica(rooms, bookings, [], '2026-08-23')
  assert.match(sera23.inRitardo[0].testo, /in ritardo di 1 giorno/)

  // Una volta segnate fatte: mai più notifiche per quella scadenza
  const fatte = [
    decisione({ booking_id: rosa.id, stato: 'fatta', data_prevista: '2026-08-22', data_effettiva: '2026-08-24' }),
    decisione({ booking_id: mario.id, room_id: LENA, stato: 'fatta', data_prevista: '2026-08-22', data_effettiva: '2026-08-24' }),
  ]
  const dopo = calcolaNotifica(rooms, bookings, fatte, '2026-08-24')
  assert.equal(dopo.domani.length, 0)
  assert.equal(dopo.inRitardo.length, 0)
  // e il ciclo riparte dalla data effettiva: prossima il 28
  assert.equal(cicloCambio(bookings, rosa, fatte).due, '2026-08-28')
})

test('CASO REALE 2 · richiesta dal sito "in attesa" con check-out oggi: non è un ospite', () => {
  const inAttesa = prenotazione({ room_id: AMBRA, guest_name: 'Anna Sawicka', status: 'in_attesa', check_in: '2026-08-22', check_out: '2026-08-23' })
  const confermata = prenotazione({ room_id: LENA, check_in: '2026-08-20', check_out: '2026-08-23' })
  const filtrate = attive([inAttesa, confermata])
  assert.equal(filtrate.length, 1)
  assert.equal(filtrate[0].id, confermata.id)
  // e non genera pulizie né righe di notifica
  const n = calcolaNotifica(rooms, [inAttesa], [], '2026-08-22')
  assert.equal(n.domani.length, 0)
  assert.equal(n.inRitardo.length, 0)
})

test('la notifica del giorno prima cita orario d\'arrivo e cambio camera', () => {
  // Amelia: Sig.ra parte domani, nuovo arrivo domani stesso alle 14:30
  const parte = prenotazione({ room_id: AMELIA, guest_name: 'Sig. Siciliana', check_in: '2026-08-18', check_out: '2026-08-25' })
  const arriva = prenotazione({ room_id: AMELIA, guest_name: 'Roberta', check_in: '2026-08-25', check_out: '2026-08-28', check_in_time: '14:30' })
  const n = calcolaNotifica(rooms, [parte, arriva], [], '2026-08-24')
  assert.equal(n.domani.length, 1)
  assert.match(n.domani[0].testo, /fine soggiorno/)
  assert.match(n.domani[0].testo, /14:30/)
  assert.match(n.domani[0].testo, /URGENTE/)
})

// ---------------------------------------------------------------- cronologia

test('CRONOLOGIA · le date del vecchio sistema sono "ricostruite", mai "fatte" (caso Rosa)', () => {
  // Rosa in Ambra dal 6/08, ultima scadenza vecchio sistema 22/08,
  // poi nel nuovo storico: fatta il 23 (era prevista il 22)
  const rosa = prenotazione({ guest_id: 'g-rosa', guest_name: 'Rosa Macauda', room_id: AMBRA, check_in: '2026-08-06', check_out: '2026-09-01', linen_next_date: '2026-08-22' })
  const events = [decisione({ booking_id: rosa.id, stato: 'fatta', data_prevista: '2026-08-22', data_effettiva: '2026-08-23' })]
  const voci = cronologiaCamera([rosa], AMBRA, '2026-08-24', events, rooms)

  // Catena ricostruita a ritroso: 10, 14, 18 — tutte marcate "ricostruita"
  const ricostruite = voci.filter(v => v.registro === 'ricostruita')
  assert.deepEqual(ricostruite.map(v => v.data), ['2026-08-10', '2026-08-14', '2026-08-18'])
  for (const v of ricostruite) assert.doesNotMatch(v.testo, /fatta/)

  // La pulizia vera: fatta il 23, era prevista il 22 — registro reale
  const fatta = voci.find(v => v.testo.startsWith('fatta'))
  assert.equal(fatta?.data, '2026-08-23')
  assert.equal(fatta?.registro, 'reale')

  // Una sola data futura di ciclo: 27 (23 + 4), col calcolo scritto
  const future = voci.filter(v => v.registro === 'futura' && v.testo.includes('prossima prevista'))
  assert.equal(future.length, 1)
  assert.equal(future[0].data, '2026-08-27')
  assert.match(future[0].testo, /23/)
})

test('CRONOLOGIA · un rinvio si legge "dal X al Y" e il check-in apre la storia', () => {
  const events = [
    decisione({ booking_id: lungo.id, stato: 'rimandata', data_prevista: '2026-08-20', prossima_data: '2026-08-22' }),
    decisione({ booking_id: lungo.id, stato: 'fatta', data_prevista: '2026-08-22', data_effettiva: '2026-08-23' }),
  ]
  const voci = cronologiaCamera([lungo], AMBRA, '2026-08-24', events, rooms)
  assert.equal(voci[0].testo, 'check-in di ' + lungo.guest_name)
  assert.ok(voci.some(v => v.registro === 'reale' && /rimandata dal 20 agosto al 22 agosto/.test(v.testo)))
  assert.ok(voci.some(v => v.registro === 'reale' && /fatta \(era prevista il 22 agosto\)/.test(v.testo)))
})

test('CRONOLOGIA · quando il ciclo si ferma lo spiega, senza inventare date future', () => {
  const corto = prenotazione({ guest_name: 'Breve', room_id: LENA, check_in: '2026-08-23', check_out: '2026-08-26' })
  const voci = cronologiaCamera([corto], LENA, '2026-08-24', [], rooms)
  const future = voci.filter(v => v.registro === 'futura')
  assert.ok(future.some(v => /nessun'altra pulizia del ciclo/.test(v.testo)))
  assert.ok(!voci.some(v => v.testo.includes('prossima prevista')))
})

test('addDaysStr scavalca i mesi correttamente', () => {
  assert.equal(addDaysStr('2026-08-29', 4), '2026-09-02')
  assert.equal(addDaysStr('2026-12-30', 4), '2027-01-03')
})

// ------------------------------------------- cambio ospite automatico (04/09)

test('AUTOMATICA · partenza e arrivo lo stesso giorno → pulizia fatta da sola, data = partenza', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-27', check_out: '2026-08-30' })
  const a = prenotazione({ room_id: AMBRA, check_in: '2026-08-30', check_out: '2026-09-02' })
  const auto = pulizieAutomatiche([p, a], [], '2026-09-04')
  assert.equal(auto.length, 1)
  assert.equal(auto[0].data, '2026-08-30')
  assert.equal(auto[0].partenza.id, p.id)
  assert.equal(auto[0].arrivo.id, a.id)
  assert.equal(auto[0].tipo, 'fine_soggiorno')
  // il giorno stesso resta in «Oggi» come lavoro, ma automatica e mai in ritardo
  const oggi = pulizieAperte([p, a], AMBRA, '2026-08-30', [])
  assert.equal(oggi.length, 1)
  assert.equal(oggi[0].automatica, true)
  assert.equal(oggi[0].ritardo, 0)
  assert.equal(prioritaDi(oggi[0], prossimoArrivo([p, a], AMBRA, '2026-08-30')), 'urgente')
})

test('AUTOMATICA · arrivo il giorno dopo → sì; due giorni dopo → no', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-27', check_out: '2026-08-30' })
  const domani = prenotazione({ room_id: AMBRA, check_in: '2026-08-31', check_out: '2026-09-02' })
  assert.equal(pulizieAutomatiche([p, domani], [], '2026-09-04').length, 1)
  const oggi = pulizieAperte([p, domani], AMBRA, '2026-08-30', [])
  assert.equal(oggi[0].automatica, true)
  assert.equal(prioritaDi(oggi[0], prossimoArrivo([p, domani], AMBRA, '2026-08-30')), 'alta')
  // ...ma la notifica della sera non la conta fra gli arretrati
  assert.equal(calcolaNotifica(rooms, [p, domani], [], '2026-08-30').inRitardo.length, 0)

  const dueGiorni = prenotazione({ room_id: AMBRA, check_in: '2026-09-01', check_out: '2026-09-03' })
  assert.equal(pulizieAutomatiche([p, dueGiorni], [], '2026-09-04').length, 0)
  const aperta = pulizieAperte([p, dueGiorni], AMBRA, '2026-08-30', [])
  assert.equal(aperta.length, 1)
  assert.equal(aperta[0].automatica, undefined)
})

test('AUTOMATICA · partenza senza arrivo → niente: si segna a mano come oggi', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-27', check_out: '2026-08-30' })
  assert.equal(pulizieAutomatiche([p], [], '2026-09-04').length, 0)
  const dopo = pulizieAperte([p], AMBRA, '2026-09-01', [])
  assert.equal(dopo.length, 1)
  assert.equal(dopo[0].ritardo, 2)
  assert.equal(calcolaNotifica(rooms, [p], [], '2026-09-01').inRitardo.length, 1)
})

test('AUTOMATICA · pulizia manuale già segnata lo stesso giorno nella camera → nessun doppione', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-27', check_out: '2026-08-30' })
  const a = prenotazione({ room_id: AMBRA, check_in: '2026-08-30', check_out: '2026-09-02' })
  const manuale = [decisione({ room_id: AMBRA, booking_id: p.id, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-08-30', data_effettiva: '2026-08-30' })]
  assert.equal(pulizieAutomatiche([p, a], manuale, '2026-09-04').length, 0)
  // anche se la riga manuale non è legata alla prenotazione (stessa camera, stesso giorno)
  const sciolta = [decisione({ room_id: AMBRA, booking_id: null, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-08-30', data_effettiva: '2026-08-30' })]
  assert.equal(pulizieAutomatiche([p, a], sciolta, '2026-09-04').length, 0)
  // in un'altra camera lo stesso giorno non c'entra
  const altra = [decisione({ room_id: LENA, booking_id: null, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-08-30', data_effettiva: '2026-08-30' })]
  assert.equal(pulizieAutomatiche([p, a], altra, '2026-09-04').length, 1)
})

test('AUTOMATICA · correzioni di Ania: data cambiata → resta la riga a mano; «non fatta» → sparisce', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-27', check_out: '2026-08-30' })
  const a = prenotazione({ room_id: AMBRA, check_in: '2026-08-31', check_out: '2026-09-02' })
  const corretta = [decisione({ room_id: AMBRA, booking_id: p.id, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-08-30', data_effettiva: '2026-08-31', note: NOTA_AUTOMATICA_CORRETTA })]
  assert.equal(pulizieAutomatiche([p, a], corretta, '2026-09-04').length, 0)
  const tolta = [decisione({ room_id: AMBRA, booking_id: p.id, tipo: 'fine_soggiorno', stato: 'saltata', data_prevista: '2026-08-30', note: NOTA_AUTOMATICA_TOLTA })]
  assert.equal(pulizieAutomatiche([p, a], tolta, '2026-09-04').length, 0)
})

test('AUTOMATICA · solo prenotazioni confermate, mai richieste in attesa; prolungamenti e futuro esclusi', () => {
  const p = prenotazione({ room_id: AMBRA, check_in: '2026-08-27', check_out: '2026-08-30' })
  const attesa = prenotazione({ room_id: AMBRA, check_in: '2026-08-30', check_out: '2026-09-02', status: 'in_attesa' })
  assert.equal(pulizieAutomatiche([p, attesa], [], '2026-09-04').length, 0)
  // stesso ospite che prolunga: nessun cambio ospite
  const seg1 = prenotazione({ guest_id: 'g-x', room_id: AMBRA, check_in: '2026-08-27', check_out: '2026-08-30' })
  const seg2 = prenotazione({ guest_id: 'g-x', room_id: AMBRA, check_in: '2026-08-30', check_out: '2026-09-02' })
  assert.equal(pulizieAutomatiche([seg1, seg2], [], '2026-09-04').length, 0)
  // cambio ospite nel futuro: non è ancora avvenuto
  const f1 = prenotazione({ room_id: LENA, check_in: '2026-09-10', check_out: '2026-09-12' })
  const f2 = prenotazione({ room_id: LENA, check_in: '2026-09-12', check_out: '2026-09-14' })
  assert.equal(pulizieAutomatiche([f1, f2], [], '2026-09-04').length, 0)
  assert.equal(pulizieAutomatiche([f1, f2], [], '2026-09-12').length, 1)
  // prima del confine storico le statistiche stimano già una pulizia per partenza
  const v1 = prenotazione({ room_id: LENA, check_in: '2026-08-10', check_out: '2026-08-12' })
  const v2 = prenotazione({ room_id: LENA, check_in: '2026-08-12', check_out: '2026-08-14' })
  assert.equal(pulizieAutomatiche([v1, v2], [], '2026-09-04').length, 0)
})

test('AUTOMATICA · caso Allegra: partenza, arrivo il giorno dopo, partenza oggi → due pulizie', () => {
  const primo = prenotazione({ room_id: LENA, check_in: '2026-08-29', check_out: '2026-09-01' })
  const secondo = prenotazione({ room_id: LENA, check_in: '2026-09-02', check_out: '2026-09-04' })
  const oggi = '2026-09-04'
  const auto = pulizieAutomatiche([primo, secondo], [], oggi)
  assert.equal(auto.length, 1)
  assert.equal(auto[0].data, '2026-09-01')
  // la partenza di oggi non ha un arrivo vicino: la segna Ania
  const fatta = [decisione({ room_id: LENA, booking_id: secondo.id, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: oggi, data_effettiva: oggi })]
  const totali = pulizieAutomatiche([primo, secondo], fatta, oggi).length + fatta.filter(e => e.stato === 'fatta').length
  assert.equal(totali, 2)
})

// Caso Rosa Macauda (5 settembre 2026, regola confermata da Ania): con un
// cambio camera la nuova camera è consegnata pulita, quindi il conteggio
// delle 4 notti riparte dal giorno del trasloco. Una pulizia saltata nella
// camera vecchia resta lì e non viaggia con l'ospite.
test('cambio camera: il ciclo delle 4 notti riparte dal trasloco, il salto resta nella camera vecchia', () => {
  const ambra = prenotazione({ guest_id: 'g-rosa', guest_name: 'Rosa', room_id: AMBRA, check_in: '2026-09-01', check_out: '2026-09-07' })
  const amelia = prenotazione({ guest_id: 'g-rosa', guest_name: 'Rosa', room_id: AMELIA, check_in: '2026-09-07', check_out: '2026-09-15' })
  const saltata = decisione({ room_id: AMBRA, booking_id: ambra.id, tipo: 'soggiorno', stato: 'saltata', data_prevista: '2026-09-05', prossima_data: '2026-09-09' })
  // Ambra: dopo il salto non c'è altro cambio prima della partenza
  assert.equal(cicloCambio([ambra, amelia], ambra, [saltata]).due, null)
  assert.deepEqual(pulizieAperte([ambra, amelia], AMBRA, '2026-09-06', [saltata]), [])
  // Amelia: 7 + 4 = 11, non il 9 proposto dal salto in Ambra
  assert.equal(cicloCambio([ambra, amelia], amelia, [saltata]).due, '2026-09-11')
  assert.deepEqual(pulizieAperte([ambra, amelia], AMELIA, '2026-09-09', [saltata]), [])
  assert.equal(pulizieAperte([ambra, amelia], AMELIA, '2026-09-11', [saltata])[0]?.tipo, 'soggiorno')
  // Se il soggiorno nella nuova camera dura esattamente 4 notti, nessun cambio
  const breve = { ...amelia, check_out: '2026-09-11' }
  assert.equal(cicloCambio([ambra, breve], breve, [saltata]).due, null)
})
