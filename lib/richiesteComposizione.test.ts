import { test } from 'node:test'
import assert from 'node:assert/strict'
import { camereAmmesseNotte, cameraSuccessiva, composizioneDaSoluzione, soluzioneDaComposizione, prezziTariffaPerNotte, applicaATutteLeNotti, totaleCentesimi } from './richiesteComposizione.ts'
import { proponiSoluzioni, motiviEsclusione, testoMotivo, compattaDate, conPrezziNotti, prezziNottiCentesimi, segmento } from './richiesteProposta.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const LENA = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno', active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]
const occ = (room_id: string, check_in: string, check_out: string, extra: Partial<{ num_guests: number; extra_bed: boolean; extra_bed_dates: string[]; status: string }> = {}) =>
  ({ room_id, check_in, check_out, status: 'confermata', ...extra })
// il caso reale: 17–21, in 2 la prima notte poi in 3
const R = { arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null, persone_per_notte: [2, 3, 3, 3] }

test('compattaDate: notti compresse', () => {
  assert.equal(compattaDate(['2026-09-19']), '19 set')
  assert.equal(compattaDate(['2026-09-18', '2026-09-19', '2026-09-20']), '18–20 set')
  assert.equal(compattaDate(['2026-09-17', '2026-09-19', '2026-09-20']), '17 set, 19–20 set')
  assert.equal(compattaDate(['2026-09-30', '2026-10-01']), '30 set–1 ott')
  assert.equal(compattaDate([]), '')
})

test('motiviEsclusione: i quattro motivi e il caso reale 17–21 con [2,3,3,3]', () => {
  // Lena occupata 18–21, Allegra libera ma le brande sono prese dalla quadrupla in Lena… no: usiamo una tripla in Allegra il 19 (1 branda) + Ambra a 3 il 19 (1 branda) → pool esaurito il 19
  const conf = [
    occ(LENA_ID, '2026-09-18', '2026-09-21', { num_guests: 2 }),
  ]
  const m = motiviEsclusione(R, CAMERE, conf)
  const di = (nome: string) => m.find(x => x.camera.name === nome)!.motivo
  assert.deepEqual(di('Lena'), { stato: 'occupata', notti: ['2026-09-18', '2026-09-19', '2026-09-20'] })
  assert.equal(testoMotivo(di('Lena')), 'occupata 18–20 set')
  assert.deepEqual(di('Amelia'), { stato: 'senza_posto', notti: ['2026-09-18', '2026-09-19', '2026-09-20'], persone: 3 })
  assert.equal(testoMotivo(di('Amelia')), 'senza posto per 3 (18–20 set)')
  assert.deepEqual(di('Ambra'), { stato: 'libera', notti: [] })
  assert.deepEqual(di('Allegra'), { stato: 'libera', notti: [] })
  // la ricerca automatica, coerente, propone Ambra e Allegra (caso A)
  assert.deepEqual(proponiSoluzioni(R, CAMERE, conf).map(s => s.segmenti[0].camera.name), ['Allegra', 'Ambra'])
  // brande esaurite: quadrupla in Lena il 19 (2 brande) → Ambra a 3 quella notte non ha la branda
  const pool = [occ(LENA_ID, '2026-09-19', '2026-09-20', { num_guests: 4, extra_bed: true, extra_bed_dates: ['2026-09-19'] })]
  const m2 = motiviEsclusione(R, CAMERE, pool)
  assert.deepEqual(m2.find(x => x.camera.name === 'Ambra')!.motivo, { stato: 'brande_esaurite', notti: ['2026-09-19'] })
  assert.equal(testoMotivo(m2.find(x => x.camera.name === 'Ambra')!.motivo), 'brande esaurite 19 set')
  // occupata vince su senza posto: Amelia occupata il 17 e senza posto il 18–20 → «occupata 17 set»
  const m3 = motiviEsclusione(R, CAMERE, [occ('amelia', '2026-09-17', '2026-09-18')])
  assert.deepEqual(m3.find(x => x.camera.name === 'Amelia')!.motivo, { stato: 'occupata', notti: ['2026-09-17'] })
  // solo le confermate contano
  assert.equal(motiviEsclusione(R, CAMERE, [occ(LENA_ID, '2026-09-18', '2026-09-21', { status: 'in_attesa' })]).find(x => x.camera.name === 'Lena')!.motivo.stato, 'libera')
})

test('camereAmmesseNotte e ciclo del tocco: libere, con posto per le persone di quella notte, poi «nessuna»', () => {
  const conf = [occ(LENA_ID, '2026-09-18', '2026-09-21')]
  assert.deepEqual(camereAmmesseNotte(0, R, CAMERE, conf).map(c => c.name), ['Amelia', 'Allegra', 'Ambra', 'Lena'])   // 17: in 2, tutto libero
  assert.deepEqual(camereAmmesseNotte(1, R, CAMERE, conf).map(c => c.name), ['Allegra', 'Ambra'])                     // 18: in 3, Amelia no, Lena occupata
  const ammesse = camereAmmesseNotte(1, R, CAMERE, conf)
  assert.equal(cameraSuccessiva(null, ammesse), 'allegra')
  assert.equal(cameraSuccessiva('allegra', ammesse), 'ambra')
  assert.equal(cameraSuccessiva('ambra', ammesse), null)
  assert.equal(cameraSuccessiva('amelia', ammesse), null)   // non più ammessa → nessuna
  assert.deepEqual(camereAmmesseNotte(9, R, CAMERE, conf), [])
})

test('soluzioneDaComposizione: A (camera diversa), B con un cambio, B con due cambi, C con buco in mezzo, estremo, completo', () => {
  const daAuto = composizioneDaSoluzione(R, proponiSoluzioni(R, CAMERE, [])[0])
  assert.deepEqual(daAuto, ['allegra', 'allegra', 'allegra', 'allegra'])
  const a = soluzioneDaComposizione(R, CAMERE, ['ambra', 'ambra', 'ambra', 'ambra'])
  assert.equal(a.caso, 'completa'); assert.equal(a.manuale, true); assert.equal(a.prezzoTotale, 350)   // 80 + 3 × 90
  assert.deepEqual(a.segmenti[0].personeNotti, [2, 3, 3, 3]); assert.deepEqual(a.segmenti[0].lettoNotti, ['2026-09-18', '2026-09-19', '2026-09-20'])
  const b = soluzioneDaComposizione(R, CAMERE, ['amelia', 'ambra', 'ambra', 'ambra'])
  assert.equal(b.caso, 'cambio'); assert.equal(b.segmenti.length, 2)
  assert.deepEqual(b.segmenti.map(s => [s.camera.name, s.arrivo, s.partenza, s.totale]), [['Amelia', '2026-09-17', '2026-09-18', 75], ['Ambra', '2026-09-18', '2026-09-21', 270]])
  assert.equal(totaleCentesimi(b), 34500)
  const b2 = soluzioneDaComposizione(R, CAMERE, ['amelia', 'ambra', 'ambra', LENA_ID])
  assert.equal(b2.caso, 'cambio'); assert.equal(b2.segmenti.length, 3); assert.equal(b2.prezzoTotale, 75 + 180 + 90)
  const c = soluzioneDaComposizione(R, CAMERE, ['amelia', null, 'ambra', 'ambra'])
  assert.equal(c.caso, 'manca_mezzo'); assert.deepEqual(c.nottiMancanti, ['2026-09-18']); assert.equal(c.nottiCoperte, 3)
  const e = soluzioneDaComposizione(R, CAMERE, [null, 'ambra', 'ambra', 'ambra'])
  assert.equal(e.caso, 'manca_estremo'); assert.deepEqual(e.nottiMancanti, ['2026-09-17'])
  const v = soluzioneDaComposizione(R, CAMERE, [null, null, null, null])
  assert.equal(v.caso, 'completo'); assert.equal(v.segmenti.length, 0)
  assert.throws(() => soluzioneDaComposizione(R, CAMERE, ['ambra']), /servono 4 notti/)
})

test('prezzo a mano: una notte, tutte le notti di una camera, ripristino; il segmento salvato porta i prezzi e il flag', () => {
  const comp = ['amelia', 'ambra', 'ambra', 'ambra']
  assert.deepEqual(prezziTariffaPerNotte(R, CAMERE, comp), [7500, 9000, 9000, 9000])
  // una notte sola: la prima a 60 €
  const uno = soluzioneDaComposizione(R, CAMERE, comp, [6000, null, null, null])
  assert.equal(uno.segmenti[0].prezzo_manuale, true); assert.deepEqual(uno.segmenti[0].prezziNottiCentesimi, [6000]); assert.equal(uno.segmenti[0].totale, 60)
  assert.equal(uno.segmenti[1].prezzo_manuale, undefined); assert.equal(uno.segmenti[1].totale, 270)
  assert.equal(uno.prezzoTotale, 330)
  // tutte le notti di Ambra a 85 €
  const tutte = applicaATutteLeNotti(comp, [6000, null, null, null], 1, 8500)
  assert.deepEqual(tutte, [6000, 8500, 8500, 8500])
  const due = soluzioneDaComposizione(R, CAMERE, comp, tutte)
  assert.deepEqual(due.segmenti[1].prezziNottiCentesimi, [8500, 8500, 8500]); assert.equal(due.segmenti[1].totale, 255)
  assert.equal(due.segmenti[1].prezzoNotte, 85); assert.equal(due.segmenti[1].lettoTotale, 0)
  // ripristino: senza prezzi manuali torna la tariffa e il flag sparisce
  const rip = soluzioneDaComposizione(R, CAMERE, comp, [null, null, null, null])
  assert.equal(rip.segmenti[0].prezzo_manuale, undefined); assert.equal(rip.prezzoTotale, 345)
  // conPrezziNotti: price_per_night = notte più economica, extra_bed_total = resto, totale esatto
  const s = conPrezziNotti(segmento(AMBRA, '2026-09-17', '2026-09-21', [2, 3, 3, 3]), [8000, 9500, 9000, 9000], true)
  assert.equal(s.prezzoNotte, 80); assert.equal(s.lettoTotale, 35); assert.equal(s.totale, 355)
  assert.deepEqual(prezziNottiCentesimi(s), [8000, 9500, 9000, 9000])
  assert.throws(() => conPrezziNotti(segmento(AMBRA, '2026-09-17', '2026-09-21', 2), [1, 2], true), /servono 4 prezzi/)
  assert.throws(() => conPrezziNotti(segmento(AMBRA, '2026-09-17', '2026-09-21', 2), [1, 2, 3, -1], true), /non validi/)
})
