// ============================================================================
// «CONTROLLA IL NOME» — l'avviso che compare quando il saluto non è sicuro
// (Ania, 21/09/2026).
//
// Tutti i messaggi cominciano con «Gentile [Nome],» (lib/guestName), ma il
// nome delle prenotazioni sta in un campo unico e non sempre si capisce:
// «Monda» può essere il nome o il cognome, «De Luca Anna» è scritto al
// contrario, e certe prenotazioni vecchie non hanno nessun nominativo.
// In quei casi il messaggio NON deve sembrare pronto: qui stanno le parole
// che Ania legge, in un posto solo, così la finestra della conferma e la
// parte «Messaggi» della scheda dicono la stessa cosa.
//
// Parole di tutti i giorni, un passo alla volta: niente nomi di campi o di
// file (Ania, 16/09/2026).
// ============================================================================
import type { Saluto } from './guestName.ts'

export type AvvisoSaluto = {
  /** la riga che legge Ania */
  testo: string
  /** true quando i tasti che mandano il messaggio si spengono */
  blocca: boolean
}

/** null quando il nome è sicuro e non c'è niente da dire. */
export function avvisoSaluto(saluto: Saluto): AvvisoSaluto | null {
  if (saluto.daCompletare) return {
    testo: 'Manca il nome della cliente: il messaggio non parte. Scrivi nome e cognome nella parte CLIENTE della scheda, poi torna qui.',
    blocca: true,
  }
  if (!saluto.sicuro) return {
    testo: `Controlla il nome: il messaggio comincia con «Gentile ${saluto.nome},». Se «${saluto.nome}» è il cognome, scrivi anche il nome nella parte CLIENTE della scheda.`,
    blocca: false,
  }
  return null
}
