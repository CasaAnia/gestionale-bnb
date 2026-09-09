// Ora scritta a mano (Ania, 09/09/2026: «la ruota che gira è scocciante,
// preferisco scrivere 0-3-0-0»): si digitano solo le cifre e i due punti li
// mette la pagina. Ore oltre 23 e minuti oltre 59 rientrano da soli.
export function oraDigitata(testo: string): string {
  const cifre = testo.replace(/\D/g, '').slice(0, 4)
  if (cifre.length <= 2) return cifre
  const ore = String(Math.min(23, Number(cifre.slice(0, 2)))).padStart(2, '0')
  const minuti = cifre.slice(2)
  return cifre.length === 3 ? `${ore}:${minuti}` : `${ore}:${String(Math.min(59, Number(minuti))).padStart(2, '0')}`
}

export const oraCompleta = (t: string) => /^\d{2}:\d{2}$/.test(t)
