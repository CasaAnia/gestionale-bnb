// ============================================================================
// «QUELLA CAMERA È APPENA STATA PRESA» (15/09/2026)
//
// Il vincolo della proposta 0051 è l'unica cosa che può fermare due
// prenotazioni fatte nello stesso istante sulla stessa camera: il database è
// l'unico a vedere tutte le scritture. Quando scatta, PostgreSQL risponde col
// codice 23P01 (exclusion_violation): qui si traduce in una frase che si può
// leggere, invece del messaggio del database.
//
// Finché la 0051 non è applicata, questo codice non arriva mai e il
// gestionale si difende come può con la rilettura prima di scrivere: è una
// difesa più debole, e va detto.
// ============================================================================
export const CODICE_SOVRAPPOSIZIONE = '23P01'
export const CAMERA_APPENA_PRESA =
  'Quella camera è appena stata presa da un’altra prenotazione per quelle notti. Ricarica la pagina e scegli un’altra camera o altre date.'

// I letti in più sono due in tutta la casa: il controllo che li conta sta nel
// database (proposta 0054) perché due salvataggi insieme, su camere diverse,
// non violano nessun vincolo di camera. Quando scatta, il messaggio comincia
// per LETTI_FINITI (secondo controllo del 15/09/2026).
export const LETTI_APPENA_PRESI =
  'I letti in più di quella notte sono appena stati presi da un’altra prenotazione: in tutta la casa ce ne sono due. Ricarica la pagina e riprova senza il letto in più.'

export function eLettiFiniti(errore: unknown): boolean {
  const e = errore as { message?: string } | null
  return !!e && /LETTI_FINITI|letti aggiuntivi esauriti/i.test(e.message ?? '')
}

export function eSovrapposizione(errore: unknown): boolean {
  const e = errore as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === CODICE_SOVRAPPOSIZIONE) return true
  return /exclusion|bookings_camera_non_due_volte/i.test(e.message ?? '')
}

/** Il messaggio da mostrare, o null se l'errore è un altro */
export function messaggioSovrapposizione(errore: unknown): string | null {
  if (eSovrapposizione(errore)) return CAMERA_APPENA_PRESA
  if (eLettiFiniti(errore)) return LETTI_APPENA_PRESI
  return null
}
