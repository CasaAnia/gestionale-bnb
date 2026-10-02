import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statisticheNuove, provaLavanderia, ore, euro } from './statistichePulizieNuove.ts'
import { interventiDaTabelle } from './pulizieDotazioneStatistiche.ts'

const nome = (id: string) => ({ a: 'Allegra', b: 'Ambra', l: 'Lena', m: 'Amelia', v: 'Vecchia' } as Record<string, string>)[id] ?? id
const c = (id: string, room: string, data: string, tipo: string, minuti: number | null, assetto: Record<string, number> | null) =>
  ({ id, room_id: room, tipo, stato: 'fatta', data_prevista: data, data_effettiva: data, minuti, assetto: assetto ? { federe_matrimoniale: 4, ...assetto } : null })
const M2 = { matrimoniali: 1, singoli: 0, ospiti: 2 }, M1 = { matrimoniali: 1, singoli: 0, ospiti: 1 }, ML = { matrimoniali: 1, singoli: 1, ospiti: 3 }, A1 = { matrimoniali: 0, singoli: 1, ospiti: 1 }

const pulizie = [
  c('1', 'a', '2026-09-03', 'fine_soggiorno', 40, M2), c('2', 'a', '2026-09-10', 'cambio_camera', 60, M1),
  c('3', 'b', '2026-09-12', 'soggiorno', 30, M2), c('4', 'b', '2026-09-20', 'soggiorno', null, ML),
  c('5', 'l', '2026-09-25', 'fine_soggiorno', null, null), c('6', 'v', '2026-09-26', 'fine_soggiorno', 20, A1),
  c('7', 'a', '2026-08-05', 'fine_soggiorno', 50, M2), c('8', 'b', '2026-08-06', 'soggiorno', 50, M2),
]
const interventi = interventiDaTabelle(pulizie as never, [{ cleaning_id: '1', federe: 2, telo_doccia: 1 }])
const tempi = [{ data: '2026-09-03', attivita: 'area_comune', minuti: 20 }, { data: '2026-09-04', attivita: 'corridoio', minuti: 10 }, { data: '2026-09-05', attivita: 'altro', minuti: 5 }]
const rinvii = [{ room_id: 'b', stato: 'rimandata', data_prevista: '2026-09-11' }, { room_id: 'b', stato: 'saltata', data_prevista: '2026-09-16' }, { room_id: 'a', stato: 'rimandata', data_prevista: '2026-08-01' }]
const S = statisticheNuove({ interventi, tempi, rinvii, dal: '2026-09-01', al: '2026-09-30', prima: { dal: '2026-08-01', al: '2026-08-30' }, nomeCamera: nome })

test('tre numeri: pulizie, lavoro con gli spazi comuni, media a camera solo sui minuti noti', () => {
  assert.equal(S.pulizie, 6)
  assert.equal(S.minutiCamere, 150)
  assert.equal(S.minutiSpazi, 35)                     // area_comune dentro il corridoio, una volta sola
  assert.equal(S.lavoro, 185)
  assert.deepEqual(S.aCamera, { n: 6, conMinuti: 4, media: 37.5 }) // 150 / 4, mai / 6
})

test('per tipo: camera da rifare (partenze + cambi camera) e biancheria ogni 4 notti', () => {
  assert.deepEqual(S.rifare, { n: 4, conMinuti: 3, media: 40 })
  assert.deepEqual(S.biancheria, { n: 2, conMinuti: 1, media: 30 })
})

test('confronto col periodo prima: minuti a camera in meno = meglio', () => {
  assert.deepEqual(S.confronto, { testo: '↓ 12 minuti a camera', meglio: true })
})

test('con una camera scelta gli spazi comuni non le si attribuiscono', () => {
  const a = statisticheNuove({ interventi, tempi, rinvii, dal: '2026-09-01', al: '2026-09-30', prima: null, roomId: 'a', nomeCamera: nome })
  assert.equal(a.minutiSpazi, null); assert.equal(a.lavoro, 100); assert.equal(a.pulizie, 2)
  assert.equal(a.rimandate, 0)
})

test('per camera (anche disattivate) e come si usano le camere', () => {
  assert.deepEqual(S.perCamera.map(p => [p.nome, p.n, p.minuti]), [['Allegra', 2, 100], ['Ambra', 2, 30], ['Vecchia', 1, 20], ['Lena', 1, 0]])
  const allegra = S.uso.find(u => u.nome === 'Allegra')!
  assert.deepEqual(allegra.pillole, [{ n: 1, testo: 'in 2' }, { n: 1, testo: 'uso singolo' }])
  const ambra = S.uso.find(u => u.nome === 'Ambra')!
  assert.deepEqual(ambra.pillole, [{ n: 1, testo: 'in 2' }, { n: 1, testo: '+ letto in più' }])
  assert.equal(S.uso.some(u => u.nome === 'Lena'), false, 'senza letti segnati non si conta')
})

test('completi usati: totale ÷ giorni × 7 / 30,44 / 365', () => {
  assert.deepEqual(S.completi.totali, { matrimoniali: 4, singole: 2, asciugamani: 9 })
  assert.equal(Math.round(S.completi.asciugamani.mese), Math.round(9 / 30 * 30.44))
  assert.equal(Math.round(S.completi.matrimoniali.anno), Math.round(4 / 30 * 365))
})

test('biancheria e rinvii', () => {
  assert.equal(S.recuperati, 3)
  assert.equal(S.aLavare, S.preparati - 3)
  assert.equal(S.rimandate, 1); assert.equal(S.saltate, 1)
  const federe = S.mandati.find(m => m.pezzo === 'federe')!
  assert.equal(federe.recuperati, 2)
})

test('prova lavanderia: prezzo vuoto = da inserire, totale parziale con i pezzi mancanti; zero vale solo se scritto', () => {
  const mandati = [{ pezzo: 'federe' as const, nome: 'Federe', aLavare: 30, alMese: 30.44 }, { pezzo: 'teli_doccia' as const, nome: 'Teli doccia', aLavare: 10, alMese: 10.15 }, { pezzo: 'tappetini' as const, nome: 'Tappetini e tappeti', aLavare: 4, alMese: 4.06 }]
  const p = provaLavanderia(mandati, { federe: 0.5, tappetini: 0 })
  assert.equal(p.parziale, true); assert.deepEqual(p.mancanti, ['Teli doccia'])
  assert.equal(p.alMese, 30.44 * 0.5)                 // prima dell'arrotondamento
  assert.equal(p.periodo, 15)
  assert.equal(p.righe[2].costoMese, 0)
  assert.equal(provaLavanderia(mandati, { federe: 0.5, teli_doccia: 1, tappetini: 0 }).parziale, false)
  assert.equal(euro(66.5), '66,50'); assert.equal(ore(1260), '21 h'); assert.equal(ore(400), '6 h 40'); assert.equal(ore(46), '46′')
})
