// Contatore delle richieste aperte (bollino «Richieste» nella barra) con
// esito controllato — errori di salvataggio visibili, parte 3 (05/09/2026).
// Prima un errore di lettura tornava 0, indistinguibile da «nessuna
// richiesta». Stessa forma di lib/richiesteDalSito: stato a tre valori,
// nessun import di Supabase (i test usano un finto).
import { isErroreDiRete } from './connessione.ts'
import { scadenzaProposta } from './richieste.ts'

export const MESSAGGIO_CONTATORE_NON_LETTO = 'Non riesco a contare le richieste aperte'

export function messaggioContatoreNonLetto(err: unknown): string {
  return isErroreDiRete(err) ? `${MESSAGGIO_CONTATORE_NON_LETTO}: nessuna connessione` : `${MESSAGGIO_CONTATORE_NON_LETTO}, riprova`
}

// Dal 07/09/2026 (Ania) il contatore non è più un numero unico ma le righe
// aperte (stato + ora della proposta): i bollini si calcolano da qui.
export type RigaAperta = { stato: string; proposta_inviata_at: string | null }
export type EsitoContatore = { righe: RigaAperta[] | null; errore: string | null }

type RispostaRighe = { data: RigaAperta[] | null; error: unknown }

export async function contaConEsito(leggi: () => PromiseLike<RispostaRighe>): Promise<EsitoContatore> {
  try {
    const r = await leggi()
    if (r.error) return { righe: null, errore: messaggioContatoreNonLetto(r.error) }
    return { righe: r.data ?? [], errore: null }
  } catch (err) {
    return { righe: null, errore: messaggioContatoreNonLetto(err) }
  }
}

export type StatoContatore =
  | { stato: 'caricamento'; righe: RigaAperta[]; errore: null }
  | { stato: 'pronto'; righe: RigaAperta[]; errore: null }
  | { stato: 'errore'; righe: RigaAperta[]; errore: string }

export const CONTATORE_IN_CARICAMENTO: StatoContatore = { stato: 'caricamento', righe: [], errore: null }

// Con un errore le righe già lette restano (i bollini non tornano a zero).
export function statoDopoConteggio(prima: StatoContatore, esito: EsitoContatore): StatoContatore {
  if (esito.errore || esito.righe === null) return { stato: 'errore', righe: prima.righe, errore: esito.errore ?? `${MESSAGGIO_CONTATORE_NON_LETTO}, riprova` }
  return { stato: 'pronto', righe: esito.righe, errore: null }
}

// ── Bollini sul tasto «Richieste» (Ania, 07/09/2026) ──────────────────────
// Rosso col numero SOLO per le richieste nuove da gestire (in attesa): è
// l'urgenza. Blu, sotto il rosso, per quelle già gestite (proposta inviata)
// che aspettano ancora la risposta del cliente entro le 3 ore. Una proposta
// scaduta non conta in nessuno dei due: resta visibile nella pagina Richieste
// ma non c'è più niente da sistemare. Confermate/rifiutate/chiuse: mai.
export type Bollini = { nuove: number; inAttesaRisposta: number }

export function bolliniRichieste(righe: RigaAperta[], adesso: Date = new Date()): Bollini {
  let nuove = 0, inAttesaRisposta = 0
  for (const r of righe) {
    if (r.stato === 'in_attesa') nuove++
    else if (r.stato === 'proposta_inviata' && scadenzaProposta(r as Parameters<typeof scadenzaProposta>[0], adesso)?.scaduta !== true) inAttesaRisposta++
  }
  return { nuove, inAttesaRisposta }
}
