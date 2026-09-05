'use client'
// Richieste di prenotazione: letture dal database e contatore per la
// navigazione. La logica pura (ordinamento, testi) sta in lib/richieste.ts.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { STATI_APERTI, spiegaErrore, pianoModifica, type Richiesta, type ValoriModifica, type PropostaPrecedente } from './richieste'
import type { CondizionePagamento } from './condizioniPrenotazione'
import { contaConEsito, statoDopoConteggio, CONTATORE_IN_CARICAMENTO, type EsitoContatore, type StatoContatore } from './richiesteContatore'
import { manca0036, AVVISO_0036 } from './provenienza'

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

// Errori di salvataggio visibili, parte 3 (05/09/2026): il contatore non
// torna più 0 su errore (0 = «nessuna richiesta»); l'esito porta il
// messaggio e la barra mostra «!». La navigazione continua a funzionare.
export function contaRichiesteAperte(): Promise<EsitoContatore> {
  return contaConEsito(() => supabase
    .from('richieste')
    .select('id', { count: 'exact', head: true })
    .in('stato', STATI_APERTI))
}

// Stato UNICO per tutta l'app (come lib/webRequests): la barra, la pagina
// Richieste e «Riprova» leggono e aggiornano lo stesso contatore.
let statoContatore: StatoContatore = CONTATORE_IN_CARICAMENTO
const ascoltatori = new Set<() => void>()

function iscrivi(fn: () => void): () => void {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function pubblica(s: StatoContatore) {
  statoContatore = s
  for (const fn of ascoltatori) fn()
}

// Rilegge il contatore; con `daCapo` mostra prima «caricamento» (Riprova),
// altrimenti lo stato attuale resta finché non arriva la risposta.
export async function ricaricaRichiesteAperte(daCapo = false): Promise<void> {
  if (daCapo) pubblica(CONTATORE_IN_CARICAMENTO)
  const esito = await contaRichiesteAperte()
  pubblica(statoDopoConteggio(statoContatore, esito))
}

// Contatore in attesa/proposta inviata, riaggiornato quando la pagina torna
// in primo piano e a ogni navigazione (refreshKey), come useRichiesteWeb.
export function useRichiesteAperte(refreshKey?: string): StatoContatore & { ricarica: () => void } {
  const stato = useSyncExternalStore(iscrivi, () => statoContatore, () => CONTATORE_IN_CARICAMENTO)
  useEffect(() => {
    const load = () => { void ricaricaRichiesteAperte() }
    load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', load)
    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', load)
    }
  }, [refreshKey])
  const ricarica = useCallback(() => { void ricaricaRichiesteAperte(true) }, [])
  return { ...stato, ricarica }
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

// Pezzo 9: nel caso A con più camere libere il messaggio le elenca tutte; le
// soluzioni elencate si salvano in proposta_alternative (0031) per la scelta
// alla conferma. Senza alternative la colonna non viene toccata (tollera la
// migrazione mancante).
export async function segnaPropostaInviata(id: string, testo: string, soluzione: unknown, condizioni: CondizioniSalvate, alternative?: unknown[] | null): Promise<{ proposta_inviata_at: string; error: string | null }> {
  const proposta_inviata_at = new Date().toISOString()
  const { data, error } = await supabase.from('richieste')
    .update({ stato: 'proposta_inviata', proposta_inviata_at, proposta_testo: testo, proposta_soluzione: soluzione, ...condizioni, ...(alternative && alternative.length > 1 ? { proposta_alternative: alternative } : {}) })
    .eq('id', id).select('id, proposta_testo')
  if (error) return { proposta_inviata_at, error: manca0025(error) ? AVVISO_0025 : manca0029(error) ? AVVISO_0029 : manca0031(error) ? AVVISO_0031 : spiegaErrore(error) }
  if (!data || data.length === 0) return { proposta_inviata_at, error: 'Nessuna riga aggiornata: la richiesta potrebbe essere stata chiusa.' }
  return { proposta_inviata_at, error: null }
}

// ── Pezzo 9: persone notte per notte, modifica, alternative (migrazione 0031) ──
export const AVVISO_0031 = 'Va applicata la migrazione 0031 (colonne persone_per_notte, proposte_precedenti, proposta_alternative).'
export const COLONNE_0031 = ['persone_per_notte', 'proposte_precedenti', 'proposta_alternative'] as const

export function manca0031(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (new RegExp(COLONNE_0031.join('|'), 'i').test(e.message || '') || e.code === 'PGRST204' || e.code === '42703')
}
export function colonne0031Presenti(riga: Record<string, unknown> | null | undefined): boolean {
  return !!riga && COLONNE_0031.every(c => c in riga)
}

// Nuova richiesta: persone_per_notte va nel payload SOLO se non uniforme
// (così senza la 0031 le richieste «normali» si salvano ancora; quelle con
// persone variabili spiegano cosa manca).
// Provenienza (0036): se le colonne mancano si ritenta senza e si avvisa,
// la richiesta entra comunque.
export async function creaRichiesta(v: ValoriModifica): Promise<{ id: string | null; error: string | null; avviso?: string | null }> {
  const { persone_per_notte, provenienza, struttura_nome, ...resto } = v
  const base: Record<string, unknown> = { ...resto, stato: 'in_attesa', ...(persone_per_notte ? { persone_per_notte } : {}) }
  const conProvenienza = provenienza !== undefined
  const payload: Record<string, unknown> = conProvenienza ? { ...base, provenienza, struttura_nome: struttura_nome ?? null } : base
  let { data, error } = await supabase.from('richieste').insert(payload).select('id').single()
  let avviso: string | null = null
  if (error && conProvenienza && manca0036(error)) {
    avviso = AVVISO_0036
    ;({ data, error } = await supabase.from('richieste').insert(base).select('id').single())
  }
  if (error) return { id: null, error: persone_per_notte && manca0031(error) ? AVVISO_0031 : spiegaErrore(error) }
  if (!data?.id) return { id: null, error: 'Salvataggio non confermato dal database: la richiesta potrebbe non essere stata registrata.' }
  return { id: data.id, error: null, avviso }
}

// Modifica: un solo UPDATE con il piano puro (lib/richieste.pianoModifica).
// Se la proposta inviata viene superata, lo stato torna in_attesa e la
// proposta precedente finisce in proposte_precedenti: senza la 0031 l'update
// fallisce per intero e lo si dice.
export async function aggiornaRichiesta(
  originale: Richiesta & { persone_per_notte?: number[] | null; proposta_testo?: string | null; proposta_soluzione?: unknown; proposte_precedenti?: PropostaPrecedente[] | null },
  nuovi: ValoriModifica,
): Promise<{ error: string | null; avviso: string | null }> {
  const piano = pianoModifica(originale, nuovi)
  if (piano.errore) return { error: piano.errore, avviso: null }
  const campi = { ...piano.campi }
  // persone_per_notte null va scritto (torna uniforme) solo se la colonna esiste
  if (campi.persone_per_notte == null && !('persone_per_notte' in originale)) delete campi.persone_per_notte
  // Provenienza (0036): si scrive solo se la colonna esiste sulla riga letta
  if (!('provenienza' in originale)) { delete campi.provenienza; delete campi.struttura_nome }
  else if (campi.provenienza === undefined) { delete campi.provenienza; delete campi.struttura_nome }
  const { data, error } = await supabase.from('richieste').update(campi).eq('id', originale.id).in('stato', STATI_APERTI).select('id')
  if (error) return { error: manca0031(error) ? AVVISO_0031 : spiegaErrore(error), avviso: null }
  if (!data || data.length === 0) return { error: 'Nessuna riga aggiornata: la richiesta potrebbe essere stata chiusa nel frattempo.', avviso: null }
  return { error: null, avviso: piano.avviso }
}

// Alla conferma di un caso A con più camere: la camera scelta dal cliente
// diventa la soluzione da confermare (la RPC legge solo proposta_soluzione)
export async function scegliSoluzioneInviata(id: string, soluzione: unknown): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from('richieste').update({ proposta_soluzione: soluzione }).eq('id', id).eq('stato', 'proposta_inviata').select('id')
  if (error) return { error: spiegaErrore(error) }
  if (!data || data.length === 0) return { error: 'Nessuna riga aggiornata: la richiesta non è più in «proposta inviata».' }
  return { error: null }
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
