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
