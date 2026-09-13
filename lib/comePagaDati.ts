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
  | { esito: 'ok'; messaggio: null }
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

export async function salvaComePaga(
  campi: CampiComePaga,
  scriviTutte: (campi: Record<string, unknown>) => PromiseLike<RispostaScrittura>,
  scriviPrima: (campi: Record<string, unknown>) => PromiseLike<RispostaScrittura>,
): Promise<EsitoComePaga> {
  // 1. il modo su tutte le camere; la caparra vecchia si azzera qui, così il
  //    vincolo del database resta rispettato anche cambiando modo.
  const perTutte = {
    accordo_pagamento: campi.accordo_pagamento,
    bonifico: campi.bonifico,
    caparra_centesimi: null,
    caparra_entro: null,
  }
  const errore = await prova(() => scriviTutte(perTutte))
  if (errore) {
    const colonna = colonnaMancante(errore as { code?: string; message?: string })
    if (!colonna || !COLONNE_ACCORDO.includes(colonna)) return { esito: 'errore', messaggio: messaggioNonSalvato(errore) }
    // senza le colonne della 0041 resta la spunta di sempre
    const secondo = await prova(() => scriviTutte({ bonifico: campi.bonifico }))
    if (secondo) return { esito: 'errore', messaggio: messaggioNonSalvato(secondo) }
    return { esito: 'senza_accordo', messaggio: AVVISO_SENZA_0041 }
  }

  // 2. la caparra, solo sulla riga che arriva per prima
  if (campi.caparra_centesimi == null && campi.caparra_entro == null) return { esito: 'ok', messaggio: null }
  const erroreCaparra = await prova(() => scriviPrima({
    caparra_centesimi: campi.caparra_centesimi,
    caparra_entro: campi.caparra_entro,
  }))
  if (erroreCaparra) return { esito: 'errore', messaggio: messaggioNonSalvato(erroreCaparra) }
  return { esito: 'ok', messaggio: null }
}
