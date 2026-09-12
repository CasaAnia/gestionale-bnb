// ============================================================================
// LE DUE RIGHE DI PAROLE SOTTO IL CALENDARIO DELLE RICHIESTE
// (Ania, dal telefono, 12/09/2026).
//
// Al posto delle pastiglie colorate, due righe che si leggono:
//
//   • 3 da guardare · ferme da più di un giorno
//   Ordina per  arrivo  notti  persone
//
// Qui si decide COSA c'è scritto, la pagina decide come disegnarlo.
// ============================================================================
import type { OrdineRichieste } from './richieste.ts'

export const CODA_FERME = ' · ferme da più di un giorno'
export const CODA_TUTTE = ' · mostra tutte'

// La riga «N da guardare». Il conto va in grassetto scuro, la coda in grigio.
// Da accesa la coda diventa la via d'uscita: «mostra tutte».
// Senza richieste ferme non c'è niente da dire: la riga non compare (null).
export type RigaGuardare = { conto: string; coda: string }

export function rigaDaGuardare(quante: number, acceso = false): RigaGuardare | null {
  const n = Math.max(0, Math.trunc(quante))
  if (n === 0) return null
  return { conto: `${n} da guardare`, coda: acceso ? CODA_TUTTE : CODA_FERME }
}

// La riga come si legge tutta di seguito: serve alle prove e a chi non vede.
export const testoRigaGuardare = (r: RigaGuardare | null): string => (r ? `${r.conto}${r.coda}` : '')

// Le tre scelte di sempre, nelle parole e nell'ordine chiesti da Ania.
// «durata» si legge «notti»: è la stessa cosa detta come la dice la riga della
// richiesta («2 notti»).
export const ORDINI_RICHIESTE = [
  ['arrivo', 'arrivo'],
  ['durata', 'notti'],
  ['persone', 'persone'],
] as const satisfies readonly (readonly [OrdineRichieste, string])[]
