// Testo della conferma dopo «Registra pagamento» (Ania, 11/09/2026: «mettimi
// un piccolo pop-up, sì è stato registrato»). Logica PURA, si prova in node.
// Due righe, come le ha dettate Ania: sopra quanto è stato registrato e come,
// sotto quanto resta da avere (o che il soggiorno è saldato). Gli importi si
// scrivono all'italiana: 50 → «50 €», 62,5 → «62,50 €».
export type MetodoScritto = 'contanti' | 'bonifico' | string
export type ConfermaPagamento = { prima: string; seconda: string }

export const importoItaliano = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })

export function confermaPagamento(importo: number, metodo: MetodoScritto, restaCent: number): ConfermaPagamento {
  return {
    prima: `Registrati ${importoItaliano(importo)} € ${metodo === 'bonifico' ? 'con bonifico' : 'in contanti'}`,
    seconda: restaCent > 0 ? `restano da avere ${importoItaliano(restaCent / 100)} €` : 'soggiorno saldato',
  }
}
