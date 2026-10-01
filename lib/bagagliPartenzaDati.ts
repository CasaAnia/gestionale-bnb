// ============================================================================
// SALVARE BAGAGLI E PARTENZA — stesso principio di lib/arrivoDati: non si dice
// mai una cosa che non si sa.
//   1. Ogni scrittura deve restituire la sua riga: zero righe = non salvato.
//   2. Errore del SERVER (un codice PostgreSQL o PGRST…) = certo, non scritto.
//      Errore senza codice (rete caduta, risposta persa) = INCERTO: si rilegge
//      e si dice «salvato» o «non salvato» solo se la rilettura lo dimostra;
//      se non si riesce a rileggere resta incerto, con i dati a schermo, e non
//      si invita a risalvare.
//   3. Alla fine si rilegge TUTTO quello che si è scritto e si confronta.
//   4. A schermo va la riga RILETTA, mai quella spedita.
// Due righe diverse (cambio camera: bagagli sul primo tratto, partenza
// sull'ultimo) sono due scritture: se la seconda non passa lo si dice preciso.
// Non importa `supabase`: scrittura e rilettura arrivano da chi chiama.
// ============================================================================
import { oraBreve, oraPerSql } from './schema0064.ts'
import type { ScritturaOrario } from './bagagliPartenza.ts'

type Errore = { code?: string; message?: string } | null | undefined
type Riga = { id: string; bagagli_alle?: unknown; check_out_time?: unknown }
export type Scrivi = (id: string, campi: Record<string, string | null>) => PromiseLike<{ data: Riga[] | null; error: Errore }>
export type Rileggi = (ids: string[]) => PromiseLike<{ data: Riga[] | null; error: Errore }>

export type EsitoOrari =
  | { stato: 'salvato'; righe: Riga[]; verificato?: boolean }
  | { stato: 'non_salvato'; messaggio: string; righe?: Riga[] }
  | { stato: 'incerto'; messaggio: string }

export const NON_SALVATO_ORARI = 'Non salvato: riprova.'
export const INCERTO_ORARI = 'Non so se è stato salvato: la risposta non è arrivata. Non risalvare: chiudi e riapri la prenotazione per controllare.'
export const RILETTURA_DIVERSA = 'La rilettura non coincide con quello che hai scritto: chiudi e riapri la prenotazione per controllare.'

const certo = (e: Errore) => !!e && /^([0-9A-Z]{5}|PGRST\d+)$/.test(e.code ?? '')
const coincide = (r: Riga | undefined, campi: ScritturaOrario['campi']) => !!r && Object.entries(campi).every(([k, v]) => oraBreve((r as Record<string, unknown>)[k]) === (v === null || v === undefined ? null : oraBreve(v)))

export async function salvaOrari(scritture: ScritturaOrario[], scrivi: Scrivi, rileggi: Rileggi): Promise<EsitoOrari> {
  if (!scritture.length) return { stato: 'salvato', righe: [] }
  const fatte: ScritturaOrario[] = []
  for (const s of scritture) {
    const sql = Object.fromEntries(Object.entries(s.campi).map(([k, v]) => [k, v === null || v === undefined ? null : oraPerSql(v)]))
    let r: Awaited<ReturnType<Scrivi>>
    try { r = await scrivi(s.id, sql) } catch (e) { r = { data: null, error: { message: String((e as Error)?.message ?? e) } } }
    if (r.error && certo(r.error)) return parziale(fatte, rileggi, NON_SALVATO_ORARI)
    if (r.error) return riconcilia([...fatte, s], rileggi)
    if (!r.data || r.data.length === 0) return parziale(fatte, rileggi, 'Non salvato: la prenotazione non è stata aggiornata. Chiudi e riapri la scheda.')
    fatte.push(s)
  }
  const letto = await leggi(fatte, rileggi)
  if (!letto) return { stato: 'incerto', messaggio: 'Salvato, ma non riesco a rileggerlo: chiudi e riapri la prenotazione per controllare, senza risalvare.' }
  if (!fatte.every(s => coincide(letto.find(r => r.id === s.id), s.campi))) return { stato: 'non_salvato', messaggio: RILETTURA_DIVERSA, righe: letto }
  return { stato: 'salvato', righe: letto }
}

async function leggi(fatte: ScritturaOrario[], rileggi: Rileggi): Promise<Riga[] | null> {
  try { const r = await rileggi(fatte.map(s => s.id)); return r.error || !r.data ? null : r.data } catch { return null }
}

// La prima scrittura è passata e la seconda no: si dice preciso cosa c'è.
async function parziale(fatte: ScritturaOrario[], rileggi: Rileggi, messaggio: string): Promise<EsitoOrari> {
  if (!fatte.length) return { stato: 'non_salvato', messaggio }
  const letto = await leggi(fatte, rileggi)
  return { stato: 'non_salvato', messaggio: `L'orario dei bagagli è salvato, quello della partenza no: ${messaggio.charAt(0).toLowerCase()}${messaggio.slice(1)}`, righe: letto ?? undefined }
}

// Risposta persa: decide solo la rilettura.
async function riconcilia(tentate: ScritturaOrario[], rileggi: Rileggi): Promise<EsitoOrari> {
  const letto = await leggi(tentate, rileggi)
  if (!letto) return { stato: 'incerto', messaggio: INCERTO_ORARI }
  if (tentate.every(s => coincide(letto.find(r => r.id === s.id), s.campi))) return { stato: 'salvato', righe: letto, verificato: true }
  return { stato: 'incerto', messaggio: INCERTO_ORARI }
}
