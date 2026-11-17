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
//
// REGOLA DI ANIA, 17/11/2026: «speso» è quello che il cliente ha già pagato,
// più questa prenotazione. Le prenotazioni in corso e future dello stesso
// cliente NON si contano nella cifra delle altre: sul futuro la cifra è
// concluso + futuro, sull'in corso è concluso + in corso. Non cambiare senza
// una sua richiesta (REGOLE-FISSE.md n. 12; test in lib/spesoCliente.test.ts).
// Anche la scheda cliente usa questa stessa funzione (soggiorniConclusiDelCliente),
// con le schede che hanno lo stesso telefono unite: le quattro cifre coincidono.
// Funzioni pure, provate con node --test.
// ============================================================================
import { elencoSoggiorniPersona, type SoggiornoStorico, type SoggiornoPersona } from './clienteCheTorna.ts'
import { normalizzaTelefono } from './whatsapp.ts'
import { chiavePrenotazione, contoPrenotazione, type RigaPrenotazione } from './prenotazioneUnica.ts'
import { euroScheda } from './schedaPrenotazione.ts'
import { euroTondi } from './euroTondi.ts'

type Riga = RigaPrenotazione & {
  guest_id?: string | null; guest_name?: string | null; room_id?: string | null
  guests?: { phone?: string | null; full_name?: string | null } | null
  rooms?: { name?: string | null } | null
}

// Lo STESSO cliente, per i soldi (17/11/2026): la stessa scheda, oppure lo
// stesso telefono (cifre: «+39 335 123 4567» = «3351234567»). Mai il solo nome:
// due «Antonio» con telefoni diversi sono due persone. Prima si filtrava per
// scheda: un cliente con due schede (stesso telefono) vedeva il totale diviso.
const cifreTel = (t: string | null | undefined) => normalizzaTelefono(t).numero
type Chi = { guest_id?: string | null; guests?: { phone?: string | null } | null }
export function stessoCliente(a: Chi, b: Chi): boolean {
  if (a.guest_id && b.guest_id && a.guest_id === b.guest_id) return true
  const ta = cifreTel(a.guests?.phone), tb = cifreTel(b.guests?.phone)
  return !!ta && ta === tb
}

/** Le altre schede con lo stesso telefono (cifre) della scheda `guestId`: serve a chi legge i soggiorni per scheda */
export function schedeStessoTelefono(guestId: string, telefono: string | null | undefined, guests: { id: string; phone?: string | null }[]): string[] {
  const t = cifreTel(telefono)
  if (!t) return []
  return guests.filter(g => g.id !== guestId && cifreTel(g.phone) === t).map(g => g.id)
}

/** I soggiorni CONCLUSI del cliente fuori da questa prenotazione: la fonte unica di numero e importo,
 *  per la cifra rossa, il foglietto, il riquadro e la testata della scheda. */
export function soggiorniDelCliente(prenotazione: Riga, tutte: Riga[], camere: { id: string; name: string }[], oggi: string): SoggiornoPersona[] {
  const chiave = chiavePrenotazione(prenotazione)
  const altre = (prenotazione.guest_id || prenotazione.guests?.phone)
    ? tutte.filter(b => stessoCliente(b, prenotazione) && chiavePrenotazione(b) !== chiave).map(b => ({ ...b, rooms: b.rooms ?? camere.find(c => c.id === b.room_id) ?? null }))
    : []
  const guest = prenotazione.guests ?? null
  const persona = { guest_id: prenotazione.guest_id ?? null, telefono: guest?.phone ?? null, full_name: prenotazione.guest_name || guest?.full_name || null }
  return elencoSoggiorniPersona(persona, altre as unknown as SoggiornoStorico[], oggi, chiave)
}

/** La scheda cliente (17/11/2026): tutti i soggiorni CONCLUSI del cliente, schede con lo stesso telefono
 *  comprese, con la STESSA funzione della cifra rossa (nessuna prenotazione esclusa). */
export function soggiorniConclusiDelCliente(cliente: { id: string; phone?: string | null; full_name?: string | null }, tutte: Riga[], camere: { id: string; name: string }[], oggi: string): { elenco: SoggiornoPersona[]; n: number; ricaviCent: number } {
  const rif = { id: '', guest_id: cliente.id, guest_name: cliente.full_name ?? null, guests: { phone: cliente.phone ?? null, full_name: cliente.full_name ?? null } } as Riga
  const elenco = soggiorniDelCliente(rif, tutte, camere, oggi)
  return { elenco, n: elenco.length, ricaviCent: elenco.reduce((t, s) => t + s.totaleCent, 0) }
}

/** I soggiorni conclusi del cliente fuori da questa prenotazione, in centesimi (il foglietto) */
export function spesoPrimaCent(prenotazione: Riga, tutte: Riga[], camere: { id: string; name: string }[], oggi: string): number {
  return soggiorniDelCliente(prenotazione, tutte, camere, oggi).reduce((t, s) => t + s.totaleCent, 0)
}

/** Tutto, questa compresa: `righeQuesta` sono tutte le righe di questa prenotazione. null se il conto non si fa. */
export function spesoConQuestaCent(prenotazione: Riga, righeQuesta: Riga[], tutte: Riga[], camere: { id: string; name: string }[], oggi: string): number | null {
  let questa: number
  try { questa = contoPrenotazione(righeQuesta, []).totaleCent } catch { return null }
  return spesoPrimaCent(prenotazione, tutte, camere, oggi) + questa
}

/** Le forme della cifra, dalla più lunga: «1.380 €» → «1.380». Se nessuna ci sta, niente.
 *  Con i centesimi («250,44 €») niente forma arrotondata: una cifra più corta non cambia mai il conto. */
export function formeCifra(cent: number): string[] {
  const piena = euroScheda(cent)
  const senzaEuro = piena.replace(/\s*€$/, '')
  if (Math.round(cent) % 100 !== 0) return [piena, senzaEuro]
  return [...new Set([piena, euroTondi(Math.round(cent / 100) * 100).replace(/\s*€$/, '')])]
}
