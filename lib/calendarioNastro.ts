// ============================================================================
// I CONTI DEL NASTRO condivisi da Calendario e Richieste (29/09/2026, Richieste
// «Maison»: «stessi componenti, riusati con le opzioni, mai copiati»).
//  · nottiPagate  — quante notti di ogni prenotazione sono coperte dagli
//    acconti, lungo tutta la catena del cambio camera (−1 = tutte);
//  · legamiCatene — le catene del cambio camera: chi esce verso un'altra
//    camera (taglio a destra), chi arriva da un'altra (taglio a sinistra),
//    «poi Lena» / «da Ambra».
// Erano scritti dentro la pagina del Calendario: le Richieste disegnano le
// stesse schede, e i conti devono essere gli stessi.
// ============================================================================
import { prezzoPrenotazione } from './prezzoNotti.ts'
import { identitaSoggiorno } from './statistiche/tipi.ts'
import { buildChangeGroups, type ChangeGroups } from './roomChanges.ts'

type Riga = { id: string; room_id: string; group_id?: string | null; prenotazione_id?: string | null; check_in: string; check_out: string; total_amount?: number | string | null; rooms?: unknown; [k: string]: unknown }
type Camera = { id: string; name: string }

/**
 * Notti coperte dagli acconti per prenotazione (−1 = tutte). Nei soggiorni con
 * cambio camera i soldi ricevuti "scorrono" lungo tutta la catena in ordine di
 * data, qualunque sia il segmento su cui l'acconto è stato registrato.
 * Un soggiorno è la prenotazione intera (regola fissa n. 9), non il group_id.
 */
export function nottiPagate<T extends Riga>(bookings: T[], acconti: Record<string, number>, camere: Camera[]): Record<string, number> {
  const map: Record<string, number> = {}
  const groups: Record<string, T[]> = {}
  bookings.forEach(b => { const k = identitaSoggiorno(b); (groups[k] = groups[k] || []).push(b) })
  Object.values(groups).forEach(segs => {
    let money = segs.reduce((s, b) => s + (acconti[b.id] || 0), 0)
    if (money <= 0) return
    const totale = segs.reduce((s, b) => s + Number(b.total_amount), 0)
    const ordinati = [...segs].sort((a, b) => a.check_in.localeCompare(b.check_in))
    if (money >= totale) { ordinati.forEach(b => { map[b.id] = -1 }); return }
    for (const b of ordinati) {
      // Tariffa di ogni notte (lib/prezzoNotti): con persone che cambiano da
      // una notte all'altra ogni notte ha il suo prezzo, non una media
      const tariffe = prezzoPrenotazione((camere.find(r => r.id === b.room_id) ?? b.rooms) as Parameters<typeof prezzoPrenotazione>[0], b as unknown as Parameters<typeof prezzoPrenotazione>[1]).notti.map(x => x.tariffa)
      const notti = tariffe.length
      if (notti === 0 || tariffe.some(t => t <= 0)) continue
      let coperte = 0
      while (coperte < notti && money >= tariffe[coperte]) { money -= tariffe[coperte]; coperte++ }
      if (coperte > 0) map[b.id] = coperte
      if (coperte < notti) break
    }
  })
  return map
}

export type LegamiCatene = {
  changeGroups: ChangeGroups
  outgoingIds: Set<string>
  incomingIds: Set<string>
  /** sul tratto che parte: «poi Lena» */
  poiCamera: Record<string, string>
  /** sul tratto che arriva: «da Ambra» */
  daCamera: Record<string, string>
}

export function legamiCatene<T extends Riga>(bookings: T[], camere: Camera[]): LegamiCatene {
  const changeGroups = buildChangeGroups(bookings)
  const outgoingIds = new Set<string>(), incomingIds = new Set<string>()
  const corta = (id: string) => (camere.find(r => r.id === bookings.find(b => b.id === id)?.room_id)?.name ?? '').split(' ').slice(-1)[0]
  const poiCamera: Record<string, string> = {}, daCamera: Record<string, string> = {}
  changeGroups.edges.forEach(e => {
    outgoingIds.add(e.fromId); incomingIds.add(e.toId)
    poiCamera[e.fromId] = corta(e.toId); daCamera[e.toId] = corta(e.fromId)
  })
  return { changeGroups, outgoingIds, incomingIds, poiCamera, daCamera }
}
