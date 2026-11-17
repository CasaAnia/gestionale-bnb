// ============================================================================
// LETTURE SEMPRE COMPLETE (17/11/2026). Supabase risponde al massimo 1.000
// righe per richiesta, senza dare errore: una tabella che cresce oltre il
// limite perderebbe le righe in silenzio. `leggiTutto` legge a pagine con un
// ordine stabile (prima le colonne chieste, poi sempre `id`), fino all'ultima
// pagina. Se una pagina va in errore torna l'errore e NESSUNA riga: mai un
// elenco parziale che sembra completo. Se si arriva al tetto di pagine con
// l'ultima ancora piena, è un errore esplicito (ErroreLetturaIncompleta).
// Forma di ritorno uguale a quella di Supabase ({ data, error }), così le
// pagine mostrano l'avviso che hanno già. Solo letture.
// ============================================================================
import { raccogliPagine, aBlocchi, LIMITE_PAGINA, DIMENSIONE_BLOCCO_ID } from './statistiche/paginazione.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ClienteLettura = { from(tabella: string): { select(colonne: string): any } }
export type Ordine = { colonna: string; ascendente?: boolean }
export type OpzioniLettura = {
  /** filtri della lettura (eq, in, neq…): si applicano a ogni pagina */
  filtri?: (q: any) => any
  /** ordine voluto prima dell'id (che chiude sempre l'ordine, per renderlo stabile) */
  ordine?: Ordine[]
  /** righe per pagina (1.000 è il massimo di Supabase; si cambia solo nelle prove) */
  limite?: number
}
export type ErroreLettura = { message: string; cause?: unknown }
export type EsitoLettura<T> = { data: T[] | null; error: ErroreLettura | null }
// l'errore ha sempre un testo (`message`), come quello di Supabase, e conserva la causa originale
const comeErrore = (e: unknown): ErroreLettura => {
  const m = (e as { message?: unknown } | null)?.message
  return { message: typeof m === 'string' ? m : String(e), cause: e }
}

export async function leggiTutto<T = Record<string, unknown>>(db: ClienteLettura, tabella: string, colonne = '*', opzioni: OpzioniLettura = {}): Promise<EsitoLettura<T>> {
  const r = await raccogliPagine<T>((da, limite) => {
    let q = db.from(tabella).select(colonne)
    if (opzioni.filtri) q = opzioni.filtri(q)
    for (const o of opzioni.ordine ?? []) q = q.order(o.colonna, { ascending: o.ascendente ?? true })
    return q.order('id', { ascending: true }).range(da, da + limite - 1)
  }, opzioni.limite ?? LIMITE_PAGINA)
  return r.error ? { data: null, error: comeErrore(r.error) } : { data: r.data, error: null }
}

/** Come leggiTutto, per un elenco lungo di valori (`colonna in (…)`): a blocchi di 100 per non allungare l'indirizzo,
 *  ogni blocco letto a pagine, righe uniche per `id`. Al primo errore nessuna riga. */
export async function leggiTuttoPer<T extends { id?: string | number | null }>(db: ClienteLettura, tabella: string, colonne: string, colonna: string, valori: string[], opzioni: OpzioniLettura = {}): Promise<EsitoLettura<T>> {
  const viste = new Set<string>()
  const righe: T[] = []
  for (const blocco of aBlocchi(valori, DIMENSIONE_BLOCCO_ID)) {
    const r = await leggiTutto<T>(db, tabella, colonne, { ...opzioni, filtri: q => (opzioni.filtri ? opzioni.filtri(q) : q).in(colonna, blocco) })
    if (r.error || !r.data) return { data: null, error: r.error ?? comeErrore(new Error('lettura non riuscita')) }
    for (const riga of r.data) {
      const k = riga.id == null ? JSON.stringify(riga) : String(riga.id)
      if (!viste.has(k)) { viste.add(k); righe.push(riga) }
    }
  }
  return { data: righe, error: null }
}
