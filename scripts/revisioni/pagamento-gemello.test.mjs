// ============================================================================
// IL GEMELLO: prima di scrivere un pagamento si rileggono i movimenti e se uno
// identico (importo, giorno, modo) è nato negli ultimi 2 minuti non se ne
// scrive un secondo (Ania, 29/09/2026). Funzioni VERE di lib/pagamentiDati,
// Supabase e memoria finti. Nessuna rete, nessun dato vero.
//
// Esecuzione:
//   node --experimental-loader ./scripts/revisioni/loader-supabase-finto.mjs \
//     --test scripts/revisioni/pagamento-gemello.test.mjs
// ============================================================================
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const memoria = new Map()
globalThis.localStorage = {
  get length() { return memoria.size },
  key: i => [...memoria.keys()][i] ?? null,
  getItem: k => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
}

let righe = [], movimenti = [], chiamate = [], inserimenti = []
globalThis.__fakeSupabase = {
  from(tabella) {
    const filtri = []
    const q = {
      select() { return q }, eq(k, v) { filtri.push(r => r[k] === v); return q }, is() { return q },
      in(k, v) { filtri.push(r => v.includes(r[k])); return q }, order() { return q }, maybeSingle() { return q },
      update() { return q }, single() { return q },
      insert(v) { inserimenti.push(v); return q },
      then(ok, ko) {
        const dati = (tabella === 'bookings' ? righe : movimenti).filter(r => filtri.every(f => f(r)))
        return Promise.resolve({ data: dati, error: null }).then(ok, ko)
      },
    }
    return q
  },
  async rpc(nome, argomenti) {
    chiamate.push({ nome, argomenti })
    return { data: null, error: { message: 'non deve essere chiamata' } }
  },
}

const mod = await import('../../lib/pagamentiDati.ts')
// Ledi: Lena, 27 → 29 set, già segnata pagata; 170 € contanti del 29/09
const ledi = { id: 'lena', prenotazione_id: 'P', guest_id: 'g', status: 'confermata', check_in: '2026-09-27', check_out: '2026-09-29', price_per_night: 85, total_amount: 170, pagato: true }
const dati = { importo: 170, metodo: 'contanti', giorno: '2026-09-29', nota: '' }

beforeEach(() => { memoria.clear(); righe = [ledi]; movimenti = []; chiamate = []; inserimenti = [] })

test('un pagamento identico nato da 30 secondi: niente seconda scrittura, «Salvato»', async () => {
  movimenti = [{ id: 'm1', booking_id: 'lena', amount: 170, method: 'contanti', paid_on: '2026-09-29', created_at: new Date(Date.now() - 30_000).toISOString(), chiave_operazione: 'k1' }]
  memoria.set('ca_acconto_pendente_P', JSON.stringify({ chiave: 'k1', amount: 170, method: 'contanti', paid_on: '2026-09-29', creato: new Date().toISOString(), giaPresenti: 0 }))
  const r = await mod.registraPagamento(ledi, righe, dati)
  assert.equal(r.esito, 'ok')
  assert.equal(r.giaRegistrato, true)
  assert.equal(chiamate.length, 0, 'nessuna scrittura al server')
  assert.equal(inserimenti.length, 0)
  assert.equal(r.pagamenti.length, 1, 'resta un movimento solo')
  // il tentativo custodito è chiuso: riaprendo il foglio non sembra incerto
  assert.equal(memoria.has('ca_acconto_pendente_P'), false)
})

test('lo stesso pagamento di 3 minuti fa non è un gemello: si scrive (qui il server finto risponde di no)', async () => {
  movimenti = [{ id: 'm1', booking_id: 'lena', amount: 170, method: 'contanti', paid_on: '2026-09-29', created_at: new Date(Date.now() - 180_000).toISOString() }]
  await mod.registraPagamento(ledi, righe, dati)
  assert.ok(chiamate.length > 0, 'la scrittura parte')
})

test('un importo diverso non è un gemello', async () => {
  movimenti = [{ id: 'm1', booking_id: 'lena', amount: 100, method: 'contanti', paid_on: '2026-09-29', created_at: new Date().toISOString() }]
  await mod.registraPagamento(ledi, righe, dati)
  assert.ok(chiamate.length > 0, 'la scrittura parte')
})

// Audit Codex R1 (30/09/2026): un incasso uguale di pochi secondi fa che NON
// porta la chiave del nostro tentativo può essere un secondo versamento vero.
// Non si assorbe in silenzio: si chiede, e con «Sì, è un altro pagamento» si scrive.
test('un incasso uguale non nostro: si chiede, niente scritto e niente «Salvato»', async () => {
  movimenti = [{ id: 'm1', booking_id: 'lena', amount: 170, method: 'contanti', paid_on: '2026-09-29', created_at: new Date().toISOString(), chiave_operazione: 'altra-operazione' }]
  const r = await mod.registraPagamento(ledi, righe, dati)
  assert.equal(r.esito, 'errore')
  assert.equal(r.somiglia, true)
  assert.equal(r.messaggio, mod.PAGAMENTO_SOMIGLIANTE('170,00 €', 'contanti'))
  assert.equal(chiamate.length, 0, 'nessuna scrittura finché Ania non risponde')
})

test('«Sì, è un altro pagamento»: la scrittura parte', async () => {
  movimenti = [{ id: 'm1', booking_id: 'lena', amount: 170, method: 'contanti', paid_on: '2026-09-29', created_at: new Date().toISOString(), chiave_operazione: 'altra-operazione' }]
  await mod.registraPagamento(ledi, righe, { ...dati, altroPagamento: true })
  assert.ok(chiamate.length > 0, 'la scrittura parte')
})

test('tentativo custodito ma il gemello ha un\'altra chiave: si chiede, non si conferma quello', async () => {
  movimenti = [{ id: 'm1', booking_id: 'lena', amount: 170, method: 'contanti', paid_on: '2026-09-29', created_at: new Date().toISOString(), chiave_operazione: 'altra-operazione' }]
  memoria.set('ca_acconto_pendente_P', JSON.stringify({ chiave: 'k1', amount: 170, method: 'contanti', paid_on: '2026-09-29', creato: new Date().toISOString(), giaPresenti: 0 }))
  const r = await mod.registraPagamento(ledi, righe, dati)
  assert.equal(r.somiglia, true)
  assert.equal(chiamate.length, 0)
  assert.equal(memoria.has('ca_acconto_pendente_P'), true, 'il nostro tentativo resta custodito')
})

test('senza colonna chiave (gemello senza chiave): si chiede', async () => {
  movimenti = [{ id: 'm1', booking_id: 'lena', amount: 170, method: 'contanti', paid_on: '2026-09-29', created_at: new Date().toISOString() }]
  const r = await mod.registraPagamento(ledi, righe, dati)
  assert.equal(r.somiglia, true)
  assert.equal(chiamate.length, 0)
})
