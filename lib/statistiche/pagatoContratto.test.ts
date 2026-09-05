// R1/R8/R10 — controprove del contratto client (finto server in memoria):
// risposta persa, richiesta ancora in volo alla riapertura, localStorage
// negato, risposta RPC nulla/malformata, errore interno 42703/42P01, doppio
// tocco, due schede dello stesso soggiorno; e lo stesso per gli acconti.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  eseguiSegnaPagato, eseguiRegistraAcconto, rpcMancante, validaEsitoSegnaPagato, ErroreRispostaMalformata,
  MESSAGGIO_CUSTODIA_CHIAVE, MESSAGGIO_RILETTURA_PAGAMENTI, MESSAGGIO_MOVIMENTO_NON_REGISTRATO, MESSAGGIO_FLAG_NON_SEGNATO, MESSAGGIO_RISPOSTA_MALFORMATA,
  type MovimentoSaldo, type DepsSegnaPagato, type AccontoPendente, type DepsRegistraAcconto,
} from './pagato.ts'
import type { PagamentoStat, PrenotazioneStat } from './tipi.ts'

const seg: PrenotazioneStat[] = [{ id: 'a', room_id: 'r1', check_in: '2026-09-01', check_out: '2026-09-03', total_amount: 160, status: 'confermata', group_id: 'g' }, { id: 'b', room_id: 'r4', check_in: '2026-09-03', check_out: '2026-09-05', total_amount: 180, status: 'confermata', group_id: 'g' }]

type Riga = PagamentoStat & { chiave?: string; method?: string; created_at?: string }
// Finto server condiviso fra «schede»: store dei pagamenti (con chiave), flag, contatori
function server(opz: { perdiRisposteInsert?: number; rpc?: boolean } = {}) {
  const store: Riga[] = [{ booking_id: 'a', amount: 100, paid_on: '2026-08-20', method: 'bonifico', created_at: '2026-08-20T10:00:00Z' }]
  const st = { pagato: 0, inserimenti: 0, patch: 0, rilettureFallite: 0, perdi: opz.perdiRisposteInsert ?? 0 }
  // RPC finta: come segna_pagato della 0033 RICALCOLA il saldo sul server (340 − registrati)
  const scriviRpc = async (chiave: string, m: MovimentoSaldo | null): Promise<{ data: PagamentoStat | null; error: unknown; flagScritto: boolean }> => {
    const esistente = store.find(p => p.chiave === chiave)
    let riga: Riga | null = esistente ?? null
    if (!esistente) {
      const mancante = 340 - store.reduce((x, p) => x + Number(p.amount), 0)
      if (mancante > 0) { st.inserimenti++; riga = { booking_id: m?.booking_id ?? 'a', amount: mancante, paid_on: '2026-09-05', method: m?.method ?? 'contanti', chiave, created_at: '2026-09-05T10:00:00Z' }; store.push(riga) }
    }
    st.pagato = 2
    if (st.perdi > 0) { st.perdi--; throw new TypeError('Failed to fetch') }
    return { data: riga, error: null, flagScritto: true }
  }
  const scriviInsert = async (_chiave: string, m: MovimentoSaldo | null): Promise<{ data: PagamentoStat | null; error: unknown; flagScritto: boolean }> => {
    if (!m) return { data: null, error: null, flagScritto: false }
    st.inserimenti++
    store.push({ booking_id: m.booking_id, amount: m.amount, paid_on: m.paid_on, method: m.method, created_at: '2026-09-05T10:00:00Z' })
    if (st.perdi > 0) { st.perdi--; throw new TypeError('Failed to fetch') }
    return { data: store[store.length - 1], error: null, flagScritto: false }
  }
  return { store, st, scrivi: opz.rpc ? scriviRpc : scriviInsert }
}
// Finta scheda del telefono: custodia in una memoria (può essere negata)
function scheda(srv: ReturnType<typeof server>, opz: { memoriaNegata?: boolean; chiave?: string } = {}): DepsSegnaPagato & { memoria: Map<string, string> } {
  const memoria = new Map<string, string>()
  return {
    memoria,
    custodisciChiave: () => {
      if (opz.memoriaNegata) return null
      const k = memoria.get('chiave') ?? opz.chiave ?? `chiave-${Math.random().toString(16).slice(2)}`
      memoria.set('chiave', k)
      return k
    },
    rileggiPagamenti: async () => srv.st.rilettureFallite-- > 0 ? { data: null, error: new TypeError('Failed to fetch') } : { data: srv.store.map(p => ({ ...p })), error: null },
    scrivi: (k, m) => srv.scrivi(k, m),
    segnaFlag: async () => { srv.st.patch++; srv.st.pagato = 2; return { error: null, righe: 2 } },
  }
}

test('risposta persa dopo un INSERT applicato → al secondo tocco un solo movimento e flag pagato (ripiego senza RPC)', async () => {
  const srv = server({ perdiRisposteInsert: 1 })
  const s = scheda(srv)
  const primo = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.deepEqual([primo.esito, primo.esito === 'errore' && primo.fase, primo.esito === 'errore' && primo.messaggio], ['errore', 'movimento', MESSAGGIO_MOVIMENTO_NON_REGISTRATO])
  assert.equal(srv.store.length, 2)
  const secondo = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.equal(secondo.esito, 'ok')
  assert.deepEqual([srv.store.length, srv.st.inserimenti, srv.st.pagato, srv.st.patch], [2, 1, 2, 1])
  assert.equal(srv.store.filter(p => p.paid_on === '2026-09-05').reduce((x, p) => x + Number(p.amount), 0), 240)
})

test('RPC: risposta persa dopo una RPC applicata → stessa chiave custodita, nessun secondo movimento, nessun PATCH del flag', async () => {
  const srv = server({ perdiRisposteInsert: 1, rpc: true })
  const s = scheda(srv)
  const primo = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.equal(primo.esito, 'errore')
  const chiave1 = s.memoria.get('chiave')
  const secondo = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.equal(secondo.esito, 'ok')
  assert.equal(secondo.esito === 'ok' && secondo.chiave, chiave1)   // stessa chiave: la RPC è idempotente
  assert.deepEqual([srv.store.length, srv.st.inserimenti, srv.st.patch], [2, 1, 0])   // niente secondo PATCH dopo la RPC
})

test('richiesta ancora in volo alla riapertura: la chiave custodita resta e la rilettura mostra il movimento → nessuna scrittura doppia', async () => {
  const srv = server({ rpc: true })
  const chiusa = scheda(srv, { chiave: 'k-in-volo' })
  // la vecchia scheda ha già mandato la richiesta (applicata) ma non ha ricevuto risposta
  await srv.scrivi('k-in-volo', { booking_id: 'a', amount: 240, method: 'contanti', paid_on: '2026-09-05', chiave_operazione: 'k-in-volo' })
  const riaperta = scheda(srv, { chiave: 'k-in-volo' })   // stessa custodia
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', riaperta)
  assert.equal(r.esito, 'ok')
  assert.equal(r.esito === 'ok' && r.movimento?.amount, 240)   // la RPC torna il movimento GIÀ scritto con quella chiave
  assert.equal(srv.store.length, 2)
  assert.equal(srv.st.inserimenti, 1)
  assert.equal(chiusa.memoria.size, 0)
})

test('localStorage negato → custodia fallita → NESSUNA richiesta inviata', async () => {
  const srv = server()
  let riletture = 0
  const s = scheda(srv, { memoriaNegata: true })
  s.rileggiPagamenti = async () => { riletture++; return { data: [...srv.store], error: null } }
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.deepEqual([r.esito, r.esito === 'errore' && r.fase, r.esito === 'errore' && r.messaggio], ['errore', 'custodia', MESSAGGIO_CUSTODIA_CHIAVE])
  assert.deepEqual([riletture, srv.st.inserimenti, srv.st.patch], [0, 0, 0])
})

test('rilettura fallita → ci si ferma prima di scrivere (mai «pagamento assente»)', async () => {
  const srv = server(); srv.st.rilettureFallite = 1
  const s = scheda(srv)
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.deepEqual([r.esito, r.esito === 'errore' && r.messaggio], ['errore', MESSAGGIO_RILETTURA_PAGAMENTI])
  assert.equal(srv.st.inserimenti, 0)
})

test('risposta RPC nulla o malformata non vale come successo; 42703/42P01 non sono «RPC mancante»', async () => {
  assert.equal(validaEsitoSegnaPagato(null), null)
  assert.equal(validaEsitoSegnaPagato({}), null)
  assert.equal(validaEsitoSegnaPagato({ movimento_id: 'x', importo: 240, pagato: false, soggiorno: 'g', segmenti_aggiornati: 2 }), null)
  assert.equal(validaEsitoSegnaPagato({ movimento_id: 'x', importo: 240, pagato: true, soggiorno: 'g', segmenti_aggiornati: 0 }), null)
  assert.deepEqual(validaEsitoSegnaPagato({ movimento_id: null, importo: '0', pagato: true, soggiorno: 'g', segmenti_aggiornati: 2 }), { movimento_id: null, importo: 0, pagato: true, soggiorno: 'g', segmenti_aggiornati: 2 })
  const srv = server()
  const s = scheda(srv)
  s.scrivi = async () => ({ data: null, error: new ErroreRispostaMalformata(), flagScritto: false })
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.deepEqual([r.esito, r.esito === 'errore' && r.messaggio], ['errore', MESSAGGIO_RISPOSTA_MALFORMATA])
  assert.equal(srv.st.patch, 0)
  assert.equal(rpcMancante({ code: 'PGRST202', message: 'Could not find the function public.segna_pagato(p_booking_id, p_chiave) in the schema cache' }, 'segna_pagato'), true)
  assert.equal(rpcMancante({ code: '42883', message: 'function public.segna_pagato(uuid, uuid, text, date) does not exist' }, 'segna_pagato'), true)
  assert.equal(rpcMancante({ code: 'PGRST202', message: 'Could not find the function public.altra' }, 'segna_pagato'), false)
  assert.equal(rpcMancante({ code: '42703', message: 'column payments.chiave_operazione does not exist' }, 'segna_pagato'), false)
  assert.equal(rpcMancante({ code: '42P01', message: 'relation "public.payments" does not exist' }, 'segna_pagato'), false)
})

test('ripiego: flag su zero righe → errore, non successo', async () => {
  const srv = server()
  const s = scheda(srv)
  s.segnaFlag = async () => ({ error: null, righe: 0 })
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s)
  assert.deepEqual([r.esito, r.esito === 'errore' && r.fase, r.esito === 'errore' && r.messaggio], ['errore', 'flag', MESSAGGIO_FLAG_NON_SEGNATO])
})

test('doppio tocco (stessa scheda) e due schede dello stesso soggiorno → un solo movimento sul server', async () => {
  const srv = server({ rpc: true })
  const s1 = scheda(srv), s2 = scheda(srv)
  const [a, b] = await Promise.all([eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s1), eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'b', s2)])
  assert.deepEqual([a.esito, b.esito], ['ok', 'ok'])
  // con la RPC vera il lock serializza le due chiamate; qui il finto è
  // sequenziale per costruzione (await): il secondo trova la chiave/saldo
  const doppio = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', s1)
  assert.equal(doppio.esito, 'ok')
  assert.equal(srv.store.filter(p => p.paid_on === '2026-09-05').length <= 2, true)
  assert.equal(srv.store.filter(p => p.paid_on === '2026-09-05').reduce((x, p) => x + Number(p.amount), 0), 240)
})

// ---- acconti (R10) ----
function depsAcconto(srv: ReturnType<typeof server>, opz: { negata?: boolean; perdi?: number } = {}): DepsRegistraAcconto & { memoria: Map<string, AccontoPendente>; chiamate: number } {
  const memoria = new Map<string, AccontoPendente>()
  let perdi = opz.perdi ?? 0
  const d: DepsRegistraAcconto & { memoria: Map<string, AccontoPendente>; chiamate: number } = {
    memoria, chiamate: 0,
    leggiPendente: () => memoria.get('p') ?? null,
    custodisci: p => { if (opz.negata) return false; memoria.set('p', p); return true },
    dimentica: () => { memoria.delete('p') },
    rileggiPagamenti: async () => ({ data: srv.store.map(p => ({ ...p })), error: null }),
    scrivi: async (p, bookingId) => {
      d.chiamate++
      const riga = { booking_id: bookingId, amount: p.amount, paid_on: p.paid_on, method: p.method, chiave: p.chiave, created_at: '2026-09-05T12:00:00Z' }
      if (!srv.store.some(x => x.chiave === p.chiave)) srv.store.push(riga)
      if (perdi > 0) { perdi--; throw new TypeError('Failed to fetch') }
      return { data: riga, error: null }
    },
    adesso: () => '2026-09-05T11:59:00Z',
    nuovaChiave: () => `acc-${Math.random().toString(16).slice(2)}`,
  }
  return d
}

test('acconto: risposta persa dopo un INSERT applicato → al secondo tocco nessun doppione (pendente riconosciuto fra i riletti)', async () => {
  const srv = server()
  const d = depsAcconto(srv, { perdi: 1 })
  const primo = await eseguiRegistraAcconto('a', 60, 'contanti', '2026-09-05', d)
  assert.deepEqual([primo.esito, primo.esito === 'errore' && primo.fase], ['errore', 'movimento'])
  assert.equal(d.memoria.has('p'), true)             // la chiave resta custodita
  const secondo = await eseguiRegistraAcconto('a', 60, 'contanti', '2026-09-05', d)
  assert.equal(secondo.esito, 'ok')
  assert.equal(secondo.esito === 'ok' && secondo.giaApplicato, true)
  assert.equal(srv.store.filter(p => Number(p.amount) === 60).length, 1)
  assert.equal(d.chiamate, 1)
  assert.equal(d.memoria.has('p'), false)
})

test('acconto: memoria negata → nessuna richiesta; percorso normale → una riga e custodia dimenticata; importo diverso → chiave nuova', async () => {
  const srv = server()
  const negata = depsAcconto(srv, { negata: true })
  const r = await eseguiRegistraAcconto('a', 60, 'contanti', '2026-09-05', negata)
  assert.deepEqual([r.esito, r.esito === 'errore' && r.fase, negata.chiamate], ['errore', 'custodia', 0])
  const d = depsAcconto(srv)
  const ok = await eseguiRegistraAcconto('a', 60, 'contanti', '2026-09-05', d)
  assert.equal(ok.esito, 'ok')
  assert.equal(ok.esito === 'ok' && ok.giaApplicato, false)
  const chiave1 = srv.store[srv.store.length - 1].chiave
  const ok2 = await eseguiRegistraAcconto('a', 40, 'carta', '2026-09-05', d)
  assert.equal(ok2.esito, 'ok')
  assert.notEqual(srv.store[srv.store.length - 1].chiave, chiave1)
  assert.equal(srv.store.length, 3)
})

// ---- autorevisione (collaudo del 06/09/2026) ----
test('difetto 2: orologio del telefono avanti rispetto al server → l\'acconto applicato con risposta persa deve essere riconosciuto lo stesso (nessun doppione)', async () => {
  const srv = server()
  const d = depsAcconto(srv, { perdi: 1 })
  d.adesso = () => '2026-09-05T12:30:00Z'     // il telefono è 30 minuti AVANTI: il server scriverà created_at 12:00
  const primo = await eseguiRegistraAcconto('a', 60, 'contanti', '2026-09-05', d)
  assert.equal(primo.esito, 'errore')
  assert.equal(srv.store.filter(p => Number(p.amount) === 60).length, 1)
  const secondo = await eseguiRegistraAcconto('a', 60, 'contanti', '2026-09-05', d)
  assert.equal(secondo.esito, 'ok')
  assert.equal(secondo.esito === 'ok' && secondo.giaApplicato, true)
  assert.equal(srv.store.filter(p => Number(p.amount) === 60).length, 1, 'un secondo movimento da 60 sarebbe un doppione')
  // e un acconto IDENTICO già esistente da prima NON deve essere scambiato per il pendente
  const srv2 = server()
  srv2.store.push({ booking_id: 'a', amount: 60, paid_on: '2026-09-05', method: 'contanti', created_at: '2026-09-01T10:00:00Z' })
  const d2 = depsAcconto(srv2)
  const r = await eseguiRegistraAcconto('a', 60, 'contanti', '2026-09-05', d2)
  assert.equal(r.esito === 'ok' && r.giaApplicato, false)
  assert.equal(srv2.store.filter(p => Number(p.amount) === 60).length, 2)
})
