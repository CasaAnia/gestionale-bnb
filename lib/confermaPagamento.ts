// Testo della conferma dopo «Registra pagamento» (Ania, 11/09/2026: «mettimi
// un piccolo pop-up, sì è stato registrato»). Logica PURA, si prova in node.
// Due righe, come le ha dettate Ania: sopra quanto è stato registrato e come,
// sotto quanto resta da avere (o che il soggiorno è saldato). Gli importi si
// scrivono all'italiana: 50 → «50 €», 62,5 → «62,50 €».
export type MetodoScritto = 'contanti' | 'bonifico' | string
export type ConfermaPagamento = { prima: string; seconda: string }
/** La seconda riga quando il conto è cambiato mentre si registrava (rilievo 2, 20/09/2026) */
export const CONFERMA_CONTO_CAMBIATO = 'il conto è cambiato nel frattempo: ricarica la scheda'

export const importoItaliano = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })

/** Con `ritrovato` (rilievo 3, 20/09/2026): il pagamento era già stato
 *  registrato con la risposta persa e «Verifica pagamento» lo ha ritrovato. */
export function confermaPagamento(importo: number, metodo: MetodoScritto, restaCent: number, ritrovato = false): ConfermaPagamento {
  return {
    prima: `${ritrovato ? 'Ritrovati e confermati' : 'Registrati'} ${importoItaliano(importo)} € ${metodo === 'bonifico' ? 'con bonifico' : 'in contanti'}`,
    seconda: restaCent > 0 ? `restano da avere ${importoItaliano(restaCent / 100)} €` : 'soggiorno saldato',
  }
}
