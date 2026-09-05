// Memoria del browser (sessionStorage / localStorage) con esito esplicito —
// errori di salvataggio visibili, parte 3 (05/09/2026). Non è Supabase: una
// memoria negata (navigazione privata, spazio esaurito, iframe) è normale e
// non va mostrata a Ania; ma il ripiego deve essere dichiarato dal
// chiamante, non nascosto in un catch vuoto. Le funzioni non lanciano mai.
export type Memoria = { getItem(chiave: string): string | null; setItem(chiave: string, valore: string): void }

// Torna il valore, oppure null se la memoria è assente/negata O la chiave manca.
export function leggiMemoria(memoria: () => Memoria, chiave: string): string | null {
  try {
    return memoria().getItem(chiave)
  } catch {
    return null
  }
}

// Torna true se scritto, false se la memoria è assente/negata.
export function scriviMemoria(memoria: () => Memoria, chiave: string, valore: string): boolean {
  try {
    memoria().setItem(chiave, valore)
    return true
  } catch {
    return false
  }
}
