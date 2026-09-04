// Striscia dei mesi cliccabili sotto i calendari (Calendario, Arrivi, Richieste):
// da quello corrente in avanti, con l'anno segnato quando cambia. Funzione
// pura, la stessa per le tre pagine, così le strisce sono identiche.
export type MeseCliccabile = { iso: string; chiave: string; label: string; anno: number; nuovoAnno: boolean }

export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const due = (n: number) => String(n).padStart(2, '0')

// `oggi` in locale; `quanti` mesi a partire da quello corrente.
export function mesiCliccabili(oggi: Date, quanti = 12): MeseCliccabile[] {
  const out: MeseCliccabile[] = []
  for (let i = 0; i < quanti; i++) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() + i, 1)
    out.push({
      iso: `${d.getFullYear()}-${due(d.getMonth() + 1)}-01`,
      chiave: `${d.getFullYear()}-${due(d.getMonth() + 1)}`,
      label: MESI_BREVI[d.getMonth()],
      anno: d.getFullYear(),
      nuovoAnno: i > 0 && d.getMonth() === 0,
    })
  }
  return out
}
