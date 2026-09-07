// ============================================================================
// ESITO DELLE LETTURE del modulo spese vecchio (07/09/2026, pezzo 6). Prima
// una lettura fallita tornava `null` e la sezione spariva in silenzio, senza
// distinguere «tabella non ancora creata» (normale, migrazione non applicata)
// da «rete caduta / permesso negato» (da dire ad Ania con Riprova). Qui la
// distinzione, pura: nessun Supabase.
// ============================================================================
import { messaggioLetturaNonRiuscita } from '../prenotazioneScritture.ts'

export type EsitoLettura<T> = { righe: T[]; assente: boolean; errore: string | null }

// PostgREST: tabella sconosciuta (42P01 / PGRST205) o colonna sconosciuta
// (42703 / PGRST204) = migrazione non applicata; storage: bucket assente
export function tabellaOBucketAssente(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown; status?: unknown } | null
  const codice = String(e?.code ?? '')
  if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(codice)) return true
  const testo = String(e?.message ?? '').toLowerCase()
  return testo.includes('bucket not found') || testo.includes('does not exist')
}

export function esitoLettura<T>(risposta: { data: T[] | null; error: unknown }, cosa: string): EsitoLettura<T> {
  if (!risposta.error) return { righe: risposta.data ?? [], assente: false, errore: null }
  if (tabellaOBucketAssente(risposta.error)) return { righe: [], assente: true, errore: null }
  return { righe: [], assente: false, errore: messaggioLetturaNonRiuscita(risposta.error, cosa) }
}
