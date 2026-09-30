// ============================================================================
// IL PREZZO CONCORDATO A MANO nella scheda nuova (30/09/2026, audit Codex R5).
//
// Una riga senza sconto registrato ma con total_amount diverso da tariffa ×
// notti + letto è un prezzo preso con la cliente. Prima ogni modifica delle
// notti lo riscriveva col listino, in silenzio. Adesso:
//   · niente cambiato → niente scritto;
//   · solo il letto (o persone che non cambiano tariffa) → si sposta solo il
//     supplemento, il resto del concordato resta;
//   · date, camera, tariffa, tratti nuovi o tolti → il foglio «Il soggiorno
//     cambia» chiede il prezzo; senza passare dal foglio non si salva;
//   · i tratti intatti non si riscrivono; listino e sconti registrati come prima.
// Prove avversarie sulla logica pura (lib/strisciaNotti, lib/soggiornoSconto).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pianoNotti, nottiDaSegmenti, cambiaLetto, cambiaCamera, cambiaOspitiNotte, nonDormeQui, differenzaConcordata,
  PREZZO_CONCORDATO_DA_CONFERMARE, PREZZO_CONCORDATO_NEGATIVO,
  type CameraStriscia, type ContestoNotti, type SegmentoNotti, type NotteStriscia,
} from './strisciaNotti.ts'
import { SENZA_SCONTO, serveConfermaPrezzo, scontoDiPrima, scelteTengo, primaDelCambio } from './soggiornoSconto.ts'
import { nottiConDate } from './lineeSoggiorno.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMBRA: CameraStriscia = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: CameraStriscia = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5 }
const LENA: CameraStriscia = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const CAMERE = [AMBRA, AMELIA, LENA]
const ctx = (extra: Partial<ContestoNotti> = {}): ContestoNotti => ({ camere: CAMERE, altre: [], ospiti: 2, ...extra })

const NOTTI_OTT = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
// Ambra 1 → 5 ott, in tre col letto tutte le notti: 4 × 80 + 4 × 10 = 360 di
// listino, concordati 330 a voce, nessuno sconto registrato
const riga = (extra: Partial<SegmentoNotti> = {}): SegmentoNotti => ({
  id: 'a', room_id: 'ambra', rooms: AMBRA, check_in: '2026-10-01', check_out: '2026-10-05', status: 'confermata',
  num_guests: 3, extra_bed: true, extra_bed_dates: NOTTI_OTT, price_per_night: 80, extra_bed_total: 40, total_amount: 330,
  discount_type: null, discount_value: null, ...extra,
})
const C3 = ctx({ ospiti: 3 })
const tutti = (p: ReturnType<typeof pianoNotti>) => [...p.aggiorna.map(a => a.campi), ...p.crea]

test('differenzaConcordata: solo senza sconto registrato, righe attive, totale presente', () => {
  assert.equal(differenzaConcordata(riga()), -3000)
  assert.equal(differenzaConcordata(riga({ total_amount: 360 })), 0)
  assert.equal(differenzaConcordata(riga({ total_amount: 400 })), 4000)
  assert.equal(differenzaConcordata(riga({ discount_type: 'target_total', discount_value: 330 })), 0)
  assert.equal(differenzaConcordata(riga({ discount_type: 'percentage', discount_value: 10 })), 0)
  assert.equal(differenzaConcordata(riga({ total_amount: null })), 0)
  assert.equal(differenzaConcordata(riga({ total_amount: '' as unknown as number })), 0)
  assert.equal(differenzaConcordata(riga({ status: 'annullata' })), 0)
})

test('niente cambiato: nessuna scrittura, il concordato resta 330', () => {
  const s = [riga()]
  const p = pianoNotti(nottiDaSegmenti(s), s, C3)
  assert.equal(p.errore, null)
  assert.equal(p.concordatoDubbio, false)
  assert.equal(p.aggiorna.length + p.crea.length + p.annulla.length, 0)
})

test('solo il letto: si sposta solo il supplemento (330 − 40 + 30 = 320), niente foglio', () => {
  const s = [riga()]
  const nuove = cambiaLetto(nottiDaSegmenti(s), '2026-10-04', false, C3)
  const p = pianoNotti(nuove, s, C3)
  assert.equal(p.errore, null)
  assert.equal(p.aggiorna.length, 1)
  const c = p.aggiorna[0].campi
  assert.equal(c.extra_bed_total, 30)
  assert.equal(c.total_amount, 320)
  assert.equal(c.price_per_night, 80, 'la tariffa non cambia')
  assert.equal(c.discount_type, undefined, 'nessuno sconto inventato')
  assert.equal(serveConfermaPrezzo(s, s, pianoNotti(nuove, s, C3, SENZA_SCONTO)), false)
})

test('solo il letto, ma il concordato andrebbe sotto zero: fermo, niente scritto', () => {
  const s = [riga({ total_amount: 5 })]
  let nuove = nottiDaSegmenti(s)
  for (const iso of NOTTI_OTT) nuove = cambiaLetto(nuove, iso, false, C3)
  const p = pianoNotti(nuove, s, C3)
  assert.equal(p.errore, PREZZO_CONCORDATO_NEGATIVO)
  assert.equal(tutti(p).length, 0)
})

test('persone che non cambiano la tariffa, su tutto il tratto: resta la riduzione', () => {
  const s = [riga({ num_guests: 2, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, total_amount: 300 })]
  const nuove = nottiDaSegmenti(s).map(n => ({ ...n, persone: 1 }))
  const p = pianoNotti(nuove, s, ctx())
  assert.equal(p.errore, null)
  assert.equal(p.concordatoDubbio, false)
  assert.equal(p.aggiorna.length, 1)
  assert.equal(p.aggiorna[0].campi.num_guests, 1)
  assert.equal(p.aggiorna[0].campi.total_amount, 300)
})

test('persone cambiate in UNA notte: il tratto si spezza, e il concordato va confermato', () => {
  const s = [riga({ num_guests: 2, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, total_amount: 300 })]
  const nuove = cambiaOspitiNotte(nottiDaSegmenti(s), '2026-10-02', 1, ctx())
  assert.equal(serveConfermaPrezzo(s, s, pianoNotti(nuove, s, ctx(), SENZA_SCONTO)), true)
  assert.equal(pianoNotti(nuove, s, ctx()).errore, PREZZO_CONCORDATO_DA_CONFERMARE)
})

test('persone che cambiano la tariffa (Lena 2 → 3): va confermato nel foglio', () => {
  const s = [riga({ id: 'l', room_id: LENA_ID, rooms: LENA, num_guests: 2, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, total_amount: 300 })]
  const nuove = nottiDaSegmenti(s).map(n => ({ ...n, persone: 3 }))
  const senza = pianoNotti(nuove, s, C3, SENZA_SCONTO)
  assert.equal(senza.errore, null)
  assert.equal(senza.concordatoDubbio, true)
  assert.equal(serveConfermaPrezzo(s, s, senza), true)
  assert.equal(pianoNotti(nuove, s, C3).errore, PREZZO_CONCORDATO_DA_CONFERMARE)
})

for (const [nome, cambia] of [
  ['date allungate', (n: NotteStriscia[]) => nottiConDate(n, '2026-10-01', '2026-10-07', C3)],
  ['date accorciate', (n: NotteStriscia[]) => nottiConDate(n, '2026-10-01', '2026-10-03', C3)],
  ['arrivo spostato', (n: NotteStriscia[]) => nottiConDate(n, '2026-10-02', '2026-10-06', C3)],
  ['camera cambiata in una notte', (n: NotteStriscia[]) => cambiaCamera(n, '2026-10-03', AMELIA, C3)],
  ['una notte fuori', (n: NotteStriscia[]) => nonDormeQui(n, '2026-10-02')],
] as const) {
  test(`${nome}: il foglio del prezzo si apre; senza foglio non si salva e non si scrive il listino`, () => {
    const s = [riga()]
    const nuove = cambia(nottiDaSegmenti(s))
    const senza = pianoNotti(nuove, s, C3, SENZA_SCONTO)
    assert.equal(senza.errore, null)
    assert.equal(serveConfermaPrezzo(s, s, senza), true)
    const p = pianoNotti(nuove, s, C3)
    assert.equal(p.errore, PREZZO_CONCORDATO_DA_CONFERMARE)
    assert.equal(tutti(p).length + p.annulla.length, 0)
  })
}

test('nel foglio: il concordato conta come sconto di prima e si può tenere a notte (30 € su 4 notti)', () => {
  const s = [riga()]
  assert.equal(scontoDiPrima(s), 3000)
  assert.deepEqual(primaDelCambio(s), { notti: 4, pienoCent: 36000, scontoCent: 3000, totaleCent: 33000 })
  const nuove = nottiConDate(nottiDaSegmenti(s), '2026-10-01', '2026-10-07', C3)
  const senza = pianoNotti(nuove, s, C3, SENZA_SCONTO)
  const scelte = scelteTengo(s, s, senza.tratti)
  assert.deepEqual(scelte.aNotte?.scelta, { tipo: 'per_notte', centANotte: 750 })
  assert.equal(scelte.inTutto?.scelta.scontoCent, 3000)
  // scelto nel foglio: si scrive uno sconto REGISTRATO, 6 × 90 − 6 × 7,50 = 495
  const p = pianoNotti(nuove, s, C3, { tipo: 'per_notte', centANotte: 750 })
  assert.equal(p.errore, null)
  const c = tutti(p)
  assert.equal(c.length, 1)
  assert.equal(c[0].total_amount, 495)
  assert.equal(c[0].discount_type, 'target_total')
})

test('nel foglio: «prezzo nuovo» e «senza sconto» sono scelte consapevoli e si scrivono', () => {
  const s = [riga()]
  const nuove = nottiConDate(nottiDaSegmenti(s), '2026-10-01', '2026-10-03', C3)
  const finale = tutti(pianoNotti(nuove, s, C3, { tipo: 'finale', totaleCent: 16000 }))
  assert.equal(finale[0].total_amount, 160)
  assert.equal(finale[0].discount_type, 'target_total')
  const pieno = tutti(pianoNotti(nuove, s, C3, SENZA_SCONTO))
  assert.equal(pieno[0].total_amount, 180)
  assert.equal(pieno[0].discount_type, null)
})

test('prezzo concordato SOPRA il listino: solo letto lo porta, le date passano dal foglio', () => {
  const s = [riga({ total_amount: 400 })]
  const soloLetto = pianoNotti(cambiaLetto(nottiDaSegmenti(s), '2026-10-04', false, C3), s, C3)
  assert.equal(soloLetto.aggiorna[0].campi.total_amount, 390)
  const date = nottiConDate(nottiDaSegmenti(s), '2026-10-01', '2026-10-06', C3)
  assert.equal(serveConfermaPrezzo(s, s, pianoNotti(date, s, C3, SENZA_SCONTO)), true)
})

// Cambio camera: Ambra concordata (1 → 3 ott, 150 invece di 160) poi Amelia di listino (3 → 5 ott)
const DUE = (): SegmentoNotti[] => [
  riga({ id: 'x', check_out: '2026-10-03', num_guests: 2, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, total_amount: 150 }),
  riga({ id: 'y', room_id: 'amelia', rooms: AMELIA, check_in: '2026-10-03', num_guests: 2, extra_bed: false, extra_bed_dates: [], price_per_night: 70, extra_bed_total: 0, total_amount: 140 }),
]

test('tratti intatti: toccando solo il tratto di listino, quello concordato non si riscrive', () => {
  const s = DUE()
  const nuove = cambiaLetto(nottiDaSegmenti(s), '2026-10-04', true, ctx())
  const p = pianoNotti(nuove, s, ctx())
  assert.equal(p.errore, null)
  assert.equal(p.concordatoDubbio, false)
  assert.deepEqual(p.aggiorna.map(a => a.id), ['y'])
  assert.equal(p.aggiorna[0].campi.total_amount, 145)
})

test('tratti intatti: allungando il tratto di listino il concordato resta e non serve il foglio', () => {
  const s = DUE()
  const nuove = nottiConDate(nottiDaSegmenti(s), '2026-10-01', '2026-10-06', ctx())
  const senza = pianoNotti(nuove, s, ctx(), SENZA_SCONTO)
  assert.equal(serveConfermaPrezzo(s, s, senza), false)
  const p = pianoNotti(nuove, s, ctx())
  assert.equal(p.errore, null)
  assert.deepEqual(p.aggiorna.map(a => a.id), ['y'])
  assert.equal(p.aggiorna[0].campi.total_amount, 210)
})

test('il tratto concordato che sparisce (tutte le sue notti fuori): va confermato', () => {
  const s = DUE()
  let nuove = nottiDaSegmenti(s)
  nuove = nonDormeQui(nonDormeQui(nuove, '2026-10-01'), '2026-10-02')
  const senza = pianoNotti(nuove, s, ctx(), SENZA_SCONTO)
  assert.equal(senza.concordatoDubbio, true)
  assert.equal(pianoNotti(nuove, s, ctx()).errore, PREZZO_CONCORDATO_DA_CONFERMARE)
})

test('invariati: listino puro e sconti registrati non conoscono il concordato', () => {
  const listino = [riga({ total_amount: 360 })]
  const allunga = nottiConDate(nottiDaSegmenti(listino), '2026-10-01', '2026-10-06', C3)
  const p = pianoNotti(allunga, listino, C3)
  assert.equal(p.errore, null)
  assert.equal(p.concordatoDubbio, false)
  assert.equal(tutti(p)[0].total_amount, 450)
  const sconto = [riga({ discount_type: 'percentage', discount_value: 10, total_amount: 324 })]
  const conSconto = pianoNotti(cambiaLetto(nottiDaSegmenti(sconto), '2026-10-04', false, C3), sconto, C3)
  assert.equal(conSconto.concordatoDubbio, false)
  assert.equal(tutti(conSconto)[0].discount_type, 'percentage')
  assert.equal(tutti(conSconto)[0].total_amount, 315)
})
