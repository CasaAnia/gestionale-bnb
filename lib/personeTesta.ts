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
//
// Sotto, quando le persone cambiano, una casellina per notte: il giorno sopra
// e il numero sotto, col numero in mattone nelle notti in cui cambia.
// ============================================================================
import { GIORNI_BREVI, MESI_BREVI } from './dateItaliane.ts'

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

// ── La strisciolina delle notti ─────────────────────────────────────────────
export type CasellaNotte = {
  etichetta: string   // «gio 29» · «lun 10 → mer 12» quando le notti si uniscono
  persone: number
  cambia: boolean     // il numero è diverso dalla notte (o dal gruppo) di prima
}

export const MAX_CASELLE = 7

const giornoEtichetta = (iso: string): string => {
  const [a, m, g] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g))
  return `${GIORNI_BREVI[d.getUTCDay()]} ${g}`
}
// Col mese, quando le notti ne attraversano più d'uno: «gio 29 ott»
const conMese = (iso: string): string => `${giornoEtichetta(iso)} ${MESI_BREVI[Number(iso.slice(5, 7)) - 1]}`

// Una casellina per notte. Se le notti sono più di MAX_CASELLE, le notti
// vicine con lo stesso numero si uniscono in una casellina sola, così la
// strisciolina resta dentro i margini.
// Le notti arrivano già nel loro ordine: con un soggiorno spezzato
// (notti_richieste) sono solo quelle richieste.
export function caselleNotti(notti: string[], persone: number[], massimo = MAX_CASELLE): CasellaNotte[] {
  if (notti.length === 0 || persone.length !== notti.length) return []
  const piuMesi = new Set(notti.map(n => n.slice(0, 7))).size > 1
  const eti = piuMesi ? conMese : giornoEtichetta
  if (notti.length <= massimo) {
    return notti.map((n, i) => ({ etichetta: eti(n), persone: persone[i], cambia: i > 0 && persone[i] !== persone[i - 1] }))
  }
  const out: CasellaNotte[] = []
  let da = 0
  for (let i = 1; i <= notti.length; i++) {
    if (i === notti.length || persone[i] !== persone[da]) {
      const uno = i - 1 === da
      out.push({
        etichetta: uno ? eti(notti[da]) : `${eti(notti[da])} → ${eti(notti[i - 1])}`,
        persone: persone[da],
        cambia: out.length > 0,
      })
      da = i
    }
  }
  return out
}

// La strisciolina compare solo quando le persone cambiano da una notte all'altra
export const personeCambiano = (persone: number[]): boolean => trattiPersone(persone).length > 1
