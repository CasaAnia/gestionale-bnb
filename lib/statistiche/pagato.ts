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
// R1 (revisione Codex di f4d5474): «Segna come pagato» con RECUPERO
// DELL'ESITO. Il rischio: l'INSERT del saldo viene eseguito dal server ma la
// risposta si perde; al tocco successivo, con la lista dei pagamenti vecchia,
// si calcolerebbe di nuovo lo stesso saldo → secondo movimento. Contratto:
//  1. PRIMA di ogni tentativo si rileggono i pagamenti del soggiorno dal
//     server; se la rilettura fallisce ci si FERMA (mai «pagamento assente»);
//  2. il saldo mancante si calcola sui dati appena riletti: se il movimento
//     precedente era stato applicato, il saldo è zero e non si scrive nulla;
//  3. poi il flag. Ogni fase riporta il suo esito, niente eccezioni fuori.
// Con la migrazione 0033 (proposta) l'inserimento passa dalla RPC
// segna_pagato con chiave stabile: idempotente anche lato database.
// ---------------------------------------------------------------------------
export type MovimentoSaldo = { booking_id: string; amount: number; method: MetodoPagamento; paid_on: string; chiave_operazione: string }

export const MESSAGGIO_RILETTURA_PAGAMENTI = 'Non riesco a controllare i pagamenti già registrati, riprova'
export const MESSAGGIO_MOVIMENTO_NON_REGISTRATO = 'Non salvato, riprova: il pagamento non è stato registrato'
export const MESSAGGIO_FLAG_NON_SEGNATO = 'Pagamento registrato, ma non segnato come pagato: riprova'

export type DepsSegnaPagato = {
  rileggiPagamenti: () => PromiseLike<{ data: PagamentoStat[] | null; error: unknown }>
  // Scrive il movimento (RPC idempotente se c'è, altrimenti INSERT); torna la riga scritta
  inserisci: (movimento: MovimentoSaldo) => PromiseLike<{ data: PagamentoStat | null; error: unknown }>
  segnaFlag: () => PromiseLike<{ error: unknown }>
}

export type EsitoSegnaPagato =
  | { esito: 'ok'; pagamenti: PagamentoStat[]; movimento: PagamentoStat | null }
  | { esito: 'errore'; fase: 'rilettura' | 'movimento' | 'flag'; messaggio: string; pagamenti: PagamentoStat[] | null }

export async function eseguiSegnaPagato(
  segmenti: PrenotazioneStat[], oggi: string, metodo: MetodoPagamento, bookingId: string, chiave: string, deps: DepsSegnaPagato,
): Promise<EsitoSegnaPagato> {
  let riletti: { data: PagamentoStat[] | null; error: unknown }
  try { riletti = await deps.rileggiPagamenti() } catch (e) { riletti = { data: null, error: e ?? new Error('errore sconosciuto') } }
  if (riletti.error || !riletti.data) return { esito: 'errore', fase: 'rilettura', messaggio: MESSAGGIO_RILETTURA_PAGAMENTI, pagamenti: null }
  const pagamenti = riletti.data
  const base = movimentoSaldo(segmenti, pagamenti, oggi, metodo, bookingId)
  let scritto: PagamentoStat | null = null
  if (base) {
    const movimento: MovimentoSaldo = { ...base, chiave_operazione: chiave }
    let r: { data: PagamentoStat | null; error: unknown }
    try { r = await deps.inserisci(movimento) } catch (e) { r = { data: null, error: e ?? new Error('errore sconosciuto') } }
    if (r.error) return { esito: 'errore', fase: 'movimento', messaggio: MESSAGGIO_MOVIMENTO_NON_REGISTRATO, pagamenti }
    scritto = r.data ?? { booking_id: movimento.booking_id, amount: movimento.amount, paid_on: movimento.paid_on }
  }
  const dopo = scritto ? [...pagamenti, scritto] : pagamenti
  let f: { error: unknown }
  try { f = await deps.segnaFlag() } catch (e) { f = { error: e ?? new Error('errore sconosciuto') } }
  if (f.error) return { esito: 'errore', fase: 'flag', messaggio: scritto ? MESSAGGIO_FLAG_NON_SEGNATO : MESSAGGIO_MOVIMENTO_NON_REGISTRATO.replace(': il pagamento non è stato registrato', ''), pagamenti: dopo }
  return { esito: 'ok', pagamenti: dopo, movimento: scritto }
}

// La RPC della 0033 non c'è ancora? (PostgREST: funzione non trovata)
export function rpcMancante(e: unknown): boolean {
  const code = String((e as { code?: unknown })?.code ?? '')
  const msg = String((e as { message?: unknown })?.message ?? '').toLowerCase()
  return code === 'PGRST202' || code === '42883' || msg.includes('could not find the function') || msg.includes('does not exist')
}
