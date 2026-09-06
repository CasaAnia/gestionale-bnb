// Recupero biancheria (06/09/2026, richiesta di Ania): quando una camera
// viene segnata pulita si può annotare, SOLO se serve, quali pezzi l'ospite
// NON ha usato e sono tornati puliti. Si segna solo il non usato, mai il set
// completo. Tabella biancheria_recuperata (migrazione 0039), una riga per
// pulizia (cleaning_id). Qui solo regole pure: limiti, tocco dei chip,
// riassunto con i plurali, somme per le Statistiche.

export type VoceBiancheria = 'federe' | 'lenzuolo_sotto' | 'lenzuolo_sopra' | 'telo_doccia' | 'asciugamano_viso' | 'asciugamano_mani' | 'tappetino_doccia' | 'tappeto_bagno'
export type Gruppo = 'lenzuola' | 'asciugamani'
export type Contatori = Record<VoceBiancheria, number>

export type Recupero = Contatori & {
  id?: string
  cleaning_id: string
  room_id: string
  booking_id: string | null
  data: string            // giorno della pulizia (AAAA-MM-GG)
  created_at?: string
}

// Ordine di comparsa nella scheda e nei riassunti
export const VOCI: { chiave: VoceBiancheria; gruppo: Gruppo; chip: string; singolare: string; plurale: string; max: number }[] = [
  { chiave: 'federe', gruppo: 'lenzuola', chip: 'Federa', singolare: 'federa', plurale: 'federe', max: 4 },
  { chiave: 'lenzuolo_sotto', gruppo: 'lenzuola', chip: 'Sotto', singolare: 'lenzuolo sotto', plurale: 'lenzuola sotto', max: 1 },
  { chiave: 'lenzuolo_sopra', gruppo: 'lenzuola', chip: 'Sopra', singolare: 'lenzuolo sopra', plurale: 'lenzuola sopra', max: 1 },
  { chiave: 'telo_doccia', gruppo: 'asciugamani', chip: 'Telo doccia', singolare: 'telo doccia', plurale: 'teli doccia', max: 2 },
  { chiave: 'asciugamano_viso', gruppo: 'asciugamani', chip: 'Viso', singolare: 'asciugamano viso', plurale: 'asciugamani viso', max: 2 },
  { chiave: 'asciugamano_mani', gruppo: 'asciugamani', chip: 'Mani', singolare: 'asciugamano mani', plurale: 'asciugamani mani', max: 2 },
  { chiave: 'tappetino_doccia', gruppo: 'asciugamani', chip: 'Tappetino doccia', singolare: 'tappetino doccia', plurale: 'tappetini doccia', max: 1 },
  { chiave: 'tappeto_bagno', gruppo: 'asciugamani', chip: 'Tappeto bagno', singolare: 'tappeto bagno', plurale: 'tappeti bagno', max: 1 },
]
export const ETICHETTA_GRUPPO: Record<Gruppo, string> = { lenzuola: 'Lenzuola', asciugamani: 'Asciugamani' }
export const CHIAVI: VoceBiancheria[] = VOCI.map(v => v.chiave)
export const LIMITE: Record<VoceBiancheria, number> = Object.fromEntries(VOCI.map(v => [v.chiave, v.max])) as Record<VoceBiancheria, number>

export const TITOLO_SCHEDA = 'non usato e recuperato'
export const SOTTOTITOLO_SCHEDA = 'Tocca una volta per ogni pezzo, ritocca per togliere'
export const NIENTE_RECUPERATO = 'Niente recuperato'

export function vuoto(): Contatori {
  return Object.fromEntries(CHIAVI.map(c => [c, 0])) as Contatori
}

// Un tocco sul chip: +1 fino al massimo, poi torna a 0 (così si toglie)
export function tocca(valori: Contatori, chiave: VoceBiancheria): Contatori {
  const n = (valori[chiave] ?? 0) + 1
  return { ...valori, [chiave]: n > LIMITE[chiave] ? 0 : n }
}

// Riporta nei limiti un valore letto da fuori (mai sopra il massimo, mai negativo)
export function normalizza(valori: Partial<Record<VoceBiancheria, unknown>> | null | undefined): Contatori {
  const out = vuoto()
  for (const c of CHIAVI) {
    const n = Math.floor(Number(valori?.[c] ?? 0))
    out[c] = Number.isFinite(n) ? Math.min(Math.max(n, 0), LIMITE[c]) : 0
  }
  return out
}

export function totale(valori: Contatori): number {
  return CHIAVI.reduce((s, c) => s + (valori[c] ?? 0), 0)
}

// «Niente recuperato» / «1 pezzo recuperato» / «3 pezzi recuperati»
export function testoTotale(valori: Contatori): string {
  const n = totale(valori)
  return n === 0 ? NIENTE_RECUPERATO : n === 1 ? '1 pezzo recuperato' : `${n} pezzi recuperati`
}

// Solo le voci > 0: «2 federe, telo doccia» (l'1 non si scrive)
export function elencoVoci(valori: Contatori): string {
  return VOCI.filter(v => (valori[v.chiave] ?? 0) > 0).map(v => valori[v.chiave] === 1 ? v.singolare : `${valori[v.chiave]} ${v.plurale}`).join(', ')
}

// Riga sotto la pulizia: «Recuperato: 2 federe, telo doccia»; null se niente
export function riassunto(valori: Contatori): string | null {
  const e = elencoVoci(valori)
  return e ? `Recuperato: ${e}` : null
}

// Statistiche: totali per voce nel periodo (righe già filtrate per data)
export function sommaPerVoce(righe: Contatori[]): { chiave: VoceBiancheria; etichetta: string; n: number }[] {
  return VOCI.map(v => ({ chiave: v.chiave, etichetta: v.plurale, n: righe.reduce((s, r) => s + (r[v.chiave] ?? 0), 0) }))
}

export function nelPeriodo<T extends { data: string }>(righe: T[], da: string, a: string): T[] {
  return righe.filter(r => r.data >= da && r.data < a)
}

// Tabella non ancora creata (migrazione 0039 non applicata): PostgREST 205 / Postgres 42P01
export function tabellaBiancheriaAssente(e: unknown): boolean {
  const c = String((e as { code?: unknown })?.code ?? '')
  return c === 'PGRST205' || c === '42P01'
}
export const AVVISO_0039 = 'Recupero biancheria non disponibile: va applicata la migrazione 0039'
