'use client'
// Cronologia delle modifiche (07/09/2026): lettura di booking_events per i
// segmenti di un soggiorno. Tabella assente (proposta 0042 non applicata) =
// «registro non acceso», dichiarato e mai un errore; ogni altro errore è
// visibile (AvvisoAzione + Riprova nella scheda). Nessuna scrittura da qui:
// le righe le scrivono i trigger del database.
import { supabase } from './supabase'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import type { EventoCronologia } from './cronologia'

export type LetturaCronologia = { eventi: EventoCronologia[]; registrata: boolean; errore: string | null }

const tabellaAssente = (e: unknown) => { const c = String((e as { code?: unknown })?.code ?? ''); return c === '42P01' || c === 'PGRST205' }

export async function leggiCronologia(bookingIds: string[]): Promise<LetturaCronologia> {
  if (bookingIds.length === 0) return { eventi: [], registrata: true, errore: null }
  try {
    const { data, error } = await supabase.from('booking_events')
      .select('id, n, booking_id, soggiorno, created_at, tipo, prima, dopo')
      .in('booking_id', bookingIds)
      .order('created_at', { ascending: false }).order('n', { ascending: false })
      .limit(500)
    if (error) {
      if (tabellaAssente(error)) return { eventi: [], registrata: false, errore: null }
      return { eventi: [], registrata: true, errore: messaggioLetturaNonRiuscita(error, 'caricare la cronologia') }
    }
    return { eventi: (data || []) as EventoCronologia[], registrata: true, errore: null }
  } catch (err) {
    return { eventi: [], registrata: true, errore: messaggioLetturaNonRiuscita(err, 'caricare la cronologia') }
  }
}
