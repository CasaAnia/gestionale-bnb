// ============================================================================
// «1.360 €»: euro tondi, col punto delle migliaia.
//
// Non si usa toLocaleString: in italiano non raggruppa i numeri di quattro
// cifre e scriverebbe «1360 €» (e il risultato cambia con l'ICU di Node).
// Serve al totale speso dal cliente, che si legge uguale nella testa della
// proposta, nella riga dell'elenco e nella parte CLIENTE.
// ============================================================================

export function euroTondi(cent: number): string {
  const euro = Math.round((Number.isFinite(cent) ? cent : 0) / 100)
  const segno = euro < 0 ? '-' : ''
  return `${segno}${String(Math.abs(euro)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`
}
