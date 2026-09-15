import { EXTRA_BED_MAX, tariffaCamera, capienzaCamera } from './tariffe.ts'

export const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'

type PrenotazioneConLetto = {
  room_id?: string | null
  num_guests?: number | string | null
  extra_bed?: boolean | null
  extra_bed_dates?: string[] | null
}

// Quanti letti del pool comune occupa una prenotazione. Questa è la stessa
// regola usata quando si crea una prenotazione e quando il calendario colora
// la disponibilità: Lena con 4 ospiti esaurisce da sola entrambi i letti.
export function lettiPoolPrenotazione(booking: PrenotazioneConLetto): 0 | 1 | 2 {
  const usaLetto = !!booking.extra_bed || (booking.extra_bed_dates?.length ?? 0) > 0
  if (!usaLetto) return 0
  return booking.room_id === LENA_ID && Number(booking.num_guests) >= 4 ? 2 : 1
}

// ── Pool condiviso: quanti letti sono già presi in ogni notte ─────────────
// Casa Ania ha DUE letti di supporto in tutto (EXTRA_BED_MAX), condivisi fra le
// camere. Una prenotazione li occupa nelle notti di extra_bed_dates, oppure in
// tutte le sue notti se ha extra_bed senza date (stessa lettura del calendario
// principale). Contano solo le prenotazioni passate dal chiamante (confermate).
export type PrenotazioneLetti = PrenotazioneConLetto & { check_in: string; check_out: string }

export function nottiLettoExtra(b: PrenotazioneLetti): string[] {
  if (b.extra_bed_dates && b.extra_bed_dates.length > 0) return b.extra_bed_dates
  if (!b.extra_bed) return []
  const out: string[] = []
  let t = Date.parse(b.check_in + 'T00:00:00Z')
  const fine = Date.parse(b.check_out + 'T00:00:00Z')
  while (t < fine) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000 }
  return out
}

export function lettiOccupatiPerNotte(prenotazioni: PrenotazioneLetti[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of prenotazioni) {
    const contrib = lettiPoolPrenotazione(b)
    if (contrib === 0) continue
    for (const g of nottiLettoExtra(b)) m.set(g, (m.get(g) || 0) + contrib)
  }
  return m
}

// ── L'accordo del letto vale per TUTTA la prenotazione ─────────────────────
// Importo e criterio si scelgono una volta sola; quando il soggiorno è spezzato
// in più tratti (cambio camera, notte per notte) il costo NON si ripete per
// ogni tratto: si calcola sul soggiorno intero e si riparte fra i tratti in
// proporzione alle notti col letto (rilievo del 15/09/2026: «30 € in tutto»
// diventavano 60, e «ogni 4 notti» ricominciava da capo a ogni tratto).
export type AccordoLetto = { importo: number; criterio: 'notte' | 'ogni4' | 'totale' }

/** Quanto costa il letto in tutto il soggiorno, con quell'accordo */
export function costoLettoIntero(accordo: AccordoLetto | null | undefined, nottiColLetto: number): number {
  if (!accordo || !accordo.importo || nottiColLetto <= 0) return 0
  if (accordo.criterio === 'totale') return arrotonda(accordo.importo)
  if (accordo.criterio === 'ogni4') return arrotonda(accordo.importo * Math.ceil(nottiColLetto / 4))
  return arrotonda(accordo.importo * nottiColLetto)
}

/** La fetta che tocca a ogni tratto: le somme tornano sempre al totale intero */
export function lettoRipartito(
  accordo: AccordoLetto | null | undefined, nottiPerTratto: number[],
): number[] {
  const totaleNotti = nottiPerTratto.reduce((s, n) => s + n, 0)
  const intero = costoLettoIntero(accordo, totaleNotti)
  if (intero <= 0 || totaleNotti <= 0) return nottiPerTratto.map(() => 0)
  // «a notte» si divide da sé; gli altri due in proporzione, e l'ultimo tratto
  // che ha notti col letto prende il resto, così la somma torna al centesimo
  const centesimi = Math.round(intero * 100)
  const fette = nottiPerTratto.map(n => (n <= 0 ? 0 : Math.floor((centesimi * n) / totaleNotti)))
  const ultimo = nottiPerTratto.reduce((ultimo, n, i) => (n > 0 ? i : ultimo), -1)
  if (ultimo >= 0) fette[ultimo] += centesimi - fette.reduce((s, c) => s + c, 0)
  return fette.map(c => arrotonda(c / 100))
}

const arrotonda = (n: number) => Math.round(n * 100) / 100

export function lettiLiberi(occupati: ReadonlyMap<string, number>, notte: string): number {
  return Math.max(0, EXTRA_BED_MAX - (occupati.get(notte) ?? 0))
}

// La camera può ospitare N persone in TUTTE le notti indicate? Serve la
// capienza massima e, se la regola delle tariffe impegna letti del pool,
// abbastanza letti liberi in ogni notte (quelli non già presi da altre camere).
export function cameraOspita(
  camera: { name?: string | null; has_extra_bed?: boolean | null; base_price?: number | string | null; double_price?: number | string | null },
  persone: number,
  notti: string[],
  occupati: ReadonlyMap<string, number>,
): boolean {
  if (persone > capienzaCamera(camera)) return false
  const { lettiPool } = tariffaCamera(camera, persone)
  if (lettiPool === 0) return true
  return notti.every(n => lettiLiberi(occupati, n) >= lettiPool)
}
