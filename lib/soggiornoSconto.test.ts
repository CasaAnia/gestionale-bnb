// ============================================================================
// LO SCONTO QUANDO CAMBIA IL SOGGIORNO (17/09/2026, rifatto il 18/09/2026):
// il caso di Ania (Maurizio Stuppino) — Allegra, una notte in tre, 80 + 10 =
// 90 portati a 85; si aggiungono due notti in Ambra a 90 e si vuole tenere
// 5 € di sconto A NOTTE: 3 × 85 = 255. Prima il piano teneva 85 € per tutto il
// soggiorno e spalmava 61,67 e 123,33 sui due tratti. Qui le prove della
// logica pura del foglio «Il soggiorno si allunga».
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SENZA_SCONTO, primaDelCambio, dopoIlCambio, soggiornoConSconto, serveConfermaPrezzo, titoloConferma, sottotitoloConferma, riepilogoPrima,
  primaScelta, sottoScontati, scontatiPerTratto, righeDeiTratti, anteprimaSoggiorno, periodoConMese,
  TITOLO_ALLUNGA, TITOLO_ACCORCIA, TITOLO_CAMBIA, SCELTA_PER_NOTTE, SCELTA_PERCENTUALE, SCELTA_NUOVO_PREZZO, ETICHETTA_TOTALE_SOGGIORNO,
  TORNA_ALLE_MODIFICHE, CONFERMA, DOMANDA_PREZZO, TITOLO_NUOVO_CONTO, SCRIVI_IL_TOTALE, TOTALE_TROPPO_ALTO, SENZA_SCONTO_TESTO,
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
// la stessa notte col 10 % di sconto: 90 − 9 = 81
const ALLEGRA_DIECI_PER_CENTO = riga('p', ALLEGRA, '2026-11-29', '2026-11-30', { discount_type: 'percentage', discount_value: 10, total_amount: 81 })
// e senza sconto
const ALLEGRA_SENZA_SCONTO = riga('s', ALLEGRA, '2026-11-29', '2026-11-30', { discount_type: null, discount_value: null, total_amount: 90 })

// le tre notti di Ania: 29 nov → 2 dic, la prima in Allegra e le altre due in Ambra
function treNottiAmbra(ambra = AMBRA, prima = ALLEGRA_UNA_NOTTE) {
  const segmenti = [prima]
  const ctx = contesto([ALLEGRA, ambra])
  let notti = nottiConDate(nottiDaSegmenti(segmenti), '2026-11-29', '2026-12-02', ctx)
  notti = cambiaCamera(notti, '2026-11-30', ambra, ctx)
  notti = cambiaCamera(notti, '2026-12-01', ambra, ctx)
  return { segmenti, ctx, notti }
}
const RIGHE_PIENE_ANIA = [['Allegra', '29 → 30 nov · 1 notte × 80 €', '80 €'], ['Ambra', '30 nov → 2 dic · 2 notti × 80 €', '160 €'], ['Letto in più', '3 notti × 10 €', '30 €']]

test('prima del cambio: «prima: 90 € − 5 € di sconto = 85 € per una notte»', () => {
  assert.deepEqual(primaDelCambio([ALLEGRA_UNA_NOTTE]), { notti: 1, pienoCent: 9000, scontoCent: 500, totaleCent: 8500 })
  assert.equal(riepilogoPrima(primaDelCambio([ALLEGRA_UNA_NOTTE])), 'prima: 90 € − 5 € di sconto = 85 € per una notte')
  assert.equal(riepilogoPrima({ notti: 3, pienoCent: 27000, scontoCent: 1500, totaleCent: 25500 }), 'prima: 270 € − 15 € di sconto = 255 € per 3 notti')
  assert.equal(riepilogoPrima(primaDelCambio([ALLEGRA_DIECI_PER_CENTO])), 'prima: 90 € − 9 € di sconto = 81 € per una notte')
})

test('il foglio compare SOLO con lo sconto: prezzo finale o percentuale, mai senza', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const senza = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO)
  assert.equal(senza.errore, null)
  assert.deepEqual(senza.tratti.map(t => [t.camera, t.notti, t.pienoCent, t.letto, t.nottiLetto]), [['Allegra', 1, 9000, 10, 1], ['Ambra', 2, 18000, 20, 2]])
  assert.deepEqual(dopoIlCambio(senza.tratti), { notti: 3, pienoCent: 27000 })
  assert.equal(soggiornoConSconto(segmenti), true)
  assert.equal(serveConfermaPrezzo(segmenti, segmenti, senza), true)
  // con la percentuale il foglio serve lo stesso: si chiede come aggiornare il prezzo (Ania, 18/09/2026)
  const percento = [ALLEGRA_DIECI_PER_CENTO]
  assert.equal(soggiornoConSconto(percento), true)
  assert.equal(serveConfermaPrezzo(percento, percento, pianoNotti(notti, percento, ctx, SENZA_SCONTO)), true)
  // senza sconto il foglio NON compare e il conto si rifà da solo
  const nessuno = [ALLEGRA_SENZA_SCONTO]
  assert.equal(soggiornoConSconto(nessuno), false)
  assert.equal(serveConfermaPrezzo(nessuno, nessuno, pianoNotti(notti, nessuno, ctx, SENZA_SCONTO)), false)
  // una riga annullata con lo sconto non conta
  assert.equal(soggiornoConSconto([{ ...ALLEGRA_UNA_NOTTE, status: 'annullata' }, ALLEGRA_SENZA_SCONTO]), false)
  // e se notti e prezzo pieno non cambiano (stessa camera, stesse notti) nemmeno con lo sconto
  const ferme = pianoNotti(nottiDaSegmenti(segmenti), segmenti, ctx, SENZA_SCONTO)
  assert.equal(serveConfermaPrezzo(segmenti, segmenti, ferme), false)
})

test('la testa del foglio: «Il soggiorno si allunga» · «da 1 a 3 notti · 29 nov → 2 dic» · «Come aggiorno il prezzo»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  assert.equal(titoloConferma(1, 3), TITOLO_ALLUNGA)
  assert.equal(titoloConferma(3, 1), TITOLO_ACCORCIA)
  assert.equal(titoloConferma(3, 3), TITOLO_CAMBIA)
  assert.equal(TITOLO_ALLUNGA, 'Il soggiorno si allunga')
  assert.equal(TITOLO_ACCORCIA, 'Il soggiorno si accorcia')
  assert.equal(sottotitoloConferma(1, tratti), 'da 1 a 3 notti · 29 nov → 2 dic')
  assert.equal(sottotitoloConferma(3, tratti), 'sempre 3 notti · 29 nov → 2 dic')
  assert.equal(periodoConMese('2026-09-10', '2026-09-13'), '10 → 13 set')
  assert.equal(DOMANDA_PREZZO, 'Come aggiorno il prezzo')
  assert.equal(TITOLO_NUOVO_CONTO, 'Il nuovo conto')
})

test('la prima scelta: «Tengo 5 € di sconto a notte» con sotto «85 € a notte, letto compreso»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const { opzione, motivo } = primaScelta(segmenti, segmenti, tratti)
  assert.equal(motivo, null)
  assert.deepEqual(opzione, { scelta: { tipo: 'per_notte', centANotte: 500 }, etichetta: 'Tengo 5 € di sconto a notte', sotto: '85 € a notte, letto compreso' })
  assert.equal(SCELTA_PER_NOTTE(500), 'Tengo 5 € di sconto a notte')
  assert.equal(SCELTA_NUOVO_PREZZO, 'Concordo un prezzo nuovo')
  assert.equal(ETICHETTA_TOTALE_SOGGIORNO, 'Totale dell’intero soggiorno')
  assert.equal(TORNA_ALLE_MODIFICHE, 'Torna alle modifiche')
})

test('con la prima scelta il nuovo conto: le camere a prezzo pieno, il letto in una riga, «Sconto» −15 €, da pagare 255 €', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const a = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), RIGHE_PIENE_ANIA)
  assert.equal(a.pienoCent, 27000)
  assert.deepEqual(a.sconto, { testo: 'Sconto', importo: '−15 €' })
  assert.deepEqual([a.daPagare, a.totaleCent, a.notti], ['255 €', 25500, 3])
  assert.equal(a.sotto, '3 notti · 85 € a notte · prezzo pieno 270 €, sconto 15 €')
  assert.equal(a.pulsante, 'Conferma · 255 €')
  assert.equal(CONFERMA, 'Conferma')
  assert.equal(a.errore, null)
  assert.deepEqual(a.scelta, { tipo: 'per_notte', centANotte: 500 })
  assert.deepEqual(a.altre, [])
  assert.deepEqual(a.incassi, [])
  assert.equal(a.aNotteCampo, '')
})

test('le due scelte si cambiano avanti e indietro e il conto cambia: 255 € con lo sconto a notte, 250 € col prezzo nuovo, e di nuovo 255 €', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const tengo = primaScelta(segmenti, segmenti, tratti).opzione!.scelta
  const prima = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: tengo })
  const nuovo = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'finale', testo: '250' } })
  const ancora = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: tengo })
  assert.deepEqual([prima.daPagare, nuovo.daPagare, ancora.daPagare], ['255 €', '250 €', '255 €'])
  assert.deepEqual([prima.sconto?.importo, nuovo.sconto?.importo, ancora.sconto?.importo], ['−15 €', '−20 €', '−15 €'])
  assert.deepEqual([prima.pulsante, nuovo.pulsante, ancora.pulsante], ['Conferma · 255 €', 'Conferma · 250 €', 'Conferma · 255 €'])
  // le righe delle camere sono le stesse in tutte e due: cambia solo lo sconto
  assert.deepEqual(nuovo.righe, prima.righe)
  assert.equal(nuovo.sotto, '3 notti · 83,33 € a notte · prezzo pieno 270 €, sconto 20 €')
})

test('con la percentuale la prima scelta è «Tengo il 10 % di sconto», e il conto dice «Sconto 10 %»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra(AMBRA, ALLEGRA_DIECI_PER_CENTO)
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const { opzione, motivo } = primaScelta(segmenti, segmenti, tratti)
  assert.equal(motivo, null)
  assert.deepEqual(opzione, { scelta: { tipo: 'percentuale', percento: 10 }, etichetta: 'Tengo il 10 % di sconto', sotto: '81 € a notte, letto compreso' })
  assert.equal(SCELTA_PERCENTUALE(12.5), 'Tengo il 12,5 % di sconto')
  assert.deepEqual(scontatiPerTratto(tratti, { tipo: 'percentuale', percento: 10 }), [8100, 16200])
  const a = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'percentuale', percento: 10 } })
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), RIGHE_PIENE_ANIA)
  assert.deepEqual(a.sconto, { testo: 'Sconto 10 %', importo: '−27 €' })
  assert.deepEqual([a.daPagare, a.totaleCent, a.sotto], ['243 €', 24300, '3 notti · 81 € a notte · prezzo pieno 270 €, sconto 27 €'])
  assert.equal(a.pulsante, 'Conferma · 243 €')
  // il piano con la scelta scrive la percentuale su tutti i tratti, e riletto il conto fa 243
  const piano = pianoNotti(notti, segmenti, ctx, { tipo: 'percentuale', percento: 10 })
  assert.equal(piano.errore, null)
  const scritte = [...piano.aggiorna.map(x => ({ ...ALLEGRA_DIECI_PER_CENTO, ...x.campi })), ...piano.crea]
  const allegra = piano.aggiorna.length ? scritte[0] : ALLEGRA_DIECI_PER_CENTO
  const ambra = piano.crea[0]
  assert.deepEqual([ambra.discount_type, ambra.discount_value, ambra.total_amount], ['percentage', 10, 162])
  assert.equal(Math.round((contoSoggiorno(allegra).totale + contoSoggiorno(ambra).totale) * 100), 24300)
  // una percentuale che non è più tale ferma il piano
  assert.equal(pianoNotti(notti, segmenti, ctx, { tipo: 'percentuale', percento: 100 }).errore, SCONTO_DECADUTO)
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

test('tariffe diverse: con Ambra a 70 si tolgono 5 € dai prezzi veri — «85 € e 75 € a notte», da pagare 235, non «sempre 85»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra(AMBRA_70)
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  assert.deepEqual(tratti.map(t => t.pienoCent), [9000, 16000])
  const { opzione } = primaScelta(segmenti, segmenti, tratti)
  assert.equal(opzione?.sotto, '85 € e 75 € a notte, letto compreso')
  const a = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), [['Allegra', '29 → 30 nov · 1 notte × 80 €', '80 €'], ['Ambra', '30 nov → 2 dic · 2 notti × 70 €', '140 €'], ['Letto in più', '3 notti × 10 €', '30 €']])
  assert.deepEqual([a.daPagare, a.sconto?.importo, a.sotto], ['235 €', '−15 €', '3 notti · 78,33 € a notte · prezzo pieno 250 €, sconto 15 €'])
  // il letto solo in alcune notti di un tratto: gli importi a notte non sono uguali, si dice il totale
  const tratto = { cameraId: 'x', camera: 'Ambra', check_in: '2026-12-01', check_out: '2026-12-04', notti: 3, aNotte: 80, letto: 10, pienoCent: 25000, nottiLetto: 1 }
  assert.equal(sottoScontati([tratto], scontatiPerTratto([tratto], { tipo: 'per_notte', centANotte: 500 })), '235 € in tutto, letto compreso')
  // e la riga del letto senza «× 10 €» quando gli importi a notte non sono uno solo (Allegra 10, Amelia 5)
  const allegra = { cameraId: 'a', camera: 'Allegra', check_in: '2026-12-01', check_out: '2026-12-02', notti: 1, aNotte: 80, letto: 10, pienoCent: 9000, nottiLetto: 1 }
  const amelia = { cameraId: 'm', camera: 'Amelia', check_in: '2026-12-02', check_out: '2026-12-03', notti: 1, aNotte: 65, letto: 5, pienoCent: 7000, nottiLetto: 1 }
  assert.deepEqual(righeDeiTratti([allegra, amelia], []).map(r => [r.titolo, r.dettaglio, r.importo]), [['Allegra', '1 → 2 dic · 1 notte × 80 €', '80 €'], ['Amelia', '2 → 3 dic · 1 notte × 65 €', '65 €'], ['Letto in più', '2 notti', '15 €']])
})

test('la seconda scelta: il totale scritto a mano, accanto quanto viene a notte, l’anteprima si aggiorna, e i controlli sul numero', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const con = (testo: string) => anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'finale', testo } })
  const a = con('250')
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), RIGHE_PIENE_ANIA)
  assert.deepEqual(a.sconto, { testo: 'Sconto', importo: '−20 €' })
  assert.deepEqual([a.daPagare, a.totaleCent, a.pulsante, a.errore], ['250 €', 25000, 'Conferma · 250 €', null])
  assert.equal(a.aNotteCampo, '83,33 € a notte')
  assert.deepEqual(a.scelta, { tipo: 'finale', totaleCent: 25000 })
  // la virgola va bene
  assert.equal(con('249,50').totaleCent, 24950)
  assert.equal(con('255').aNotteCampo, '85 € a notte')
  // vuoto, troppo alto, uguale al pieno (= senza sconto), sotto zero
  assert.deepEqual([con('').errore, con('').pulsante, con('').scelta, con('').sconto, con('').aNotteCampo], [SCRIVI_IL_TOTALE, CONFERMA, null, null, ''])
  assert.equal(con('300').errore, TOTALE_TROPPO_ALTO(27000))
  assert.match(TOTALE_TROPPO_ALTO(27000), /270 €/)
  assert.deepEqual([con('270').errore, con('270').nota, con('270').scelta, con('270').sconto, con('270').sotto], [null, SENZA_SCONTO_TESTO, SENZA_SCONTO, null, '3 notti · 90 € a notte · prezzo pieno 270 €'])
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
  assert.equal(sottotitoloConferma(3, senza.tratti), 'da 3 a 1 notte · 29 → 30 nov')
  assert.equal(riepilogoPrima(primaDelCambio([tre])), 'prima: 270 € − 15 € di sconto = 255 € per 3 notti')
  const { opzione } = primaScelta([tre], [tre], senza.tratti)
  assert.deepEqual(opzione?.scelta, { tipo: 'per_notte', centANotte: 500 })
  assert.equal(opzione?.sotto, '85 € a notte, letto compreso')
  const a = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), [['Allegra', '29 → 30 nov · 1 notte × 80 €', '80 €'], ['Letto in più', '1 notte × 10 €', '10 €']])
  assert.deepEqual([a.daPagare, a.sconto?.testo, a.sconto?.importo, a.sotto, a.pulsante], ['85 €', 'Sconto', '−5 €', '1 notte · 85 € a notte · prezzo pieno 90 €, sconto 5 €', 'Conferma · 85 €'])
  // con 200 concordati su 270 (non si divide per 3): niente prima scelta, e il piano
  // vecchio si fermava con «sconto decaduto» — il foglio invece chiede il nuovo totale
  const duecento = { ...tre, discount_value: 200, total_amount: 200 }
  assert.equal(pianoNotti(notti, [duecento], ctx).errore, SCONTO_DECADUTO)
  const senza2 = pianoNotti(notti, [duecento], ctx, SENZA_SCONTO)
  assert.equal(senza2.errore, null)
  assert.equal(serveConfermaPrezzo([duecento], [duecento], senza2), true)
  assert.deepEqual(primaScelta([duecento], [duecento], senza2.tratti), { opzione: null, motivo: MOTIVO_NON_SI_DIVIDE(7000, 3) })
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
  assert.deepEqual(primaScelta(lineaLei.segmenti, tutti, senza.tratti), { opzione: null, motivo: MOTIVO_PIU_CAMERE })
  const a = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [sorella], ricevutiCent: 0, scelta: { tipo: 'finale', testo: '340' } })
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), [['Lena', '20 → 23 nov · 3 notti × 80 €', '240 €'], ['Amelia', '20 → 22 nov · 2 notti', '130 €']])
  assert.equal(a.pienoCent, 37000)
  assert.equal(a.sconto?.importo, '−30 €')
  assert.deepEqual([a.totaleCent, a.notti, a.aNotteCampo], [34000, 3, '113,33 € a notte'])
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
  assert.equal(primaScelta(misto, misto, senza.tratti).motivo, MOTIVO_ACCORDI_DIVERSI)
  // con la stessa percentuale su tutte e due le camere invece «Tengo il 10 %» si può proporre, e la sorella resta com'è
  const leiP = { ...lei, discount_type: 'percentage', discount_value: 10, total_amount: 144 }
  const sorellaP = { ...sorella, discount_type: 'percentage', discount_value: 10, total_amount: 117 }
  const p = primaScelta([leiP], [leiP, sorellaP], senza.tratti)
  assert.deepEqual(p.opzione?.scelta, { tipo: 'percentuale', percento: 10 })
  const ap = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [sorellaP], ricevutiCent: 0, scelta: { tipo: 'percentuale', percento: 10 } })
  assert.deepEqual([ap.totaleCent, ap.sconto, ap.altre], [21600 + 11700, { testo: 'Sconto 10 %', importo: '−37 €' }, []])
})

test('letto messo a mano per due ospiti: il letto segue le notti nuove con l’accordo, e 5 € a notte restano', () => {
  // Allegra in due col letto (dormono separati), accordo 10 € a notte (0048): 80 + 10 = 90, concordati 85
  const due = riga('d', ALLEGRA, '2026-12-10', '2026-12-11', { num_guests: 2, extra_bed_importo: 10, extra_bed_criterio: 'notte' })
  const ctx = contesto([ALLEGRA, AMBRA], { ospiti: 2 })
  const notti = nottiConDate(nottiDaSegmenti([due]), '2026-12-10', '2026-12-13', ctx)
  assert.deepEqual(notti.map(n => n.letto), [true, true, true])
  const senza = pianoNotti(notti, [due], ctx, SENZA_SCONTO)
  assert.equal(senza.errore, null)
  assert.deepEqual(senza.tratti.map(t => [t.notti, t.letto, t.pienoCent, t.nottiLetto]), [[3, 30, 27000, 3]])
  const { opzione } = primaScelta([due], [due], senza.tratti)
  assert.deepEqual(opzione, { scelta: { tipo: 'per_notte', centANotte: 500 }, etichetta: 'Tengo 5 € di sconto a notte', sotto: '85 € a notte, letto compreso' })
  assert.deepEqual(righeDeiTratti(senza.tratti, []).map(r => [r.titolo, r.dettaglio, r.importo]), [['Allegra', '10 → 13 dic · 3 notti × 80 €', '240 €'], ['Letto in più', '3 notti × 10 €', '30 €']])
  const piano = pianoNotti(notti, [due], ctx, { tipo: 'per_notte', centANotte: 500 })
  assert.deepEqual([piano.aggiorna[0].campi.extra_bed_total, piano.aggiorna[0].campi.total_amount, piano.aggiorna[0].campi.extra_bed_importo], [30, 255, 10])
})

test('i pagamenti già presenti: «Già incassati» e «Resta da incassare», o la differenza se superano il nuovo totale — senza toccarli', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const poco = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 10000, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(poco.incassi.map(r => [r.testo, r.importo]), [[RIGA_INCASSATI, '100 €'], [RIGA_RESTA, '155 €']])
  assert.equal(poco.oltre, null)
  const troppo = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 30000, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(troppo.incassi.map(r => [r.testo, r.importo]), [[RIGA_INCASSATI, '300 €']])
  assert.equal(troppo.oltre, OLTRE_IL_TOTALE(4500))
  assert.match(OLTRE_IL_TOTALE(4500), /45 € oltre il nuovo totale/)
  assert.match(OLTRE_IL_TOTALE(4500), /i pagamenti restano come sono/)
})

// ── La pagina e il foglio, letti dai sorgenti ──────────────────────────────
const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('il foglio: la veste chiesta da Ania — titolo Georgia 24 centrato, sotto 12,5 stone, riquadro #F5EFE2 con #7A5C1E, i titoletti in ottone, il conto nelle righe di sempre', () => {
  const foglio = leggi('components/scheda/FoglioPrezzoSoggiorno.tsx')
  const veste = leggi('components/scheda/Foglio.tsx')
  assert.match(foglio, /<Foglio titolo=\{titoloConferma\(prima\.notti, dopo\.notti\)\} centrato onChiudi=\{onTorna\}>/)
  assert.match(veste, /data-titolo-centrato className="text-green-dark text-center"[\s\S]{0,120}fontSize: 24, lineHeight: '28px'/)
  assert.match(foglio, /data-sottotitolo-prezzo className="text-center" style=\{\{ marginTop: -8, fontSize: 12\.5, color: 'var\(--color-stone\)' \}\}>\{sottotitoloConferma/)
  assert.match(foglio, /export const FONDO_PRIMA = '#F5EFE2'/)
  assert.match(foglio, /export const TESTO_PRIMA = '#7A5C1E'/)
  assert.match(foglio, /data-prima-del-cambio className="text-center" style=\{\{ marginTop: 14, padding: '9px 12px', borderRadius: 10, background: FONDO_PRIMA, fontSize: 12\.5, color: TESTO_PRIMA \}\}>\{riepilogoPrima\(prima\)\}/)
  // i due titoletti in ottone maiuscolo (Etichetta di PezziNuova)
  assert.match(foglio, /<Etichetta testo=\{DOMANDA_PREZZO\} ottone/)
  assert.match(foglio, /<Etichetta testo=\{TITOLO_NUOVO_CONTO\} ottone \/>/)
  // le due scelte col pallino e il filo sotto; «Tengo…» è accesa di partenza quando si può
  assert.match(foglio, /useState<'tengo' \| 'finale'>\(tengo\.opzione \? 'tengo' : 'finale'\)/)
  assert.match(foglio, /role="radio" aria-checked=\{acceso\} data-scelta-prezzo=\{dati\}/)
  assert.match(foglio, /dati="tengo"/)
  assert.match(foglio, /dati="nuovo-prezzo"/)
  // «Concordo un prezzo nuovo» aprendosi mostra il campo in euro e accanto, in ottone, quanto viene a notte
  assert.match(foglio, /data-campo="totale-soggiorno"/)
  assert.match(foglio, /data-a-notte-campo className="shrink-0" style=\{\{ fontSize: 12\.5, fontWeight: 600, color: OTTONE \}\}>\{anteprima\.aNotteCampo\}/)
  // il nuovo conto nelle righe condivise, «Da pagare» in Georgia 28 con sotto le notti e il prezzo a notte
  assert.match(foglio, /import \{ RigaConto, ScontoConto, DaPagareConto \} from '@\/components\/ContoRighe'/)
  assert.match(foglio, /\{anteprima\.righe\.map\(r => <RigaConto key=\{r\.chiave\} riga=\{r\} \/>\)\}/)
  assert.match(foglio, /<DaPagareConto importo=\{anteprima\.daPagare\} sotto=\{anteprima\.sotto\}>/)
  const righe = leggi('components/ContoRighe.tsx')
  assert.match(righe, /data-da-pagare[\s\S]{0,300}fontFamily: GEORGIA, fontSize: 28, lineHeight: '32px'/)
  assert.match(righe, /data-a-notte className="text-right" style=\{\{ fontSize: 12, color: 'var\(--color-stone\)', marginTop: 2 \}\}/)
  // in fondo la pastiglia «Conferma · 255 €» e «Torna alle modifiche» nel piede comune (13 px stone)
  assert.match(foglio, /<PiedeFoglio azione=\{anteprima\.pulsante\} onAzione=\{conferma\} salvando=\{salvando\}[\s\S]{0,80}onAnnulla=\{onTorna\} testoAnnulla=\{TORNA_ALLE_MODIFICHE\} dati="prezzo-soggiorno"/)
})

test('il foglio: niente si scrive finché non si conferma; «Torna alle modifiche» chiude solo il foglio e la bozza resta sotto', () => {
  const foglio = leggi('components/scheda/FoglioPrezzoSoggiorno.tsx')
  const pagina = leggi('app/scheda/[id]/page.tsx')
  assert.equal(/supabase/.test(foglio), false, 'il foglio non deve scrivere niente')
  assert.match(foglio, /import Foglio, \{ PiedeFoglio \} from '\.\/Foglio'/)
  assert.match(foglio, /testoAnnulla=\{TORNA_ALLE_MODIFICHE\}/)
  assert.match(foglio, /onAnnulla=\{onTorna\}/)
  assert.match(foglio, /if \(salvando \|\| anteprima\.errore \|\| !anteprima\.scelta\) return/)
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
