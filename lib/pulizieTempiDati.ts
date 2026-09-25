'use client'
// Timer e tempi fuori camera sul database (proposta 0059). Un solo stato
// condiviso da tutte le schede aperte nella pagina: il timer di una camera,
// quello fuori camera e l'avviso «timer in corso» leggono la stessa copia.
// Niente stato «salvato» solo in memoria: se la rete manca lo si dice.
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { osservaAggiornamentiPulizie } from './aggiornamentiPulizie'
import { raccogliPagine } from './statistiche/paginazione'
import { chiaveTimerFuori, type AttivitaFuori, type TimerSql } from './tempoPulizie'

export type FuoriCameraSql = { data: string; attivita: AttivitaFuori; minuti: number; versione: number; aggiornato_at?: string }
export type StatoTimer = { stato: 'caricamento' | 'pronto' | 'errore'; timer: TimerSql[]; scarto: number; nonSincronizzato: boolean; errore: string | null }
type Risposta = { adesso: string; timer: TimerSql[]; fuori: FuoriCameraSql | null }

export const AVVISO_0059 = 'Timer e tempi non ancora attivati: va applicata la migrazione 0059.'
const assente = (code?: string) => code === 'PGRST202' || code === '42883' || code === 'PGRST205' || code === '42P01'

let stato: StatoTimer = { stato: 'caricamento', timer: [], scarto: 0, nonSincronizzato: false, errore: null }
const ascoltatori = new Set<() => void>()
let revisione = 0
function pubblica(s: Partial<StatoTimer>) { stato = { ...stato, ...s }; for (const f of ascoltatori) f() }

async function chiama(richiesta: Record<string, unknown>): Promise<{ data: Risposta | null; error: { code?: string; message?: string; details?: string } | null; rete: boolean }> {
  const inviato = Date.now()
  try {
    const r = await supabase.rpc('gestisci_tempo_pulizie', { p_richiesta: richiesta })
    if (r.error) return { data: null, error: r.error, rete: false }
    const data = r.data as Risposta
    // scarto = orologio server − orologio telefono, a metà del viaggio
    const adesso = Date.parse(data.adesso)
    if (Number.isFinite(adesso)) pubblica({ scarto: adesso - (inviato + Date.now()) / 2 })
    return { data, error: null, rete: false }
  } catch { return { data: null, error: null, rete: true } }
}

// Una lettura lenta partita prima di un'azione non sovrascrive quella dopo.
export async function leggiTimer(): Promise<void> {
  const propria = ++revisione
  const r = await chiama({ azione: 'leggi' })
  if (propria !== revisione) return
  if (r.rete) return pubblica({ nonSincronizzato: true, stato: stato.stato === 'caricamento' ? 'errore' : stato.stato, errore: 'Timer non sincronizzati: controlla la connessione.' })
  if (r.error) return pubblica({ stato: 'errore', errore: assente(r.error.code) ? AVVISO_0059 : 'Non riesco a leggere i timer. Riprova.' })
  pubblica({ stato: 'pronto', timer: r.data!.timer, nonSincronizzato: false, errore: null })
}

export type EsitoTimer = { errore: string | null; altra?: string }
export async function azioneTimer(azione: 'avvia' | 'pausa' | 'azzera', chiave: string, versione?: number): Promise<EsitoTimer> {
  const propria = ++revisione
  const r = await chiama({ azione, chiave, versione: versione ?? null })
  if (r.rete) {
    // Esito incerto: si rilegge, non si ripete l'azione alla cieca.
    pubblica({ nonSincronizzato: true })
    void leggiTimer()
    return { errore: 'Risposta non ricevuta: rileggo il timer. Controlla lo stato prima di ripetere.' }
  }
  if (r.error) {
    void leggiTimer()
    if (r.error.code === 'P0047') return { errore: 'Un altro timer è in corso: mettilo in pausa prima di avviarne un altro.', altra: r.error.details }
    if (r.error.code === 'P0046') return { errore: 'Metti in pausa il timer prima di azzerarlo.' }
    if (r.error.code === 'P0045') return { errore: 'Il timer è cambiato su un altro dispositivo: ecco lo stato aggiornato.' }
    return { errore: assente(r.error.code) ? AVVISO_0059 : 'Timer non salvato. Riprova.' }
  }
  if (propria === revisione) pubblica({ stato: 'pronto', timer: r.data!.timer, nonSincronizzato: false, errore: null })
  else void leggiTimer()
  window.dispatchEvent(new Event('pulizie-tempi'))
  return { errore: null }
}

export type EsitoFuori = { errore: string | null; riga: FuoriCameraSql | null; verificato?: boolean; incerto?: boolean }
export async function salvaFuoriCamera(data: string, attivita: AttivitaFuori, minuti: number, versione: number | null, timerTrascorsi: number): Promise<EsitoFuori> {
  const r = await chiama({ azione: 'salva_fuori', data, attivita, minuti, versione, timer_trascorsi: timerTrascorsi })
  void leggiTimer()
  window.dispatchEvent(new Event('pulizie-salvataggi'))
  // Risposta persa, oppure «cambiato» perché il browser ha ripetuto da solo
  // una richiesta già eseguita: si decide solo dopo aver riletto riga e timer.
  if (r.rete || r.error?.code === 'P0045') return verificaFuori(data, attivita, minuti, versione, timerTrascorsi, r.rete)
  if (r.error) {
    if (r.error.code === 'P0046') return { errore: 'Ferma il timer prima di salvare il tempo.', riga: null }
    return { errore: assente(r.error.code) ? AVVISO_0059 : 'Non riesco a salvare i minuti. Controlla il valore (da 0 a 1440).', riga: null }
  }
  return { errore: null, riga: r.data!.fuori }
}

// Esito incerto: si dice «salvato» o «non salvato» solo se riga e timer lo
// dimostrano entrambi; altrimenti resta incerto e non si invita a risalvare.
async function verificaFuori(data: string, attivita: AttivitaFuori, minuti: number, versione: number | null, timerTrascorsi: number, rete: boolean): Promise<EsitoFuori> {
  const [letta] = await Promise.all([leggiFuoriCamera(data, data), leggiTimer()])
  const t = stato.timer.find(x => x.chiave === chiaveTimerFuori(data, attivita))
  if (letta.righe === null || stato.nonSincronizzato) return { errore: 'Esito da verificare: la rete non risponde. Non salvare di nuovo; quando torna la connessione ricarica la pagina e controlla il totale.', riga: null, incerto: true }
  const riga = letta.righe.find(x => x.attivita === attivita) ?? null
  const timerOra = t?.trascorsi ?? 0
  if (riga && riga.versione !== versione && riga.minuti === minuti && timerOra === 0) return { errore: null, riga, verificato: true }
  if (rete && (riga?.versione ?? null) === versione && timerOra === timerTrascorsi) return { errore: 'Non salvato (verificato): il totale e il timer sono come prima. Puoi salvare di nuovo.', riga }
  if (!rete) return { errore: 'Il tempo o il timer sono cambiati su un altro dispositivo: ho riletto i valori, controlla e salva.', riga }
  return { errore: 'Esito incerto: il totale o il timer sono cambiati nel frattempo. Non salvare di nuovo: controlla il totale qui sopra.', riga, incerto: true }
}

export async function leggiFuoriCamera(da: string, a: string): Promise<{ righe: FuoriCameraSql[] | null; errore: string | null }> {
  try {
    const r = await raccogliPagine<FuoriCameraSql>((o, n) => supabase.from('pulizie_fuori_camera').select('*').gte('data', da).lte('data', a).order('data').order('attivita').range(o, o + n - 1))
    if (r.error) return { righe: null, errore: assente((r.error as { code?: string }).code) ? AVVISO_0059 : 'Non riesco a leggere i tempi fuori camera.' }
    return { righe: r.data, errore: null }
  } catch { return { righe: null, errore: 'Non riesco a leggere i tempi fuori camera.' } }
}

// Aggiornamento automatico: al ritorno sulla pagina, dopo salvataggi in altre
// schede e ogni 20 secondi, così un avvio da un altro telefono si vede.
let fermaOsservazione: (() => void) | null = null
function iscrivi(f: () => void) {
  ascoltatori.add(f)
  if (ascoltatori.size === 1 && typeof window !== 'undefined') {
    void leggiTimer()
    const smetti = osservaAggiornamentiPulizie(window, () => { void leggiTimer() })
    const visibile = () => { if (document.visibilityState === 'visible') void leggiTimer() }
    document.addEventListener('visibilitychange', visibile)
    const giro = window.setInterval(() => { if (document.visibilityState === 'visible') void leggiTimer() }, 20000)
    fermaOsservazione = () => { smetti(); document.removeEventListener('visibilitychange', visibile); window.clearInterval(giro) }
  }
  return () => {
    ascoltatori.delete(f)
    if (ascoltatori.size === 0) { fermaOsservazione?.(); fermaOsservazione = null }
  }
}
const SERVER: StatoTimer = { stato: 'caricamento', timer: [], scarto: 0, nonSincronizzato: false, errore: null }
// Stato letto per ultimo, per chi deve fotografarlo dopo una rilettura.
export const statoTimerAttuale = () => stato
export function useTimerPulizie(): StatoTimer {
  return useSyncExternalStore(iscrivi, () => stato, () => SERVER)
}
