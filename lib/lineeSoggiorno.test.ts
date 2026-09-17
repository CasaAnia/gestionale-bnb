// ============================================================================
// LE LINEE DI UN SOGGIORNO (17/09/2026): cambio camera in fila = una linea,
// camere in parallelo = più linee; ogni linea si salva da sola, le altre
// contano come altre prenotazioni; il conto si vede prima di salvare.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lineeDelSoggiorno, titoloLinea, contestoLinea, contoDopoNotti, testoContoDopo, chiaveLinea,
  CONTO_INVARIATO, CONTO_CAMBIA, SPIEGAZIONE_PARALLELE, CAMERE_NON_LETTE, dateLinea, nottiConDate,
  confermaNotti, conPrezzoConcordato, RIVEDI_SCONTO, AVVISO_RIVEDI_SCONTO, DURATA_CONFERMA_NOTTI, DURATA_CONFERMA_SCONTO,
  nottiDaCuiCambiare, camereDaLi, cambiaCameraDaLi,
} from './lineeSoggiorno.ts'
import { pianoNotti, cambiaCamera, camereDellaNotte, lettoDisponibileNotte, nonDormeQui, type ContestoNotti, type CameraStriscia } from './strisciaNotti.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const LENA: CameraStriscia = { id: LENA_ID, name: 'Lena', base_price: 80, has_extra_bed: true, extra_bed_price: 10 } as unknown as CameraStriscia
const AMBRA: CameraStriscia = { id: 'ambra', name: 'Ambra', base_price: 70, has_extra_bed: true, extra_bed_price: 10 } as unknown as CameraStriscia
const AMELIA: CameraStriscia = { id: 'amelia', name: 'Amelia', base_price: 65, has_extra_bed: false, extra_bed_price: 0 } as unknown as CameraStriscia
const camere = [LENA, AMBRA, AMELIA]

const riga = (id: string, camera: CameraStriscia, check_in: string, check_out: string, extra: Record<string, unknown> = {}) => ({
  id, room_id: camera.id, rooms: camera, check_in, check_out, status: 'confermata', num_guests: 2,
  price_per_night: camera.base_price, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0,
  total_amount: (camera.base_price as number) * ((Date.parse(check_out) - Date.parse(check_in)) / 86400000),
  discount_type: null, discount_value: null, ...extra,
})

// Lei in Lena poi Ambra (cambio camera, gruppo A); la sorella in Amelia nelle stesse notti (gruppo B)
const leiLena = riga('a1', LENA, '2026-11-03', '2026-11-05', { group_id: 'A' })
const leiAmbra = riga('a2', AMBRA, '2026-11-05', '2026-11-07', { group_id: 'A' })
const sorella = riga('b1', AMELIA, '2026-11-03', '2026-11-06', { group_id: 'B', num_guests: 1 })
const annullata = riga('z', LENA, '2026-11-03', '2026-11-04', { group_id: 'A', status: 'annullata' })
const tutti = [sorella, leiLena, leiAmbra, annullata]
const contesto: ContestoNotti = { camere, altre: [], ospiti: 2 }

test('le linee: il cambio camera in fila è una linea sola, la camera in parallelo un’altra; le annullate non contano', () => {
  const linee = lineeDelSoggiorno(tutti)
  assert.deepEqual(linee.map(l => l.chiave), ['A', 'B'])          // dalla prima che arriva, poi per chiave
  assert.deepEqual(linee[0].segmenti.map(s => s.id), ['a1', 'a2'])
  assert.deepEqual(linee[1].segmenti.map(s => s.id), ['b1'])
  assert.equal(linee[0].notti.length, 4)
  assert.equal(linee[0].notti.every(n => !n.parallela), true, 'dentro una linea non ci sono notti parallele')
  assert.equal(linee[1].notti.length, 3)
  // senza gruppo la linea è la riga sola
  assert.equal(chiaveLinea({ id: 'solo', group_id: null }), 'solo')
  assert.deepEqual(lineeDelSoggiorno([riga('solo', LENA, '2026-11-03', '2026-11-05')]).map(l => l.chiave), ['solo'])
})

test('il titolo della linea dice camera e notti: «Lena → Ambra · 3 → 7 nov», «Amelia · 3 → 6 nov»', () => {
  assert.equal(titoloLinea([leiLena, leiAmbra]), 'Lena → Ambra · 3 → 7 nov')
  assert.equal(titoloLinea([sorella]), 'Amelia · 3 → 6 nov')
  assert.equal(titoloLinea([annullata]), '')
  assert.equal(lineeDelSoggiorno(tutti)[0].titolo, 'Lena → Ambra · 3 → 7 nov')
})

test('nel contesto di una linea le altre linee sono altre prenotazioni: la loro camera non è libera e i loro letti contano', () => {
  const linee = lineeDelSoggiorno(tutti)
  const ctxA = contestoLinea(linee[0], linee, contesto)
  // Amelia è della sorella il 3, 4 e 5: non compare fra le libere della linea A
  const ids = (iso: string, ctx: ContestoNotti) => camereDellaNotte(iso, ctx).map(c => c.id).sort()
  assert.deepEqual(ids('2026-11-03', ctxA), ['ambra', LENA_ID].sort())
  assert.deepEqual(ids('2026-11-06', ctxA), ['ambra', 'amelia', LENA_ID].sort())
  // dalla linea B, Lena e Ambra di lei non sono libere
  const ctxB = contestoLinea(linee[1], linee, contesto)
  assert.deepEqual(ids('2026-11-03', ctxB), ['ambra', 'amelia'])
  assert.deepEqual(ids('2026-11-05', ctxB), ['amelia', LENA_ID].sort())
  // gli ospiti sono quelli della linea, non il massimo del soggiorno
  assert.equal(ctxB.ospiti, 1)
  assert.equal(ctxA.ospiti, 2)
  // le altre prenotazioni della casa restano nel contesto
  const conAltre = contestoLinea(linee[0], linee, { ...contesto, altre: [{ room_id: 'ambra', check_in: '2026-11-06', check_out: '2026-11-08', status: 'confermata' }] })
  assert.deepEqual(ids('2026-11-06', conAltre), ['amelia', LENA_ID].sort())
})

test('i due letti di casa: se l’altra linea ne usa due, per questa non ce n’è', () => {
  const sorellaConDueLetti = { ...sorella, room_id: LENA_ID, rooms: LENA, num_guests: 4, extra_bed: true, extra_bed_dates: ['2026-11-03'] }
  const lei = riga('a1', AMBRA, '2026-11-03', '2026-11-05', { group_id: 'A', num_guests: 3 })
  const linee = lineeDelSoggiorno([lei, sorellaConDueLetti])
  const ctxA = contestoLinea(linee[0], linee, { camere, altre: [], ospiti: 4 })
  assert.equal(lettoDisponibileNotte('2026-11-03', 'ambra', ctxA), false)
  assert.equal(lettoDisponibileNotte('2026-11-04', 'ambra', ctxA), true)
})

test('il piano di una linea tocca solo i suoi tratti: la sorella resta com’è', () => {
  const linee = lineeDelSoggiorno(tutti)
  const A = linee[0]
  const ctxA = contestoLinea(A, linee, contesto)
  // il 4 novembre lei passa in Ambra: Lena si accorcia, Ambra si allunga all'indietro
  const nuove = cambiaCamera(A.notti, '2026-11-04', AMBRA, ctxA)
  const piano = pianoNotti(nuove, A.segmenti, ctxA)
  assert.equal(piano.errore, null)
  assert.deepEqual(piano.aggiorna.map(a => a.id).sort(), ['a1', 'a2'])
  assert.equal(piano.annulla.length, 0)
  assert.equal(piano.crea.length, 0)
  assert.equal(piano.aggiorna.some(a => a.id === 'b1'), false, 'il piano ha toccato la linea della sorella')
  // il conto prima e dopo: Lena 1 notte (80) + Ambra 3 notti (210) + Amelia 195
  const conto = contoDopoNotti(piano, A, tutti)!
  assert.equal(conto.primaCent, 16000 + 14000 + 19500)
  assert.equal(conto.dopoCent, 8000 + 21000 + 19500)
  assert.equal(testoContoDopo(conto), CONTO_CAMBIA(49500, 48500))
  assert.equal(testoContoDopo(conto), 'Conto: 495 € → 485 €')
})

test('il conto prima di salvare: invariato se non cambia niente, annullato non più dovuto, tratto nuovo contato', () => {
  const linee = lineeDelSoggiorno(tutti)
  const A = linee[0]
  const ctxA = contestoLinea(A, linee, contesto)
  const uguale = pianoNotti(A.notti, A.segmenti, ctxA)
  assert.equal(testoContoDopo(contoDopoNotti(uguale, A, tutti)!), CONTO_INVARIATO(49500))
  // l'ultima notte non dorme qui: Ambra si accorcia a una notte
  const senzaUltima = nonDormeQui(A.notti, '2026-11-06')
  const piano = pianoNotti(senzaUltima, A.segmenti, ctxA)
  assert.equal(contoDopoNotti(piano, A, tutti)!.dopoCent, 16000 + 7000 + 19500)
  // tutte le notti di Ambra via: a2 si annulla e non conta più
  const senzaAmbra = nonDormeQui(nonDormeQui(A.notti, '2026-11-05'), '2026-11-06')
  const piano2 = pianoNotti(senzaAmbra, A.segmenti, ctxA)
  assert.deepEqual(piano2.annulla, ['a2'])
  assert.equal(contoDopoNotti(piano2, A, tutti)!.dopoCent, 16000 + 19500)
  // con un errore nel piano niente conto
  assert.equal(contoDopoNotti({ aggiorna: [], crea: [], annulla: [], errore: 'x', tratti: [] }, A, tutti), null)
})

test('le frasi sotto le strisce', () => {
  assert.equal(SPIEGAZIONE_PARALLELE, 'Più camere nelle stesse notti: ogni camera si cambia dalla sua striscia.')
  assert.equal(/scheda completa|Vedi tutto/.test(CAMERE_NON_LETTE), false, 'rimanda ancora alla scheda vecchia')
})

// ── «Cambia date» (17/09/2026) ──────────────────────────────────────────────
test('le date della linea, e le notti con date nuove: si accorcia, si allunga copiando la notte vicina', () => {
  const linee = lineeDelSoggiorno(tutti)
  const A = linee[0]
  const ctxA = contestoLinea(A, linee, contesto)
  assert.deepEqual(dateLinea(A.notti), { arrivo: '2026-11-03', partenza: '2026-11-07' })
  // si accorcia: via l'ultima notte
  const corte = nottiConDate(A.notti, '2026-11-03', '2026-11-06', ctxA)
  assert.deepEqual(corte.map(n => n.iso), ['2026-11-03', '2026-11-04', '2026-11-05'])
  // si allunga in coda: la notte nuova prende la camera dell'ultima (Ambra) se è libera
  const lunghe = nottiConDate(A.notti, '2026-11-03', '2026-11-08', ctxA)
  assert.deepEqual(lunghe.map(n => [n.iso, n.camera, n.persone, n.letto]).slice(-2), [['2026-11-06', 'Ambra', 2, false], ['2026-11-07', 'Ambra', 2, false]])
  // si allunga in testa: la notte nuova prende la camera della prima (Lena)
  const prima = nottiConDate(A.notti, '2026-11-02', '2026-11-07', ctxA)
  assert.deepEqual([prima[0].iso, prima[0].camera], ['2026-11-02', 'Lena'])
  // il piano salva tutto: il tratto di Ambra si allunga, la sorella non si tocca
  const piano = pianoNotti(lunghe, A.segmenti, ctxA)
  assert.equal(piano.errore, null)
  assert.deepEqual(piano.aggiorna.map(a => [a.id, a.campi.check_out]), [['a2', '2026-11-08']])
  assert.equal(contoDopoNotti(piano, A, tutti)!.dopoCent, 16000 + 21000 + 19500)
  // date sbagliate: le notti restano quelle
  assert.equal(nottiConDate(A.notti, '2026-11-07', '2026-11-03', ctxA), A.notti)
})

test('allungando su una notte in cui la camera è presa, la notte resta senza camera e il piano lo dice', () => {
  const linee = lineeDelSoggiorno(tutti)
  const B = linee[1]     // la sorella in Amelia 3–6
  const ctxB = contestoLinea(B, linee, { camere, altre: [{ room_id: 'amelia', check_in: '2026-11-06', check_out: '2026-11-08', status: 'confermata' }], ospiti: 1 })
  const lunghe = nottiConDate(B.notti, '2026-11-03', '2026-11-07', ctxB)
  const nuova = lunghe[lunghe.length - 1]
  assert.deepEqual([nuova.iso, nuova.cameraId, nuova.motivo], ['2026-11-06', null, 'Amelia è occupata'])
  assert.notEqual(pianoNotti(lunghe, B.segmenti, ctxB).errore, null)
})

test('due tratti dello stesso gruppo che si sovrappongono (prenotazioni vecchie) sono due linee: «A» e «A#2»', () => {
  // Ambra e Allegra nelle stesse notti, stesso group_id, come Alessandro Pagano in produzione (17/09/2026)
  const ambra = riga('p1', AMBRA, '2027-01-14', '2027-01-16', { group_id: 'G' })
  const allegra = riga('p2', { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 } as unknown as CameraStriscia, '2027-01-14', '2027-01-16', { group_id: 'G' })
  const linee = lineeDelSoggiorno([ambra, allegra])
  assert.deepEqual(linee.map(l => [l.chiave, l.segmenti.map(s => s.id)]), [['G', ['p1']], ['G#2', ['p2']]])
  assert.equal(linee[0].notti.every(n => !n.parallela && n.cameraId === 'ambra'), true)
  assert.deepEqual(linee.map(l => l.titolo), ['Ambra · 14 → 16 gen', 'Allegra · 14 → 16 gen'])
  // dal contesto della prima, Allegra è presa; il conto dopo un piano vuoto resta lo stesso
  const ctx = contestoLinea(linee[0], linee, { camere: [...camere, allegra.rooms], altre: [], ospiti: 2 })
  assert.equal(camereDellaNotte('2027-01-14', ctx).some(c => c.id === 'allegra'), false)
  const piano = pianoNotti(linee[0].notti, linee[0].segmenti, ctx)
  assert.equal(piano.errore, null)
  assert.deepEqual(contoDopoNotti(piano, linee[0], [ambra, allegra]), { primaCent: 30000, dopoCent: 30000 })
  // in fila (uno finisce dove comincia l'altro) restano una linea sola
  const inFila = lineeDelSoggiorno([leiLena, leiAmbra])
  assert.deepEqual(inFila.map(l => l.chiave), ['A'])
})

// ── Il pop-up dopo aver salvato le notti (Ania, 17/09/2026) ────────────────
test('dopo «Fatto»: il conto com’è adesso e quante notti; col prezzo finale concordato e notti diverse, «rivedi lo sconto» e un avviso che resta', () => {
  const normale = confermaNotti({ totaleCent: 17000, nottiPrima: 1, nottiDopo: 2, concordato: false })
  assert.deepEqual(normale.righe, { prima: 'Notti aggiornate', seconda: 'Conto: 170 € · 2 notti' })
  assert.equal(normale.avviso, null)
  assert.equal(normale.durata, DURATA_CONFERMA_NOTTI)
  // prezzo finale concordato: il conto resta 170 anche con una notte in più → si dice
  const concordato = confermaNotti({ totaleCent: 17000, nottiPrima: 1, nottiDopo: 2, concordato: true })
  assert.deepEqual(concordato.righe, { prima: 'Notti aggiornate', seconda: 'Conto rimasto a 170 €! Hai inserito lo sconto del Prezzo Finale' })
  assert.equal(concordato.righe.seconda, RIVEDI_SCONTO(17000))
  assert.equal(concordato.avviso, AVVISO_RIVEDI_SCONTO(17000))
  assert.equal(concordato.durata, DURATA_CONFERMA_SCONTO)
  // stesse notti (solo cambio camera): niente da rivedere
  const stesse = confermaNotti({ totaleCent: 17000, nottiPrima: 2, nottiDopo: 2, concordato: true })
  assert.equal(stesse.righe.seconda, 'Conto: 170 € · 2 notti')
  assert.equal(stesse.avviso, null)
  assert.equal(conPrezzoConcordato([{ discount_type: null }, { discount_type: 'target_total' }]), true)
  assert.equal(conPrezzoConcordato([{ discount_type: 'percentage' }]), false)
})

// ── «Cambio camera» da una notte in poi (Ania, 17/09/2026) ─────────────────
test('cambio camera da una notte in poi: le camere libere in tutte quelle notti, e tutte le notti da lì passano nella nuova', () => {
  const linee = lineeDelSoggiorno(tutti)
  const A = linee[0]                       // lei: Lena 3–5, Ambra 5–7; la sorella in Amelia 3–6
  const ctxA = contestoLinea(A, linee, contesto)
  assert.deepEqual(nottiDaCuiCambiare(A.notti).map(n => n.iso), ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
  // dal 5: Amelia è della sorella fino al 6 → resta libera solo Lena (Ambra è già la camera di quelle notti)
  assert.deepEqual(camereDaLi(A.notti, '2026-11-05', ctxA).map(c => c.name), ['Lena'])
  // dal 6: Amelia è libera (la sorella parte il 6), Lena pure
  assert.deepEqual(camereDaLi(A.notti, '2026-11-06', ctxA).map(c => c.name).sort(), ['Amelia', 'Lena'])
  // dal 4 in Ambra: 4, 5 e 6 in Ambra; il 3 resta Lena
  const nuove = cambiaCameraDaLi(A.notti, '2026-11-04', AMBRA, ctxA)
  assert.deepEqual(nuove.map(n => n.camera), ['Lena', 'Ambra', 'Ambra', 'Ambra'])
  const piano = pianoNotti(nuove, A.segmenti, ctxA)
  assert.equal(piano.errore, null)
  assert.equal(contoDopoNotti(piano, A, tutti)!.dopoCent, 8000 + 21000 + 19500)
  // senza notti niente camere
  assert.deepEqual(camereDaLi(A.notti, '2026-12-01', ctxA), [])
})
