// Camere da proporre con la spunta (11/09/2026): quali partono spuntate,
// quali restano grigie e con quale motivo, e che messaggio esce togliendo
// le spunte una alla volta.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { camereDaProporre, camereProponibili, camereDaSpuntare, soluzioniSpuntate, motivoInParole, quandoInParole } from './richiesteCamere.ts'
import { proponiSoluzioni } from './richiesteProposta.ts'
import { generaProposta } from './richiesteTesti.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const LENA = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]
const occ = (room_id: string, check_in: string, check_out: string, status = 'confermata') => ({ room_id, check_in, check_out, status })

// Il caso vero di Ania: 29–31 ottobre, tre persone, tutto libero
const TRE = { nome: 'Lena', arrivo: '2026-10-29', partenza: '2026-10-31', persone: 3, camera_id: null }
const righeTre = (occupate: ReturnType<typeof occ>[] = []) =>
  camereDaProporre(TRE, CAMERE, occupate, proponiSoluzioni(TRE, CAMERE, occupate))

test('tre persone, tutto libero: partono spuntate Allegra, Ambra e Lena; Amelia resta grigia', () => {
  const righe = righeTre()
  assert.deepEqual(righe.map(r => r.camera.name), ['Amelia', 'Allegra', 'Ambra', 'Lena'])
  assert.deepEqual(camereProponibili(righe), ['allegra', 'ambra', LENA_ID])
  const amelia = righe[0]
  assert.equal(amelia.proponibile, false)
  // niente date parziali: per tre persone non va in nessuna notte
  assert.equal(amelia.stato, 'singola: per 3 persone non va')
})

test('etichette e prezzi delle camere spuntate', () => {
  const [, allegra, ambra, lena] = righeTre()
  // Allegra: 80 di tariffa + 10 di letto, due notti = 180; e va tolto il tavolo
  assert.equal(allegra.stato, 'libera tutte e 2 le notti')
  assert.equal(allegra.prezzoNotteCent, 8000)
  assert.equal(allegra.lettoNotteCent, 1000)
  assert.equal(allegra.totaleCent, 18000)
  assert.equal(allegra.lettoInPiu, true)
  assert.equal(allegra.tavolo, true)
  assert.equal(allegra.tripla, false)
  // Ambra: stesso conto, ma nessun tavolo da togliere
  assert.equal(ambra.lettoInPiu, true)
  assert.equal(ambra.tavolo, false)
  // Lena: tripla, il terzo letto è compreso e non si paga
  assert.equal(lena.tripla, true)
  assert.equal(lena.lettoInPiu, false)
  assert.equal(lena.lettoNotteCent, 0)
  assert.equal(lena.prezzoNotteCent, 9000)
  assert.equal(lena.totaleCent, 18000)
})

test('camere grigie: occupata dal primo giorno, occupata una notte sola, letto già impegnato', () => {
  // Ambra presa per tutte e due le notti, Allegra solo la seconda
  const righe = righeTre([occ('ambra', '2026-10-29', '2026-10-31'), occ('allegra', '2026-10-30', '2026-10-31')])
  const per = (n: string) => righe.find(r => r.camera.name === n)!
  assert.equal(per('Ambra').proponibile, false)
  assert.equal(per('Ambra').stato, 'occupata dal 29')
  assert.equal(per('Allegra').proponibile, false)
  assert.equal(per('Allegra').stato, 'occupata il 30')
  assert.equal(per('Lena').proponibile, true)
})

test('quando in parole: mai intervalli col trattino', () => {
  const notti = ['2026-10-29', '2026-10-30', '2026-10-31']
  assert.equal(quandoInParole(['2026-10-30'], notti), 'il 30')
  assert.equal(quandoInParole(['2026-10-30', '2026-10-31'], notti), 'dal 30')
  assert.equal(quandoInParole(notti, notti), 'dal 29')
  assert.equal(quandoInParole(['2026-10-29', '2026-10-31'], notti), 'il 29 e il 31')
  assert.equal(quandoInParole([], notti), '')
  // a cavallo di due mesi il mese si scrive
  const dueMesi = ['2026-10-31', '2026-11-01']
  assert.equal(quandoInParole(['2026-11-01'], dueMesi), 'il 1 nov')
})

test('motivo in parole: il letto in più già impegnato', () => {
  const notti = ['2026-10-29', '2026-10-30']
  assert.equal(motivoInParole({ stato: 'brande_esaurite', notti }, AMBRA, notti), 'il letto in più è già impegnato')
  assert.equal(motivoInParole({ stato: 'brande_esaurite', notti: ['2026-10-30'] }, AMBRA, notti), 'il letto in più è già impegnato il 30')
  assert.equal(motivoInParole({ stato: 'libera', notti: [] }, AMBRA, notti), 'libera')
})

// ── Il messaggio segue le spunte ────────────────────────────────────────────
const testoCon = (spuntate: string[]) => {
  const righe = righeTre()
  const scelte = soluzioniSpuntate(righe, spuntate)
  if (scelte.length === 0) return null
  return generaProposta({
    richiesta: TRE, soluzione: scelte[0], condizione: { tipo: 'arrivo' },
    alternative: scelte.length > 1 ? scelte : null,
  })
}

test('tre camere spuntate: il messaggio approvato da Ania, nell’ordine Lena, Ambra, Allegra', () => {
  const testo = testoCon(['allegra', 'ambra', LENA_ID]) as string
  assert.match(testo, /posso proporle tre camere:/)
  const ordine = ['Lena', 'Ambra', 'Allegra'].map(n => testo.indexOf(`– *${n}*,`))
  assert.ok(ordine.every(i => i > 0), 'tutte e tre le camere elencate')
  assert.deepEqual([...ordine].sort((a, b) => a - b), ordine, 'ordine Lena, Ambra, Allegra')
})

test('togliendo una spunta la camera sparisce e il numero in parole si aggiorna', () => {
  const testo = testoCon(['ambra', LENA_ID]) as string
  assert.match(testo, /posso proporle due camere:/)
  assert.ok(!testo.includes('– *Allegra*,'), 'Allegra non è più nel messaggio')
  assert.ok(testo.includes('– *Lena*,') && testo.includes('– *Ambra*,'))
})

test('una camera sola spuntata: torna il testo della camera unica, senza elenco', () => {
  const testo = testoCon([LENA_ID]) as string
  assert.match(testo, /è disponibile soltanto Lena, una camera tripla/)
  assert.ok(!testo.includes('posso proporle'), 'nessun elenco con una camera sola')
  assert.ok(!testo.includes('– *Ambra*,') && !testo.includes('– *Allegra*,'))
  assert.ok(!testo.includes('*'), 'con una camera sola il testo non ha grassetto')
})

test('nessuna camera spuntata: non c’è niente da mandare', () => {
  assert.equal(testoCon([]), null)
  assert.deepEqual(soluzioniSpuntate(righeTre(), []), [])
  // una camera grigia non può essere spuntata nemmeno di nascosto
  assert.deepEqual(soluzioniSpuntate(righeTre(), ['amelia']), [])
})

test('due persone: Amelia entra fra le spuntate, Lena resta una matrimoniale', () => {
  const due = { nome: 'Anna', arrivo: '2026-10-29', partenza: '2026-10-31', persone: 2, camera_id: null }
  const righe = camereDaProporre(due, CAMERE, [], proponiSoluzioni(due, CAMERE, []))
  assert.deepEqual(camereProponibili(righe), ['amelia', 'allegra', 'ambra', LENA_ID])
  const amelia = righe[0]
  assert.equal(amelia.lettoInPiu, true)          // la seconda persona dorme nel letto in più
  assert.equal(amelia.lettoNotteCent, 500)
  assert.equal(amelia.prezzoNotteCent, 7000)
  assert.equal(righe[3].tripla, false)           // Lena a due è una matrimoniale
  assert.equal(righe[3].totaleCent, 16000)
})

// ── Quali camere partono spuntate (Ania, 11/09/2026) ────────────────────────
test('camera chiesta dal cliente e libera: parte spuntata solo quella', () => {
  const conAmbra = { ...TRE, camera_id: 'ambra' }
  const righe = camereDaProporre(conAmbra, CAMERE, [], proponiSoluzioni(conAmbra, CAMERE, []))
  // tutte e tre restano proponibili, cioè spuntabili a mano
  assert.deepEqual(camereProponibili(righe).sort(), ['allegra', 'ambra', LENA_ID].sort())
  // ma parte spuntata solo quella chiesta
  assert.deepEqual(camereDaSpuntare(righe, conAmbra.camera_id), ['ambra'])
  // e il messaggio è quello della camera unica, senza elenco
  const scelte = soluzioniSpuntate(righe, camereDaSpuntare(righe, conAmbra.camera_id))
  const testo = generaProposta({ richiesta: conAmbra, soluzione: scelte[0], condizione: { tipo: 'arrivo' }, alternative: scelte.length > 1 ? scelte : null })
  assert.match(testo, /è disponibile soltanto Ambra/)
  assert.ok(!testo.includes('posso proporle'))
})

test('camera chiesta ma non proponibile, oppure «qualsiasi»: partono spuntate tutte', () => {
  const righe = righeTre()
  // «qualsiasi camera»
  assert.deepEqual(camereDaSpuntare(righe, null), ['allegra', 'ambra', LENA_ID])
  assert.deepEqual(camereDaSpuntare(righe, undefined), ['allegra', 'ambra', LENA_ID])
  // ha chiesto Amelia, che per tre persone non va: non si spunta da sola
  assert.deepEqual(camereDaSpuntare(righe, 'amelia'), ['allegra', 'ambra', LENA_ID])
  // ha chiesto Ambra, ma Ambra è occupata: restano le altre
  const occupate = [occ('ambra', '2026-10-29', '2026-10-31')]
  const conOccupata = camereDaProporre({ ...TRE, camera_id: 'ambra' }, CAMERE, occupate, proponiSoluzioni({ ...TRE, camera_id: 'ambra' }, CAMERE, occupate))
  assert.deepEqual(camereDaSpuntare(conOccupata, 'ambra'), ['allegra', LENA_ID])
})
