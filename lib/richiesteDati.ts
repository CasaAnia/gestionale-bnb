'use client'
// Richieste di prenotazione: letture dal database e contatore per la
// navigazione. La logica pura (ordinamento, testi) sta in lib/richieste.ts.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { STATI_APERTI, spiegaErrore, type Richiesta } from './richieste'

// Tutte le richieste con il nome della camera. Gli errori tornano al
// chiamante come testo: la pagina li mostra, mai catch silenziosi.
export async function fetchRichieste(): Promise<{ data: Richiesta[]; error: string | null }> {
  const { data, error } = await supabase
    .from('richieste')
    .select('*, rooms(name)')
    .order('created_at', { ascending: true })
  if (error) return { data: [], error: spiegaErrore(error) }
  return { data: (data || []) as unknown as Richiesta[], error: null }
}

export async function contaRichiesteAperte(): Promise<number> {
  const { count, error } = await supabase
    .from('richieste')
    .select('id', { count: 'exact', head: true })
    .in('stato', STATI_APERTI)
  // Il contatore è un dettaglio della barra: se la tabella manca la
  // navigazione deve continuare a funzionare (la pagina spiega l'errore).
  if (error) return 0
  return count ?? 0
}

// Contatore in attesa/proposta inviata, riaggiornato quando la pagina torna
// in primo piano e a ogni navigazione (refreshKey), come useWebRequestCount.
export function useRichiesteCount(refreshKey?: string): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    const load = () => contaRichiesteAperte().then(n => { if (alive) setCount(n) })
    load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', load)
    return () => {
      alive = false
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', load)
    }
  }, [refreshKey])
  return count
}
