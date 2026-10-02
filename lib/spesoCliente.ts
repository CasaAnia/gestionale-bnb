// ============================================================================
// QUANTO HA SPESO IL CLIENTE (Ania, 02/10/2026): il totale di tutti i suoi
// soggiorni, questa prenotazione compresa. È la cifra della riga «Cliente …
// · 1.020 € con questa» del foglietto della prenotazione; dal 02/10/2026 sta
// anche sulla riga del nome delle schede del Calendario, senza parole davanti.
//
//   prima   = i soggiorni CONCLUSI della stessa persona fuori da questa
//             prenotazione (elencoSoggiorniPersona, come la scheda);
//   questa  = il totale del conto di questa prenotazione (contoPrenotazione,
//             tutte le sue righe, anche un mancato arrivo); se il conto non si
//             può fare (un importo mancante) la cifra non c'è.
// Funzioni pure, provate con node --test.
// ============================================================================
import { elencoSoggiorniPersona, type SoggiornoStorico } from './clienteCheTorna.ts'
import { chiavePrenotazione, contoPrenotazione, type RigaPrenotazione } from './prenotazioneUnica.ts'
import { euroScheda } from './schedaPrenotazione.ts'
import { euroTondi } from './euroTondi.ts'

type Riga = RigaPrenotazione & {
  guest_id?: string | null; guest_name?: string | null; room_id?: string | null
  guests?: { phone?: string | null; full_name?: string | null } | null
}

/** I soggiorni conclusi del cliente fuori da questa prenotazione, in centesimi (il foglietto) */
export function spesoPrimaCent(prenotazione: Riga, tutte: Riga[], camere: { id: string; name: string }[], oggi: string): number {
  const chiave = chiavePrenotazione(prenotazione)
  const altre = prenotazione.guest_id
    ? tutte.filter(b => b.guest_id === prenotazione.guest_id && chiavePrenotazione(b) !== chiave).map(b => ({ ...b, rooms: camere.find(c => c.id === b.room_id) ?? null }))
    : []
  const guest = prenotazione.guests ?? null
  const persona = { guest_id: prenotazione.guest_id ?? null, telefono: guest?.phone ?? null, full_name: prenotazione.guest_name || guest?.full_name || null }
  return elencoSoggiorniPersona(persona, altre as unknown as SoggiornoStorico[], oggi, chiave).reduce((t, s) => t + s.totaleCent, 0)
}

/** Tutto, questa compresa: `righeQuesta` sono tutte le righe di questa prenotazione. null se il conto non si fa. */
export function spesoConQuestaCent(prenotazione: Riga, righeQuesta: Riga[], tutte: Riga[], camere: { id: string; name: string }[], oggi: string): number | null {
  let questa: number
  try { questa = contoPrenotazione(righeQuesta, []).totaleCent } catch { return null }
  return spesoPrimaCent(prenotazione, tutte, camere, oggi) + questa
}

/** Le forme della cifra, dalla più lunga: «1.380,50 €» → «1.381 €» → «1.381». Se nessuna ci sta, niente. */
export function formeCifra(cent: number): string[] {
  const tonda = euroTondi(Math.round(cent / 100) * 100)
  return [...new Set([euroScheda(cent), tonda, tonda.replace(/\s*€$/, '')])]
}
