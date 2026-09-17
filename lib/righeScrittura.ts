// ============================================================================
// SCRIVERE SU PIÙ RIGHE DI bookings (17/09/2026) — la logica, senza il client
// dell'app: il client arriva da fuori, così si prova col client PostgREST
// vero e un trasporto finto (revisione del 17/09/2026, ultimo caso del
// rilievo 3).
//
// Due strade:
// - `aggiornaInUnColpo`: gli STESSI campi su tutte le righe, in una richiesta
//   sola (`update … in ('id', …)`): una sola istruzione SQL, o tutto o niente.
// - `aggiornaRigaPerRiga`: campi diversi per riga (sconto, tariffe), una
//   chiamata per riga con il controllo che ogni aggiornamento abbia toccato
//   la sua riga.
//
// L'esito d'errore dice se è INCERTO: qualcosa può essere stato scritto. È
// incerto quando una riga sì e una no, quando le righe toccate non tornano, e
// quando la risposta è andata PERSA: il client PostgREST non lancia, con un
// guasto di rete risponde `{ error, status: 0 }` (e con un gateway che cade,
// 502/503/504) — la scrittura può essere arrivata al database lo stesso. In
// quel caso la scheda non deve più fidarsi di quello che mostra: rilegge e
// intanto nasconde il conto. Niente viene dato per salvato senza esserlo.
// ============================================================================
import { messaggioNonSalvato } from './scritturaSicura.ts'

export const ERRORE_RIGA_NON_TROVATA = 'La camera non è stata trovata: ricarica la scheda.'
export const ERRORE_SALVATO_A_META = 'Salvato solo in parte: la scheda si rilegge da sola, controlla il conto.'
export const ERRORE_RISPOSTA_PERSA = 'Non so se è stato salvato: la scheda si rilegge da sola, controlla.'

export type EsitoRighe =
  | { esito: 'ok' }
  | { esito: 'errore'; messaggio: string; scritte: number; incerto: boolean; errore?: unknown }

export type ErrorePostgrest = { message?: string; code?: string; details?: string } | null
export type RispostaRighe = { data: unknown; error: ErrorePostgrest; status?: number }
type ConSelect = { select(colonne: string): PromiseLike<RispostaRighe> }
type Aggiornamento = { eq(colonna: string, valore: string): ConSelect; in(colonna: string, valori: string[]): ConSelect }
/** Quello che serve del client PostgREST: `from('bookings').update(...).eq|in(...).select('id')` */
export type ClienteRighe = { from(tabella: string): { update(valori: Record<string, unknown>): Aggiornamento } }

/** La risposta non è arrivata (rete caduta, tempo scaduto, gateway giù): la
 *  scrittura può essere passata lo stesso. Il client PostgREST lo dice con
 *  `status: 0` e un messaggio «TypeError: Failed to fetch» / «FetchError: …». */
export function rispostaPersa(error: ErrorePostgrest, status: number | undefined): boolean {
  if (!error) return false
  if (status === 0 || status === 502 || status === 503 || status === 504) return true
  const testo = String(error.message ?? '').toLowerCase()
  return /^(typeerror|fetcherror|aborterror):/.test(testo)
    || testo.includes('failed to fetch') || testo.includes('load failed') || testo.includes('networkerror')
    || testo.includes('fetch failed') || testo.includes('tempo scaduto')
}

/** L'esito quando la risposta è un errore: perso = incerto, altrimenti niente è stato scritto in QUESTA richiesta */
function erroreDaRisposta(error: ErrorePostgrest, status: number | undefined, scritte: number): EsitoRighe {
  const persa = rispostaPersa(error, status)
  const incerto = persa || scritte > 0
  const messaggio = scritte > 0 ? ERRORE_SALVATO_A_META : persa ? ERRORE_RISPOSTA_PERSA : messaggioNonSalvato(error)
  return { esito: 'errore', messaggio, scritte, incerto, errore: error }
}

export async function aggiornaRigaPerRiga(client: ClienteRighe, righe: { id: string; campi: Record<string, unknown> }[]): Promise<EsitoRighe> {
  let scritte = 0
  for (const r of righe) {
    let risposta: RispostaRighe
    try {
      risposta = await client.from('bookings')
        .update({ ...r.campi, updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .select('id')
    } catch (err) {
      // il client di solito non lancia; se lo fa, la riga può essere stata scritta lo stesso
      return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : ERRORE_RISPOSTA_PERSA, scritte, incerto: true, errore: err }
    }
    if (risposta.error) return erroreDaRisposta(risposta.error, risposta.status, scritte)
    if (!Array.isArray(risposta.data) || risposta.data.length !== 1) return { esito: 'errore', messaggio: scritte > 0 ? ERRORE_SALVATO_A_META : ERRORE_RIGA_NON_TROVATA, scritte, incerto: true }
    scritte += 1
  }
  return { esito: 'ok' }
}

/** Gli stessi campi su tutte le righe, in una richiesta sola: o tutte o nessuna. */
export async function aggiornaInUnColpo(client: ClienteRighe, ids: string[], campi: Record<string, unknown>): Promise<EsitoRighe> {
  if (ids.length === 0) return { esito: 'ok' }
  let risposta: RispostaRighe
  try {
    risposta = await client.from('bookings')
      .update({ ...campi, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select('id')
  } catch (err) {
    return { esito: 'errore', messaggio: ERRORE_RISPOSTA_PERSA, scritte: 0, incerto: true, errore: err }
  }
  if (risposta.error) return erroreDaRisposta(risposta.error, risposta.status, 0)
  const toccate = Array.isArray(risposta.data) ? risposta.data.length : 0
  if (toccate !== ids.length) return { esito: 'errore', messaggio: ERRORE_RIGA_NON_TROVATA, scritte: toccate, incerto: true }
  return { esito: 'ok' }
}

/** Gli stessi campi su tutte le righe, nella forma di `aggiornaRigaPerRiga` */
export function stessiCampi(ids: string[], campi: Record<string, unknown>): { id: string; campi: Record<string, unknown> }[] {
  return ids.map(id => ({ id, campi }))
}
