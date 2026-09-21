// ============================================================================
// SALVARE L'ARRIVO — un solo salvataggio per tutti i punti di ingresso
// (21/09/2026). Il foglio della scheda, la pagina «Nuova prenotazione», le
// due pagine di prima e la finestra degli Arrivi passano tutte di qui: così
// la regola «check_in_time è l'ora IN STRUTTURA» è scritta una volta sola.
//
// Non importa `supabase`: riceve la scrittura da chi lo chiama (`scrivi`),
// e quindi si può far girare nei test con un finto server che rifiuta le
// colonne nuove, va in errore o perde la risposta.
// ============================================================================
import { campiArrivo, campiArrivoVecchi, controllaArrivo, normalizza, type Arrivo } from './arrivo.ts'
import { salvaArrivo, type EsitoArrivo } from './arrivoOrario.ts'
import type { RispostaScrittura } from './scritturaSicura.ts'

export type ScritturaArrivo = (campi: Record<string, string | null>) => PromiseLike<RispostaScrittura>

export type EsitoSalvataggioArrivo = EsitoArrivo & {
  /** i campi DAVVERO salvati, da rimettere nello stato della pagina; null
   *  quando non è stato salvato niente */
  campi: Record<string, string | null> | null
}

/** Salva l'arrivo e dice cosa è finito sul server. Controlla prima: un
 *  orario a metà o un luogo non scelto tornano indietro come errore, senza
 *  scrivere niente. */
export async function salvaArrivoPrenotazione(scrivi: ScritturaArrivo, arrivo: Arrivo): Promise<EsitoSalvataggioArrivo> {
  const problema = controllaArrivo(arrivo)
  if (problema) return { esito: 'errore', messaggio: problema, campi: null }

  const pulito = normalizza(arrivo)
  const tutto = campiArrivo(pulito)
  const vecchie = campiArrivoVecchi(pulito)

  const esito = await salvaArrivo(() => scrivi(tutto), () => scrivi({ ...vecchie }))
  if (esito.esito === 'ok') return { ...esito, campi: tutto }
  if (esito.esito === 'solo_vecchie') return { ...esito, campi: { ...vecchie } }
  return { ...esito, campi: null }
}
