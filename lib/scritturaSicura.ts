// Scritture su Supabase con esito controllato (incarico del 05/09/2026,
// «errori di salvataggio visibili»).
//
// Il difetto che corregge: alcune azioni aggiornavano lo schermo subito dopo
// la chiamata a Supabase senza guardare `error` nella risposta. Se la
// scrittura falliva (rete, permessi, colonna mancante) Ania vedeva la camera
// «confermata» o il bonifico «pagato» quando sul server non era cambiato
// nulla. Regola: lo stato locale cambia SOLO se la scrittura è riuscita;
// altrimenti resta com'era e compare un messaggio vicino all'azione.
//
// Nessun import di lib/supabase: la funzione riceve la chiamata già pronta
// (una promessa PostgREST) così i test la esercitano con un finto.

export const MESSAGGIO_NON_SALVATO = 'Non salvato, riprova'

export type RispostaScrittura = { error: unknown } | null | undefined

// Testo da mostrare a fianco dell'azione. Senza connessione lo dice; per
// gli altri errori resta il messaggio breve: il dettaglio tecnico non aiuta
// Ania a decidere, quello che conta è «non è stato salvato».
export function messaggioNonSalvato(err: unknown): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return `${MESSAGGIO_NON_SALVATO}: nessuna connessione`
  const testo = String((err as { message?: unknown })?.message ?? '').toLowerCase()
  const rete = testo.includes('failed to fetch') || testo.includes('load failed') || testo.includes('tempo scaduto')
    || testo.includes('networkerror') || testo.includes('fetch failed')
  return rete ? `${MESSAGGIO_NON_SALVATO}: nessuna connessione` : MESSAGGIO_NON_SALVATO
}

// Esegue la scrittura; se riesce chiama `aggiorna` (lo stato locale) e torna
// null; se fallisce (error nella risposta O eccezione) NON chiama `aggiorna`
// e torna il messaggio per lo schermo. Nessuna eccezione viene ingoiata in
// silenzio: diventa sempre un messaggio visibile.
export async function scriviPoiAggiorna(
  scrivi: () => PromiseLike<RispostaScrittura>,
  aggiorna: () => void,
): Promise<string | null> {
  let risposta: RispostaScrittura
  try {
    risposta = await scrivi()
  } catch (err) {
    return messaggioNonSalvato(err)
  }
  if (risposta && risposta.error) return messaggioNonSalvato(risposta.error)
  aggiorna()
  return null
}
