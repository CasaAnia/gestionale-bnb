// ============================================================================
// LA TESTA DELLA PAGINA DELLE RICHIESTE (Ania, dal telefono, 12/09/2026).
//
// In cima alla pagina c'è una riga sola, che dice come sta la pagina:
//
//   4 aperte · 2 nuove dal sito
//
// Il titolo («Richieste di prenotazione» prima, poi «Richieste» in Georgia)
// non c'è più: lo dice già la barra in alto, e a schermo valeva una riga persa.
//
// Qui si decide COSA c'è scritto, la pagina decide come disegnarlo.
// Le «nuove dal sito» si nominano solo quando ce n'è almeno una: una riga che
// dice «0 nuove dal sito» fa rumore per niente.
// ============================================================================

export function sottotitoloRichieste({ aperte, nuoveDalSito = 0 }: { aperte: number; nuoveDalSito?: number }): string {
  const quante = Math.max(0, Math.trunc(aperte))
  const nuove = Math.max(0, Math.trunc(nuoveDalSito))
  const pezzi = [quante === 0 ? 'nessuna aperta' : `${quante} ${quante === 1 ? 'aperta' : 'aperte'}`]
  if (nuove > 0) pezzi.push(`${nuove} ${nuove === 1 ? 'nuova' : 'nuove'} dal sito`)
  return pezzi.join(' · ')
}
