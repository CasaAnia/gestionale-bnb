// ============================================================================
// I PREZZI DELLA «PROVA LAVANDERIA» (proposta 0064, tabella prezzi_lavanderia):
// un prezzo a pezzo scritto da Ania, che resta (non nel browser).
//   - campo vuoto = «prezzo da inserire»: la riga si cancella, mai uno zero;
//   - zero vale solo se scritto;
//   - senza la tabella i campi funzionano lo stesso, con «prezzi non salvati»;
//   - rete o permessi: lo si dice, non si finge che la tabella manchi;
//   - ogni salvataggio deve restituire la sua riga e si rilegge.
// ============================================================================
import { esitoSonda } from './schema0064.ts'
import type { PezzoLavanderia } from './statistichePulizieNuove.ts'

type Errore = { code?: string; message?: string } | null
export type ClientPrezzi = {
  leggi: () => PromiseLike<{ data: { pezzo: string; prezzo: number | string }[] | null; error: Errore }>
  scrivi: (pezzo: PezzoLavanderia, prezzo: number) => PromiseLike<{ data: { pezzo: string; prezzo: number | string }[] | null; error: Errore }>
  togli: (pezzo: PezzoLavanderia) => PromiseLike<{ error: Errore }>
}
export type LetturaPrezzi = { stato: 'si'; prezzi: Partial<Record<PezzoLavanderia, number>> } | { stato: 'no' } | { stato: 'errore' }
export const PREZZI_NON_SALVATI = 'prezzi non salvati: per ricordarli va applicata la proposta 0064'

/** «1,90», «1.9», «0» → numero; «» → null; altro → NaN */
export function prezzoScritto(testo: string): number | null {
  const t = testo.trim().replace('€', '').trim().replace(',', '.')
  if (t === '') return null
  return /^\d+(\.\d{1,2})?$/.test(t) && Number(t) <= 1000 ? Number(t) : NaN
}

export async function leggiPrezzi(c: ClientPrezzi): Promise<LetturaPrezzi> {
  try {
    const r = await c.leggi()
    const e = esitoSonda(r.error)
    if (e !== 'si') return { stato: e }
    return { stato: 'si', prezzi: Object.fromEntries((r.data ?? []).map(x => [x.pezzo, Number(x.prezzo)])) }
  } catch { return { stato: 'errore' } }
}

// Esito di un salvataggio (rilievo di Codex del 01/10/2026): una risposta
// persa NON è «non salvato». Si rilegge: il prezzo riletto uguale = salvato;
// errore certo del server (codice PostgreSQL / PGRST) = non salvato; tutto il
// resto = incerto, col valore scritto lasciato nel campo e senza invito a
// risalvare. Vale anche per la cancellazione (campo vuotato).
export type EsitoPrezzo = { stato: 'salvato' | 'non_salvato' | 'incerto'; messaggio: string | null }
export const PREZZO_INCERTO = 'Non so se il prezzo è stato salvato: la risposta non è arrivata. Non riscriverlo: ricarica la pagina per controllare.'
const certo = (e: Errore) => !!e && /^([0-9A-Z]{5}|PGRST\d+)$/.test(e.code ?? '')

export async function salvaPrezzo(c: ClientPrezzi, pezzo: PezzoLavanderia, prezzo: number | null): Promise<EsitoPrezzo> {
  let errore: Errore = null, righeVuote = false
  try {
    if (prezzo === null) errore = (await c.togli(pezzo)).error
    else { const r = await c.scrivi(pezzo, prezzo); errore = r.error; righeVuote = !r.error && !r.data?.length }
  } catch (e) { errore = { message: String(e) } }
  if (errore && certo(errore)) return { stato: 'non_salvato', messaggio: prezzo === null ? 'Prezzo non tolto: riprova.' : 'Prezzo non salvato: riprova.' }
  // In ogni altro caso decide la rilettura
  const l = await leggiPrezzi(c)
  if (l.stato !== 'si') return { stato: 'incerto', messaggio: PREZZO_INCERTO }
  if ((l.prezzi[pezzo] ?? null) === prezzo) return { stato: 'salvato', messaggio: null }
  if (!errore && righeVuote) return { stato: 'non_salvato', messaggio: 'Prezzo non salvato: riprova.' }
  if (!errore) return { stato: 'non_salvato', messaggio: 'La rilettura non coincide: ricarica la pagina e controlla.' }
  return { stato: 'incerto', messaggio: PREZZO_INCERTO }
}
