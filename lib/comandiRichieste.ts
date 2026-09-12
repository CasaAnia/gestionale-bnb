// ============================================================================
// LA FASCIA DEI COMANDI SOTTO IL CALENDARIO DELLE RICHIESTE
// (Ania, dal telefono, 12/09/2026).
//
// Prima erano pastiglie colorate, poi due righe di parole. Adesso è UNA
// fascia sola, la stessa disegnata per la scheda prenotazione: filo d'ottone
// sopra e sotto, fondo crema, voci in maiuscolo distribuite sulla larghezza.
//
//   ARRIVO      DURATA      PERSONE      DA GUARDARE · 3
//
//  · le prime tre sono l'ordinamento di sempre: una sola accesa alla volta;
//  · «DA GUARDARE · N» è il filtro delle richieste ferme, col numero dentro.
//    Si accende e si spegne da sola, senza toccare l'ordine scelto. Se non ce
//    n'è nessuna, la voce non compare.
//
// Qui si decide COSA c'è scritto e cosa è acceso, la fascia decide come
// disegnarlo.
// ============================================================================
import type { OrdineRichieste } from './richieste.ts'

// Le tre scelte di sempre, nelle parole e nell'ordine chiesti da Ania.
// La parola di mezzo resta «durata», scelta da Ania il 12/09/2026: «notti»
// era stata provata per un'ora e non le è piaciuta.
export const ORDINI_RICHIESTE = [
  ['arrivo', 'arrivo'],
  ['durata', 'durata'],
  ['persone', 'persone'],
] as const satisfies readonly (readonly [OrdineRichieste, string])[]

export const VOCE_GUARDARE = 'da guardare'

// Una voce della fascia. `tipo` dice cosa fa toccarla: cambiare l'ordine
// oppure accendere e spegnere il filtro delle ferme.
export type VoceFascia =
  | { tipo: 'ordine'; chiave: OrdineRichieste; testo: string; accesa: boolean }
  | { tipo: 'guardare'; chiave: 'guardare'; testo: string; accesa: boolean }

export function vociFascia({ ordine, ferme, soloDaGuardare = false }: {
  ordine: OrdineRichieste
  ferme: number
  soloDaGuardare?: boolean
}): VoceFascia[] {
  const voci: VoceFascia[] = ORDINI_RICHIESTE.map(([chiave, testo]) => ({ tipo: 'ordine', chiave, testo, accesa: chiave === ordine }))
  const quante = Math.max(0, Math.trunc(ferme))
  // Il filtro delle ferme non toglie e non sposta l'ordine: sono due cose
  // diverse, e l'ordine scelto resta acceso anche col filtro acceso.
  if (quante > 0) voci.push({ tipo: 'guardare', chiave: 'guardare', testo: `${VOCE_GUARDARE} · ${quante}`, accesa: soloDaGuardare })
  return voci
}

// La fascia come si legge, tutta di seguito: serve alle prove.
export const testoFascia = (voci: VoceFascia[]): string => voci.map(v => v.testo).join(' · ')
