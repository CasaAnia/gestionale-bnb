// Contatore delle richieste aperte (bollino «Richieste» nella barra) con
// esito controllato — errori di salvataggio visibili, parte 3 (05/09/2026).
// Prima un errore di lettura tornava 0, indistinguibile da «nessuna
// richiesta». Stessa forma di lib/richiesteDalSito: stato a tre valori,
// nessun import di Supabase (i test usano un finto).
import { isErroreDiRete } from './connessione.ts'

export const MESSAGGIO_CONTATORE_NON_LETTO = 'Non riesco a contare le richieste aperte'

export function messaggioContatoreNonLetto(err: unknown): string {
  return isErroreDiRete(err) ? `${MESSAGGIO_CONTATORE_NON_LETTO}: nessuna connessione` : `${MESSAGGIO_CONTATORE_NON_LETTO}, riprova`
}

export type EsitoContatore = { count: number | null; errore: string | null }

type RispostaConteggio = { count: number | null; error: unknown }

export async function contaConEsito(conta: () => PromiseLike<RispostaConteggio>): Promise<EsitoContatore> {
  try {
    const r = await conta()
    if (r.error) return { count: null, errore: messaggioContatoreNonLetto(r.error) }
    return { count: r.count ?? 0, errore: null }
  } catch (err) {
    return { count: null, errore: messaggioContatoreNonLetto(err) }
  }
}

export type StatoContatore =
  | { stato: 'caricamento'; count: number; errore: null }
  | { stato: 'pronto'; count: number; errore: null }
  | { stato: 'errore'; count: number; errore: string }

export const CONTATORE_IN_CARICAMENTO: StatoContatore = { stato: 'caricamento', count: 0, errore: null }

// Con un errore il numero già mostrato resta (non torna a zero).
export function statoDopoConteggio(prima: StatoContatore, esito: EsitoContatore): StatoContatore {
  if (esito.errore || esito.count === null) return { stato: 'errore', count: prima.count, errore: esito.errore ?? `${MESSAGGIO_CONTATORE_NON_LETTO}, riprova` }
  return { stato: 'pronto', count: esito.count, errore: null }
}
