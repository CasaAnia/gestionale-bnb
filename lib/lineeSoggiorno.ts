// ============================================================================
// LE LINEE DI UN SOGGIORNO (17/09/2026): con più camere nella stessa
// prenotazione la striscia delle notti non è una sola.
//
// Due cose diverse che prima si confondevano:
// - il CAMBIO CAMERA durante il soggiorno: tratti in fila nello stesso gruppo
//   (group_id), una striscia sola con «⇄» fra le camere;
// - le CAMERE IN PARALLELO: gruppi diversi nelle stesse notti (la sorella in
//   Ambra mentre lei sta in Lena), una striscia PER OGNI gruppo, ognuna col
//   suo titolo che dice camera e notti.
//
// Ogni linea si modifica dalla sua striscia, col foglietto della notte di
// sempre; le altre linee entrano nel contesto come «altre prenotazioni», così
// la camera che occupa la sorella non compare fra le libere e i due letti di
// casa si contano una volta sola. Il piano di salvataggio (lib/strisciaNotti)
// si fa sui tratti della linea soltanto: le altre non si toccano.
//
// Funzioni pure: niente Supabase, niente orologio.
// ============================================================================
import { nottiDaSegmenti, type SegmentoNotti, type NotteStriscia, type ContestoNotti, type PianoNotti } from './strisciaNotti.ts'
import { periodoTratto, euroScheda } from './schedaPrenotazione.ts'
import { MESI_BREVI } from './dateItaliane.ts'

export type SegmentoLinea = SegmentoNotti & { group_id?: string | null; total_amount?: number | string | null }

export type LineaSoggiorno<T extends SegmentoLinea = SegmentoLinea> = {
  /** il gruppo (group_id) o, senza gruppo, l'id della riga sola */
  chiave: string
  segmenti: T[]
  notti: NotteStriscia[]
  /** «Lena → Ambra · 24 → 28 set»: si scrive sopra la striscia quando le linee sono più d'una */
  titolo: string
}

export const SPIEGAZIONE_PARALLELE = 'Più camere nelle stesse notti: ogni camera si cambia dalla sua striscia.'
export const CAMERE_NON_LETTE = 'Le camere non si leggono: ricarica la scheda per spostare le notti.'
export const CONTO_INVARIATO = (cent: number) => `Il conto resta ${euroScheda(cent)}`
export const CONTO_CAMBIA = (prima: number, dopo: number) => `Conto: ${euroScheda(prima)} → ${euroScheda(dopo)}`

const nomeDi = (s: SegmentoNotti) => (s.rooms?.name ?? '').trim() || 'camera'
const attivi = <T extends SegmentoLinea>(segmenti: T[]) =>
  segmenti.filter(s => s.status !== 'annullata').sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))

export const chiaveLinea = (s: { id: string; group_id?: string | null }) => s.group_id || s.id

/** «Lena · 24 → 26 set», «Lena → Ambra · 24 → 28 set» (le camere in fila, senza ripetizioni consecutive) */
export function titoloLinea(segmenti: SegmentoLinea[]): string {
  const vivi = attivi(segmenti)
  if (vivi.length === 0) return ''
  const camere: string[] = []
  for (const s of vivi) { const n = nomeDi(s); if (camere[camere.length - 1] !== n) camere.push(n) }
  const dal = vivi[0].check_in
  const al = vivi.reduce((m, s) => (s.check_out > m ? s.check_out : m), vivi[0].check_out)
  return `${camere.join(' → ')} · ${periodoConMese(dal, al)}`
}

// «3 → 7 nov» anche nello stesso mese: sopra una striscia il mese serve
const periodoConMese = (dal: string, al: string) =>
  (dal.slice(0, 7) === al.slice(0, 7) ? `${periodoTratto(dal, al)} ${MESI_BREVI[Number(al.slice(5, 7)) - 1]}` : periodoTratto(dal, al))

/** Le linee del soggiorno, dalla prima che arriva; i tratti annullati non contano. */
export function lineeDelSoggiorno<T extends SegmentoLinea>(segmenti: T[]): LineaSoggiorno<T>[] {
  const per = new Map<string, T[]>()
  for (const s of attivi(segmenti)) {
    const k = chiaveLinea(s)
    if (!per.has(k)) per.set(k, [])
    per.get(k)!.push(s)
  }
  return [...per.entries()]
    .map(([chiave, righe]) => ({ chiave, segmenti: righe, notti: nottiDaSegmenti(righe), titolo: titoloLinea(righe) }))
    .sort((a, z) => a.segmenti[0].check_in.localeCompare(z.segmenti[0].check_in) || a.chiave.localeCompare(z.chiave))
}

/** Il contesto di UNA linea: le altre linee del soggiorno contano come altre
 *  prenotazioni (camera occupata, letti di casa impegnati); gli ospiti sono
 *  quelli della linea. */
export function contestoLinea<T extends SegmentoLinea>(linea: LineaSoggiorno<T>, linee: LineaSoggiorno<T>[], contesto: ContestoNotti): ContestoNotti {
  const altreLinee = linee.filter(l => l.chiave !== linea.chiave).flatMap(l => l.segmenti)
  const comeAltre = altreLinee
    .map(s => ({ ...s, room_id: s.room_id ?? s.rooms?.id ?? null }))
    .filter(s => s.room_id)
    .map(s => ({
      id: s.id, room_id: s.room_id as string, check_in: s.check_in, check_out: s.check_out, status: s.status,
      num_guests: s.num_guests, extra_bed: s.extra_bed, extra_bed_dates: s.extra_bed_dates, rooms: s.rooms,
    }))
  return {
    ...contesto,
    altre: [...contesto.altre, ...(comeAltre as unknown as ContestoNotti['altre'])],
    ospiti: Math.max(1, ...linea.segmenti.map(s => Number(s.num_guests) || 1)),
  }
}

/** Il conto prima e dopo il piano: le altre linee restano come sono, della
 *  linea contano i tratti aggiornati, quelli nuovi, e quelli rimasti; gli
 *  annullati non sono più dovuti. */
export function contoDopoNotti<T extends SegmentoLinea>(piano: PianoNotti, linea: LineaSoggiorno<T>, tutti: T[]): { primaCent: number; dopoCent: number } | null {
  if (piano.errore) return null
  const cent = (v: unknown) => Math.round((Number(v) || 0) * 100)
  const vivi = attivi(tutti)
  const primaCent = vivi.reduce((s, r) => s + cent(r.total_amount), 0)
  const altre = vivi.filter(r => chiaveLinea(r) !== linea.chiave).reduce((s, r) => s + cent(r.total_amount), 0)
  const aggiornati = new Map(piano.aggiorna.map(a => [a.id, a.campi.total_amount]))
  const dellaLinea = linea.segmenti.reduce((s, r) => {
    if (piano.annulla.includes(r.id)) return s
    return s + cent(aggiornati.has(r.id) ? aggiornati.get(r.id) : r.total_amount)
  }, 0)
  const nuovi = piano.crea.reduce((s, c) => s + cent(c.total_amount), 0)
  return { primaCent, dopoCent: altre + dellaLinea + nuovi }
}

/** «Conto: 300 € → 380 €», oppure «Il conto resta 300 €» */
export function testoContoDopo(conto: { primaCent: number; dopoCent: number }): string {
  return conto.primaCent === conto.dopoCent ? CONTO_INVARIATO(conto.primaCent) : CONTO_CAMBIA(conto.primaCent, conto.dopoCent)
}
