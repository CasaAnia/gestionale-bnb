'use client'
// ============================================================================
// SALVARE LO SCONTO dalla scheda nuova (17/09/2026): le chiamate a Supabase.
// Cosa scrivere lo decide lib/scontoScheda (pure); qui si scrive riga per
// riga, su ogni camera attiva, controllando che ogni aggiornamento abbia
// toccato la sua riga. Se una scrittura fallisce a metà si dice qual è la
// situazione: quello che è stato scritto resta scritto (la scheda rilegge),
// niente viene dato per salvato senza esserlo.
// ============================================================================
import { supabase } from './supabase'
import { messaggioNonSalvato } from './scritturaSicura'
import type { CampiScontoRiga } from './scontoScheda'

export const ERRORE_RIGA_SCONTO = 'La camera non è stata trovata: ricarica la scheda.'
export const ERRORE_SCONTO_A_META = 'Salvato solo in parte: ricarica la scheda e controlla il conto.'

export type EsitoSconto =
  | { esito: 'ok' }
  | { esito: 'errore'; messaggio: string; scritte: number }

export async function salvaSconto(righe: { id: string; campi: CampiScontoRiga }[]): Promise<EsitoSconto> {
  let scritte = 0
  for (const r of righe) {
    try {
      const { data, error } = await supabase.from('bookings')
        .update({ ...r.campi, updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .select('id')
      if (error) return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SCONTO_A_META : messaggioNonSalvato(error), scritte }
      if (!Array.isArray(data) || data.length !== 1) return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SCONTO_A_META : ERRORE_RIGA_SCONTO, scritte }
      scritte += 1
    } catch (err) {
      return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SCONTO_A_META : messaggioNonSalvato(err), scritte }
    }
  }
  return { esito: 'ok' }
}
