'use client'
// Richieste arrivate dal sito e ancora da confermare (Ania chiama sempre il
// cliente prima di confermare). Usate da: pallino sulla barra, riga nella
// home e finestra all'apertura del gestionale.
//
// Errori di salvataggio visibili (05/09/2026): la lettura torna sempre un
// esito con `errore`; lo schermo distingue caricamento, nessuna richiesta ed
// errore (mai una lista vuota al posto di un errore). La logica pura sta in
// lib/richiesteDalSito.ts (testata con un finto). Lo stato è UNO per tutta
// l'app: «Riprova» nella home aggiorna anche il bollino della barra.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { caricaRichiesteWeb, statoDopoLettura, RICHIESTE_WEB_IN_CARICAMENTO, type EsitoRichiesteWeb, type StatoRichiesteWeb } from './richiesteDalSito'

export type { WebRequest, StatoRichiesteWeb } from './richiesteDalSito'

export function fetchWebRequests(): Promise<EsitoRichiesteWeb> {
  return caricaRichiesteWeb(cols => supabase
    .from('bookings')
    .select(cols)
    .eq('status', 'in_attesa')
    .eq('source', 'sito_web')
    .order('check_in', { ascending: true }))
}

let statoCondiviso: StatoRichiesteWeb = RICHIESTE_WEB_IN_CARICAMENTO
const ascoltatori = new Set<() => void>()

function iscrivi(fn: () => void): () => void {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function pubblica(s: StatoRichiesteWeb) {
  statoCondiviso = s
  for (const fn of ascoltatori) fn()
}

// Rilegge le richieste e aggiorna tutti i componenti in ascolto. Con
// `daCapo` mostra prima «caricamento» (tasto «Riprova»); altrimenti lo stato
// attuale resta finché non arriva la risposta (aggiornamenti in sottofondo).
export async function ricaricaRichiesteWeb(daCapo = false): Promise<void> {
  if (daCapo) pubblica(RICHIESTE_WEB_IN_CARICAMENTO)
  const esito = await fetchWebRequests()
  pubblica(statoDopoLettura(statoCondiviso, esito))
}

// Stato delle richieste dal sito con aggiornamento quando la pagina torna in
// primo piano e a ogni navigazione (refreshKey): sul telefono il gestionale
// resta aperto per giorni, il numero non deve invecchiare.
export function useRichiesteWeb(refreshKey?: string): StatoRichiesteWeb & { ricarica: () => void } {
  const stato = useSyncExternalStore(iscrivi, () => statoCondiviso, () => RICHIESTE_WEB_IN_CARICAMENTO)
  useEffect(() => {
    const load = () => { void ricaricaRichiesteWeb() }
    load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', load)
    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', load)
    }
  }, [refreshKey])
  const ricarica = useCallback(() => { void ricaricaRichiesteWeb(true) }, [])
  return { ...stato, ricarica }
}
