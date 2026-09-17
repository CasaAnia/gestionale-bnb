'use client'
// ============================================================================
// SCRIVERE SU PIÙ RIGHE DI bookings (17/09/2026).
//
// Due strade:
// - `aggiornaInUnColpo`: gli STESSI campi su tutte le righe, in una richiesta
//   sola (`update … in ('id', …)`): una sola istruzione SQL, o tutto o niente.
//   La usano nota e colore, «con lei», il legame fra le camere.
// - `aggiornaRigaPerRiga`: campi diversi per riga (sconto, tariffe), una
//   chiamata per riga con il controllo che ogni aggiornamento abbia toccato
//   la sua riga.
//
// L'esito d'errore dice se è INCERTO: qualcosa può essere stato scritto (una
// riga sì e una no, oppure la risposta è andata persa dopo la scrittura). In
// quel caso la scheda non deve più fidarsi di quello che mostra: rilegge e
// intanto nasconde il conto (rilievo della revisione del 17/09/2026).
// Niente viene dato per salvato senza esserlo.
// ============================================================================
import { supabase } from './supabase'
import { messaggioNonSalvato } from './scritturaSicura'

export const ERRORE_RIGA_NON_TROVATA = 'La camera non è stata trovata: ricarica la scheda.'
export const ERRORE_SALVATO_A_META = 'Salvato solo in parte: la scheda si rilegge da sola, controlla il conto.'
export const ERRORE_RISPOSTA_PERSA = 'Non so se è stato salvato: la scheda si rilegge da sola, controlla.'

export type EsitoRighe =
  | { esito: 'ok' }
  | { esito: 'errore'; messaggio: string; scritte: number; incerto: boolean; errore?: unknown }

export async function aggiornaRigaPerRiga(righe: { id: string; campi: Record<string, unknown> }[]): Promise<EsitoRighe> {
  let scritte = 0
  for (const r of righe) {
    try {
      const { data, error } = await supabase.from('bookings')
        .update({ ...r.campi, updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .select('id')
      if (error) return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : messaggioNonSalvato(error), scritte, incerto: scritte > 0, errore: error }
      if (!Array.isArray(data) || data.length !== 1) return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : ERRORE_RIGA_NON_TROVATA, scritte, incerto: true }
      scritte += 1
    } catch (err) {
      // la risposta è andata persa: la riga può essere stata scritta lo stesso
      return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : ERRORE_RISPOSTA_PERSA, scritte, incerto: true, errore: err }
    }
  }
  return { esito: 'ok' }
}

/** Gli stessi campi su tutte le righe, in una richiesta sola: o tutte o nessuna. */
export async function aggiornaInUnColpo(ids: string[], campi: Record<string, unknown>): Promise<EsitoRighe> {
  if (ids.length === 0) return { esito: 'ok' }
  try {
    const { data, error } = await supabase.from('bookings')
      .update({ ...campi, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select('id')
    if (error) return { esito: 'errore', messaggio: messaggioNonSalvato(error), scritte: 0, incerto: false, errore: error }
    const toccate = Array.isArray(data) ? data.length : 0
    if (toccate !== ids.length) return { esito: 'errore', messaggio: ERRORE_RIGA_NON_TROVATA, scritte: toccate, incerto: true }
    return { esito: 'ok' }
  } catch (err) {
    return { esito: 'errore', messaggio: ERRORE_RISPOSTA_PERSA, scritte: 0, incerto: true, errore: err }
  }
}

/** Gli stessi campi su tutte le righe, nella forma di `aggiornaRigaPerRiga` */
export function stessiCampi(ids: string[], campi: Record<string, unknown>): { id: string; campi: Record<string, unknown> }[] {
  return ids.map(id => ({ id, campi }))
}
