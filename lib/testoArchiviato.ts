// ============================================================================
// IL TESTO ARCHIVIATO DI UNA PROPOSTA GIÀ INVIATA (11/09/2026).
//
// Il problema trovato da Ania: sulla richiesta di prova (Anna Sawicka, 29–31
// ottobre, tre persone) il messaggio non mostrava né grassetto né asterischi.
// La proposta era già stata inviata PRIMA del rilascio del grassetto, e la
// pagina mostra — giustamente — il testo archiviato, cioè quello che il
// cliente ha davvero ricevuto.
//
// Cosa si può aggiornare senza raccontare bugie: solo un testo che, tolti i
// segni di WhatsApp, è IDENTICO a quello che il generatore scriverebbe oggi.
// In quel caso le parole sono le stesse e cambia soltanto il grassetto:
// aggiornarlo non cambia cosa ha letto il cliente. Se invece qualcosa è
// diverso — Ania l'ha riscritto a mano, oppure sono cambiati camere, prezzi o
// condizioni — il testo archiviato resta intoccato.
//
// Nel database non si scrive nulla: si aggiorna solo quello che si legge a
// schermo. L'archivio cambia soltanto con un nuovo «Sì, inviata».
// ============================================================================

// I segni che WhatsApp usa per grassetto e corsivo
const senzaSegni = (t: string) => t.replace(/[*_]/g, '')

export function testoDaRigenerare(archiviato: string | null | undefined, rigenerato: string | null | undefined): boolean {
  if (!archiviato || !rigenerato) return false
  if (archiviato === rigenerato) return false
  return senzaSegni(archiviato) === senzaSegni(rigenerato)
}
