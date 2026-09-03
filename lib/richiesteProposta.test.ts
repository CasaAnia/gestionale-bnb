import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proponiSoluzioni, capienzaCamera, segmento, prezziNottiCentesimi, personePerNotte, alternativaAmelia } from './richiesteProposta.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const LENA = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, active: true }
const CAMERE = [LENA, AMBRA, AMELIA, ALLEGRA]
const occ = (room_id: string, check_in: string, check_out: string, status = 'confermata') => ({ room_id, check_in, check_out, status })
const ric = (persone = 1, camera_id: string | null = null) => ({ arrivo: '2026-09-13', partenza: '2026-09-16', persone, camera_id })

test('capienza e prezzo del segmento seguono le tariffe della conferma', () => {
  assert.equal(capienzaCamera(AMELIA), 2)
  assert.equal(capienzaCamera(ALLEGRA), 3)
  assert.equal(capienzaCamera(LENA), 4)
  assert.equal(capienzaCamera({ ...ALLEGRA, has_extra_bed: false }), 2)
  const s = segmento(ALLEGRA, '2026-09-13', '2026-09-15', 3)
  assert.equal(s.notti, 2)
  assert.equal(s.prezzoNotte, 80)
  assert.equal(s.lettoTotale, 20)
  assert.equal(s.totale, 180)
  // Lena a 3: tripla tutto compreso, letto non addebitato
  const l = segmento(LENA, '2026-09-13', '2026-09-15', 3)
  assert.equal(l.prezzoNotte, 90)
  assert.equal(l.lettoTotale, 0)
  assert.equal(l.totale, 180)
})

test('A completa: la camera richiesta per prima, poi le altre libere; le in_attesa non contano', () => {
  const sol = proponiSoluzioni(ric(2, 'ambra'), CAMERE, [
    occ('amelia', '2026-09-14', '2026-09-15'),
    occ(LENA_ID, '2026-09-10', '2026-09-20', 'in_attesa'),
    occ('allegra', '2026-09-10', '2026-09-20', 'annullata'),
  ])
  assert.equal(sol[0].caso, 'completa')
  assert.deepEqual(sol.filter(s => s.caso === 'completa').map(s => s.segmenti[0].camera.name), ['Ambra', 'Allegra', 'Lena'])
  assert.equal(sol[0].prezzoTotale, 240)
  assert.equal(sol[0].nottiCoperte, 3)
  assert.deepEqual(sol[0].nottiMancanti, [])
})

test('B cambio camera: tiene la camera richiesta più a lungo, poi meno notti nella seconda', () => {
  // Amelia (richiesta) libera 13,14; Allegra libera 14,15; Ambra libera solo 15; Lena occupata
  const sol = proponiSoluzioni(ric(1, 'amelia'), CAMERE, [
    occ('amelia', '2026-09-15', '2026-09-16'),
    occ('allegra', '2026-09-13', '2026-09-14'),
    occ('ambra', '2026-09-13', '2026-09-15'),
    occ(LENA_ID, '2026-09-13', '2026-09-16'),
  ])
  assert.equal(sol[0].caso, 'cambio')
  assert.deepEqual(sol[0].segmenti.map(s => [s.camera.name, s.arrivo, s.partenza]), [['Amelia', '2026-09-13', '2026-09-15'], ['Allegra', '2026-09-15', '2026-09-16']])
  assert.equal(sol[0].prezzoTotale, 70 * 2 + 80)
  assert.equal(sol[0].nottiCoperte, 3)
  assert.ok(sol.length <= 5)
})

test('C manca in mezzo: inizio e fine coperti, la notte centrale scoperta', () => {
  const sol = proponiSoluzioni(ric(1, null), CAMERE, [
    occ('amelia', '2026-09-14', '2026-09-15'),
    occ('allegra', '2026-09-14', '2026-09-15'),
    occ('ambra', '2026-09-14', '2026-09-15'),
    occ(LENA_ID, '2026-09-14', '2026-09-15'),
  ])
  assert.equal(sol[0].caso, 'manca_mezzo')
  assert.deepEqual(sol[0].nottiMancanti, ['2026-09-14'])
  assert.equal(sol[0].nottiCoperte, 2)
  assert.equal(sol[0].segmenti.length, 2)
  assert.equal(sol[0].segmenti[0].camera.id, sol[0].segmenti[1].camera.id, 'stessa camera preferita a parità')
})

test('D manca inizio: prima notte occupata ovunque, poi Amelia libera', () => {
  const sol = proponiSoluzioni(ric(1, null), CAMERE, [
    occ('amelia', '2026-09-12', '2026-09-14'),
    occ('allegra', '2026-09-12', '2026-09-16'),
    occ('ambra', '2026-09-12', '2026-09-16'),
    occ(LENA_ID, '2026-09-12', '2026-09-16'),
  ])
  assert.equal(sol[0].caso, 'manca_estremo')
  assert.deepEqual(sol[0].nottiMancanti, ['2026-09-13'])
  assert.deepEqual(sol[0].segmenti.map(s => [s.camera.name, s.arrivo, s.partenza]), [['Amelia', '2026-09-14', '2026-09-16']])
  assert.equal(sol[0].prezzoTotale, 140)
})

test('E completo: meno della metà delle notti coperte', () => {
  const sol = proponiSoluzioni(ric(1, null), CAMERE, [
    occ('amelia', '2026-09-12', '2026-09-15'),
    occ('allegra', '2026-09-12', '2026-09-16'),
    occ('ambra', '2026-09-12', '2026-09-16'),
    occ(LENA_ID, '2026-09-12', '2026-09-16'),
  ])
  assert.equal(sol.length, 1)
  assert.equal(sol[0].caso, 'completo')
  assert.deepEqual(sol[0].segmenti, [])
  assert.deepEqual(sol[0].nottiMancanti, ['2026-09-13', '2026-09-14', '2026-09-15'])
})

test('capienza: con 4 persone resta solo Lena; con 3 Amelia è esclusa', () => {
  const quattro = proponiSoluzioni(ric(4, null), CAMERE, [])
  assert.deepEqual(quattro.map(s => s.segmenti[0].camera.name), ['Lena'])
  assert.equal(quattro[0].prezzoTotale, 3 * (90 + 10))
  const tre = proponiSoluzioni(ric(3, null), CAMERE, [])
  assert.deepEqual(tre.filter(s => s.caso === 'completa').map(s => s.segmenti[0].camera.name), ['Allegra', 'Ambra', 'Lena'])
})

test('letti aggiuntivi condivisi: la quadrupla in Lena prende entrambi i letti', () => {
  // Lena con 4 ospiti il 13 e 14: pool esaurito. Per 3 persone Allegra serve 1 letto → non proposta;
  // per 2 persone Allegra è proposta (nessun letto necessario).
  const quadrupla = { room_id: LENA_ID, check_in: '2026-09-13', check_out: '2026-09-15', status: 'confermata', num_guests: 4, extra_bed: true, extra_bed_dates: ['2026-09-13', '2026-09-14'] }
  const tre = proponiSoluzioni({ arrivo: '2026-09-13', partenza: '2026-09-15', persone: 3, camera_id: 'allegra' }, CAMERE, [quadrupla])
  assert.equal(tre.length, 1)
  assert.equal(tre[0].caso, 'completo')
  const due = proponiSoluzioni({ arrivo: '2026-09-13', partenza: '2026-09-15', persone: 2, camera_id: 'allegra' }, CAMERE, [quadrupla])
  assert.equal(due[0].caso, 'completa')
  assert.equal(due[0].segmenti[0].camera.name, 'Allegra')
  // La notte dopo il pool è libero: per 3 persone dal 15 al 16 Allegra torna disponibile col letto (80 + 10)
  const dopo = proponiSoluzioni({ arrivo: '2026-09-15', partenza: '2026-09-16', persone: 3, camera_id: 'allegra' }, CAMERE, [quadrupla])
  assert.equal(dopo[0].caso, 'completa')
  assert.equal(dopo[0].prezzoTotale, 90)
  // Un solo letto preso (Ambra a 3): per 3 in Allegra resta l'altro letto → proposta; per 4 in Lena servono 2 → no
  const unLetto = { room_id: 'ambra', check_in: '2026-09-13', check_out: '2026-09-15', status: 'confermata', num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-09-13', '2026-09-14'] }
  assert.equal(proponiSoluzioni({ arrivo: '2026-09-13', partenza: '2026-09-15', persone: 3, camera_id: 'allegra' }, CAMERE, [unLetto])[0].caso, 'completa')
  assert.equal(proponiSoluzioni({ arrivo: '2026-09-13', partenza: '2026-09-15', persone: 4, camera_id: LENA_ID }, CAMERE, [unLetto])[0].caso, 'completo')
})

// ── pezzo 9: persone notte per notte ────────────────────────────────────────
test('pezzo 9: 17–21 con [2,1,1,1] — Amelia con secondo letto solo la prima notte, Ambra 4 notti matrimoniale, totali per notte in centesimi', () => {
  const r = { arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null, persone_per_notte: [2, 1, 1, 1] }
  const camere = [AMELIA, ALLEGRA, AMBRA, LENA]
  const sol = proponiSoluzioni(r, camere, [])
  assert.ok(sol.every(s => s.caso === 'completa'))
  const amelia = sol.find(s => s.segmenti[0].camera.name === 'Amelia')!
  assert.equal(amelia.prezzoTotale, 285)                              // 1 × (70 + 5) + 3 × 70
  assert.deepEqual(amelia.segmenti[0].personeNotti, [2, 1, 1, 1])
  assert.deepEqual(amelia.segmenti[0].lettoNotti, ['2026-09-17'])
  assert.equal(amelia.segmenti[0].prezzoNotte, 70); assert.equal(amelia.segmenti[0].lettoTotale, 5)
  assert.deepEqual(prezziNottiCentesimi(amelia.segmenti[0]), [7500, 7000, 7000, 7000])
  const ambra = sol.find(s => s.segmenti[0].camera.name === 'Ambra')!
  assert.equal(ambra.prezzoTotale, 320)                               // 4 × 80, nessun letto
  assert.deepEqual(ambra.segmenti[0].lettoNotti, [])
  // una matrimoniale a 3 persone la prima notte: branda SOLO quella notte
  const tre = proponiSoluzioni({ ...r, persone: 3, persone_per_notte: [3, 2, 2, 2] }, camere, []).find(s => s.segmenti[0].camera.name === 'Ambra')!
  assert.deepEqual(tre.segmenti[0].lettoNotti, ['2026-09-17'])
  assert.equal(tre.prezzoTotale, 330)                                 // 90 + 3 × 80
  assert.deepEqual(prezziNottiCentesimi(tre.segmenti[0]), [9000, 8000, 8000, 8000])
  // Lena a 3 poi 2: la tariffa cambia per notte, nessun letto addebitato
  const lena = proponiSoluzioni({ ...r, persone: 3, persone_per_notte: [3, 2, 2, 2] }, camere, []).find(s => s.segmenti[0].camera.name === 'Lena')!
  assert.equal(lena.prezzoTotale, 330); assert.deepEqual(lena.segmenti[0].lettoNotti, []); assert.equal(lena.segmenti[0].prezzoNotte, 80); assert.equal(lena.segmenti[0].lettoTotale, 10)
})

test('pezzo 9: il pool delle brande si controlla notte per notte con le persone di quella notte', () => {
  const camere = [AMELIA, ALLEGRA, AMBRA, LENA]
  // quadrupla in Lena SOLO il 18: entrambe le brande prese quella notte
  const occ = [{ room_id: LENA.id, check_in: '2026-09-18', check_out: '2026-09-19', status: 'confermata', num_guests: 4, extra_bed: true, extra_bed_dates: ['2026-09-18'] }]
  const r = { arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null }
  // in 2 SOLO il 17: Amelia va bene (la branda serve il 17, libera)
  assert.ok(proponiSoluzioni({ ...r, persone_per_notte: [2, 1, 1, 1] }, camere, occ).some(s => s.caso === 'completa' && s.segmenti[0].camera.name === 'Amelia'))
  // in 2 il 18: Amelia non può (branda esaurita quella notte), Ambra/Allegra sì senza branda
  const s18 = proponiSoluzioni({ ...r, persone_per_notte: [1, 2, 1, 1] }, camere, occ)
  assert.ok(!s18.some(s => s.caso === 'completa' && s.segmenti[0].camera.name === 'Amelia'))
  assert.ok(s18.some(s => s.caso === 'completa' && s.segmenti[0].camera.name === 'Ambra'))
  // array di lunghezza sbagliata: errore esplicito, mai un ripiego
  assert.throws(() => proponiSoluzioni({ ...r, persone_per_notte: [2, 1] }, camere, occ), /Persone per notte non valide: servono 4/)
  assert.deepEqual(personePerNotte({ ...r, persone_per_notte: null }), [2, 2, 2, 2])
  // capienza per notte: 3 persone una notte in Amelia (max 2) → Amelia esclusa
  assert.ok(!proponiSoluzioni({ ...r, persone: 3, persone_per_notte: [3, 1, 1, 1] }, camere, []).some(s => s.segmenti.some(x => x.camera.name === 'Amelia')))
})

test('pezzo 9: alternativa Amelia con persone variabili solo se la differenza a notte è costante', () => {
  const camere = [AMELIA, ALLEGRA, AMBRA, LENA]
  const r = { arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null, persone_per_notte: [2, 1, 1, 1] }
  const amelia = proponiSoluzioni(r, camere, []).find(s => s.segmenti[0].camera.name === 'Amelia')!
  // Amelia 75/70/70/70 vs Allegra 80/80/80/80: differenze 5/10/10/10 → non costante → nessun blocco
  assert.equal(alternativaAmelia(r, amelia, camere, []), null)
  const uniforme = { ...r, persone: 1, persone_per_notte: [1, 1, 1, 1] }
  const a = alternativaAmelia(uniforme, proponiSoluzioni(uniforme, camere, [])[0], camere, [])
  assert.equal(a?.differenzaNotteCentesimi, 1000)
})
