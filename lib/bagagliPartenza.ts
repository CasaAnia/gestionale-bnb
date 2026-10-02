// ============================================================================
// BAGAGLI E PARTENZA (Ania, 01/10/2026): DOVE SI SCRIVONO I DUE ORARI.
//
// Una prenotazione può avere più righe di `bookings`:
//   - tratti CONSECUTIVI (cambio camera: Lena fino al 3, Amelia dal 3);
//   - camere CONTEMPORANEE (Lena e Amelia nelle stesse notti);
//   - tratti ANNULLATI, che non contano mai.
// Regola: si raggruppano i tratti vivi in «catene» — una camera dopo l'altra
// senza buchi, nella stessa linea del soggiorno (lib/lineeSoggiorno: le
// camere contemporanee stanno in linee diverse). Ogni catena è UN arrivo e
// UNA partenza:
//   bagagli_alle   → sulla PRIMA riga della catena (il giorno dell'arrivo)
//   check_out_time → sull'ULTIMA riga della catena (il giorno della partenza)
// Così con due camere contemporanee che partono in giorni diversi ognuna ha
// la sua partenza, e con un cambio camera l'ora di partenza sta sulla camera
// che si lascia davvero l'ultimo giorno: nessun orario su una camera sbagliata.
// Le Pulizie leggono la stessa cosa dall'altra parte: la riga che parte
// (check_out) ha l'ora della partenza, la riga che arriva (check_in) ha i
// bagagli. Funzioni pure, provate con node --test.
// ============================================================================
import { lineeDelSoggiorno, type SegmentoLinea } from './lineeSoggiorno.ts'
import { oraBreve } from './schema0064.ts'
import { GIORNI_BREVI, MESI_BREVI } from './dateItaliane.ts'

export type RigaOrari = SegmentoLinea & { bagagli_alle?: unknown; check_out_time?: unknown; check_in_time?: unknown }

export type CatenaOrari<T extends RigaOrari = RigaOrari> = {
  chiave: string
  segmenti: T[]
  /** la riga che riceve bagagli_alle */
  rigaArrivo: T
  /** la riga che riceve check_out_time */
  rigaPartenza: T
  arrivo: string
  partenza: string
  /** le camere della catena in fila, senza ripetizioni consecutive */
  camere: string[]
  bagagli: string | null
  oraPartenza: string | null
  oraArrivo: string | null
}

const nome = (s: SegmentoLinea) => (s.rooms?.name ?? '').trim().split(' ').slice(-1)[0] || 'camera'

export function catenePrenotazione<T extends RigaOrari>(righe: T[]): CatenaOrari<T>[] {
  const out: CatenaOrari<T>[] = []
  for (const linea of lineeDelSoggiorno(righe)) {
    let corrente: T[] = []
    const chiudi = () => {
      if (!corrente.length) return
      const primo = corrente[0], ultimo = corrente[corrente.length - 1]
      const camere: string[] = []
      for (const s of corrente) { const n = nome(s); if (camere[camere.length - 1] !== n) camere.push(n) }
      out.push({
        chiave: `${linea.chiave}:${primo.id}`, segmenti: corrente, rigaArrivo: primo, rigaPartenza: ultimo,
        arrivo: primo.check_in, partenza: ultimo.check_out, camere,
        bagagli: oraBreve(primo.bagagli_alle), oraPartenza: oraBreve(ultimo.check_out_time), oraArrivo: oraBreve(primo.check_in_time),
      })
      corrente = []
    }
    for (const s of linea.segmenti as T[]) {
      if (corrente.length && corrente[corrente.length - 1].check_out !== s.check_in) chiudi()
      corrente.push(s)
    }
    chiudi()
  }
  return out.sort((a, z) => a.arrivo.localeCompare(z.arrivo) || a.chiave.localeCompare(z.chiave))
}

/** «dom 4 ott» */
export function giornoBreve(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${GIORNI_BREVI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MESI_BREVI[m - 1]}`
}

/** «13 → 16 ott», «30 set → 2 ott»: l'etichetta di una catena quando sono più d'una */
export function periodoCatena(arrivo: string, partenza: string): string {
  const [, m1, d1] = arrivo.split('-').map(Number), [, m2, d2] = partenza.split('-').map(Number)
  return m1 === m2 ? `${d1} → ${d2} ${MESI_BREVI[m2 - 1]}` : `${d1} ${MESI_BREVI[m1 - 1]} → ${d2} ${MESI_BREVI[m2 - 1]}`
}

/** A destra delle due righe della scheda */
export const testoBagagli = (c: Pick<CatenaOrari, 'bagagli'>) => (c.bagagli ? `alle ${c.bagagli}` : 'no')
export const testoPartenza = (c: Pick<CatenaOrari, 'partenza' | 'oraPartenza'>) => `${giornoBreve(c.partenza)} · ${c.oraPartenza ?? 'da chiedere'}`
/** Sotto il nome nel foglio: «arriva gio 1 ott alle 16:00 · parte dom 4 ott» */
export const sottotitoloFoglio = (c: Pick<CatenaOrari, 'arrivo' | 'oraArrivo' | 'partenza'>) =>
  `arriva ${giornoBreve(c.arrivo)}${c.oraArrivo ? ` alle ${c.oraArrivo}` : ''} · parte ${giornoBreve(c.partenza)}`

/** Le scritture da fare: solo le righe che cambiano davvero, mai una riga sbagliata. */
export type ScritturaOrario = { id: string; campi: { bagagli_alle?: string | null; check_out_time?: string | null } }
export function scrittureOrari(c: CatenaOrari, bagagli: string | null, partenza: string | null): ScritturaOrario[] {
  const perRiga = new Map<string, ScritturaOrario['campi']>()
  if (bagagli !== c.bagagli) perRiga.set(c.rigaArrivo.id, { ...perRiga.get(c.rigaArrivo.id), bagagli_alle: bagagli })
  if (partenza !== c.oraPartenza) perRiga.set(c.rigaPartenza.id, { ...perRiga.get(c.rigaPartenza.id), check_out_time: partenza })
  return [...perRiga].map(([id, campi]) => ({ id, campi }))
}
