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

// Rifiuto: stato rifiutata e ora di chiusura. Nessun messaggio parte da qui.
// Torna il testo dell'errore (mostrato a schermo) oppure null.
export async function rifiutaRichiesta(id: string): Promise<{ chiusa_at: string; error: string | null }> {
  const chiusa_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('richieste')
    .update({ stato: 'rifiutata', chiusa_at })
    .eq('id', id)
    .select('id')
  if (error) return { chiusa_at, error: spiegaErrore(error) }
  if (!data || data.length === 0) return { chiusa_at, error: 'Nessuna riga aggiornata: la richiesta potrebbe essere già stata chiusa.' }
  return { chiusa_at, error: null }
}

export async function fetchRichiesta(id: string): Promise<{ data: Richiesta | null; error: string | null }> {
  const { data, error } = await supabase.from('richieste').select('*, rooms(name)').eq('id', id).maybeSingle()
  if (error) return { data: null, error: spiegaErrore(error) }
  return { data: (data as unknown as Richiesta) ?? null, error: data ? null : 'Richiesta non trovata.' }
}

// Al tocco su «Apri WhatsApp e invia»: stato proposta_inviata, ora, bozza e
// soluzione inviate. Se le colonne della 0025 non ci sono ancora, lo stato
// cambia comunque e si avvisa che la bozza non è stata archiviata.
export async function segnaPropostaInviata(id: string, testo: string, soluzione: unknown): Promise<{ proposta_inviata_at: string; error: string | null; avviso: string | null }> {
  const proposta_inviata_at = new Date().toISOString()
  const completo = await supabase.from('richieste')
    .update({ stato: 'proposta_inviata', proposta_inviata_at, proposta_testo: testo, proposta_soluzione: soluzione })
    .eq('id', id).select('id')
  if (!completo.error) {
    if (!completo.data || completo.data.length === 0) return { proposta_inviata_at, error: 'Nessuna riga aggiornata: la richiesta potrebbe essere stata chiusa.', avviso: null }
    return { proposta_inviata_at, error: null, avviso: null }
  }
  const colonnaMancante = /proposta_testo|proposta_soluzione|schema cache|column/i.test(completo.error.message || '')
  if (!colonnaMancante) return { proposta_inviata_at, error: spiegaErrore(completo.error), avviso: null }
  const ridotto = await supabase.from('richieste')
    .update({ stato: 'proposta_inviata', proposta_inviata_at })
    .eq('id', id).select('id')
  if (ridotto.error) return { proposta_inviata_at, error: spiegaErrore(ridotto.error), avviso: null }
  if (!ridotto.data || ridotto.data.length === 0) return { proposta_inviata_at, error: 'Nessuna riga aggiornata: la richiesta potrebbe essere stata chiusa.', avviso: null }
  return { proposta_inviata_at, error: null, avviso: 'Stato aggiornato, ma la bozza non è stata archiviata: va applicata la migrazione 0025.' }
}
