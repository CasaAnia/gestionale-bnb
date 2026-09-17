// ============================================================================
// LO SCONTO QUANDO CAMBIA IL SOGGIORNO (17/09/2026): il caso di Ania —
// Allegra, una notte in tre, 80 + 10 = 90 portati a 85; si aggiungono due
// notti in Ambra a 90 e si vuole tenere 5 € di sconto A NOTTE: 3 × 85 = 255.
// Prima il piano teneva 85 € per tutto il soggiorno e spalmava 61,67 e
// 123,33 sui due tratti. Qui le prove della logica pura del foglio.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SENZA_SCONTO, primaDelCambio, dopoIlCambio, serveConfermaPrezzo, titoloConferma, sottotitoloConferma, riepilogoPrima,
  opzionePerNotte, sottoPerNotte, anteprimaSoggiorno, periodoConMese,
  TITOLO_ALLUNGA, TITOLO_ACCORCIA, TITOLO_CAMBIA, SCELTA_PER_NOTTE, SCELTA_NUOVO_PREZZO, ETICHETTA_TOTALE_SOGGIORNO,
  TORNA_ALLE_MODIFICHE, CONFERMA_SOGGIORNO, DOMANDA_PREZZO, SCRIVI_IL_TOTALE, TOTALE_TROPPO_ALTO, SENZA_SCONTO_TESTO,
  MOTIVO_PIU_CAMERE, MOTIVO_NON_SI_DIVIDE, MOTIVO_ACCORDI_DIVERSI, OLTRE_IL_TOTALE, RIGA_INCASSATI, RIGA_RESTA,
  type RigaSoggiorno,
} from './soggiornoSconto.ts'
import { pianoNotti, nottiDaSegmenti, cambiaCamera, SCONTO_DECADUTO, type CameraStriscia, type ContestoNotti, type SegmentoNotti } from './strisciaNotti.ts'
import { nottiConDate, lineeDelSoggiorno, contestoLinea } from './lineeSoggiorno.ts'
import { contoSoggiorno } from './conto.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const ALLEGRA: CameraStriscia = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMBRA: CameraStriscia = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMBRA_70: CameraStriscia = { id: 'ambra', name: 'Ambra', base_price: 70, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: CameraStriscia = { id: 'amelia', name: 'Amelia', base_price: 65, has_extra_bed: true, extra_bed_price: 5 }
const LENA: CameraStriscia = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const contesto = (camere: CameraStriscia[], extra: Partial<ContestoNotti> = {}): ContestoNotti => ({ camere, altre: [], ospiti: 3, ...extra })

type Riga = SegmentoNotti & RigaSoggiorno & { group_id?: string | null }
const riga = (id: string, camera: CameraStriscia, dal: string, al: string, extra: Partial<Riga> = {}): Riga => ({
  id, room_id: camera.id, rooms: camera, check_in: dal, check_out: al, status: 'confermata', num_guests: 3,
  extra_bed: true, extra_bed_dates: [dal], price_per_night: 80, extra_bed_total: 10, total_amount: 85,
  discount_type: 'target_total', discount_value: 85, ...extra,
})

// Allegra, 29 → 30 nov, in tre: 80 + 10 = 90, concordati 85
const ALLEGRA_UNA_NOTTE = riga('a', ALLEGRA, '2026-11-29', '2026-11-30')

// le tre notti di Ania: 29 nov → 2 dic, la prima in Allegra e le altre due in Ambra
function treNottiAmbra(ambra = AMBRA) {
  const segmenti = [ALLEGRA_UNA_NOTTE]
  const ctx = contesto([ALLEGRA, ambra])
  let notti = nottiConDate(nottiDaSegmenti(segmenti), '2026-11-29', '2026-12-02', ctx)
  notti = cambiaCamera(notti, '2026-11-30', ambra, ctx)
  notti = cambiaCamera(notti, '2026-12-01', ambra, ctx)
  return { segmenti, ctx, notti }
}

test('prima del cambio: 90 € − 5 € = 85 € per una notte', () => {
  assert.deepEqual(primaDelCambio([ALLEGRA_UNA_NOTTE]), { notti: 1, pienoCent: 9000, scontoCent: 500, totaleCent: 8500 })
  assert.equal(riepilogoPrima(primaDelCambio([ALLEGRA_UNA_NOTTE])), 'Prima: 90 € − 5 € = 85 € per una notte')
  assert.equal(riepilogoPrima({ notti: 3, pienoCent: 27000, scontoCent: 1500, totaleCent: 25500 }), 'Prima: 270 € − 15 € = 255 € per 3 notti')
})

test('il piano SENZA sconto dice i tratti col prezzo pieno: Allegra 90, Ambra 180 — e il foglio serve', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const senza = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO)
  assert.equal(senza.errore, null)
  assert.deepEqual(senza.tratti.map(t => [t.camera, t.notti, t.pienoCent, t.letto]), [['Allegra', 1, 9000, 10], ['Ambra', 2, 18000, 20]])
  assert.deepEqual(dopoIlCambio(senza.tratti), { notti: 3, pienoCent: 27000 })
  assert.equal(serveConfermaPrezzo(segmenti, segmenti, senza), true)
  // senza prezzo finale concordato il foglio non serve: la percentuale segue le notti da sola
  const percento = [riga('p', ALLEGRA, '2026-11-29', '2026-11-30', { discount_type: 'percentage', discount_value: 10, total_amount: 81 })]
  assert.equal(serveConfermaPrezzo(percento, percento, pianoNotti(notti, percento, ctx, SENZA_SCONTO)), false)
  // e se notti e prezzo pieno non cambiano (stessa camera, stesse notti) nemmeno
  const ferme = pianoNotti(nottiDaSegmenti(segmenti), segmenti, ctx, SENZA_SCONTO)
  assert.equal(serveConfermaPrezzo(segmenti, segmenti, ferme), false)
})

test('la testa del foglio: «Il soggiorno si allunga · Da 1 a 3 notti · 29 nov → 2 dic»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  assert.equal(titoloConferma(1, 3), TITOLO_ALLUNGA)
  assert.equal(titoloConferma(3, 1), TITOLO_ACCORCIA)
  assert.equal(titoloConferma(3, 3), TITOLO_CAMBIA)
  assert.equal(TITOLO_ALLUNGA, 'Il soggiorno si allunga')
  assert.equal(sottotitoloConferma(1, tratti), 'Da 1 a 3 notti · 29 nov → 2 dic')
  assert.equal(sottotitoloConferma(3, tratti), 'Sempre 3 notti · 29 nov → 2 dic')
  assert.equal(periodoConMese('2026-09-10', '2026-09-13'), '10 → 13 set')
  assert.equal(DOMANDA_PREZZO, 'Come vuoi aggiornare il prezzo?')
})

test('la prima scelta: «Mantieni 5 € di sconto a notte · 85 € a notte · letto incluso»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const { opzione, motivo } = opzionePerNotte(segmenti, segmenti, tratti)
  assert.equal(motivo, null)
  assert.deepEqual(opzione, { centANotte: 500, etichetta: 'Mantieni 5 € di sconto a notte', sotto: '85 € a notte · letto incluso' })
  assert.equal(SCELTA_PER_NOTTE(500), 'Mantieni 5 € di sconto a notte')
  assert.equal(SCELTA_NUOVO_PREZZO, 'Concorda un nuovo prezzo')
  assert.equal(ETICHETTA_TOTALE_SOGGIORNO, 'Totale dell’intero soggiorno')
})

test('con la prima scelta il nuovo conto: Allegra 1 × 85, Ambra 2 × 85, pieno 270, sconto 3 × 5 = −15, totale 255', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const a = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(a.righe.map(r => [r.testo, r.importo]), [['Allegra · 1 notte × 85 €', '85 €'], ['Ambra · 2 notti × 85 €', '170 €']])
  assert.deepEqual([a.pieno.testo, a.pieno.importo], ['Prezzo pieno', '270 €'])
  assert.deepEqual(a.sconto && [a.sconto.testo, a.sconto.importo], ['Sconto: 3 notti × 5 €', '−15 €'])
  assert.deepEqual([a.totale.testo, a.totale.importo, a.totaleCent], ['Totale', '255 €', 25500])
  assert.equal(a.pulsante, 'Conferma soggiorno · 255 €')
  assert.equal(TORNA_ALLE_MODIFICHE, 'Torna alle modifiche')
  assert.equal(a.errore, null)
  assert.deepEqual(a.scelta, { tipo: 'per_notte', centANotte: 500 })
  assert.deepEqual(a.altre, [])
  assert.deepEqual(a.sotto, [])
})

test('si salva INSIEME: il piano con la scelta scrive 85 su Allegra e 170 su Ambra, e riletto il conto fa 255 con lo sconto', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const piano = pianoNotti(notti, segmenti, ctx, { tipo: 'per_notte', centANotte: 500 })
  assert.equal(piano.errore, null)
  // il tratto di Allegra resta com'è (85 concordati = 90 − 5): non si riscrive; Ambra è nuova
  assert.equal(piano.aggiorna.length, 0)
  assert.equal(piano.crea.length, 1)
  const allegra = ALLEGRA_UNA_NOTTE, ambra = piano.crea[0]
  assert.deepEqual([allegra.discount_type, allegra.discount_value, allegra.total_amount], ['target_total', 85, 85])
  assert.deepEqual([ambra.room_id, ambra.discount_type, ambra.discount_value, ambra.total_amount], ['ambra', 'target_total', 170, 170])
  // riaperta, la scheda rilegge riga per riga con lib/conto: prezzo, letto e sconto tornano
  const c1 = contoSoggiorno(allegra), c2 = contoSoggiorno(ambra)
  assert.deepEqual([c1.prezzoPieno, c1.sconto, c1.totale], [90, 5, 85])
  assert.deepEqual([c2.prezzoPieno, c2.sconto, c2.totale], [180, 10, 170])
  assert.equal(Math.round((c1.totale + c2.totale) * 100), 25500)
  // il vecchio piano (senza scelta) teneva 85 € per tutto il soggiorno: 28,33 + 56,67
  const vecchio = pianoNotti(notti, segmenti, ctx)
  assert.equal(vecchio.aggiorna.length, 1)
  assert.equal(Math.round((vecchio.aggiorna[0].campi.total_amount + vecchio.crea[0].total_amount) * 100), 8500)
})

test('tariffe diverse: con Ambra a 70 si tolgono 5 € dai prezzi veri — «85 € e 75 € a notte», totale 235, non «sempre 85»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra(AMBRA_70)
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  assert.deepEqual(tratti.map(t => t.pienoCent), [9000, 16000])
  const { opzione } = opzionePerNotte(segmenti, segmenti, tratti)
  assert.equal(opzione?.sotto, '85 € e 75 € a notte · letto incluso')
  const a = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(a.righe.map(r => [r.testo, r.importo]), [['Allegra · 1 notte × 85 €', '85 €'], ['Ambra · 2 notti × 75 €', '150 €']])
  assert.equal(a.totale.importo, '235 €')
  // il letto solo in alcune notti di un tratto: gli importi a notte non sono uguali, si dice il totale
  assert.equal(sottoPerNotte([{ cameraId: 'x', camera: 'Ambra', check_in: '2026-12-01', check_out: '2026-12-04', notti: 3, aNotte: 80, letto: 10, pienoCent: 25000 }], 500), '235 € in tutto · letto incluso')
})

test('la seconda scelta: il totale scritto a mano, l’anteprima si aggiorna, e i controlli sul numero', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const con = (testo: string) => anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'finale', testo } })
  const a = con('250')
  assert.deepEqual(a.righe.map(r => [r.testo, r.importo]), [['Allegra · 1 notte × 90 €', '90 €'], ['Ambra · 2 notti × 90 €', '180 €']])
  assert.deepEqual(a.sconto && [a.sconto.testo, a.sconto.importo], ['Sconto', '−20 €'])
  assert.deepEqual([a.totale.importo, a.totaleCent, a.pulsante, a.errore], ['250 €', 25000, 'Conferma soggiorno · 250 €', null])
  assert.deepEqual(a.scelta, { tipo: 'finale', totaleCent: 25000 })
  // la virgola va bene
  assert.equal(con('249,50').totaleCent, 24950)
  // vuoto, troppo alto, uguale al pieno (= senza sconto), sotto zero
  assert.deepEqual([con('').errore, con('').pulsante, con('').scelta], [SCRIVI_IL_TOTALE, CONFERMA_SOGGIORNO, null])
  assert.equal(con('300').errore, TOTALE_TROPPO_ALTO(27000))
  assert.match(TOTALE_TROPPO_ALTO(27000), /270 €/)
  assert.deepEqual([con('270').errore, con('270').nota, con('270').scelta, con('270').sconto], [null, SENZA_SCONTO_TESTO, SENZA_SCONTO, null])
  assert.equal(con('0').errore !== null, true)
  assert.equal(con('abc').errore !== null, true)
  // e il piano col nuovo totale: 250 ripartiti fra i tratti al centesimo
  const piano = pianoNotti(notti, segmenti, ctx, { tipo: 'finale', totaleCent: 25000 })
  assert.equal(piano.errore, null)
  const totali = [piano.aggiorna[0].campi.total_amount, piano.crea[0].total_amount]
  assert.deepEqual(totali, [83.33, 166.67])
  assert.equal(Math.round(totali.reduce((s, t) => s + t, 0) * 100), 25000)
  // «senza sconto» scrive null per davvero, anche sul tratto rimasto uguale
  const nessuno = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO)
  assert.deepEqual([nessuno.aggiorna[0].campi.discount_type, nessuno.aggiorna[0].campi.discount_value, nessuno.aggiorna[0].campi.total_amount], [null, null, 90])
})

test('il soggiorno accorciato: «Il soggiorno si accorcia», 5 € a notte restano, e il totale concordato che non sta più sotto il pieno non blocca', () => {
  // tre notti in Allegra a 90 concordate 255 (5 € a notte): si torna a una notte
  const tre = riga('t', ALLEGRA, '2026-11-29', '2026-12-02', { extra_bed_dates: ['2026-11-29', '2026-11-30', '2026-12-01'], extra_bed_total: 30, discount_value: 255, total_amount: 255 })
  const ctx = contesto([ALLEGRA, AMBRA])
  const notti = nottiConDate(nottiDaSegmenti([tre]), '2026-11-29', '2026-11-30', ctx)
  const senza = pianoNotti(notti, [tre], ctx, SENZA_SCONTO)
  assert.equal(senza.errore, null)
  assert.equal(serveConfermaPrezzo([tre], [tre], senza), true)
  assert.equal(titoloConferma(3, dopoIlCambio(senza.tratti).notti), TITOLO_ACCORCIA)
  assert.equal(sottotitoloConferma(3, senza.tratti), 'Da 3 a 1 notte · 29 → 30 nov')
  const { opzione } = opzionePerNotte([tre], [tre], senza.tratti)
  assert.equal(opzione?.centANotte, 500)
  const a = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual([a.totale.importo, a.sconto?.testo], ['85 €', 'Sconto: 1 notte × 5 €'])
  // con 200 concordati su 270 (non si divide per 3): niente prima scelta, e il piano
  // vecchio si fermava con «sconto decaduto» — il foglio invece chiede il nuovo totale
  const duecento = { ...tre, discount_value: 200, total_amount: 200 }
  assert.equal(pianoNotti(notti, [duecento], ctx).errore, SCONTO_DECADUTO)
  const senza2 = pianoNotti(notti, [duecento], ctx, SENZA_SCONTO)
  assert.equal(senza2.errore, null)
  assert.equal(serveConfermaPrezzo([duecento], [duecento], senza2), true)
  assert.deepEqual(opzionePerNotte([duecento], [duecento], senza2.tratti), { opzione: null, motivo: MOTIVO_NON_SI_DIVIDE(7000, 3) })
  assert.match(MOTIVO_NON_SI_DIVIDE(7000, 3), /70 €.*3 notti/)
})

test('camere contemporanee: niente sconto diviso per i giorni, si chiede il totale dell’intero soggiorno e la quota della sorella viaggia insieme', () => {
  // lei in Lena 20 → 22 nov (160, concordati 150), la sorella in Amelia 20 → 22 (130, concordati 120): 270 in tutto
  const lei = riga('lei', LENA, '2026-11-20', '2026-11-22', { num_guests: 2, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, price_per_night: 80, discount_value: 150, total_amount: 150, group_id: 'L' })
  const sorella = riga('sor', AMELIA, '2026-11-20', '2026-11-22', { num_guests: 1, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, price_per_night: 65, discount_value: 120, total_amount: 120, group_id: 'S' })
  const tutti = [lei, sorella]
  const linee = lineeDelSoggiorno(tutti)
  const lineaLei = linee.find(l => l.chiave === 'L')!
  const ctx = contestoLinea(lineaLei, linee, contesto([LENA, AMELIA, AMBRA], { ospiti: 2 }))
  // lei resta una notte in più: 20 → 23
  const notti = nottiConDate(lineaLei.notti, '2026-11-20', '2026-11-23', ctx)
  const senza = pianoNotti(notti, lineaLei.segmenti, ctx, SENZA_SCONTO)
  assert.equal(senza.errore, null)
  assert.equal(serveConfermaPrezzo(lineaLei.segmenti, tutti, senza), true)
  assert.deepEqual(opzionePerNotte(lineaLei.segmenti, tutti, senza.tratti), { opzione: null, motivo: MOTIVO_PIU_CAMERE })
  const a = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [sorella], ricevutiCent: 0, scelta: { tipo: 'finale', testo: '340' } })
  assert.deepEqual(a.righe.map(r => [r.testo, r.importo]), [['Lena · 3 notti × 80 €', '240 €'], ['Amelia · 20 → 22 · 2 notti', '130 €']])
  assert.equal(a.pieno.importo, '370 €')
  assert.equal(a.sconto?.importo, '−30 €')
  assert.equal(a.totaleCent, 34000)
  // 340 ripartiti fra Lena (240) e Amelia (130) in proporzione, al centesimo
  assert.equal(a.scelta?.tipo, 'finale')
  const quotaLei = a.scelta?.tipo === 'finale' ? a.scelta.totaleCent : 0
  assert.equal(a.altre.length, 1)
  assert.equal(a.altre[0].id, 'sor')
  assert.equal(a.altre[0].campi.discount_type, 'target_total')
  assert.equal(quotaLei + Math.round(a.altre[0].campi.total_amount * 100), 34000)
  // il piano della linea porta la sua quota, e la sorella la sua: la somma è 340
  const piano = pianoNotti(notti, lineaLei.segmenti, ctx, a.scelta!)
  assert.equal(piano.errore, null)
  assert.equal(Math.round(piano.aggiorna[0].campi.total_amount * 100), quotaLei)
  // col totale uguale al pieno anche la sorella torna senza sconto
  const pieno = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [sorella], ricevutiCent: 0, scelta: { tipo: 'finale', testo: '370' } })
  assert.deepEqual(pieno.altre[0].campi, { discount_type: null, discount_value: null, total_amount: 130 })
  // accordi diversi dentro la linea: niente prima scelta
  const misto = [riga('m1', ALLEGRA, '2026-11-29', '2026-11-30'), riga('m2', AMBRA, '2026-11-30', '2026-12-01', { discount_type: null, discount_value: null, total_amount: 90, group_id: 'M' })]
  assert.equal(opzionePerNotte(misto, misto, senza.tratti).motivo, MOTIVO_ACCORDI_DIVERSI)
})

test('letto messo a mano per due ospiti: il letto segue le notti nuove con l’accordo, e 5 € a notte restano', () => {
  // Allegra in due col letto (dormono separati), accordo 10 € a notte (0048): 80 + 10 = 90, concordati 85
  const due = riga('d', ALLEGRA, '2026-12-10', '2026-12-11', { num_guests: 2, extra_bed_importo: 10, extra_bed_criterio: 'notte' })
  const ctx = contesto([ALLEGRA, AMBRA], { ospiti: 2 })
  const notti = nottiConDate(nottiDaSegmenti([due]), '2026-12-10', '2026-12-13', ctx)
  assert.deepEqual(notti.map(n => n.letto), [true, true, true])
  const senza = pianoNotti(notti, [due], ctx, SENZA_SCONTO)
  assert.equal(senza.errore, null)
  assert.deepEqual(senza.tratti.map(t => [t.notti, t.letto, t.pienoCent]), [[3, 30, 27000]])
  const { opzione } = opzionePerNotte([due], [due], senza.tratti)
  assert.deepEqual(opzione, { centANotte: 500, etichetta: 'Mantieni 5 € di sconto a notte', sotto: '85 € a notte · letto incluso' })
  const piano = pianoNotti(notti, [due], ctx, { tipo: 'per_notte', centANotte: 500 })
  assert.deepEqual([piano.aggiorna[0].campi.extra_bed_total, piano.aggiorna[0].campi.total_amount, piano.aggiorna[0].campi.extra_bed_importo], [30, 255, 10])
})

test('i pagamenti già presenti: «Già incassati» e «Resta da incassare», o la differenza se superano il nuovo totale — senza toccarli', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const poco = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 10000, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(poco.sotto.map(r => [r.testo, r.importo]), [[RIGA_INCASSATI, '100 €'], [RIGA_RESTA, '155 €']])
  assert.equal(poco.oltre, null)
  const troppo = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 30000, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(troppo.sotto.map(r => [r.testo, r.importo]), [[RIGA_INCASSATI, '300 €']])
  assert.equal(troppo.oltre, OLTRE_IL_TOTALE(4500))
  assert.match(OLTRE_IL_TOTALE(4500), /45 € oltre il nuovo totale/)
  assert.match(OLTRE_IL_TOTALE(4500), /i pagamenti restano come sono/)
})

// ── La pagina e il foglio, letti dai sorgenti ──────────────────────────────
const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('il foglio: niente si scrive finché non si conferma; «Torna alle modifiche» chiude solo il foglio e la bozza resta sotto', () => {
  const foglio = leggi('components/scheda/FoglioPrezzoSoggiorno.tsx')
  const pagina = leggi('app/scheda/[id]/page.tsx')
  assert.equal(/supabase/.test(foglio), false, 'il foglio non deve scrivere niente')
  assert.match(foglio, /import Foglio, \{ PiedeFoglio \} from '\.\/Foglio'/)
  assert.match(foglio, /testoAnnulla=\{TORNA_ALLE_MODIFICHE\}/)
  assert.match(foglio, /onAnnulla=\{onTorna\}/)
  assert.match(foglio, /if \(salvando \|\| anteprima\.errore \|\| !anteprima\.scelta\) return/)
  assert.match(foglio, /data-scelta-prezzo=\{dati\}/)
  assert.match(foglio, /dati="per-notte"/)
  assert.match(foglio, /dati="nuovo-prezzo"/)
  assert.match(foglio, /data-campo="totale-soggiorno"/)
  // la scelta apre il foglio SENZA chiudere quello di partenza; salva, chiude tutto
  assert.match(pagina, /if \(serveConfermaPrezzo\(linea\.segmenti, attive, senza\)\) \{ setPrezzoDaConfermare\(\{ linea, nuove, tratti: senza\.tratti \}\); return \}/)
  assert.match(pagina, /onTorna=\{\(\) => setPrezzoDaConfermare\(null\)\}/)
  assert.match(pagina, /onConferma=\{prezzo => \{ void salvaNotti\(prezzoDaConfermare\.linea, prezzoDaConfermare\.nuove, prezzo\) \}\}/)
  assert.match(pagina, /const chiudiFogliSoggiorno = \(\) => \{ setPrezzoDaConfermare\(null\); setNotteAperta\(null\); setDateAperte\(null\); setCambioAperto\(null\) \}/)
  // soggiorno e prezzo insieme, in un colpo solo, con le altre camere
  assert.match(pagina, /supabase\.rpc\('sposta_notti', dati\), prezzo\?\.altre \?\? \[\]\)/)
  // doppio tocco: mentre salva il tasto è spento e salvaNotti non riparte
  assert.match(pagina, /salvando=\{salvandoNotti\}/)
  assert.match(pagina, /if \(!booking \|\| salvandoNotti \|\| salvataggioNotti\.current \|\| stessaStriscia\(linea\.notti, nuove\)\) return/)
  assert.match(pagina, /salvataggioNotti\.current = true\n\s+setSalvandoNotti\(true\)/)
  // risposta persa: la scheda rilegge e non si fida del conto
  assert.match(pagina, /if \(esito\.incerto\) \{ invalida\(esito\.messaggio\); return \}/)
  // il foglio sta DOPO gli altri fogli del soggiorno: si vede sopra
  assert.ok(pagina.indexOf('<FoglioPrezzoSoggiorno') > pagina.indexOf('<FoglioDate') && pagina.indexOf('<FoglioPrezzoSoggiorno') > pagina.indexOf('<FoglioNotte'))
})
