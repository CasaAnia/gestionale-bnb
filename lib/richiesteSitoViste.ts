// Solo UUID nel browser di questo dispositivo. Nessuna scrittura su richieste.
export const CHIAVE_VISTE = 'ca_richieste_sito_viste_v1'
export const EVENTO_VISTE = 'ca-richieste-sito-viste'
export function idsViste(testo: string | null): string[] {
  try {
    const valori: unknown = JSON.parse(testo ?? '[]')
    return Array.isArray(valori) ? valori.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}
export function segnaRichiestaSitoVista(id: string) {
  try {
    const viste = idsViste(localStorage.getItem(CHIAVE_VISTE))
    localStorage.setItem(CHIAVE_VISTE, JSON.stringify([...new Set([...viste, id])]))
    window.dispatchEvent(new Event(EVENTO_VISTE))
  } catch {
    // Senza memoria disponibile l'avviso resta: nessuna richiesta sparisce.
  }
}
export function nuoveRichieste<T extends { id: string }>(richieste: T[], viste: string[]): T[] {
  const ids = new Set(viste)
  return richieste.filter(r => !ids.has(r.id))
}
