// «Statistiche, numeri corretti» (05/09/2026): le quattro voci e le notti su
// un intervallo, con i casi di bordo richiesti.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ricavoPerNotteCent, ricaviSoggiornoCent, incassiCent, speseCent, cassaIntervallo, nottiVendibili, nottiVenduteIntervallo, occupazioneIntervallo, indiciIntervallo, camereOccupate, daIncassare, TESTO_ANOMALIA_OCCUPAZIONE } from './intervallo.ts'
import type { PrenotazioneStat } from './tipi.ts'

const AMELIA = { id: 'r1', name: 'Amelia', active: true }, ALLEGRA = { id: 'r2', name: 'Allegra', active: true }
const AMBRA = { id: 'r3', name: 'Ambra', active: true }, LENA = { id: 'r4', name: 'Lena', active: true }
const CHIUSA = { id: 'r5', name: 'Vecchia', active: false }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA, CHIUSA]
const SET = ['2026-09-01', '2026-10-01'] as const

const pren = (id: string, room_id: string, check_in: string, check_out: string, total: number, extra: Partial<PrenotazioneStat> = {}): PrenotazioneStat =>
  ({ id, room_id, check_in, check_out, total_amount: total, status: 'confermata', group_id: null, ...extra })

// Cambio camera a metà: 3–5 Amelia (160) poi 5–7 Lena (180), stesso gruppo g1
const CAMBIO = [pren('c1', 'r1', '2026-09-03', '2026-09-05', 160, { group_id: 'g1', guest_name: 'Rossi' }), pren('c2', 'r4', '2026-09-05', '2026-09-07', 180, { group_id: 'g1', guest_name: 'Rossi' })]

test('ricavo per notte: 100 € su 3 notti → 33,34 + 33,33 + 33,33 in centesimi interi, prime notti col resto', () => {
  const n = ricavoPerNotteCent(pren('a', 'r1', '2026-08-30', '2026-09-02', 100))
  assert.deepEqual(n.map(x => x.cent), [3334, 3333, 3333])
  assert.deepEqual(n.map(x => x.giorno), ['2026-08-30', '2026-08-31', '2026-09-01'])
  assert.equal(n.reduce((s, x) => s + x.cent, 0), 10000)
})

test('ricavi per soggiorno a cavallo di mese: agosto prende 2 notti, settembre 1; in_attesa e annullate MAI contate', () => {
  const lista = [
    pren('a', 'r1', '2026-08-30', '2026-09-02', 100),
    pren('b', 'r2', '2026-09-10', '2026-09-12', 500, { status: 'in_attesa' }),
    pren('c', 'r2', '2026-09-12', '2026-09-14', 500, { status: 'annullata' }),
    pren('d', 'r3', '2026-09-20', '2026-09-21', 80, { status: 'completata' }),
  ]
  assert.equal(ricaviSoggiornoCent(lista, '2026-08-01', '2026-09-01'), 6667)
  assert.equal(ricaviSoggiornoCent(lista, ...SET), 3333 + 8000)
})

test('cambio camera a metà: ogni segmento vale le sue notti, il gruppo è un solo soggiorno da incassare', () => {
  assert.equal(ricaviSoggiornoCent(CAMBIO, ...SET), 34000)
  assert.equal(ricaviSoggiornoCent(CAMBIO, '2026-09-05', '2026-09-06'), 9000)      // prima notte di Lena
  const pag = [{ booking_id: 'c1', amount: 100, paid_on: '2026-08-20' }]
  const di = daIncassare(CAMBIO, pag)
  assert.equal(di.length, 1)
  assert.deepEqual([di[0].chiave, di[0].id, di[0].dovutoCent, di[0].ricevutoCent, di[0].residuoCent], ['g1', 'c1', 34000, 10000, 24000])
})

test('incassi per data di pagamento: acconto in agosto + saldo in settembre → ogni mese il suo; niente dal soggiorno', () => {
  const pag = [{ booking_id: 'c1', amount: 100, paid_on: '2026-08-20' }, { booking_id: 'c2', amount: '240', paid_on: '2026-09-05' }, { booking_id: 'x', amount: 50, paid_on: null }]
  assert.equal(incassiCent(pag, '2026-08-01', '2026-09-01'), 10000)
  assert.equal(incassiCent(pag, ...SET), 24000)
  // pagamento in un mese diverso dal soggiorno: ottobre vede il saldo, non le notti
  const pagOtt = [{ booking_id: 'c1', amount: 340, paid_on: '2026-10-02' }]
  assert.equal(incassiCent(pagOtt, '2026-10-01', '2026-11-01'), 34000)
  assert.equal(ricaviSoggiornoCent(CAMBIO, '2026-10-01', '2026-11-01'), 0)
})

test('spese per data di pagamento: paid_at vince su expense_date; saldo di cassa = incassi − spese', () => {
  const spese = [{ expense_date: '2026-08-30', amount: 100, paid_at: '2026-09-02' }, { expense_date: '2026-09-15', amount: '35.50' }, { expense_date: '2026-09-30', amount: 10, paid_at: '2026-10-01' }]
  assert.equal(speseCent(spese, ...SET), 13550)
  const c = cassaIntervallo(CAMBIO, [{ booking_id: 'c2', amount: 240, paid_on: '2026-09-05' }], spese, ...SET)
  assert.deepEqual(c, { ricaviCent: 34000, incassiCent: 24000, speseCent: 13550, saldoCent: 10450 })
})

test('periodo vuoto: tutto zero, nessun errore, occupazione 0 senza anomalia', () => {
  assert.deepEqual(cassaIntervallo([], [], [], '2027-03-01', '2027-04-01'), { ricaviCent: 0, incassiCent: 0, speseCent: 0, saldoCent: 0 })
  const o = occupazioneIntervallo('2027-03-01', '2027-04-01', CAMERE, [])
  assert.deepEqual(o, { nottiVendute: 0, nottiVendibili: 124, nottiLibere: 124, perMille: 0, percento: 0, anomalia: false })
  assert.deepEqual(occupazioneIntervallo('2027-03-01', '2027-03-01', CAMERE, []).nottiVendibili, 0)
})

test('notti vendibili = camere ATTIVE per giorno (la quinta disattivata non conta), meno le notti fuori servizio', () => {
  assert.equal(nottiVendibili(...SET, CAMERE).totali, 120)
  const fs = [{ room_id: 'r4', da: '2026-09-10', a: '2026-09-20' }, { room_id: 'r3', da: '2026-09-29', a: '2026-10-05' }]
  const v = nottiVendibili(...SET, CAMERE, fs)
  assert.equal(v.totali, 108)
  assert.equal(v.perCamera.r4, 20)
  assert.equal(v.perCamera.r3, 28)
  assert.equal(v.perCamera.r5, undefined)
})

test('occupazione: notti vendute ÷ vendibili; oltre il 100 % NON bloccata e segnata come anomalia', () => {
  const lista = [...CAMBIO, pren('e', 'r2', '2026-09-10', '2026-09-12', 500, { status: 'in_attesa' })]
  const o = occupazioneIntervallo(...SET, CAMERE, lista)
  assert.deepEqual([o.nottiVendute, o.nottiVendibili, o.perMille, o.percento, o.anomalia], [4, 120, 33, 3, false])
  // sovrapposizione: due confermate su Amelia le stesse notti, con 1 sola camera attiva
  const doppie = [pren('a', 'r1', '2026-09-01', '2026-10-01', 100), pren('b', 'r1', '2026-09-01', '2026-10-01', 100)]
  const an = occupazioneIntervallo(...SET, [AMELIA], doppie)
  assert.deepEqual([an.nottiVendute, an.nottiVendibili, an.percento, an.anomalia, an.nottiLibere], [60, 30, 200, true, 0])
  assert.equal(TESTO_ANOMALIA_OCCUPAZIONE, 'sovrapposizione da controllare')
})

test('indici del periodo: ADR = ricavi ÷ notti vendute, RevPAR = ricavi ÷ notti vendibili, notti libere', () => {
  const i = indiciIntervallo(...SET, CAMERE, CAMBIO)
  assert.equal(i.ricaviCent, 34000)
  assert.equal(i.nottiVendute, 4)
  assert.equal(i.adrCent, 8500)
  assert.equal(i.revparCent, Math.round(34000 / 120))
  assert.equal(i.nottiLibere, 116)
  const vuoto = indiciIntervallo('2027-03-01', '2027-04-01', CAMERE, CAMBIO)
  assert.deepEqual([vuoto.adrCent, vuoto.revparCent, vuoto.ricaviCent], [0, 0, 0])
})

test('camere occupate in una notte: solo confermate che la coprono, una camera conta una volta', () => {
  const lista = [...CAMBIO, pren('e', 'r2', '2026-09-04', '2026-09-06', 500, { status: 'in_attesa' })]
  assert.equal(camereOccupate('2026-09-04', lista), 1)
  assert.equal(camereOccupate('2026-09-05', lista), 1)   // Amelia libera dal 5, Lena dal 5
  assert.equal(camereOccupate('2026-09-07', lista), 0)
  assert.equal(nottiVenduteIntervallo(...SET, lista).totali, 4)
})
