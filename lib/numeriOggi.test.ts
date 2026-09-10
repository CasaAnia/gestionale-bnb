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
import { strisciaSettimane, etichettaGiornoBreve, ultimoGiornoStriscia, testoCasella, cambiCameraPerGiorno, simboliCambi } from './numeriOggi.ts'
import { conteggioGiorno, statoCameraGiorno, pulizieAperte, attive, cicloCambio, type Decisione } from './pulizie.ts'

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
  // Oggi: le camere «da fare» sono quelle con pulizie aperte, automatiche comprese (la sezione «Oggi» della pagina)
  const aperteOggi = CAMERE.filter(r => pulizieAperte(attive(bookings), r.id, oggi, events).length > 0).length
  assert.equal(s[0].daFare, aperteOggi)
  const per = Object.fromEntries(s.map(g => [g.giorno, `${g.daFare}/${g.fatte}`]))
  assert.equal(per['2026-09-05'], '0/1')   // Ambra: partenza di oggi segnata fatta e arrivo di Lucia in camera pronta → ✓; le altre: nulla
  assert.equal(per['2026-09-06'], '0/0')   // niente
  assert.equal(per['2026-09-07'], '1/0')   // Amelia parte; il cambio biancheria di Allegra è stato spostato dalla rettifica (fatta l'8)
  assert.equal(per['2026-09-08'], '0/1')   // Allegra: cambio biancheria segnato fatto l'8 → ✓
  // Attesa aggiornata il 10/09/2026: nei giorni futuri si contano solo le
  // pulizie previste QUEL giorno. L'arrivo di Lucia in Lena non fa più numero.
  assert.equal(per['2026-09-09'], '1/0')   // Ambra: cambio camera da fare (Lucia va in Lena); l'arrivo in Lena non si conta
  assert.equal(per['2026-09-11'], '0/0')   // partenza da Lena rimandata…
  assert.equal(per['2026-09-13'], '1/0')   // …al 13
  assert.equal(per['2026-09-12'], '1/0')   // Allegra: cambio biancheria (8 + 4 notti)
  assert.equal(per['2026-09-20'], '1/0')   // Allegra parte (l'in attesa in Lena non conta)
  assert.deepEqual(s.filter(g => g.inizioSettimana).map(g => g.giorno), ['2026-09-12', '2026-09-19', '2026-09-26'])
  assert.equal(s[0].oggi, true); assert.equal(s.filter(g => g.oggi).length, 1)
})

// Ania, 10/09/2026: «diamo per scontato che dopo ogni soggiorno la camera
// viene pulita». Nei giorni futuri la striscia conta solo le pulizie previste
// quel giorno: un arrivo, da solo, non fa numero — né da fare né fatta. Una
// camera ricompare più avanti solo se la pulizia è stata RIMANDATA a quel
// giorno. Prima invece la stessa pulizia si vedeva due volte: il giorno suo e
// il giorno dell'arrivo successivo (il caso di sabato 12 settembre).
test('arrivi nei giorni futuri: non fanno numero, né «2» né «✓»; il lavoro resta contato il giorno suo', () => {
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
  assert.deepEqual([domani.daFare, domani.fatte], [0, 0])                   // due arrivi, nessuna pulizia prevista
  assert.deepEqual(testoCasella(domani), { testo: '—', tono: 'niente' })
  // Senza la seconda segnatura: la partenza di oggi in Ambra è ancora lavoro
  // di OGGI (sta in «Oggi» della pagina Pulizie); domani resta vuoto
  const senzaAmbra = strisciaSettimane(CAMERE, bookings, fatte.slice(0, 1), oggi)
  assert.deepEqual([senzaAmbra[0].daFare, senzaAmbra[0].fatte], [1, 0])     // oggi: Ambra da fare
  assert.deepEqual([senzaAmbra[1].daFare, senzaAmbra[1].fatte], [0, 0])     // domani: niente
  // Partita il 4 e MAI segnata: resta in ritardo OGGI, non si ripresenta
  // domani solo perché in Amelia arriva qualcuno
  const senzaAmelia = strisciaSettimane(CAMERE, bookings, fatte.slice(1), oggi)
  assert.equal(senzaAmelia[0].daFare, 1)      // Amelia in ritardo oggi
  assert.deepEqual([senzaAmelia[1].daFare, senzaAmelia[1].fatte], [0, 0])
  assert.deepEqual(testoCasella(senzaAmelia[1]), { testo: '—', tono: 'niente' })
  assert.deepEqual(testoCasella({ daFare: 0, fatte: 0 }), { testo: '—', tono: 'niente' })
  assert.equal(statoCameraGiorno(attive(bookings), 'lena', '2026-09-06', oggi, fatte), 'nessuna')
})

// ── Il caso vero di Ania: sabato 12 settembre 2026 ──────────────────────────
// Rosa parte da Amelia venerdì 11 e la pulizia non è ancora segnata; sabato 12
// in Amelia arriva Carmela, che quel giorno lascia Lena, dove entra Salvatore.
// Ania: «sabato mi fa vedere due camere da fare» — ma la seconda era la
// pulizia di venerdì, contata una seconda volta. Sabato deve restare la sola
// Lena; Amelia torna a farsi vedere solo se la pulizia viene RIMANDATA lì.
test('sabato 12/09/2026: una camera sola, non due; con il rinvio tornano due', () => {
  seq = 0
  const oggi = '2026-09-10'
  const bookings = [
    pren('amelia', '2026-09-07', '2026-09-11'),                 // Rosa parte venerdì 11
    pren('lena', '2026-09-10', '2026-09-12', { guest_id: 'carmela' }),
    pren('amelia', '2026-09-12', '2026-09-13', { guest_id: 'carmela' }),   // Carmela: cambio camera sabato
    pren('lena', '2026-09-12', '2026-09-13'),                   // Salvatore entra in Lena sabato
  ]
  const venerdi = conteggioGiorno(CAMERE, bookings, [], '2026-09-11', oggi)
  const sabato = conteggioGiorno(CAMERE, bookings, [], '2026-09-12', oggi)
  assert.deepEqual([venerdi.daFare, venerdi.fatte], [1, 0], 'venerdì: Amelia')
  assert.deepEqual([sabato.daFare, sabato.fatte], [1, 0], 'sabato: solo Lena')
  assert.equal(statoCameraGiorno(attive(bookings), 'amelia', '2026-09-12', oggi, []), 'nessuna')
  assert.equal(statoCameraGiorno(attive(bookings), 'lena', '2026-09-12', oggi, []), 'da_fare')
  // Se Ania rimanda a sabato la pulizia di Amelia, sabato torna a due camere
  const rinvio: Decisione[] = [{
    id: 'r1', room_id: 'amelia', booking_id: 'p1', tipo: 'fine_soggiorno', stato: 'rimandata',
    data_prevista: '2026-09-11', prossima_data: '2026-09-12', created_at: '2026-09-11T09:00:00Z',
  }]
  const sabatoRinviato = conteggioGiorno(CAMERE, bookings, rinvio, '2026-09-12', oggi)
  assert.deepEqual([sabatoRinviato.daFare, sabatoRinviato.fatte], [2, 0], 'sabato col rinvio: Amelia e Lena')
  assert.deepEqual((c => [c.daFare, c.fatte])(conteggioGiorno(CAMERE, bookings, rinvio, '2026-09-11', oggi)), [0, 0], 'venerdì: la pulizia se n\'è andata a sabato')
})

// ── Bug del 07/09/2026: la casella di OGGI perdeva il conteggio (finestra che parte da oggi) ──
// Caso vero: Rosa cambia camera oggi (Ambra → Amelia), in Ambra entra oggi un nuovo ospite, da
// Amelia parte oggi chi c'era. La pagina Pulizie elenca Ambra e Amelia in «Oggi» (automatiche);
// ieri la casella del 7 mostrava «2», oggi mostrava «✓» perché l'automatica valeva già fatta.
const CASO_OGGI = () => {
  seq = 0
  return [
    pren('ambra', '2026-09-01', '2026-09-07', { guest_id: 'rosa' }),
    pren('amelia', '2026-09-07', '2026-09-11', { guest_id: 'rosa' }),     // cambio camera oggi
    pren('ambra', '2026-09-07', '2026-09-11', { guest_id: 'nuovo' }),     // nuovo ospite in Ambra oggi
    pren('amelia', '2026-09-06', '2026-09-07', { guest_id: 'parte' }),    // parte oggi da Amelia
    pren('allegra', '2026-09-06', '2026-09-08'),
  ]
}

test('finestra che parte da oggi con pulizie da fare oggi: la casella di oggi conta le stesse camere della sezione «Oggi» di Pulizie, come ieri', () => {
  const bookings = CASO_OGGI()
  const oggi = '2026-09-07'
  const s = strisciaSettimane(CAMERE, bookings, [], oggi)
  assert.equal(s[0].giorno, oggi); assert.equal(s[0].oggi, true)
  assert.deepEqual([s[0].daFare, s[0].fatte, s[0].cambi], [2, 0, 1])
  assert.deepEqual(testoCasella(s[0]), { testo: '2', tono: 'numero' })
  // = pagina Pulizie: «N camere da rifare oggi» e le righe di «Oggi»
  assert.equal(conteggioGiorno(CAMERE, bookings, [], oggi, oggi).daFare, 2)
  const righeOggi = CAMERE.filter(r => pulizieAperte(attive(bookings), r.id, oggi, []).length > 0)
  assert.deepEqual(righeOggi.map(r => r.id).sort(), ['ambra', 'amelia'])
  // Ieri la stessa giornata mostrava già 2
  assert.deepEqual(testoCasella(strisciaSettimane(CAMERE, bookings, [], '2026-09-06')[1]), { testo: '2', tono: 'numero' })
  // Segnate fatte tutte e due → «✓»; una sola → «1»
  const fatta = (id: string, room_id: string, booking_id: string): Decisione =>
    ({ id, room_id, booking_id, tipo: 'cambio_camera', stato: 'fatta', data_prevista: oggi, data_effettiva: oggi, created_at: '2026-09-07T11:00:00Z' })
  const una = strisciaSettimane(CAMERE, bookings, [fatta('f1', 'ambra', 'p1')], oggi)[0]
  assert.deepEqual(testoCasella(una), { testo: '1', tono: 'numero' })
  const due = strisciaSettimane(CAMERE, bookings, [fatta('f1', 'ambra', 'p1'), { ...fatta('f2', 'amelia', 'p4'), tipo: 'fine_soggiorno' }], oggi)[0]
  assert.deepEqual(testoCasella(due), { testo: '✓', tono: 'fatto' })
  // Domani (8): i cambi ospite di oggi sono passati e valgono fatti; resta la partenza da Allegra
  const domani = strisciaSettimane(CAMERE, bookings, [], '2026-09-08')[0]
  assert.deepEqual([domani.daFare, domani.fatte], [1, 0])
  assert.equal(statoCameraGiorno(attive(bookings), 'ambra', '2026-09-08', '2026-09-08', []), 'nessuna')
})

test('vicino a mezzanotte in Europe/Rome: la prima casella è il giorno di Roma (non UTC) e conta le pulizie di quel giorno', () => {
  const bookings = CASO_OGGI()
  // 00:30 del 7 settembre a Roma = ancora 6 settembre in UTC
  const istante = new Date('2026-09-06T22:30:00Z')
  assert.equal(istante.toISOString().slice(0, 10), '2026-09-06')
  const oggi = oggiARoma(istante)
  assert.equal(oggi, '2026-09-07')
  const s = strisciaSettimane(CAMERE, bookings, [], oggi)
  assert.equal(s[0].giorno, '2026-09-07'); assert.equal(etichettaGiornoBreve(s[0].giorno), 'lun 7')
  assert.deepEqual([s[0].daFare, s[0].fatte, s[0].cambi], [2, 0, 1])
  assert.equal(s[1].giorno, '2026-09-08'); assert.equal(s.length, 28)
  // 23:30 del 7 a Roma (21:30 UTC): stesso giorno, stesso conteggio
  const sera = strisciaSettimane(CAMERE, bookings, [], oggiARoma(new Date('2026-09-07T21:30:00Z')))
  assert.equal(sera[0].giorno, '2026-09-07'); assert.equal(sera[0].daFare, 2)
  // Col giorno UTC (sbagliato) la casella di oggi sarebbe il 6 e le due pulizie del 7 finirebbero nella seconda
  const utc = strisciaSettimane(CAMERE, bookings, [], istante.toISOString().slice(0, 10))
  assert.equal(utc[0].giorno, '2026-09-06'); assert.equal(utc[1].daFare, 2)
})

test('etichette e limiti della striscia', () => {
  assert.equal(etichettaGiornoBreve('2026-09-05'), 'sab 5')
  assert.equal(etichettaGiornoBreve('2026-10-01'), 'gio 1')
  assert.equal(ultimoGiornoStriscia('2026-09-05'), '2026-10-02')
})

// ── Rettifiche di Pulizie (08/09/2026, segnalazione di Ania): saltata, rimandata, aggiunta a mano ──
test('cambio biancheria SALTATO in Pulizie: non conta e non riappare quel giorno; le 4 notti ripartono dalla data proposta come nella pagina', () => {
  seq = 0
  const oggi = '2026-09-05'
  // Caso vero di Ambra (dati di produzione del 05/09/2026): soggiorno continuativo 6 ago → 1 set → 7 set,
  // cambi biancheria fatti il 23 e 27 ago e il 1° set, poi quello del 5 set SALTATO (proposta 9 set) perché
  // la cliente cambia camera il 7
  const bookings = [
    pren('ambra', '2026-08-06', '2026-09-01', { guest_id: 'rosa' }),
    pren('ambra', '2026-09-01', '2026-09-07', { guest_id: 'rosa' }),
    pren('amelia', '2026-09-07', '2026-09-11', { guest_id: 'rosa' }),     // cambio camera il 7
  ]
  const fatte: Decisione[] = [
    { id: 'a1', room_id: 'ambra', booking_id: 'p1', tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-08-27', data_effettiva: '2026-08-27', created_at: '2026-08-27T19:23:00Z' },
    { id: 'a2', room_id: 'ambra', booking_id: 'p2', tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-08-31', data_effettiva: '2026-09-01', created_at: '2026-09-01T12:51:00Z' },
  ]
  const saltata: Decisione = { id: 'a3', room_id: 'ambra', booking_id: 'p2', tipo: 'soggiorno', stato: 'saltata', data_prevista: '2026-09-05', prossima_data: '2026-09-09', created_at: '2026-09-05T08:20:00Z' }
  // Prima del salto: il cambio del 5 (1° set + 4 notti) è da fare oggi
  const prima = strisciaSettimane(CAMERE, bookings, fatte, oggi)
  assert.deepEqual([prima[0].daFare, prima[0].fatte], [1, 0])
  assert.equal(statoCameraGiorno(attive(bookings), 'ambra', oggi, oggi, fatte), 'da_fare')
  // Dopo il salto: oggi «—», il cambio non riappare (la proposta del 9 cade dopo la partenza del 7 → nessun cambio),
  // il 7 resta la partenza/cambio camera da fare
  const dopo = strisciaSettimane(CAMERE, bookings, [...fatte, saltata], oggi)
  assert.deepEqual(testoCasella(dopo[0]), { testo: '—', tono: 'niente' })
  assert.equal(statoCameraGiorno(attive(bookings), 'ambra', '2026-09-06', oggi, [...fatte, saltata]), 'nessuna')
  assert.equal(statoCameraGiorno(attive(bookings), 'ambra', '2026-09-09', oggi, [...fatte, saltata]), 'nessuna')
  assert.equal(statoCameraGiorno(attive(bookings), 'ambra', '2026-09-07', oggi, [...fatte, saltata]), 'da_fare')
  // Stesso dato della pagina Pulizie: cicloCambio dice «nessun cambio» dopo il salto
  assert.equal(cicloCambio(attive(bookings), bookings[1], [...fatte, saltata]).due, null)
  // Salto con partenza lontana: le 4 notti ripartono dalla data proposta (9 set), come nella pagina
  const lungo = [pren('lena', '2026-09-01', '2026-09-20', { guest_id: 'lunga' })]
  const salto: Decisione = { id: 's1', room_id: 'lena', booking_id: 'p4', tipo: 'soggiorno', stato: 'saltata', data_prevista: '2026-09-05', prossima_data: '2026-09-09', created_at: '2026-09-05T08:00:00Z' }
  const s = strisciaSettimane(CAMERE, lungo, [salto], oggi)
  assert.equal(s.find(g => g.giorno === '2026-09-05')!.daFare, 0)
  assert.equal(s.find(g => g.giorno === '2026-09-09')!.daFare, 1)
  assert.equal(cicloCambio(attive(lungo), lungo[0], [salto]).due, '2026-09-09')
})

test('cambio biancheria RIMANDATO: conta solo nel giorno di destinazione; aggiunto a mano: fatta quel giorno e le 4 notti ripartono da lì', () => {
  seq = 0
  const oggi = '2026-09-05'
  const lungo = [pren('lena', '2026-09-01', '2026-09-20', { guest_id: 'lunga' })]
  const rimandata: Decisione = { id: 'r1', room_id: 'lena', booking_id: 'p1', tipo: 'soggiorno', stato: 'rimandata', data_prevista: '2026-09-05', prossima_data: '2026-09-07', created_at: '2026-09-05T08:00:00Z' }
  const s = strisciaSettimane(CAMERE, lungo, [rimandata], oggi)
  assert.equal(s[0].daFare, 0)                                        // non più oggi
  assert.equal(s.find(g => g.giorno === '2026-09-07')!.daFare, 1)     // nel giorno nuovo
  assert.equal(s.find(g => g.giorno === '2026-09-09')!.daFare, 0)
  // Aggiunta a mano (fatta il 6): «✓» il 6 e prossimo cambio il 10
  const fattaAMano: Decisione = { id: 'f1', room_id: 'lena', booking_id: 'p1', tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-09-05', data_effettiva: '2026-09-06', created_at: '2026-09-06T09:00:00Z' }
  const m = strisciaSettimane(CAMERE, lungo, [rimandata, fattaAMano], oggi)
  assert.deepEqual(testoCasella(m.find(g => g.giorno === '2026-09-06')!), { testo: '✓', tono: 'fatto' })
  assert.equal(m.find(g => g.giorno === '2026-09-07')!.daFare, 0)
  assert.equal(m.find(g => g.giorno === '2026-09-10')!.daFare, 1)
  assert.equal(cicloCambio(attive(lungo), lungo[0], [rimandata, fattaAMano]).due, '2026-09-10')
  // Stessi dati → striscia = pagina, giorno per giorno
  for (const g of m) assert.deepEqual([g.daFare, g.fatte], (c => [c.daFare, c.fatte])(conteggioGiorno(CAMERE, lungo, [rimandata, fattaAMano], g.giorno, oggi)), g.giorno)
})

// Segnale ⇄ dei cambi camera nella striscia (incarico del 06/09/2026)
test('cambi camera per giorno: 0, 1, 2, 3; un arrivo di un altro ospite lo stesso giorno non conta; i numeri della striscia non cambiano', () => {
  const oggi = '2026-09-05'
  const pren = [
    // 1 cambio il 7: Anna Ambra → Lena
    b('a1', 'ambra', '2026-09-05', '2026-09-07', { group_id: 'ga' }), b('a2', 'lena', '2026-09-07', '2026-09-09', { group_id: 'ga' }),
    // arrivo di un altro ospite il 7: non è un cambio
    b('x', 'amelia', '2026-09-07', '2026-09-09'),
    // 2 cambi il 10: Bruno (stesso guest_id, senza group_id) e Carla (group_id)
    b('b1', 'amelia', '2026-09-09', '2026-09-10', { guest_id: 'bruno' }), b('b2', 'allegra', '2026-09-10', '2026-09-12', { guest_id: 'bruno' }),
    b('c1', 'lena', '2026-09-09', '2026-09-10', { group_id: 'gc' }), b('c2', 'ambra', '2026-09-10', '2026-09-11', { group_id: 'gc' }),
    // 3 cambi il 15
    b('d1', 'amelia', '2026-09-13', '2026-09-15', { group_id: 'gd' }), b('d2', 'lena', '2026-09-15', '2026-09-17', { group_id: 'gd' }),
    b('e1', 'allegra', '2026-09-13', '2026-09-15', { group_id: 'ge' }), b('e2', 'amelia', '2026-09-15', '2026-09-16', { group_id: 'ge' }),
    b('f1', 'ambra', '2026-09-12', '2026-09-15', { group_id: 'gf' }), b('f2', 'allegra', '2026-09-15', '2026-09-18', { group_id: 'gf' }),
    // annullata: mai
    b('z1', 'lena', '2026-09-20', '2026-09-21', { group_id: 'gz', status: 'annullata' }), b('z2', 'ambra', '2026-09-21', '2026-09-22', { group_id: 'gz', status: 'annullata' }),
  ]
  const cambi = cambiCameraPerGiorno(pren)
  assert.deepEqual(cambi, { '2026-09-07': 1, '2026-09-10': 2, '2026-09-15': 3 })
  const s = strisciaSettimane(camere.filter(c => c.active), pren, [], oggi)
  assert.equal(s[0].cambi, 0); assert.equal(s[2].cambi, 1); assert.equal(s[5].cambi, 2); assert.equal(s[10].cambi, 3)
  // i numeri delle camere da preparare restano quelli del calcolo condiviso
  const senza = strisciaSettimane(camere.filter(c => c.active), pren.filter(p => !p.group_id && !p.guest_id), [], oggi)
  assert.ok(s.every(g => typeof g.daFare === 'number' && (g.cambi === 0 || g.daFare >= 1)), 'un cambio conta già tra le camere da preparare')
  assert.equal(senza[2].cambi, 0)
  assert.deepEqual(simboliCambi(0), { sopra: false, centro: false, sotto: false })
  assert.deepEqual(simboliCambi(1), { sopra: false, centro: false, sotto: true })
  assert.deepEqual(simboliCambi(2), { sopra: true, centro: false, sotto: true })
  assert.deepEqual(simboliCambi(3), { sopra: true, centro: true, sotto: true })
  assert.deepEqual(simboliCambi(5), { sopra: true, centro: true, sotto: true })
})
