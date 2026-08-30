// ============================================================================
// CODA DI CARICAMENTO (3.2B.2) — la logica del foglio CaricaFotoSheet,
// estratta PURA così da poterla provare con richieste simulate sospese.
// Regole:
//  · ogni voce ha un IDENTIFICATIVO STABILE: il ciclo di invio lavora sempre
//    sull'ULTIMO stato della coda (un file tolto durante l'attesa non viene
//    caricato, uno aggiunto resta e aspetta il prossimo Salva);
//  · si (ri)inviano solo le voci in attesa o con errore RIPROVABILE: le
//    sospese e i doppioni restano fuori dai ritentativi automatici;
//  · la nota di una voce viene FISSATA al primo tentativo, così documento e
//    ricevuta restano coerenti anche se l'utente la cambia tra un tentativo
//    e l'altro.
// ============================================================================
import type { EsitoCaricamento, RipresaCaricamento } from './scrittura.ts'

export type StatoVoce = 'in_attesa' | 'in_invio' | 'salvata' | 'errore' | 'duplicato' | 'sospesa'

export type VoceCoda<F = Blob> = {
  id: string
  file: F
  nome: string
  tipo: string
  stato: StatoVoce
  errore?: string
  riprovabile?: boolean
  ripresa: RipresaCaricamento   // identificativi già noti, conservati SEMPRE
  nota?: string | null          // nota fissata al primo tentativo (undefined = mai inviata)
}

export function nuoveVoci<F>(
  files: { file: F; nome: string; tipo: string }[], genId: () => string,
): VoceCoda<F>[] {
  return files.map(f => ({ id: genId(), file: f.file, nome: f.nome, tipo: f.tipo, stato: 'in_attesa' as const, ripresa: {} }))
}

export const inviabile = (v: VoceCoda<unknown>): boolean =>
  v.stato === 'in_attesa' || (v.stato === 'errore' && v.riprovabile === true)

export const daInviare = <V extends VoceCoda<unknown>>(coda: V[]): V[] => coda.filter(inviabile)

// una voce già salvata o in volo non si toglie; e nemmeno una SOSPESA
// (esito sconosciuto): toglierla perderebbe in silenzio il riferimento
// all'operazione, e potrebbe esserci un documento già creato
export const rimovibile = (v: VoceCoda<unknown>): boolean =>
  v.stato !== 'in_invio' && v.stato !== 'salvata' && v.stato !== 'sospesa'

export function applicaEsito<V extends VoceCoda<unknown>>(v: V, esito: EsitoCaricamento): V {
  if (esito.ok) return { ...v, stato: 'salvata', errore: undefined, riprovabile: false }
  return {
    ...v,
    stato: esito.duplicato ? 'duplicato' : esito.sospeso ? 'sospesa' : 'errore',
    errore: esito.errore,
    riprovabile: esito.riprovabile,
    ripresa: esito.ripresa,
  }
}

// Il ciclo di invio. `leggi`/`scrivi` guardano lo STATO VIVO della coda
// (nel foglio: lo state React della pagina), mai una copia iniziale.
export async function salvaCoda<V extends VoceCoda<unknown>>(
  leggi: () => V[],
  scrivi: (aggiorna: (coda: V[]) => V[]) => void,
  invia: (voce: V, nota: string | null) => Promise<EsitoCaricamento>,
  notaCondivisa: string | null,
): Promise<{ salvate: number }> {
  const ids = daInviare(leggi()).map(v => v.id)
  let salvate = 0
  for (const id of ids) {
    const voce = leggi().find(v => v.id === id)
    if (!voce || !inviabile(voce)) continue     // tolta o cambiata nel frattempo
    const nota = voce.nota !== undefined ? voce.nota : notaCondivisa
    scrivi(coda => coda.map(v => (v.id === id ? { ...v, stato: 'in_invio' as const, nota } : v)))
    let esito: EsitoCaricamento
    try {
      esito = await invia(voce, nota)
    } catch (e) {
      esito = { ok: false, errore: String((e as Error).message ?? e), riprovabile: true, ripresa: voce.ripresa }
    }
    if (esito.ok) salvate++
    scrivi(coda => coda.map(v => (v.id === id ? applicaEsito({ ...v, nota }, esito) : v)))
  }
  return { salvate }
}
