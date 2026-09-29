// ============================================================================
// LA NOTA DEGLI ARRIVI (29/09/2026): «arrivi dei prossimi 83 giorni», nella
// riga dei mesi. Dal Mac le pagine non hanno più sottotitoli: in cima c'è la
// sola scrittina col nome della pagina (components/TestaPagina `scrittaMac`,
// components/TestaMac).
// ============================================================================

export function sottotitoloArrivi(giorni: number): string {
  return `arrivi dei prossimi ${giorni} giorni`
}
