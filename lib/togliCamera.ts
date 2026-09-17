// ============================================================================
// «TOGLI CAMERA» (17/09/2026): dalla riga sotto la striscia, quando la
// prenotazione ha più di una camera, si toglie UNA linea (una camera in
// parallelo, o un cambio camera intero). Le sue righe vengono ANNULLATE, non
// cancellate — la stessa scrittura di «Annulla la prenotazione» (status,
// cancelled_at, cancelled_reason) — così i pagamenti già registrati restano
// nel conto e la cronologia non perde niente. Con una camera sola non si
// toglie: si annulla la prenotazione.
// Funzioni pure: la scrittura la fa il foglio con lib/righeDati (una
// richiesta sola per tutte le righe della linea).
// ============================================================================
export const TITOLO_TOGLI_CAMERA = 'Togli camera'
export const COMANDO_TOGLI_CAMERA = 'Togli camera'
export const TOGLI_LA_CAMERA = 'Togli la camera'
export const MOTIVO_TOGLI_CAMERA = 'Camera tolta dalla scheda'
export const CAMERA_TOLTA = 'Camera tolta.'
export const NOTA_PAGAMENTI = 'Le sue notti vengono annullate; i pagamenti già registrati restano nel conto.'

/** Si può togliere una camera solo se ne resta almeno un'altra */
export function siPuoTogliere(quanteLinee: number): boolean {
  return quanteLinee > 1
}

/** «Togliere Allegra · 29 → 30 nov?» */
export function domandaTogliCamera(titoloLinea: string): string {
  return `Togliere ${titoloLinea}?`
}

/** I campi da scrivere su ogni riga della linea: annullata, come «Annulla la prenotazione» */
export function campiTogliCamera(adesso: string): { status: 'annullata'; cancelled_at: string; cancelled_reason: string } {
  return { status: 'annullata', cancelled_at: adesso, cancelled_reason: MOTIVO_TOGLI_CAMERA }
}

/** Dove va la scheda se la riga aperta era fra quelle tolte: la prima delle altre linee */
export function schedaDopo(idAperto: string, tolti: string[], altre: { id: string; check_in: string }[]): string | null {
  if (!tolti.includes(idAperto)) return null
  const rimaste = [...altre].sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))
  return rimaste[0]?.id ?? null
}
