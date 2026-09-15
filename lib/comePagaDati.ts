// ============================================================================
// SALVARE «COME PAGA» (13/09/2026) — scrittura con esito controllato.
//
// L'accordo vale per TUTTA la prenotazione, quindi il modo e la vecchia
// spunta «bonifico» si scrivono su tutte le camere; la caparra e la sua
// scadenza invece UNA volta sola, sulla riga che arriva per prima (copiate su
// ogni camera varrebbero il doppio: rilievo del 09/09/2026).
//
// Se la proposta 0041 non è ancora applicata su Supabase le colonne
// dell'accordo non esistono: si salva quello che si può (la spunta bonifico)
// e lo si dice, invece di perdere tutto il salvataggio.
//
// Nessun import di lib/supabase: le chiamate arrivano già pronte.
// ============================================================================
import { messaggioNonSalvato, type RispostaScrittura } from './scritturaSicura.ts'
import { colonnaMancante } from './colonnaMancante.ts'
import type { CampiComePaga } from './comePaga.ts'

export const AVVISO_SENZA_0041 = 'Ho salvato come paga solo in parte: la caparra e la sua scadenza non sono state registrate, serve la proposta 0041 applicata su Supabase.'

export type EsitoComePaga =
  | { esito: 'ok'; messaggio: string | null }
  | { esito: 'senza_accordo'; messaggio: string }
  | { esito: 'errore'; messaggio: string }

const COLONNE_ACCORDO = ['accordo_pagamento', 'caparra_centesimi', 'caparra_entro']

async function prova(scrivi: () => PromiseLike<RispostaScrittura>): Promise<unknown> {
  try {
    const r = await scrivi()
    return r && r.error ? r.error : null
  } catch (err) {
    return err ?? new Error('errore sconosciuto')
  }
}

export type ScrittureComePaga = {
  /** la funzione atomica della proposta 0052, quando c'è */
  rpc?: (dati: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
  /** la riga che arriva per prima: porta la caparra */
  scriviPrima: (campi: Record<string, unknown>) => PromiseLike<RispostaScrittura>
  /** tutte le ALTRE camere della prenotazione */
  scriviAltre: (campi: Record<string, unknown>) => PromiseLike<RispostaScrittura>
  /** quante altre camere ci sono: zero se la prenotazione è di una sola */
  quanteAltre: number
}

export const MANCA_LA_FUNZIONE = 'Serve la proposta 0052 applicata su Supabase: senza, salvare «come paga» non è un\'operazione sola e un guasto a metà strada può cancellare la caparra.'
export const AVVISO_SENZA_0052 = 'Salvato. Attenzione: la proposta 0052 non è applicata, quindi il salvataggio è avvenuto in due passaggi invece che in uno solo.'

/**
 * Salva «come paga» su tutte le camere della prenotazione.
 *
 * Con la funzione della proposta 0052 è UNA transazione: o tutto, o niente,
 * e si controlla quante righe sono state toccate davvero.
 *
 * Senza quella funzione si fa in due passaggi, ma nell'ORDINE SICURO: prima
 * la riga che porta la caparra (col valore nuovo), poi le altre. Così un
 * guasto in mezzo non cancella la caparra di prima — che è quello che
 * succedeva scrivendo prima su tutte e azzerando (rilievo del 15/09/2026).
 */
export async function salvaComePaga(
  campi: CampiComePaga,
  scritture: ScrittureComePaga,
): Promise<EsitoComePaga> {
  // ── la via buona: una transazione sola ──────────────────────────────────
  if (scritture.rpc) {
    const r = await prova(() => scritture.rpc!({
      p_accordo: campi.accordo_pagamento,
      p_bonifico: campi.bonifico,
      p_caparra_centesimi: campi.caparra_centesimi,
      p_caparra_entro: campi.caparra_entro,
    }) as PromiseLike<RispostaScrittura>)
    if (!r) return { esito: 'ok', messaggio: null }
    // la funzione non c'è ancora: si continua con i due passaggi, dicendolo
    if (!funzioneMancante(r)) return { esito: 'errore', messaggio: messaggioNonSalvato(r) }
  }

  // ── senza transazione: prima la caparra, poi il resto ───────────────────
  const conCaparra = {
    accordo_pagamento: campi.accordo_pagamento,
    bonifico: campi.bonifico,
    caparra_centesimi: campi.caparra_centesimi,
    caparra_entro: campi.caparra_entro,
  }
  const errore = await prova(() => scritture.scriviPrima(conCaparra))
  if (errore) {
    const colonna = colonnaMancante(errore as { code?: string; message?: string })
    if (!colonna || !COLONNE_ACCORDO.includes(colonna)) return { esito: 'errore', messaggio: messaggioNonSalvato(errore) }
    // senza le colonne della 0041 resta la spunta di sempre, su tutte le righe
    const soloBonifico = await prova(() => scritture.scriviPrima({ bonifico: campi.bonifico }))
      ?? (scritture.quanteAltre > 0 ? await prova(() => scritture.scriviAltre({ bonifico: campi.bonifico })) : null)
    if (soloBonifico) return { esito: 'errore', messaggio: messaggioNonSalvato(soloBonifico) }
    return { esito: 'senza_accordo', messaggio: AVVISO_SENZA_0041 }
  }

  if (scritture.quanteAltre === 0) return { esito: 'ok', messaggio: null }
  // le altre camere: stesso modo, senza caparra (vale una volta sola)
  const erroreAltre = await prova(() => scritture.scriviAltre({
    accordo_pagamento: campi.accordo_pagamento,
    bonifico: campi.bonifico,
    caparra_centesimi: null,
    caparra_entro: null,
  }))
  if (erroreAltre) return { esito: 'errore', messaggio: `${messaggioNonSalvato(erroreAltre)} La caparra però è al sicuro: riprova.` }
  return { esito: 'ok', messaggio: scritture.rpc ? AVVISO_SENZA_0052 : null }
}

/** La funzione della proposta 0052 non è ancora su Supabase */
export function funzioneMancante(errore: unknown): boolean {
  const e = errore as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === 'PGRST202' || e.code === '42883') return true
  return /salva_come_paga|function .* does not exist|schema cache/i.test(e.message ?? '')
}
