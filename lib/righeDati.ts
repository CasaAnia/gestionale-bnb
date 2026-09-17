'use client'
// ============================================================================
// SCRIVERE SU PIÙ RIGHE DI bookings (17/09/2026): una chiamata per riga, con
// il controllo che ogni aggiornamento abbia toccato la sua riga. Se una
// scrittura fallisce a metà si dice qual è la situazione: quello che è stato
// scritto resta scritto (la scheda rilegge), niente viene dato per salvato
// senza esserlo. La usano i fogli della scheda nuova che toccano tutte le
// camere di una prenotazione: sconto, tariffe, nota e colore, «con lei».
// ============================================================================
import { supabase } from './supabase'
import { messaggioNonSalvato } from './scritturaSicura'

export const ERRORE_RIGA_NON_TROVATA = 'La camera non è stata trovata: ricarica la scheda.'
export const ERRORE_SALVATO_A_META = 'Salvato solo in parte: ricarica la scheda e controlla.'

export type EsitoRighe =
  | { esito: 'ok' }
  | { esito: 'errore'; messaggio: string; scritte: number; errore?: unknown }

export async function aggiornaRigaPerRiga(righe: { id: string; campi: Record<string, unknown> }[]): Promise<EsitoRighe> {
  let scritte = 0
  for (const r of righe) {
    try {
      const { data, error } = await supabase.from('bookings')
        .update({ ...r.campi, updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .select('id')
      if (error) return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : messaggioNonSalvato(error), scritte, errore: error }
      if (!Array.isArray(data) || data.length !== 1) return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : ERRORE_RIGA_NON_TROVATA, scritte }
      scritte += 1
    } catch (err) {
      return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : messaggioNonSalvato(err), scritte, errore: err }
    }
  }
  return { esito: 'ok' }
}

/** Gli stessi campi su tutte le righe (la nota, il colore, «con lei») */
export function stessiCampi(ids: string[], campi: Record<string, unknown>): { id: string; campi: Record<string, unknown> }[] {
  return ids.map(id => ({ id, campi }))
}
