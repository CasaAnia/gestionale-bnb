'use client'
// Lettura dei tre numeri e della striscia della settimana in cima alla Home
// (07/09/2026): prenotazioni confermate dal CUTOFF delle pulizie in poi (a
// pagine: servono anche le partenze passate ancora aperte e i prolungamenti),
// camere e decisioni della tabella cleanings (rimandi/fatte, come la pagina
// Pulizie: tabella assente = nessuna decisione); ogni errore di lettura torna come
// testo e la Home mostra un trattino al posto del numero + «Riprova», mai
// uno zero finto. Il giorno è quello di Roma. Le regole stanno in
// lib/numeriOggi (pure): qui nessuna formula.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { raccogliPagine } from './statistiche/paginazione'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { leggiCamere, STATI_LETTI } from './statisticheDati'
import { oggiARoma } from './spese/adattatore'
import { numeriOggi, strisciaSettimane, type NumeriOggi, type PrenotazioneOggi, type GiornoStriscia } from './numeriOggi'
import { CUTOFF_STORICO, type Decisione } from './pulizie'

export const MESSAGGIO_NUMERI_NON_LETTI = 'Non riesco a leggere arrivi, partenze e camere di oggi'

export type StatoNumeriOggi =
  | { stato: 'caricamento'; oggi: string }
  | { stato: 'errore'; oggi: string; errore: string }
  | { stato: 'pronto'; oggi: string; numeri: NumeriOggi; settimana: GiornoStriscia[] }

export async function leggiNumeriOggi(oggi: string): Promise<{ numeri: NumeriOggi | null; settimana: GiornoStriscia[]; errore: string | null }> {
  // Tutte le colonne (come la pagina Pulizie: servono guest_id, linen_next_date…)
  // e tutte le prenotazioni dal CUTOFF_STORICO delle pulizie in poi
  const [p, cam, ev] = await Promise.all([
    raccogliPagine<PrenotazioneOggi>((offset, limite) => supabase.from('bookings').select('*')
      .in('status', STATI_LETTI).gte('check_out', CUTOFF_STORICO).range(offset, offset + limite - 1)),
    leggiCamere(),
    raccogliPagine<Decisione>((offset, limite) => supabase.from('cleanings').select('*').order('created_at').range(offset, offset + limite - 1)),
  ])
  if (p.error) return { numeri: null, settimana: [], errore: messaggioLetturaNonRiuscita(p.error, 'leggere le prenotazioni di oggi') }
  if (cam.errore || !cam.data) return { numeri: null, settimana: [], errore: cam.errore ?? MESSAGGIO_NUMERI_NON_LETTI }
  // Stessa scelta della pagina Pulizie: senza la tabella cleanings (0018) si
  // va avanti senza decisioni registrate
  const events: Decisione[] = ev.error ? [] : ev.data
  const attive = cam.data.filter(c => c.active !== false)
  return { numeri: numeriOggi(p.data, cam.data, oggi), settimana: strisciaSettimane(attive, p.data, events, oggi), errore: null }
}

// Si rilegge al ritorno in primo piano: sul telefono il gestionale resta
// aperto per giorni e a mezzanotte «oggi» cambia.
export function useNumeriOggi(): StatoNumeriOggi & { ricarica: () => void } {
  const [stato, setStato] = useState<StatoNumeriOggi>(() => ({ stato: 'caricamento', oggi: oggiARoma() }))
  const [tentativo, setTentativo] = useState(0)
  useEffect(() => {
    let vivo = true
    const load = async () => {
      const oggi = oggiARoma()
      const { numeri, settimana, errore } = await leggiNumeriOggi(oggi)
      if (!vivo) return
      setStato(errore || !numeri ? { stato: 'errore', oggi, errore: MESSAGGIO_NUMERI_NON_LETTI } : { stato: 'pronto', oggi, numeri, settimana })
    }
    void load()
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { vivo = false; window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [tentativo])
  const ricarica = useCallback(() => { setStato(s => ({ stato: 'caricamento', oggi: s.oggi })); setTentativo(t => t + 1) }, [])
  return { ...stato, ricarica }
}
