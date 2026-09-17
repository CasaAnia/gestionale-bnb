// ============================================================================
// LE LINEE DI UN SOGGIORNO (17/09/2026): cambio camera in fila = una linea,
// camere in parallelo = più linee; ogni linea si salva da sola, le altre
// contano come altre prenotazioni; il conto si vede prima di salvare.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lineeDelSoggiorno, titoloLinea, contestoLinea, contoDopoNotti, testoContoDopo, chiaveLinea,
  CONTO_INVARIATO, CONTO_CAMBIA, SPIEGAZIONE_PARALLELE, CAMERE_NON_LETTE,
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
  assert.equal(contoDopoNotti({ aggiorna: [], crea: [], annulla: [], errore: 'x' }, A, tutti), null)
})

test('le frasi sotto le strisce', () => {
  assert.equal(SPIEGAZIONE_PARALLELE, 'Più camere nelle stesse notti: ogni camera si cambia dalla sua striscia.')
  assert.equal(/scheda completa|Vedi tutto/.test(CAMERE_NON_LETTE), false, 'rimanda ancora alla scheda vecchia')
})
