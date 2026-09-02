'use client'
// Richieste di prenotazione: letture dal database e contatore per la
// navigazione. La logica pura (ordinamento, testi) sta in lib/richieste.ts.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { STATI_APERTI, spiegaErrore, type Richiesta } from './richieste'
import type { CondizionePagamento } from './condizioniPrenotazione'

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
export const MOTIVI_RIFIUTO = ['Completo', 'Prezzo', 'Non ha più risposto', 'Altro']

export async function rifiutaRichiesta(id: string, motivo?: string): Promise<{ chiusa_at: string; error: string | null }> {
  const chiusa_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('richieste')
    .update({ stato: 'rifiutata', chiusa_at, ...(motivo ? { motivo_rifiuto: motivo } : {}) })
    .eq('id', id)
    .select('id')
  if (error) {
    if (motivo && /motivo_rifiuto/i.test(error.message || '')) return { chiusa_at, error: 'Va applicata la migrazione 0027 (colonna motivo_rifiuto).' }
    return { chiusa_at, error: spiegaErrore(error) }
  }
  if (!data || data.length === 0) return { chiusa_at, error: 'Nessuna riga aggiornata: la richiesta potrebbe essere già stata chiusa.' }
  return { chiusa_at, error: null }
}

export async function fetchRichiesta(id: string): Promise<{ data: Richiesta | null; error: string | null }> {
  const { data, error } = await supabase.from('richieste').select('*, rooms(name)').eq('id', id).maybeSingle()
  if (error) return { data: null, error: spiegaErrore(error) }
  return { data: (data as unknown as Richiesta) ?? null, error: data ? null : 'Richiesta non trovata.' }
}

// Dopo «Sì, inviata»: stato proposta_inviata, ora, bozza e soluzione in UN solo
// aggiornamento. Se le colonne della 0025 mancano, l'aggiornamento fallisce
// per intero (lo stato NON cambia) e si spiega cosa applicare: mai una
// proposta registrata senza testo e soluzione.
export const AVVISO_0025 = 'Va applicata la migrazione 0025 (colonne proposta_testo e proposta_soluzione).'

export function manca0025(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (/proposta_testo|proposta_soluzione/i.test(e.message || '') || e.code === 'PGRST204' || e.code === '42703')
}

// La riga letta ha le colonne della 0025? (select * le include solo se esistono)
export function colonne0025Presenti(riga: Record<string, unknown> | null | undefined): boolean {
  return !!riga && 'proposta_testo' in riga && 'proposta_soluzione' in riga
}

// Pezzo 6: insieme alla bozza si salvano le condizioni di pagamento scelte da
// Ania (migrazione 0029). Stessa regola della 0025: colonne assenti → nessun
// salvataggio e avviso a schermo.
export const AVVISO_0029 = 'Va applicata la migrazione 0029 (colonne condizione_pagamento, caparra_centesimi, condizione_testo, amelia_alternativa).'
export const COLONNE_0029 = ['condizione_pagamento', 'caparra_centesimi', 'condizione_testo', 'amelia_alternativa'] as const

export type CondizioniSalvate = {
  condizione_pagamento: CondizionePagamento | null
  caparra_centesimi: number | null
  condizione_testo: string | null
  amelia_alternativa: boolean
}

export function manca0029(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (new RegExp(COLONNE_0029.join('|'), 'i').test(e.message || '') || e.code === 'PGRST204' || e.code === '42703')
}

export function colonne0029Presenti(riga: Record<string, unknown> | null | undefined): boolean {
  return !!riga && COLONNE_0029.every(c => c in riga)
}

export async function segnaPropostaInviata(id: string, testo: string, soluzione: unknown, condizioni: CondizioniSalvate): Promise<{ proposta_inviata_at: string; error: string | null }> {
  const proposta_inviata_at = new Date().toISOString()
  const { data, error } = await supabase.from('richieste')
    .update({ stato: 'proposta_inviata', proposta_inviata_at, proposta_testo: testo, proposta_soluzione: soluzione, ...condizioni })
    .eq('id', id).select('id, proposta_testo')
  if (error) return { proposta_inviata_at, error: manca0025(error) ? AVVISO_0025 : manca0029(error) ? AVVISO_0029 : spiegaErrore(error) }
  if (!data || data.length === 0) return { proposta_inviata_at, error: 'Nessuna riga aggiornata: la richiesta potrebbe essere stata chiusa.' }
  return { proposta_inviata_at, error: null }
}

// Conferma: SOLO la RPC (transazione unica lato database). Torna l'id della
// prenotazione creata (o esistente, se già confermata) oppure il testo dell'errore.
export async function confermaRichiesta(id: string, rifiutaAnche: string[]): Promise<{ prenotazioneId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('conferma_richiesta', { p_richiesta_id: id, p_rifiuta_anche: rifiutaAnche.length ? rifiutaAnche : null })
  if (error) {
    if (/conferma_richiesta|schema cache|function/i.test(error.message || '') && /not find|does not exist|PGRST202/i.test(`${error.code} ${error.message}`)) {
      return { prenotazioneId: null, error: 'Va applicata la migrazione 0027 (funzione conferma_richiesta).' }
    }
    return { prenotazioneId: null, error: error.message || 'errore sconosciuto' }
  }
  if (!data || typeof data !== 'string') return { prenotazioneId: null, error: 'La conferma non ha restituito la prenotazione.' }
  return { prenotazioneId: data, error: null }
}
