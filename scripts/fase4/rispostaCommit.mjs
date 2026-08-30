// ============================================================================
// VALUTAZIONE della risposta di commit (applicazione 0022) — logica PURA e
// testata. Il successo si dichiara SOLO davanti alla riga di conferma
// esplicita { esito: 'APPLICATA' }. Tutto il resto — array vuoto, JSON
// illeggibile, forme inattese — è INCERTO: non è un successo e NON si
// presume il rollback (si passa alla verifica dello stato in sola lettura).
// ============================================================================
export function valutaRispostaCommit(risposta) {
  if (!Array.isArray(risposta) || risposta.length === 0)
    return { stato: 'incerta', dettaglio: 'risposta vuota o non interpretabile' }
  const conferma = risposta.find(r =>
    r && typeof r === 'object' && !Array.isArray(r) && r.esito === 'APPLICATA')
  if (conferma) return { stato: 'applicata', dettaglio: JSON.stringify(conferma) }
  return { stato: 'incerta', dettaglio: 'nessuna riga di conferma APPLICATA: ' + JSON.stringify(risposta).slice(0, 150) }
}
