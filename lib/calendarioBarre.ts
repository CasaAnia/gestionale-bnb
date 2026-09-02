// Colori e segmenti delle barre del calendario principale
// (app/calendario/page.tsx), riscritti come funzioni pure per il calendario
// delle Richieste. Il calendario principale NON è stato toccato: le regole
// sono le sue (pagato → verde, acconti che coprono notti → verde da sinistra,
// bonifico → viola, letto extra → terracotta / nero a pool esaurito,
// altrimenti blu). Se una regola cambia là, va cambiata anche qui.
import { lettiPoolPrenotazione } from './lettiAggiuntivi.ts'
import { coloreLettiPerGiorno } from './calendarioLetti.ts'
import { giorniTra } from './richiesteCalendario.ts'

export const COLORE_PRENOTAZIONE = '#7D9DB0' // blu — paga all'arrivo
export const COLORE_BONIFICO = '#9B8EC4'     // viola — bonifico in attesa
export const COLORE_PAGATO = '#6C9A7C'       // verde — già pagato
export const COLORE_OGGI = '#F3ECD8'
export const COLORE_DOMENICA = '#F7F3E8'
export const COLORE_GRIGLIA = '#ECE8DD'
export const COLORE_SEPARATORE = '#D6CFBD'
export const COLORE_RICHIESTA_TESTO = '#7a5f2c'

export type PrenotazioneBarra = {
  id: string
  room_id: string
  guest_id?: string | null
  group_id?: string | null
  check_in: string
  check_out: string
  status: string
  price_per_night?: number | string | null
  total_amount?: number | string | null
  num_guests?: number | string | null
  extra_bed?: boolean | null
  extra_bed_dates?: string[] | null
  pagato?: boolean | null
  bonifico?: boolean | null
  color?: string | null
  guest_name?: string | null
  source?: string | null
  guests?: { id?: string; full_name?: string | null; phone?: string | null; rating?: string | null } | null
}

export type ContestoColori = {
  nottiPagate: Record<string, number>   // -1 = tutte
  lettiExtra: Map<string, number>       // letti del pool occupati per giorno
}

const notti = (b: { check_in: string; check_out: string }) =>
  Math.round((Date.parse(b.check_out + 'T00:00:00Z') - Date.parse(b.check_in + 'T00:00:00Z')) / 86400000)

// Notti coperte dagli acconti per prenotazione (-1 = tutte). Nei soggiorni con
// cambio camera i soldi "scorrono" lungo tutta la catena in ordine di data.
export function nottiPagate(bookings: PrenotazioneBarra[], acconti: Record<string, number>): Record<string, number> {
  const map: Record<string, number> = {}
  const groups: Record<string, PrenotazioneBarra[]> = {}
  bookings.forEach(b => { const k = b.group_id || b.id; (groups[k] = groups[k] || []).push(b) })
  Object.values(groups).forEach(segs => {
    let money = segs.reduce((s, b) => s + (acconti[b.id] || 0), 0)
    if (money <= 0) return
    const totale = segs.reduce((s, b) => s + Number(b.total_amount || 0), 0)
    const ordinati = [...segs].sort((a, b) => a.check_in.localeCompare(b.check_in))
    if (money >= totale) { ordinati.forEach(b => { map[b.id] = -1 }); return }
    for (const b of ordinati) {
      const prezzo = Number(b.price_per_night || 0)
      const n = notti(b)
      if (prezzo <= 0) continue
      const coperte = Math.min(n, Math.floor(money / prezzo))
      if (coperte > 0) map[b.id] = coperte
      money -= coperte * prezzo
      if (coperte < n) break
    }
  })
  return map
}

export function giorniLettoExtra(b: PrenotazioneBarra): Set<string> {
  if (b.extra_bed_dates && b.extra_bed_dates.length > 0) return new Set(b.extra_bed_dates)
  if (b.extra_bed) return new Set(giorniTra(b.check_in, b.check_out))
  return new Set()
}

export function mappaLettiExtra(bookings: PrenotazioneBarra[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of bookings) {
    const contrib = lettiPoolPrenotazione(b)
    for (const g of giorniLettoExtra(b)) m.set(g, (m.get(g) || 0) + contrib)
  }
  return m
}

export function contestoColori(bookings: PrenotazioneBarra[], acconti: Record<string, number>): ContestoColori {
  return { nottiPagate: nottiPagate(bookings, acconti), lettiExtra: mappaLettiExtra(bookings) }
}

const strisce = (letto: string, base: string) =>
  `repeating-linear-gradient(45deg, ${letto} 0px, ${letto} 8px, ${base} 8px, ${base} 16px)`

export function coloreGiorno(b: PrenotazioneBarra, giorno: string, ctx: ContestoColori): string {
  const hasExtra = giorniLettoExtra(b).has(giorno)
  const bedColor = coloreLettiPerGiorno(ctx.lettiExtra, giorno)
  if (b.pagato) return hasExtra ? strisce(bedColor, COLORE_PAGATO) : COLORE_PAGATO
  const coperte = ctx.nottiPagate[b.id]
  if (coperte !== undefined) {
    const i = Math.round((Date.parse(giorno + 'T00:00:00Z') - Date.parse(b.check_in + 'T00:00:00Z')) / 86400000)
    if (coperte === -1 || i < coperte) return hasExtra ? strisce(bedColor, COLORE_PAGATO) : COLORE_PAGATO
  }
  if (b.bonifico) return hasExtra ? strisce(bedColor, COLORE_BONIFICO) : COLORE_BONIFICO
  if (hasExtra) return bedColor
  return b.color || COLORE_PRENOTAZIONE
}

export type Segmento = { start: number; end: number; color: string }

// Segmenti di colore della barra, come indici (inizio compreso, fine esclusa)
// dentro `giorni` (i giorni disegnati, consecutivi). Vuoto se la prenotazione
// non tocca l'intervallo.
export function segmentiBarra(b: PrenotazioneBarra, giorni: string[], ctx: ContestoColori): Segmento[] {
  if (giorni.length === 0) return []
  const idx = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(giorni[0] + 'T00:00:00Z')) / 86400000)
  const start = Math.max(0, idx(b.check_in))
  const end = Math.min(giorni.length, idx(b.check_out))
  if (end - start <= 0) return []
  const out: Segmento[] = []
  let cur = '', s = start
  for (let i = start; i < end; i++) {
    const c = coloreGiorno(b, giorni[i], ctx)
    if (c !== cur) { if (cur) out.push({ start: s, end: i, color: cur }); cur = c; s = i }
  }
  if (cur) out.push({ start: s, end, color: cur })
  return out
}

// Indici (inizio compreso, fine esclusa) di un intervallo dentro `giorni`;
// null se non lo tocca.
export function indiciIntervallo(arrivo: string, partenza: string, giorni: string[]): { start: number; end: number } | null {
  if (giorni.length === 0) return null
  const idx = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(giorni[0] + 'T00:00:00Z')) / 86400000)
  const start = Math.max(0, idx(arrivo))
  const end = Math.min(giorni.length, idx(partenza))
  return end - start > 0 ? { start, end } : null
}
