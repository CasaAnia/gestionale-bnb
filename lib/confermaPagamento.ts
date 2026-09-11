// Testo della conferma dopo «Registra pagamento» (Ania, 11/09/2026: «mettimi
// un piccolo pop-up, sì è stato registrato»). Logica PURA, si prova in node:
// dice quanto è stato registrato, come, e se il soggiorno è saldato oppure
// quanto resta. Gli importi si scrivono all'italiana: 50 → «50 €»,
// 62,5 → «62,50 €».
export type MetodoScritto = 'contanti' | 'bonifico' | string

export const importoItaliano = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })

export function testoConfermaPagamento(importo: number, metodo: MetodoScritto, restaCent: number): string {
  const come = metodo === 'bonifico' ? 'con bonifico' : 'in contanti'
  const coda = restaCent > 0 ? `restano ${importoItaliano(restaCent / 100)} €` : 'soggiorno saldato'
  return `Registrati ${importoItaliano(importo)} € ${come} · ${coda}`
}
