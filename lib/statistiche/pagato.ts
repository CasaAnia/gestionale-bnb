// «Segna come pagato» e coerenza fra il flag `pagato` e i movimenti di
// `payments`. Il movimento del saldo = totale del soggiorno (tutti i
// segmenti di un cambio camera) meno i movimenti già registrati; se non resta
// nulla, si aggiorna solo il flag. Le incongruenze si elencano, mai correggono.
import { cent, prenotazioneValida, type PagamentoStat, type PrenotazioneStat } from './tipi.ts'
import { incassiMese, type Incoerenza } from './cassa.ts'

export type MetodoPagamento = 'contanti' | 'bonifico' | 'carta' | 'altro'
export const METODI_PAGAMENTO: { chiave: MetodoPagamento; label: string }[] = [
  { chiave: 'contanti', label: 'Contanti' },
  { chiave: 'bonifico', label: 'Bonifico' },
  { chiave: 'carta', label: 'Carta' },
  { chiave: 'altro', label: 'Altro' },
]

// Quanto manca al saldo, in centesimi (0 se già coperto o oltre)
export function saldoMancanteCent(segmenti: PrenotazioneStat[], pagamenti: PagamentoStat[]): number {
  const ids = new Set(segmenti.map(b => b.id))
  const totale = segmenti.reduce((s, b) => s + cent(b.total_amount), 0)
  const registrati = pagamenti.filter(p => ids.has(p.booking_id)).reduce((s, p) => s + cent(p.amount), 0)
  return Math.max(0, totale - registrati)
}

// Il movimento da scrivere prima del flag: null se non c'è saldo da registrare
export function movimentoSaldo(segmenti: PrenotazioneStat[], pagamenti: PagamentoStat[], oggi: string, metodo: MetodoPagamento, bookingId: string): { booking_id: string; amount: number; method: MetodoPagamento; paid_on: string } | null {
  const mancante = saldoMancanteCent(segmenti, pagamenti)
  if (mancante <= 0) return null
  return { booking_id: bookingId, amount: mancante / 100, method: metodo, paid_on: oggi }
}

export type Incongruenza = Incoerenza

// Pagato senza movimenti, pagato ma incompleto, saldato ma non segnato,
// movimenti sopra il totale, movimento senza prenotazione. Indipendente dal mese.
export function incongruenzePagamenti(prenotazioni: PrenotazioneStat[], pagamenti: PagamentoStat[]): Incongruenza[] {
  return incassiMese('1970-01', prenotazioni.filter(prenotazioneValida), pagamenti, '1970-01-01').incoerenze
}

// ---------------------------------------------------------------------------
// R1 (revisione Codex di f4d5474) + R10 (revisione di 3248064): UN SOLO
// CONTRATTO per tutti i movimenti (saldo di «Segna come pagato» e acconti):
//  1. la chiave stabile viene CUSTODITA prima dell'invio (custodia fallita →
//     nessuna richiesta);
//  2. PRIMA di ogni tentativo si rileggono i pagamenti del soggiorno dal
//     server; rilettura fallita → ci si ferma (mai «pagamento assente»);
//  3. il saldo mancante si calcola sui dati riletti (una risposta persa non
//     crea un secondo movimento); un acconto pendente già visibile fra i
//     riletti conta come applicato;
//  4. la scrittura passa dalla RPC della 0033 (atomica: scrive anche il flag,
//     niente secondo PATCH) o, senza RPC, dall'INSERT e dal flag su TUTTI i
//     segmenti con verifica delle righe toccate (zero righe = errore);
//  5. una risposta RPC malformata non vale come successo.
// ---------------------------------------------------------------------------
export type MovimentoSaldo = { booking_id: string; amount: number; method: MetodoPagamento; paid_on: string; chiave_operazione: string }

export const MESSAGGIO_CUSTODIA_CHIAVE = 'Non riesco a salvare sul telefono la chiave del pagamento: nessuna richiesta inviata, riprova'
export const MESSAGGIO_RILETTURA_PAGAMENTI = 'Non riesco a controllare i pagamenti già registrati, riprova'
export const MESSAGGIO_MOVIMENTO_NON_REGISTRATO = 'Non salvato, riprova: il pagamento non è stato registrato'
export const MESSAGGIO_FLAG_NON_SEGNATO = 'Pagamento registrato, ma non segnato come pagato: riprova'
export const MESSAGGIO_RISPOSTA_MALFORMATA = 'Risposta del server non riconosciuta: non do per fatto il salvataggio, riprova'

// La RPC manca? SOLO l'assenza della funzione esatta (PostgREST PGRST202 /
// Postgres 42883 con il nome della funzione), non qualunque «does not exist».
export function rpcMancante(e: unknown, nome: string): boolean {
  const code = String((e as { code?: unknown })?.code ?? '')
  const msg = String((e as { message?: unknown })?.message ?? '')
  if (!msg.includes(nome)) return false
  if (code === 'PGRST202') return true
  return code === '42883' && /function .* does not exist/i.test(msg)
}

// Esito della RPC segna_pagato: valido solo con la forma attesa
export type EsitoRpcSegnaPagato = { movimento_id: string | null; importo: number; pagato: true; soggiorno: string; segmenti_aggiornati: number }
export function validaEsitoSegnaPagato(x: unknown): EsitoRpcSegnaPagato | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const importo = typeof o.importo === 'number' ? o.importo : (typeof o.importo === 'string' && o.importo !== '' ? Number(o.importo) : NaN)
  if (!Number.isFinite(importo) || importo < 0) return null
  if (o.pagato !== true) return null
  if (!(o.movimento_id === null || typeof o.movimento_id === 'string')) return null
  if (typeof o.soggiorno !== 'string' || !o.soggiorno) return null
  if (typeof o.segmenti_aggiornati !== 'number' || o.segmenti_aggiornati < 1) return null
  return { movimento_id: o.movimento_id, importo, pagato: true, soggiorno: o.soggiorno, segmenti_aggiornati: o.segmenti_aggiornati }
}

export type EsitoScrittura = { data: PagamentoStat | null; error: unknown; flagScritto: boolean }

export type DepsSegnaPagato = {
  // torna la chiave custodita, null se la memoria del telefono la rifiuta
  custodisciChiave: () => string | null
  rileggiPagamenti: () => PromiseLike<{ data: PagamentoStat[] | null; error: unknown }>
  // RPC (flagScritto = true: il server ricalcola il saldo e scrive anche il
  // flag, anche quando qui il movimento è null) oppure INSERT semplice
  // (flagScritto = false; con movimento null non scrive nulla)
  scrivi: (chiave: string, movimento: MovimentoSaldo | null) => PromiseLike<EsitoScrittura>
  // ripiego senza RPC: flag su TUTTI i segmenti, torna le righe toccate
  segnaFlag: () => PromiseLike<{ error: unknown; righe: number }>
}

export type EsitoSegnaPagato =
  | { esito: 'ok'; pagamenti: PagamentoStat[]; movimento: PagamentoStat | null; chiave: string }
  | { esito: 'errore'; fase: 'custodia' | 'rilettura' | 'movimento' | 'flag'; messaggio: string; pagamenti: PagamentoStat[] | null }

export async function eseguiSegnaPagato(
  segmenti: PrenotazioneStat[], oggi: string, metodo: MetodoPagamento, bookingId: string, deps: DepsSegnaPagato,
): Promise<EsitoSegnaPagato> {
  const chiave = deps.custodisciChiave()
  if (!chiave) return { esito: 'errore', fase: 'custodia', messaggio: MESSAGGIO_CUSTODIA_CHIAVE, pagamenti: null }
  let riletti: { data: PagamentoStat[] | null; error: unknown }
  try { riletti = await deps.rileggiPagamenti() } catch (e) { riletti = { data: null, error: e ?? new Error('errore sconosciuto') } }
  if (riletti.error || !riletti.data) return { esito: 'errore', fase: 'rilettura', messaggio: MESSAGGIO_RILETTURA_PAGAMENTI, pagamenti: null }
  const pagamenti = riletti.data
  const base = movimentoSaldo(segmenti, pagamenti, oggi, metodo, bookingId)
  const movimento: MovimentoSaldo | null = base ? { ...base, chiave_operazione: chiave } : null
  let r: EsitoScrittura
  try { r = await deps.scrivi(chiave, movimento) } catch (e) { r = { data: null, error: e ?? new Error('errore sconosciuto'), flagScritto: false } }
  if (r.error) return { esito: 'errore', fase: 'movimento', messaggio: r.error instanceof ErroreRispostaMalformata ? MESSAGGIO_RISPOSTA_MALFORMATA : MESSAGGIO_MOVIMENTO_NON_REGISTRATO, pagamenti }
  const scritto: PagamentoStat | null = r.data ?? (movimento ? { booking_id: movimento.booking_id, amount: movimento.amount, paid_on: movimento.paid_on } : null)
  const flagScritto = r.flagScritto
  const dopo = scritto && !pagamenti.includes(scritto) ? [...pagamenti, scritto] : pagamenti
  if (!flagScritto) {
    let f: { error: unknown; righe: number }
    try { f = await deps.segnaFlag() } catch (e) { f = { error: e ?? new Error('errore sconosciuto'), righe: 0 } }
    if (f.error || f.righe < 1) return { esito: 'errore', fase: 'flag', messaggio: scritto ? MESSAGGIO_FLAG_NON_SEGNATO : 'Non salvato, riprova', pagamenti: dopo }
  }
  return { esito: 'ok', pagamenti: dopo, movimento: scritto, chiave }
}

export class ErroreRispostaMalformata extends Error {
  constructor() { super('risposta RPC malformata'); this.name = 'ErroreRispostaMalformata' }
}

// --- acconti (R10): stesso contratto ----------------------------------------
export type AccontoPendente = { chiave: string; amount: number; method: string; paid_on: string; creato: string }

export type DepsRegistraAcconto = {
  // legge/scrive la custodia sul telefono: null = memoria negata
  leggiPendente: () => AccontoPendente | null
  custodisci: (p: AccontoPendente) => boolean
  dimentica: () => void
  rileggiPagamenti: () => PromiseLike<{ data: (PagamentoStat & { id?: string; method?: string; created_at?: string })[] | null; error: unknown }>
  // RPC registra_acconto (idempotente) oppure INSERT semplice
  scrivi: (p: AccontoPendente, bookingId: string) => PromiseLike<{ data: PagamentoStat | null; error: unknown }>
  adesso: () => string   // ISO, per la custodia
  nuovaChiave: () => string
}

export type EsitoRegistraAcconto =
  | { esito: 'ok'; movimento: PagamentoStat; giaApplicato: boolean; pagamenti: PagamentoStat[] }
  | { esito: 'errore'; fase: 'custodia' | 'rilettura' | 'movimento'; messaggio: string; pagamenti: PagamentoStat[] | null }

// Un acconto pendente (chiave custodita, risposta persa) conta come applicato
// se fra i pagamenti riletti c'è una riga uguale creata dopo la custodia
function pendenteApplicato(p: AccontoPendente, riletti: (PagamentoStat & { method?: string; created_at?: string })[]): PagamentoStat | null {
  return riletti.find(r => Math.round(Number(r.amount) * 100) === Math.round(p.amount * 100) && r.paid_on === p.paid_on && (r.method === undefined || r.method === p.method) && (!r.created_at || r.created_at >= p.creato)) ?? null
}

export async function eseguiRegistraAcconto(
  bookingId: string, amount: number, method: string, paid_on: string, deps: DepsRegistraAcconto,
): Promise<EsitoRegistraAcconto> {
  // 1. custodia PRIMA dell'invio (se c'è già un pendente identico si riusa la sua chiave)
  const precedente = deps.leggiPendente()
  const pendente: AccontoPendente = precedente && precedente.amount === amount && precedente.method === method && precedente.paid_on === paid_on
    ? precedente
    : { chiave: deps.nuovaChiave(), amount, method, paid_on, creato: deps.adesso() }
  if (!deps.custodisci(pendente)) return { esito: 'errore', fase: 'custodia', messaggio: MESSAGGIO_CUSTODIA_CHIAVE, pagamenti: null }
  // 2. rilettura
  let riletti: { data: (PagamentoStat & { method?: string; created_at?: string })[] | null; error: unknown }
  try { riletti = await deps.rileggiPagamenti() } catch (e) { riletti = { data: null, error: e ?? new Error('errore sconosciuto') } }
  if (riletti.error || !riletti.data) return { esito: 'errore', fase: 'rilettura', messaggio: MESSAGGIO_RILETTURA_PAGAMENTI, pagamenti: null }
  // 3. pendente già applicato (risposta persa la volta prima)?
  const applicato = precedente === pendente ? pendenteApplicato(pendente, riletti.data) : null
  if (applicato) { deps.dimentica(); return { esito: 'ok', movimento: applicato, giaApplicato: true, pagamenti: riletti.data } }
  // 4. scrittura (RPC idempotente per chiave, o INSERT)
  let r: { data: PagamentoStat | null; error: unknown }
  try { r = await deps.scrivi(pendente, bookingId) } catch (e) { r = { data: null, error: e ?? new Error('errore sconosciuto') } }
  if (r.error || !r.data) return { esito: 'errore', fase: 'movimento', messaggio: r.error instanceof ErroreRispostaMalformata ? MESSAGGIO_RISPOSTA_MALFORMATA : MESSAGGIO_MOVIMENTO_NON_REGISTRATO, pagamenti: riletti.data }
  deps.dimentica()
  return { esito: 'ok', movimento: r.data, giaApplicato: false, pagamenti: [...riletti.data, r.data] }
}
