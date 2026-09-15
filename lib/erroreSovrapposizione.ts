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

export function eSovrapposizione(errore: unknown): boolean {
  const e = errore as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === CODICE_SOVRAPPOSIZIONE) return true
  return /exclusion|bookings_camera_non_due_volte/i.test(e.message ?? '')
}

/** Il messaggio da mostrare, o null se l'errore è un altro */
export function messaggioSovrapposizione(errore: unknown): string | null {
  return eSovrapposizione(errore) ? CAMERA_APPENA_PRESA : null
}
