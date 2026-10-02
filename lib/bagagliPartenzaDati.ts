// ============================================================================
// SALVARE BAGAGLI E PARTENZA — stesso principio di lib/arrivoDati: non si dice
// mai una cosa che non si sa.
//   1. Si mandano TUTTE le scritture richieste (con un cambio camera sono due
//      righe: bagagli sul primo tratto, partenza sull'ultimo). Una risposta
//      persa sulla prima NON ferma la seconda: sono righe diverse, ognuna
//      scrive solo il suo orario.
//   2. Ogni scrittura deve restituire la sua riga: zero righe = non scritta.
//      Errore del SERVER (codice PostgreSQL o PGRST…) = certo, non scritta.
//      Errore senza codice (rete caduta, risposta persa) = INCERTA.
//   3. Alla fine si rilegge TUTTO e ogni modifica richiesta si classifica:
//      confermata dalla rilettura · certamente non scritta · incerta (né
//      confermata né esclusa: la richiesta può ancora arrivare).
//   4. L'esito riguarda TUTTE le modifiche richieste (rilievo di Codex del
//      01/10/2026: prima una rilettura buona della prima riga diceva
//      «salvato» anche se la seconda non era mai partita):
//        salvato   — tutte confermate dalla rilettura;
//        parziale  — alcune confermate, le altre certamente no: si dice quali;
//        incerto   — almeno una non si può né confermare né escludere: si
//                    dice cosa è confermato e non si invita a risalvare;
//        non_salvato — nessuna scritta, certo.
//      Solo «salvato» chiude il foglio; negli altri casi i dati scritti
//      restano a schermo.
//   5. A schermo va la riga RILETTA, mai quella spedita.
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
  | { stato: 'parziale'; messaggio: string; righe: Riga[] }
  | { stato: 'incerto'; messaggio: string; righe?: Riga[] }
  | { stato: 'non_salvato'; messaggio: string; righe?: Riga[] }

export const NON_SALVATO_ORARI = 'Non salvato: riprova.'
export const INCERTO_ORARI = 'Non so se è stato salvato: la risposta non è arrivata. Non risalvare: chiudi e riapri la prenotazione per controllare.'
export const RILETTURA_DIVERSA = 'La rilettura non coincide con quello che hai scritto: chiudi e riapri la prenotazione per controllare.'

const NOMI: Record<string, string> = { bagagli_alle: 'l’orario dei bagagli', check_out_time: 'l’orario della partenza' }
const certo = (e: Errore) => !!e && /^([0-9A-Z]{5}|PGRST\d+)$/.test(e.code ?? '')
const uguale = (r: Riga | undefined, campo: string, v: string | null | undefined) =>
  !!r && oraBreve((r as Record<string, unknown>)[campo]) === (v === null || v === undefined ? null : oraBreve(v))
const elenco = (campi: string[]) => campi.map(c => NOMI[c] ?? c).join(' e ')
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export async function salvaOrari(scritture: ScritturaOrario[], scrivi: Scrivi, rileggi: Rileggi): Promise<EsitoOrari> {
  if (!scritture.length) return { stato: 'salvato', righe: [] }
  // 1-2: tutte le scritture, ognuna col suo esito di invio
  const invio = new Map<string, 'ok' | 'no' | 'forse'>()
  for (const s of scritture) {
    const sql = Object.fromEntries(Object.entries(s.campi).map(([k, v]) => [k, v === null || v === undefined ? null : oraPerSql(v)]))
    let r: Awaited<ReturnType<Scrivi>>
    try { r = await scrivi(s.id, sql) } catch (e) { r = { data: null, error: { message: String((e as Error)?.message ?? e) } } }
    invio.set(s.id, r.error ? (certo(r.error) ? 'no' : 'forse') : !r.data || r.data.length === 0 ? 'no' : 'ok')
  }
  // 3: rilettura di tutte le righe toccate
  let letto: Riga[] | null = null
  try { const r = await rileggi(scritture.map(s => s.id)); letto = r.error || !r.data ? null : r.data } catch { letto = null }
  const confermati: string[] = [], mancanti: string[] = [], incerti: string[] = []
  for (const s of scritture) {
    const riga = letto?.find(r => r.id === s.id)
    for (const [campo, v] of Object.entries(s.campi)) {
      if (letto && uguale(riga, campo, v)) confermati.push(campo)
      else if (invio.get(s.id) === 'no' && letto) mancanti.push(campo)
      else if (invio.get(s.id) === 'ok' && letto) mancanti.push(campo)   // scritta ma riletta diversa
      else incerti.push(campo)
    }
  }
  const righe = letto ?? []
  // 4: l'esito su TUTTE le modifiche
  if (!incerti.length && !mancanti.length) return { stato: 'salvato', righe, verificato: [...invio.values()].some(x => x === 'forse') || undefined }
  if (incerti.length) {
    const fatto = confermati.length ? `${maiuscola(elenco(confermati))}: salvato. ` : ''
    const no = mancanti.length ? `${maiuscola(elenco(mancanti))}: non salvato. ` : ''
    return { stato: 'incerto', messaggio: `${fatto}${no}${maiuscola(elenco(incerti))}: non so se è stato salvato, la risposta non è arrivata. Non risalvare: chiudi e riapri la prenotazione per controllare.`, righe: letto ?? undefined }
  }
  if (confermati.length) return { stato: 'parziale', messaggio: `${maiuscola(elenco(confermati))}: salvato. ${maiuscola(elenco(mancanti))}: NON salvato, riprova.`, righe }
  const tutteScritte = scritture.every(s => invio.get(s.id) === 'ok')
  return { stato: 'non_salvato', messaggio: tutteScritte ? RILETTURA_DIVERSA : NON_SALVATO_ORARI, righe: letto ?? undefined }
}
