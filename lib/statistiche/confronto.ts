// ============================================================================
// KPI DEL PERIODO E CONFRONTO CON L'ANNO PRIMA (07/09/2026). I tre numeri
// sotto i quattro riquadri delle Statistiche — Occupazione, Tariffa media
// (ADR), Notti libere — vengono SOLO da indiciIntervallo: qui non c'è nessuna
// formula nuova, solo lo spostamento dell'intervallo di un anno e i testi del
// confronto («+4 punti», «−12 €», «era 31»). Nessun import di Supabase.
// ============================================================================
import { prenotazioneValida, type CameraStat, type FuoriServizio, type PrenotazioneStat } from './tipi.ts'
import { indiciIntervallo, type IndiciIntervallo, type Intervallo } from './intervallo.ts'

// Stesso intervallo [da, a) un anno prima. Il 29 febbraio scala al 28 (come
// fa il calendario), così un mese resta un mese.
export function spostaAnni(iso: string, delta: number): string {
  const [a, m, g] = iso.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a + delta, m, 0)).getUTCDate()
  return `${a + delta}-${String(m).padStart(2, '0')}-${String(Math.min(g, ultimo)).padStart(2, '0')}`
}
export const intervalloAnnoPrima = (i: Intervallo): Intervallo => ({ da: spostaAnni(i.da, -1), a: spostaAnni(i.a, -1) })

// Indici dell'anno prima: null se in quell'intervallo non c'è NESSUNA
// prenotazione confermata/completata (l'anno prima «non ha dati»: il
// confronto resta vuoto, mai un «+40 punti» contro il nulla).
export function indiciAnnoPrima(attuale: Intervallo, camere: CameraStat[], prenotazioniAnnoPrima: PrenotazioneStat[], fuoriServizio: FuoriServizio[] = []): IndiciIntervallo | null {
  const prima = intervalloAnnoPrima(attuale)
  const tocca = prenotazioniAnnoPrima.filter(b => prenotazioneValida(b) && b.check_in < prima.a && b.check_out > prima.da)
  if (tocca.length === 0) return null
  return indiciIntervallo(prima.da, prima.a, camere, tocca, fuoriServizio)
}

export type ConfrontoKpi = { occupazione: string | null; tariffaMedia: string | null; nottiLibere: string | null }

const segno = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '')

// Testi del confronto sotto ogni numero: vuoti (null) senza anno prima.
//  · occupazione in punti percentuali: «+4 punti», «−1 punto», «come l'anno prima»
//  · tariffa media in euro interi: «+12 €», «−12 €», «come l'anno prima»
//  · notti libere: sempre «era 31»
export function confrontoKpi(attuale: IndiciIntervallo, prima: IndiciIntervallo | null): ConfrontoKpi {
  if (!prima) return { occupazione: null, tariffaMedia: null, nottiLibere: null }
  const punti = attuale.percento - prima.percento
  const euro = Math.round(attuale.adrCent / 100) - Math.round(prima.adrCent / 100)
  return {
    occupazione: punti === 0 ? 'come l’anno prima' : `${segno(punti)} ${Math.abs(punti) === 1 ? 'punto' : 'punti'}`,
    tariffaMedia: euro === 0 ? 'come l’anno prima' : `${segno(euro)} €`,
    nottiLibere: `era ${prima.nottiLibere}`,
  }
}
