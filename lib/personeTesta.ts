// ============================================================================
// LA RIGA «PERSONE E CAMERA» DELLA TESTA (12/09/2026, bozza approvata da Ania).
// Prima era una riga piccola di 13 px, «3 persone · qualsiasi camera». Adesso
// ha la stessa forma della riga delle date sopra: due colonne, valore grande e
// etichetta piccola sotto. Logica pura: qui si decide COSA scrivere, la
// pagina decide come.
//
//  · persone uguali tutte le notti → «3»
//  · persone che cambiano          → «3 → 1», «2 → 1 → 2» (solo i cambi)
//  · più di tre tratti diversi     → «da 1 a 3», che sta in riga
// ============================================================================

// Un pezzo del valore: i numeri si scrivono grandi, le parole di servizio
// («→», «da», «a») piccole e in grigio.
export type PezzoPersone = { testo: string; grande: boolean }

export const MAX_TRATTI = 3

// I valori diversi di fila: [3,1,1,1,1] → [3,1] · [2,1,2] → [2,1,2]
export function trattiPersone(persone: number[]): number[] {
  return persone.filter((p, i) => i === 0 || p !== persone[i - 1])
}

export function personeTesta(persone: number[]): PezzoPersone[] {
  if (persone.length === 0) return []
  const tratti = trattiPersone(persone)
  if (tratti.length === 1) return [{ testo: String(tratti[0]), grande: true }]
  if (tratti.length > MAX_TRATTI) {
    const min = Math.min(...persone), max = Math.max(...persone)
    return [
      { testo: 'da', grande: false },
      { testo: String(min), grande: true },
      { testo: 'a', grande: false },
      { testo: String(max), grande: true },
    ]
  }
  const out: PezzoPersone[] = []
  tratti.forEach((n, i) => {
    if (i > 0) out.push({ testo: '→', grande: false })
    out.push({ testo: String(n), grande: true })
  })
  return out
}

