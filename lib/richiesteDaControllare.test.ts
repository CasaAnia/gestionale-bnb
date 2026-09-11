// «Da controllare» della proposta (11/09/2026): solo le voci vere.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vociStesseDate, voceClienteCheTorna } from './richiesteDaControllare.ts'
import { soggiorniDellaPersona } from './clienteCheTorna.ts'

const QUESTA = { id: 'r1', arrivo: '2026-10-29', partenza: '2026-10-31' }
const altra = (id: string, nome: string, arrivo: string, partenza: string) => ({ id, nome, arrivo, partenza })

test('stesse date: solo chi ha notti in comune, con il link alla sua richiesta', () => {
  const voci = vociStesseDate(QUESTA, [
    altra('r1', 'Se stessa', '2026-10-29', '2026-10-31'),      // sé: mai
    altra('r2', 'Carmela', '2026-10-30', '2026-11-02'),        // la notte del 30 è in comune
    altra('r3', 'Silvana', '2026-10-31', '2026-11-02'),        // arriva quando l'altra parte: nessun conflitto
    altra('r4', 'Rosa', '2026-10-27', '2026-10-29'),           // parte quando l'altra arriva: nessun conflitto
  ])
  assert.deepEqual(voci.map(v => v.chiave), ['stesse_date_r2'])
  assert.equal(voci[0].etichetta, 'Stesse date')
  assert.equal(voci[0].titolo, 'Anche Carmela ha chiesto dal 30 ottobre al 2 novembre')
  assert.equal(voci[0].dettaglio, 'se le proponi le stesse camere, una delle due resterà senza')
  assert.deepEqual(voci[0].link, { testo: 'Apri la richiesta di Carmela', href: '/richieste?apri=r2' })
})

test('stesse date: con le notti scelte contano solo quelle, non l’intervallo', () => {
  const questa = { id: 'r1', arrivo: '2026-10-29', partenza: '2026-11-01', notti_richieste: ['2026-10-29', '2026-10-31'] }
  const voci = vociStesseDate(questa, [
    { ...altra('r2', 'Carmela', '2026-10-30', '2026-10-31'), notti_richieste: null },   // solo la notte scartata
    { ...altra('r3', 'Rosa', '2026-10-31', '2026-11-01'), notti_richieste: null },
  ])
  assert.deepEqual(voci.map(v => v.titolo), ["Anche Rosa ha chiesto dal 31 ottobre all'1 novembre"])
})

test('nessuna richiesta vicina: nessuna voce', () => {
  assert.deepEqual(vociStesseDate(QUESTA, []), [])
})

// ── Cliente che torna ───────────────────────────────────────────────────────
const OGGI = '2026-10-01'
const seg = (id: string, check_in: string, check_out: string, extra: Record<string, unknown> = {}) => ({
  id, check_in, check_out, status: 'completata', guest_name: 'Carmela Sabia', total_amount: 680, num_guests: 2, rooms: { name: 'Ambra' }, ...extra,
})
const CARMELA = { nome: 'Carmela', cognome: 'Sabia', telefono: null }

test('cliente che torna: quante volte, l’ultimo soggiorno e i soldi spesi', () => {
  const storico = [
    seg('b1', '2025-08-10', '2025-08-14'),
    seg('b2', '2026-04-26', '2026-05-04'),
  ]
  const s = soggiorniDellaPersona(CARMELA, storico, OGGI)
  assert.equal(s.volte, 2)
  assert.equal(s.ricaviCent, 136000)
  assert.equal(s.ultimo?.check_in, '2026-04-26')
  const voce = voceClienteCheTorna(s, '/clienti/g1')
  assert.equal(voce?.etichetta, 'Cliente che torna')
  assert.equal(voce?.titolo, 'È già stata qui 2 volte')
  assert.equal(voce?.dettaglio, "l'ultima: Ambra, 26 apr → 4 mag 2026 · 2 ospiti")
  assert.deepEqual(voce?.link, { testo: 'Vedi i soggiorni', href: '/clienti/g1' })
})

test('cambio camera nell’ultimo soggiorno: le camere si leggono di fila', () => {
  const storico = [
    seg('b1', '2026-04-26', '2026-04-28', { group_id: 'g', rooms: { name: 'Ambra' }, total_amount: 160 }),
    seg('b2', '2026-04-28', '2026-05-04', { group_id: 'g', rooms: { name: 'Lena' }, total_amount: 520, num_guests: 3 }),
  ]
  const s = soggiorniDellaPersona(CARMELA, storico, OGGI)
  assert.equal(s.volte, 1, 'un cambio camera è un soggiorno solo')
  assert.equal(s.ricaviCent, 68000)
  assert.equal(voceClienteCheTorna(s, null)?.dettaglio, "l'ultima: Ambra → Lena, 26 apr → 4 mag 2026 · 3 ospiti")
  assert.equal(voceClienteCheTorna(s, null)?.link, null)
})

test('cliente nuovo, e soggiorni non ancora finiti: nessuna voce', () => {
  assert.equal(voceClienteCheTorna(soggiorniDellaPersona(CARMELA, [], OGGI), null), null)
  const futuro = [seg('b1', '2026-12-20', '2026-12-24', { status: 'confermata' })]
  assert.equal(voceClienteCheTorna(soggiorniDellaPersona(CARMELA, futuro, OGGI), null), null)
  const annullato = [seg('b1', '2025-08-10', '2025-08-14', { status: 'annullata' })]
  assert.equal(voceClienteCheTorna(soggiorniDellaPersona(CARMELA, annullato, OGGI), null), null)
})

test('la prenotazione annullata dentro un soggiorno non conta nei soldi né nelle camere', () => {
  const storico = [
    seg('b1', '2026-04-26', '2026-05-04', { prenotazione_id: 'p1', rooms: { name: 'Ambra' }, total_amount: 680 }),
    seg('b2', '2026-04-26', '2026-05-04', { prenotazione_id: 'p1', rooms: { name: 'Allegra' }, total_amount: 500, status: 'annullata' }),
  ]
  const s = soggiorniDellaPersona(CARMELA, storico, OGGI)
  assert.equal(s.volte, 1)
  assert.equal(s.ricaviCent, 68000)
  assert.deepEqual(s.ultimo?.camere, ['Ambra'])
})
