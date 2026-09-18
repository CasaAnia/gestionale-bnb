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
  scelteTengo, scontoDiPrima, sottoScontati, scontatiPerTratto, righeDeiTratti, anteprimaSoggiorno, periodoConMese,
  TITOLO_ALLUNGA, TITOLO_ACCORCIA, TITOLO_CAMBIA, SCELTA_PER_NOTTE, SCELTA_IN_TUTTO, SOTTO_IN_TUTTO, SCELTA_NUOVO_PREZZO, ETICHETTA_TOTALE_SOGGIORNO,
  TORNA_ALLE_MODIFICHE, CONFERMA, DOMANDA_PREZZO, TITOLO_NUOVO_CONTO, SCRIVI_IL_TOTALE, TOTALE_TROPPO_ALTO, SENZA_SCONTO_TESTO,
  MOTIVO_PIU_CAMERE, MOTIVO_ACCORDI_DIVERSI, MOTIVO_A_ZERO, OLTRE_IL_TOTALE, RIGA_INCASSATI, RIGA_RESTA,
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

// Il caso vero di Maurizio Stuppino, com'è salvato: Allegra 29 → 30 nov (90,
// concordati 28,33) e Ambra 30 nov → 2 dic (180, concordati 56,67): 85 in tutto
const STUPPINO = [
  riga('s1', ALLEGRA, '2026-11-29', '2026-11-30', { discount_value: 28.33, total_amount: 28.33, group_id: 'S' }),
  riga('s2', AMBRA, '2026-11-30', '2026-12-02', { extra_bed_dates: ['2026-11-30', '2026-12-01'], extra_bed_total: 20, discount_value: 56.67, total_amount: 56.67, group_id: 'S' }),
]
// Stuppino allungato di una notte: 29 nov → 3 dic, l'ultima notte ancora in Ambra
function stuppinoQuattroNotti() {
  const ctx = contesto([ALLEGRA, AMBRA])
  const notti = nottiConDate(nottiDaSegmenti(STUPPINO), '2026-11-29', '2026-12-03', ctx)
  return { segmenti: STUPPINO, ctx, notti, tratti: pianoNotti(notti, STUPPINO, ctx, SENZA_SCONTO).tratti }
}

test('la riga «Prima: … − … di sconto = … per N notti», coi numeri di quella prenotazione', () => {
  assert.deepEqual(primaDelCambio([ALLEGRA_UNA_NOTTE]), { notti: 1, pienoCent: 9000, scontoCent: 500, totaleCent: 8500 })
  assert.equal(riepilogoPrima(primaDelCambio([ALLEGRA_UNA_NOTTE])), 'Prima: 90 € − 5 € di sconto = 85 € per 1 notte')
  assert.equal(riepilogoPrima({ notti: 3, pienoCent: 27000, scontoCent: 1500, totaleCent: 25500 }), 'Prima: 270 € − 15 € di sconto = 255 € per 3 notti')
  assert.equal(riepilogoPrima(primaDelCambio([ALLEGRA_DIECI_PER_CENTO])), 'Prima: 90 € − 9 € di sconto = 81 € per 1 notte')
  // Stuppino: prezzo pieno di prima, meno lo sconto di prima, uguale quello che pagava, per quante notti erano
  assert.deepEqual(primaDelCambio(STUPPINO), { notti: 3, pienoCent: 27000, scontoCent: 18500, totaleCent: 8500 })
  assert.equal(riepilogoPrima(primaDelCambio(STUPPINO)), 'Prima: 270 € − 185 € di sconto = 85 € per 3 notti')
  assert.equal(scontoDiPrima(STUPPINO), 18500)
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

test('la testa del foglio: «Il soggiorno si allunga» · «Da 1 a 3 notti · 29 nov → 2 dic» · «Come aggiorno il prezzo»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  assert.equal(titoloConferma(1, 3), TITOLO_ALLUNGA)
  assert.equal(titoloConferma(3, 1), TITOLO_ACCORCIA)
  assert.equal(titoloConferma(3, 3), TITOLO_CAMBIA)
  assert.equal(TITOLO_ALLUNGA, 'Il soggiorno si allunga')
  assert.equal(TITOLO_ACCORCIA, 'Il soggiorno si accorcia')
  assert.equal(sottotitoloConferma(1, tratti), 'Da 1 a 3 notti · 29 nov → 2 dic')
  assert.equal(sottotitoloConferma(3, tratti), 'Sempre 3 notti · 29 nov → 2 dic')
  assert.equal(periodoConMese('2026-09-10', '2026-09-13'), '10 → 13 set')
  assert.equal(DOMANDA_PREZZO, 'Come aggiorno il prezzo')
  assert.equal(TITOLO_NUOVO_CONTO, 'Il nuovo conto')
})

test('le tre scelte: «Tengo lo stesso sconto a notte» (85 € a notte, letto compreso), «Tengo lo stesso sconto in tutto» (5 € sul nuovo totale), «Concordo un prezzo nuovo»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const { aNotte, motivo, inTutto } = scelteTengo(segmenti, segmenti, tratti)
  assert.equal(motivo, null)
  assert.deepEqual(aNotte, { scelta: { tipo: 'per_notte', centANotte: 500 }, etichetta: 'Tengo lo stesso sconto a notte', sotto: '85 € a notte, letto compreso' })
  assert.deepEqual(inTutto, { scelta: { tipo: 'in_tutto', scontoCent: 500 }, etichetta: 'Tengo lo stesso sconto in tutto', sotto: '5 € di sconto sul nuovo totale' })
  assert.equal(SCELTA_PER_NOTTE, 'Tengo lo stesso sconto a notte')
  assert.equal(SCELTA_IN_TUTTO, 'Tengo lo stesso sconto in tutto')
  assert.equal(SOTTO_IN_TUTTO(18500), '185 € di sconto sul nuovo totale')
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

test('le tre scelte si cambiano avanti e indietro e il conto cambia con ognuna: 255 € a notte, 265 € in tutto, 250 € col prezzo nuovo, e di nuovo 255 €', () => {
  const { segmenti, ctx, notti } = treNottiAmbra()
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const scelte = scelteTengo(segmenti, segmenti, tratti)
  const con = (scelta: Parameters<typeof anteprimaSoggiorno>[0]['scelta']) => anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta })
  const aNotte = con(scelte.aNotte!.scelta)
  const inTutto = con(scelte.inTutto!.scelta)
  const nuovo = con({ tipo: 'finale', testo: '250' })
  const ancora = con(scelte.aNotte!.scelta)
  assert.deepEqual([aNotte.daPagare, inTutto.daPagare, nuovo.daPagare, ancora.daPagare], ['255 €', '265 €', '250 €', '255 €'])
  assert.deepEqual([aNotte.sconto?.importo, inTutto.sconto?.importo, nuovo.sconto?.importo, ancora.sconto?.importo], ['−15 €', '−5 €', '−20 €', '−15 €'])
  assert.deepEqual([aNotte.pulsante, inTutto.pulsante, nuovo.pulsante], ['Conferma · 255 €', 'Conferma · 265 €', 'Conferma · 250 €'])
  assert.deepEqual([aNotte.sotto, inTutto.sotto, nuovo.sotto], [
    '3 notti · 85 € a notte · prezzo pieno 270 €, sconto 15 €',
    '3 notti · 88,33 € a notte · prezzo pieno 270 €, sconto 5 €',
    '3 notti · 83,33 € a notte · prezzo pieno 270 €, sconto 20 €',
  ])
  // le righe delle camere sono le stesse in tutte e tre: cambia solo lo sconto
  assert.deepEqual(inTutto.righe, aNotte.righe)
  assert.deepEqual(nuovo.righe, aNotte.righe)
  // «in tutto» va al piano come totale concordato della linea: 265 ripartiti fra i tratti
  assert.deepEqual(inTutto.scelta, { tipo: 'finale', totaleCent: 26500 })
  const piano = pianoNotti(notti, segmenti, ctx, inTutto.scelta!)
  assert.equal(piano.errore, null)
  assert.equal(Math.round((piano.aggiorna[0].campi.total_amount + piano.crea[0].total_amount) * 100), 26500)
})

test('Maurizio Stuppino allungato di una notte: lo sconto di prima (185 € su 3 notti) si applica anche se non si divide esatto', () => {
  const { segmenti, ctx, notti, tratti } = stuppinoQuattroNotti()
  assert.deepEqual(tratti.map(t => [t.camera, t.notti, t.pienoCent]), [['Allegra', 1, 9000], ['Ambra', 3, 27000]])
  assert.equal(sottotitoloConferma(3, tratti), 'Da 3 a 4 notti · 29 nov → 3 dic')
  const scelte = scelteTengo(segmenti, segmenti, tratti)
  // a notte: 185 / 3 = 61,67 a notte, tolti da ogni notte nuova (28,33 a notte)
  assert.equal(scelte.motivo, null)
  assert.ok(Math.abs(scelte.aNotte!.scelta.tipo === 'per_notte' ? scelte.aNotte!.scelta.centANotte - 18500 / 3 : 1) < 1e-9)
  assert.deepEqual([scelte.aNotte!.etichetta, scelte.aNotte!.sotto], ['Tengo lo stesso sconto a notte', '28,33 € a notte, letto compreso'])
  const aNotte = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: scelte.aNotte!.scelta })
  assert.deepEqual(aNotte.righe.map(r => [r.titolo, r.dettaglio, r.importo]), [['Allegra', '29 → 30 nov · 1 notte × 80 €', '80 €'], ['Ambra', '30 nov → 3 dic · 3 notti × 80 €', '240 €'], ['Letto in più', '4 notti × 10 €', '40 €']])
  assert.deepEqual([aNotte.daPagare, aNotte.sconto?.importo, aNotte.sotto, aNotte.pulsante], ['113,33 €', '−247 €', '4 notti · 28,33 € a notte · prezzo pieno 360 €, sconto 247 €', 'Conferma · 113,33 €'])
  // e il piano scrive gli stessi numeri, al centesimo: 28,33 + 85 = 113,33
  const piano = pianoNotti(notti, segmenti, ctx, aNotte.scelta!)
  assert.equal(piano.errore, null)
  // (Allegra resta com'è, 28,33: non si riscrive; Ambra si allunga a 85)
  const toccate = new Set([...piano.aggiorna.map(a => a.id), ...piano.annulla])
  const ferme = STUPPINO.filter(r => !toccate.has(r.id)).map(r => Number(r.total_amount))
  const scritti = [...piano.aggiorna.map(a => a.campi.total_amount), ...piano.crea.map(c => c.total_amount), ...ferme]
  assert.equal(Math.round(scritti.reduce((s, t) => s + t, 0) * 100), 11333)
  // in tutto: 360 − 185 = 175
  assert.deepEqual([scelte.inTutto!.etichetta, scelte.inTutto!.sotto], ['Tengo lo stesso sconto in tutto', '185 € di sconto sul nuovo totale'])
  const inTutto = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: scelte.inTutto!.scelta })
  assert.deepEqual([inTutto.daPagare, inTutto.sconto?.importo, inTutto.sotto], ['175 €', '−185 €', '4 notti · 43,75 € a notte · prezzo pieno 360 €, sconto 185 €'])
  // prezzo nuovo: 340
  const nuovo = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'finale', testo: '340' } })
  assert.deepEqual([nuovo.daPagare, nuovo.sconto?.importo, nuovo.aNotteCampo], ['340 €', '−20 €', '85 € a notte'])
  // uno sconto a notte che azzera un tratto non si propone: 89,33 € a notte su una notte da 50
  const enorme = [{ ...STUPPINO[0], discount_value: 1, total_amount: 1 }, { ...STUPPINO[1], discount_value: 1, total_amount: 1 }]
  const bassa = [{ ...tratti[0], aNotte: 40, letto: 10, pienoCent: 5000 }, tratti[1]]
  assert.equal(scelteTengo(enorme, enorme, bassa).motivo, MOTIVO_A_ZERO(Math.round(26800 / 3)))
  assert.equal(scelteTengo(enorme, enorme, tratti).motivo, null)
})

test('con la percentuale «Tengo lo stesso sconto a notte» tiene il 10 %, «in tutto» tiene i 9 €, e il conto dice «Sconto 10 %»', () => {
  const { segmenti, ctx, notti } = treNottiAmbra(AMBRA, ALLEGRA_DIECI_PER_CENTO)
  const tratti = pianoNotti(notti, segmenti, ctx, SENZA_SCONTO).tratti
  const { aNotte, motivo, inTutto } = scelteTengo(segmenti, segmenti, tratti)
  assert.equal(motivo, null)
  assert.deepEqual(aNotte, { scelta: { tipo: 'percentuale', percento: 10 }, etichetta: 'Tengo lo stesso sconto a notte', sotto: '81 € a notte, letto compreso' })
  assert.deepEqual(inTutto, { scelta: { tipo: 'in_tutto', scontoCent: 900 }, etichetta: 'Tengo lo stesso sconto in tutto', sotto: '9 € di sconto sul nuovo totale' })
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
  const { aNotte } = scelteTengo(segmenti, segmenti, tratti)
  assert.equal(aNotte?.sotto, '85 € e 75 € a notte, letto compreso')
  const a = anteprimaSoggiorno({ tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), [['Allegra', '29 → 30 nov · 1 notte × 80 €', '80 €'], ['Ambra', '30 nov → 2 dic · 2 notti × 70 €', '140 €'], ['Letto in più', '3 notti × 10 €', '30 €']])
  assert.deepEqual([a.daPagare, a.sconto?.importo, a.sotto], ['235 €', '−15 €', '3 notti · 78,33 € a notte · prezzo pieno 250 €, sconto 15 €'])
  // il letto solo in alcune notti di un tratto: si dice quanto viene a notte al centesimo
  const tratto = { cameraId: 'x', camera: 'Ambra', check_in: '2026-12-01', check_out: '2026-12-04', notti: 3, aNotte: 80, letto: 10, pienoCent: 25000, nottiLetto: 1 }
  assert.equal(sottoScontati([tratto], scontatiPerTratto([tratto], { tipo: 'per_notte', centANotte: 500 })), '78,33 € a notte, letto compreso')
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
  assert.equal(sottotitoloConferma(3, senza.tratti), 'Da 3 a 1 notte · 29 → 30 nov')
  assert.equal(riepilogoPrima(primaDelCambio([tre])), 'Prima: 270 € − 15 € di sconto = 255 € per 3 notti')
  const { aNotte, inTutto } = scelteTengo([tre], [tre], senza.tratti)
  assert.deepEqual(aNotte?.scelta, { tipo: 'per_notte', centANotte: 500 })
  assert.equal(aNotte?.sotto, '85 € a notte, letto compreso')
  // «in tutto» accorciando: 15 € su 90 → 75 €
  assert.deepEqual(inTutto?.scelta, { tipo: 'in_tutto', scontoCent: 1500 })
  const tutto = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [], ricevutiCent: 0, scelta: inTutto!.scelta })
  assert.deepEqual([tutto.daPagare, tutto.sconto?.importo], ['75 €', '−15 €'])
  const a = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [], ricevutiCent: 0, scelta: { tipo: 'per_notte', centANotte: 500 } })
  assert.deepEqual(a.righe.map(r => [r.titolo, r.dettaglio, r.importo]), [['Allegra', '29 → 30 nov · 1 notte × 80 €', '80 €'], ['Letto in più', '1 notte × 10 €', '10 €']])
  assert.deepEqual([a.daPagare, a.sconto?.testo, a.sconto?.importo, a.sotto, a.pulsante], ['85 €', 'Sconto', '−5 €', '1 notte · 85 € a notte · prezzo pieno 90 €, sconto 5 €', 'Conferma · 85 €'])
  // con 200 concordati su 270 (70 di sconto, non si divide per 3): il piano vecchio
  // si fermava con «sconto decaduto» — il foglio invece propone 23,33 € a notte
  const duecento = { ...tre, discount_value: 200, total_amount: 200 }
  assert.equal(pianoNotti(notti, [duecento], ctx).errore, SCONTO_DECADUTO)
  const senza2 = pianoNotti(notti, [duecento], ctx, SENZA_SCONTO)
  assert.equal(senza2.errore, null)
  assert.equal(serveConfermaPrezzo([duecento], [duecento], senza2), true)
  const s2 = scelteTengo([duecento], [duecento], senza2.tratti)
  assert.equal(s2.aNotte?.sotto, '66,67 € a notte, letto compreso')
  const a2 = anteprimaSoggiorno({ tratti: senza2.tratti, altreRighe: [], ricevutiCent: 0, scelta: s2.aNotte!.scelta })
  assert.deepEqual([a2.daPagare, a2.sconto?.importo], ['66,67 €', '−23 €'])
  // e «in tutto» qui non si può: 70 € di sconto su 90 € di prezzo pieno sì, ma su una notte da 90 resta 20
  assert.deepEqual(s2.inTutto?.scelta, { tipo: 'in_tutto', scontoCent: 7000 })
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
  const scelte = scelteTengo(lineaLei.segmenti, tutti, senza.tratti)
  assert.deepEqual([scelte.aNotte, scelte.motivo], [null, MOTIVO_PIU_CAMERE])
  // «in tutto» c'è: 20 di sconto in tutto (10 + 10) sul nuovo pieno 370 → 350, ripartiti fra lei e la sorella
  assert.deepEqual(scelte.inTutto?.scelta, { tipo: 'in_tutto', scontoCent: 2000 })
  const tutto = anteprimaSoggiorno({ tratti: senza.tratti, altreRighe: [sorella], ricevutiCent: 0, scelta: scelte.inTutto!.scelta })
  assert.deepEqual([tutto.totaleCent, tutto.altre.length, tutto.scelta?.tipo], [35000, 1, 'finale'])
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
  assert.equal(scelteTengo(misto, misto, senza.tratti).motivo, MOTIVO_ACCORDI_DIVERSI)
  // con la stessa percentuale su tutte e due le camere invece «Tengo il 10 %» si può proporre, e la sorella resta com'è
  const leiP = { ...lei, discount_type: 'percentage', discount_value: 10, total_amount: 144 }
  const sorellaP = { ...sorella, discount_type: 'percentage', discount_value: 10, total_amount: 117 }
  const p = scelteTengo([leiP], [leiP, sorellaP], senza.tratti)
  assert.deepEqual(p.aNotte?.scelta, { tipo: 'percentuale', percento: 10 })
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
  const { aNotte } = scelteTengo([due], [due], senza.tratti)
  assert.deepEqual(aNotte, { scelta: { tipo: 'per_notte', centANotte: 500 }, etichetta: 'Tengo lo stesso sconto a notte', sotto: '85 € a notte, letto compreso' })
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
  // le TRE scelte col pallino e il filo sotto; «Tengo lo stesso sconto a notte» è accesa di partenza quando si può
  assert.match(foglio, /useState<'a_notte' \| 'in_tutto' \| 'finale'>\(tengo\.aNotte \? 'a_notte' : tengo\.inTutto \? 'in_tutto' : 'finale'\)/)
  assert.match(foglio, /role="radio" aria-checked=\{acceso\} data-scelta-prezzo=\{dati\}/)
  assert.match(foglio, /dati="a-notte"/)
  assert.match(foglio, /dati="in-tutto"/)
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
