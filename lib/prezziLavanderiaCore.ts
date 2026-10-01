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

export async function salvaPrezzo(c: ClientPrezzi, pezzo: PezzoLavanderia, prezzo: number | null): Promise<{ errore: string | null }> {
  try {
    if (prezzo === null) {
      const r = await c.togli(pezzo)
      if (r.error) return { errore: 'Prezzo non tolto: riprova.' }
    } else {
      const r = await c.scrivi(pezzo, prezzo)
      if (r.error || !r.data?.length) return { errore: 'Prezzo non salvato: riprova.' }
    }
    const l = await leggiPrezzi(c)
    if (l.stato !== 'si') return { errore: 'Salvato, ma non riesco a rileggerlo: ricarica la pagina per controllare.' }
    return (l.prezzi[pezzo] ?? null) === prezzo ? { errore: null } : { errore: 'La rilettura non coincide: ricarica la pagina e controlla.' }
  } catch { return { errore: 'Non so se il prezzo è stato salvato: ricarica la pagina per controllare.' } }
}
