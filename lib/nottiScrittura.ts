// ============================================================================
// SALVARE LE NOTTI SPOSTATE (15/09/2026) — o tutto, o niente.
//
// Cambiare le notti dalla striscia sono tre cose insieme: accorciare i tratti
// che restano, crearne di nuovi, annullare quelli rimasti vuoti. Fatte come
// tre richieste separate, un guasto in mezzo lasciava il soggiorno a metà —
// il primo tratto già accorciato e la camera nuova mai creata, cioè notti
// sparite dal calendario. Il messaggio lo diceva; rimetterle a posto no.
//
// Qui si chiama la funzione della proposta 0053, che fa tutto dentro una
// transazione e ricontrolla la disponibilità sul database. Se la funzione non
// c'è ancora NON si ripiega sulle tre richieste separate: si dice che manca.
// Meglio non poter spostare le notti che spostarne metà.
// ============================================================================
import { messaggioNonSalvato } from './scritturaSicura.ts'
import { messaggioSovrapposizione } from './erroreSovrapposizione.ts'
import type { PianoNotti } from './strisciaNotti.ts'

export const MOTIVO_ANNULLA = 'Camera non più necessaria: notti spostate dalla striscia'
export const SERVE_LA_0053 =
  'Per spostare le notti serve la proposta 0053 applicata su Supabase: senza, il salvataggio sarebbe fatto a pezzi e un guasto a metà strada lascerebbe il soggiorno incompleto.'

export type EsitoNotti =
  | { esito: 'ok'; create: { id: string; check_in: string }[] }
  | { esito: 'errore'; messaggio: string }

export type RigaCreata = { id: string; check_in: string }

/** La funzione della 0053 non è ancora su Supabase */
export function manca0053(errore: unknown): boolean {
  const e = errore as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === 'PGRST202' || e.code === '42883') return true
  return /sposta_notti|function .* does not exist|schema cache/i.test(e.message ?? '')
}

/** I campi delle righe nuove: quelli del piano più quelli comuni al soggiorno */
export function righeDaCreare(
  piano: PianoNotti, comuni: Record<string, unknown>, arrivoDi: (checkIn: string) => Record<string, unknown>,
): Record<string, unknown>[] {
  return piano.crea.map(c => ({ ...comuni, ...arrivoDi(c.check_in), ...c }))
}

export async function salvaNottiInUnColpo(
  piano: PianoNotti,
  gruppo: string,
  comuni: Record<string, unknown>,
  arrivoDi: (checkIn: string) => Record<string, unknown>,
  chiama: (dati: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<EsitoNotti> {
  const dati = {
    p_aggiorna: piano.aggiorna.map(a => ({ id: a.id, campi: { ...a.campi, group_id: gruppo } })),
    p_crea: righeDaCreare(piano, { ...comuni, group_id: gruppo }, arrivoDi),
    p_annulla: piano.annulla,
    p_motivo: MOTIVO_ANNULLA,
  }
  let risposta: { data: unknown; error: unknown }
  try {
    risposta = await chiama(dati)
  } catch (err) {
    return { esito: 'errore', messaggio: messaggioNonSalvato(err) }
  }
  if (risposta.error) {
    if (manca0053(risposta.error)) return { esito: 'errore', messaggio: SERVE_LA_0053 }
    // camera presa o letti finiti: si dice con parole, non col messaggio del database
    const chiaro = messaggioSovrapposizione(risposta.error)
    if (chiaro) return { esito: 'errore', messaggio: chiaro }
    return { esito: 'errore', messaggio: messaggioNonSalvato(risposta.error) }
  }
  const create = ((risposta.data as { create?: RigaCreata[] } | null)?.create ?? []) as RigaCreata[]
  return { esito: 'ok', create }
}
