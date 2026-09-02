import { EXTRA_BED_MAX } from './tariffe.ts'

export const COLORE_LETTO_PARZIALE = '#C58A67'
export const COLORE_LETTI_ESAURITI = '#1f2937'

export type StatoLettiAggiuntivi = 'liberi' | 'parziali' | 'esauriti'

export function statoLettiAggiuntivi(occupati: number): StatoLettiAggiuntivi {
  if (occupati <= 0) return 'liberi'
  if (occupati < EXTRA_BED_MAX) return 'parziali'
  return 'esauriti'
}

// Il colore dipende dal TOTALE occupato in quella notte, non dagli "altri"
// letti. Così una quadrupla in Lena (2 letti su 2) è subito nera.
export function coloreLettiAggiuntivi(occupati: number): string {
  return statoLettiAggiuntivi(occupati) === 'esauriti'
    ? COLORE_LETTI_ESAURITI
    : COLORE_LETTO_PARZIALE
}

export function coloreLettiPerGiorno(mappa: ReadonlyMap<string, number>, giorno: string): string {
  return coloreLettiAggiuntivi(mappa.get(giorno) ?? 0)
}
