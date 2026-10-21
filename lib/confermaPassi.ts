// ============================================================================
// I DUE PASSI PRIMA DELLA CONFERMA DI UNA RICHIESTA (21/10/2026, T1 e T3 di
// Codex), con la prova del valore DAVVERO salvato. Niente Supabase qui: chi
// chiama passa le letture e le scritture, i test le simulano (risposta persa,
// errore, valore diverso). Regola: si va avanti solo quando la rilettura
// conferma; se non si sa com'è andata ci si ferma («incerto»), mai alla cieca.
// ============================================================================

export type EsitoPasso<T = null> =
  | { esito: 'ok'; valore: T }
  | { esito: 'errore'; testo: string }
  | { esito: 'incerto'; testo: string }

const testoDi = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : String((e as { message?: string })?.message ?? e))

/** Il telefono della richiesta prende la forma della scheda. Riuscito solo se
 *  la risposta della scrittura, o la rilettura, mostra proprio quel telefono. */
export async function allineaConVerifica(o: {
  telefono: string
  scrivi: () => PromiseLike<{ error: unknown; telefono: string | null }>
  rileggi: () => PromiseLike<{ error: unknown; telefono: string | null; stato: string | null }>
}): Promise<EsitoPasso> {
  let scritto: string | null = null
  try {
    const r = await o.scrivi()
    if (!r.error) scritto = r.telefono
  } catch { /* risposta persa: decide la rilettura */ }
  if (scritto === o.telefono) return { esito: 'ok', valore: null }
  let letto: { error: unknown; telefono: string | null; stato: string | null }
  try { letto = await o.rileggi() } catch (e) { return { esito: 'incerto', testo: `non so se il numero della richiesta è stato allineato (${testoDi(e)}): riapri la richiesta e riprova` } }
  if (letto.error) return { esito: 'incerto', testo: `non so se il numero della richiesta è stato allineato (${testoDi(letto.error)}): riapri la richiesta e riprova` }
  if (letto.telefono === o.telefono && letto.stato === 'proposta_inviata') return { esito: 'ok', valore: null }
  if (letto.stato !== 'proposta_inviata') return { esito: 'errore', testo: 'la richiesta non è più in «proposta inviata»' }
  return { esito: 'errore', testo: 'il numero della richiesta non è stato allineato alla scheda' }
}

/** La scheda del cliente nuovo, col «+». Se la risposta della creazione si
 *  perde, la scheda si cerca: una sola col numero → è quella; nessuna → non
 *  creata; altrimenti incerto. */
export async function creaSchedaConVerifica<T extends { id: string }>(o: {
  crea: () => PromiseLike<{ cliente: T | null; errore: string | null; schede?: T[] }>
  cerca: () => PromiseLike<{ schede: T[]; errore: string | null }>
}): Promise<EsitoPasso<T>> {
  let errore: string | null = null
  try {
    const r = await o.crea()
    if (r.cliente) return { esito: 'ok', valore: r.cliente }
    if (r.schede?.length) return { esito: 'errore', testo: 'il numero è già su una scheda: riapri la conferma per sceglierla' }
    errore = r.errore
  } catch (e) { errore = testoDi(e) }
  let trovate: { schede: T[]; errore: string | null }
  try { trovate = await o.cerca() } catch (e) { return { esito: 'incerto', testo: `non so se la scheda del cliente è stata creata (${testoDi(e)}): riapri la conferma` } }
  if (trovate.errore) return { esito: 'incerto', testo: `non so se la scheda del cliente è stata creata (${trovate.errore}): riapri la conferma` }
  if (trovate.schede.length === 1) return { esito: 'ok', valore: trovate.schede[0] }
  if (trovate.schede.length === 0) return { esito: 'errore', testo: `la scheda del cliente non è stata creata${errore ? `: ${errore}` : ''}` }
  return { esito: 'incerto', testo: 'il numero ora è su più schede: riapri la conferma per scegliere' }
}
