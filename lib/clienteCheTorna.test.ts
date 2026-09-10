import { test } from 'node:test'
import assert from 'node:assert/strict'
import { soggiorniPrecedenti, etichettaGiaStato, eraGiaStato, stessaPersona } from './clienteCheTorna.ts'

const OGGI = '2026-09-05'
const b = (id: string, check_in: string, check_out: string, guests: { full_name?: string | null; phone?: string | null } | null, extra: Record<string, unknown> = {}) =>
  ({ id, check_in, check_out, status: 'confermata', guests, ...extra })

test('cliente che torna: stesso telefono o stesso nome e cognome, solo soggiorni conclusi, ogni soggiorno una volta', () => {
  const storico = [
    b('a', '2026-07-01', '2026-07-05', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),
    b('b1', '2026-08-01', '2026-08-03', { full_name: 'Rossi Anna', phone: null }, { group_id: 'g' }),      // stesso nome, ordine diverso
    b('b2', '2026-08-03', '2026-08-06', { full_name: 'Rossi Anna', phone: null }, { group_id: 'g' }),      // stesso soggiorno di b1
    b('c', '2026-09-10', '2026-09-12', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),            // futuro: non concluso
    b('d', '2026-06-01', '2026-06-03', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }, { status: 'annullata' }),
    b('e', '2026-05-01', '2026-05-03', { full_name: 'Marco Bianchi', phone: '333 999 0000' }),
  ]
  assert.equal(soggiorniPrecedenti({ telefono: '3331234567' }, storico, OGGI), 1)                      // per telefono: solo «a»
  assert.equal(soggiorniPrecedenti({ nome: 'anna', cognome: 'ROSSI' }, storico, OGGI), 2)             // per nome: «a» e il gruppo «g»
  assert.equal(soggiorniPrecedenti({ nome: 'Anna', cognome: 'Rossi', telefono: '+39 333 123 4567' }, storico, OGGI), 2)
  assert.equal(soggiorniPrecedenti({ nome: 'Anna', cognome: 'Rossi' }, storico, OGGI, 'g'), 1)         // escluso il soggiorno in esame
  assert.equal(soggiorniPrecedenti({ telefono: '+39 333 999 0000' }, storico, OGGI), 1)
  assert.equal(soggiorniPrecedenti({ nome: 'Luca', cognome: 'Verdi' }, storico, OGGI), 0)
  assert.equal(soggiorniPrecedenti({}, storico, OGGI), 0)
  assert.equal(etichettaGiaStato(0), null)
  assert.equal(etichettaGiaStato(1), 'Già stato da noi · 1 soggiorno')
  assert.equal(etichettaGiaStato(3), 'Già stato da noi · 3 soggiorni')
  assert.equal(stessaPersona({ guest_id: 'x' }, { guest_id: 'x' }), true)
  assert.equal(stessaPersona({ nome: 'Anna', cognome: 'Rossi' }, { guest_name: 'Anna Rossi', guests: { full_name: 'Scheda Diversa' } }), true)
})

test('statistiche: «già stato» = un soggiorno concluso PRIMA del check-in di questa prenotazione', () => {
  const storico = [
    b('vecchio', '2026-07-01', '2026-07-05', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),
    b('nuovo', '2026-09-10', '2026-09-12', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),
    b('primo', '2026-09-01', '2026-09-03', { full_name: 'Marco Bianchi', phone: '333 999 0000' }),
    b('secondo', '2026-09-20', '2026-09-22', { full_name: 'Marco Bianchi', phone: '333 999 0000' }),
  ]
  assert.equal(eraGiaStato(storico[1], storico), true)     // Anna: torna
  assert.equal(eraGiaStato(storico[0], storico), false)    // la prima volta di Anna
  assert.equal(eraGiaStato(storico[3], storico), true)     // Marco: il secondo soggiorno
  assert.equal(eraGiaStato(storico[2], storico), false)
})

test('scheda cliente: soggiorni conclusi (uno per gruppo) e ricavi totali', async () => {
  const { soggiorniConclusi } = await import('./clienteCheTorna.ts')
  const r = soggiorniConclusi([
    { id: 'a', check_in: '2026-07-01', check_out: '2026-07-05', status: 'completata', total_amount: 400 },
    { id: 'b1', group_id: 'g', check_in: '2026-08-01', check_out: '2026-08-03', status: 'confermata', total_amount: 100 },
    { id: 'b2', group_id: 'g', check_in: '2026-08-03', check_out: '2026-08-05', status: 'confermata', total_amount: 140 },
    { id: 'f', check_in: '2026-09-10', check_out: '2026-09-12', status: 'confermata', total_amount: 999 },   // futuro
    { id: 'x', check_in: '2026-06-01', check_out: '2026-06-03', status: 'annullata', total_amount: 999 },
  ], '2026-09-05')
  assert.deepEqual(r, { n: 2, ricaviCent: 64000 })
})

// ============================================================================
// Camere parallele (10/09/2026): la conclusione si giudica sulla prenotazione
// intera, non sulla singola camera.
// ============================================================================

const ANNA = { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }
const persona = { telefono: '3331234567' }

test('cliente che torna: due camere della stessa prenotazione valgono UNA visita', () => {
  const storico = [
    b('r1', '2026-07-01', '2026-07-05', ANNA, { prenotazione_id: 'p' }),
    b('r2', '2026-07-01', '2026-07-05', ANNA, { prenotazione_id: 'p' }),
  ]
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI), 1)
})

test('cliente che torna: se una camera parallela non è ancora partita, il soggiorno NON è concluso', () => {
  const storico = [
    b('corta', '2026-09-01', '2026-09-03', ANNA, { prenotazione_id: 'p' }),   // già partita
    b('lunga', '2026-09-01', '2026-09-20', ANNA, { prenotazione_id: 'p' }),   // ancora dentro
  ]
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI), 0)
  // la stessa prenotazione, una volta finita tutta, conta una volta sola
  assert.equal(soggiorniPrecedenti(persona, storico, '2026-09-25'), 1)
})

test('cliente che torna: la prenotazione aperta si esclude INTERA, anche nominando una sola delle sue camere', () => {
  const storico = [
    b('vecchia', '2026-07-01', '2026-07-05', ANNA),
    b('r1', '2026-08-01', '2026-08-04', ANNA, { prenotazione_id: 'p' }),
    b('r2', '2026-08-01', '2026-08-04', ANNA, { prenotazione_id: 'p', group_id: 'g2' }),
  ]
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI), 2)
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI, 'p'), 1)      // per identità
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI, 'r2'), 1)     // per id di un segmento
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI, 'g2'), 1)     // per gruppo di un segmento
})

test('cliente che torna: due prenotazioni indipendenti sulle stesse date dello stesso cliente valgono DUE visite', () => {
  const storico = [
    b('uno', '2026-07-01', '2026-07-05', ANNA),
    b('due', '2026-07-01', '2026-07-05', ANNA),
  ]
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI), 2)
})

test('cliente che torna: una camera annullata non toglie la visita, tutta annullata non conta', () => {
  const parziale = [
    b('viva', '2026-07-01', '2026-07-05', ANNA, { prenotazione_id: 'p' }),
    b('morta', '2026-07-01', '2026-07-05', ANNA, { prenotazione_id: 'p', status: 'annullata' }),
  ]
  assert.equal(soggiorniPrecedenti(persona, parziale, OGGI), 1)
  const tutta = parziale.map(x => ({ ...x, status: 'annullata' }))
  assert.equal(soggiorniPrecedenti(persona, tutta, OGGI), 0)
})

test('scheda cliente: con le camere parallele i ricavi sommano i segmenti, e una camera ancora aperta ferma il soggiorno', async () => {
  const { soggiorniConclusi } = await import('./clienteCheTorna.ts')
  const righe = [
    { id: 'r1', prenotazione_id: 'p', check_in: '2026-07-01', check_out: '2026-07-05', status: 'confermata', total_amount: 240 },
    { id: 'r2', prenotazione_id: 'p', check_in: '2026-07-01', check_out: '2026-07-05', status: 'confermata', total_amount: 320 },
    { id: 'x', prenotazione_id: 'p', check_in: '2026-07-01', check_out: '2026-07-05', status: 'annullata', total_amount: 999 },
    { id: 'a1', prenotazione_id: 'q', check_in: '2026-09-01', check_out: '2026-09-03', status: 'confermata', total_amount: 100 },
    { id: 'a2', prenotazione_id: 'q', check_in: '2026-09-01', check_out: '2026-09-20', status: 'confermata', total_amount: 700 },
  ]
  assert.deepEqual(soggiorniConclusi(righe, OGGI), { n: 1, ricaviCent: 56000 })
  assert.deepEqual(soggiorniConclusi(righe, '2026-09-25'), { n: 2, ricaviCent: 136000 })
})

test('cliente che torna: le prenotazioni vecchie, per group_id o da sole, contano come prima', () => {
  const storico = [
    b('sola', '2026-07-01', '2026-07-05', ANNA),
    b('g1', '2026-08-01', '2026-08-03', ANNA, { group_id: 'g' }),
    b('g2', '2026-08-03', '2026-08-06', ANNA, { group_id: 'g' }),
  ]
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI), 2)
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI, 'g'), 1)
})

test('cliente che torna: una camera ancora «in attesa» non si può ignorare, il soggiorno non è concluso', () => {
  const storico = [
    b('confermata', '2026-07-01', '2026-07-05', ANNA, { prenotazione_id: 'p' }),
    b('attesa', '2026-07-01', '2026-07-05', ANNA, { prenotazione_id: 'p', status: 'in_attesa' }),
  ]
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI), 0)
  // anche se quella in attesa deve ancora arrivare
  const futura = [storico[0], { ...storico[1], check_in: '2026-09-20', check_out: '2026-09-24' }]
  assert.equal(soggiorniPrecedenti(persona, futura, OGGI), 0)
  // quando viene sistemata, il soggiorno conta una volta sola
  const sistemata = storico.map(x => ({ ...x, status: 'confermata' }))
  assert.equal(soggiorniPrecedenti(persona, sistemata, OGGI), 1)
})

test('cliente che torna: il raggruppamento viene prima del riconoscimento della persona', () => {
  // La seconda camera è intestata a un altro nome e non è ancora partita:
  // fa parte della stessa prenotazione, quindi il soggiorno non è concluso.
  const storico = [
    b('mia', '2026-07-01', '2026-07-05', ANNA, { prenotazione_id: 'p' }),
    b('altra', '2026-07-01', '2026-09-20', { full_name: 'Marco Bianchi', phone: '333 999 0000' }, { prenotazione_id: 'p' }),
  ]
  assert.equal(soggiorniPrecedenti(persona, storico, OGGI), 0)
  assert.equal(soggiorniPrecedenti(persona, storico, '2026-09-25'), 1)
})

test('scheda cliente: un segmento «in attesa» ferma il soggiorno e i suoi ricavi', async () => {
  const { soggiorniConclusi } = await import('./clienteCheTorna.ts')
  const righe = [
    { id: 'r1', prenotazione_id: 'p', check_in: '2026-07-01', check_out: '2026-07-05', status: 'confermata', total_amount: 240 },
    { id: 'r2', prenotazione_id: 'p', check_in: '2026-07-01', check_out: '2026-07-05', status: 'in_attesa', total_amount: 320 },
    { id: 'sola', check_in: '2026-07-01', check_out: '2026-07-05', status: 'completata', total_amount: 100 },
  ]
  assert.deepEqual(soggiorniConclusi(righe, OGGI), { n: 1, ricaviCent: 10000 })
})
