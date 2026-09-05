'use client'
// Lettura dei tre numeri in cima alla Home (07/09/2026): prenotazioni
// confermate che toccano oggi (a pagine) e camere; ogni errore torna come
// testo e la Home mostra un trattino al posto del numero + «Riprova», mai
// uno zero finto. Il giorno è quello di Roma. Le regole stanno in
// lib/numeriOggi (pure): qui nessuna formula.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { raccogliPagine } from './statistiche/paginazione'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { leggiCamere, STATI_LETTI } from './statisticheDati'
import { oggiARoma } from './spese/adattatore'
import { numeriOggi, type NumeriOggi, type PrenotazioneOggi } from './numeriOggi'

export const MESSAGGIO_NUMERI_NON_LETTI = 'Non riesco a leggere arrivi, partenze e camere di oggi'

export type StatoNumeriOggi =
  | { stato: 'caricamento'; oggi: string }
  | { stato: 'errore'; oggi: string; errore: string }
  | { stato: 'pronto'; oggi: string; numeri: NumeriOggi }

export async function leggiNumeriOggi(oggi: string): Promise<{ numeri: NumeriOggi | null; errore: string | null }> {
  const [p, cam] = await Promise.all([
    raccogliPagine<PrenotazioneOggi>((offset, limite) => supabase.from('bookings').select('id, room_id, group_id, guest_id, check_in, check_out, status')
      .in('status', STATI_LETTI).lte('check_in', oggi).gte('check_out', oggi).range(offset, offset + limite - 1)),
    leggiCamere(),
  ])
  if (p.error) return { numeri: null, errore: messaggioLetturaNonRiuscita(p.error, 'leggere le prenotazioni di oggi') }
  if (cam.errore || !cam.data) return { numeri: null, errore: cam.errore ?? MESSAGGIO_NUMERI_NON_LETTI }
  return { numeri: numeriOggi(p.data, cam.data, oggi), errore: null }
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
      const { numeri, errore } = await leggiNumeriOggi(oggi)
      if (!vivo) return
      setStato(errore || !numeri ? { stato: 'errore', oggi, errore: MESSAGGIO_NUMERI_NON_LETTI } : { stato: 'pronto', oggi, numeri })
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
