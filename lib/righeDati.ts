'use client'
// ============================================================================
// SCRIVERE SU PIÙ RIGHE DI bookings (17/09/2026) — il legame col client
// dell'app. La logica sta in lib/righeScrittura (senza Supabase, provata col
// client PostgREST vero e un trasporto finto); qui si passa soltanto il
// client del browser.
// ============================================================================
import { supabase } from './supabase'
import {
  aggiornaRigaPerRiga as aggiornaRigaPerRigaCon, aggiornaInUnColpo as aggiornaInUnColpoCon,
  type ClienteRighe, type EsitoRighe,
} from './righeScrittura'

export { stessiCampi, rispostaPersa, ERRORE_RIGA_NON_TROVATA, ERRORE_SALVATO_A_META, ERRORE_RISPOSTA_PERSA } from './righeScrittura'
export type { EsitoRighe } from './righeScrittura'

const client = supabase as unknown as ClienteRighe

export function aggiornaRigaPerRiga(righe: { id: string; campi: Record<string, unknown> }[]): Promise<EsitoRighe> {
  return aggiornaRigaPerRigaCon(client, righe)
}

export function aggiornaInUnColpo(ids: string[], campi: Record<string, unknown>): Promise<EsitoRighe> {
  return aggiornaInUnColpoCon(client, ids, campi)
}
