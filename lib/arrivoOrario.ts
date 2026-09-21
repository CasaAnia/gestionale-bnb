// Arrivi: salvataggio di orario e navetta con esito controllato (errori di
// salvataggio visibili, parte 2, 05/09/2026). Prima il secondo tentativo
// (solo orario, per chi non ha ancora la colonna shuttle della migrazione
// 0019) non controllava nulla e l'avviso era un alert del browser.
import { messaggioNonSalvato, type RispostaScrittura } from './scritturaSicura.ts'

export const AVVISO_NAVETTA_0019 = 'Orario salvato, ma la navetta no: va incollata la migrazione 0019 su Supabase.'

export type EsitoOrario =
  | { esito: 'ok'; messaggio: null }
  | { esito: 'solo_orario'; messaggio: string | null }
  | { esito: 'errore'; messaggio: string }

async function tenta(scrivi: () => PromiseLike<RispostaScrittura>): Promise<unknown> {
  try {
    const r = await scrivi()
    return r && r.error ? r.error : null
  } catch (err) {
    return err ?? new Error('errore sconosciuto')
  }
}

// Prima orario + navetta insieme; se il server rifiuta, solo l'orario. Se
// fallisce anche quello: errore, nulla è cambiato. `navettaRichiesta` decide
// se l'avviso sulla 0019 ha senso (senza navetta scelta non c'è nulla da dire).
export async function salvaOrarioENavetta(
  scriviTutto: () => PromiseLike<RispostaScrittura>,
  scriviSoloOrario: () => PromiseLike<RispostaScrittura>,
  navettaRichiesta: boolean,
): Promise<EsitoOrario> {
  const erroreTutto = await tenta(scriviTutto)
  if (!erroreTutto) return { esito: 'ok', messaggio: null }
  const erroreOrario = await tenta(scriviSoloOrario)
  if (erroreOrario) return { esito: 'errore', messaggio: messaggioNonSalvato(erroreOrario) }
  return { esito: 'solo_orario', messaggio: navettaRichiesta ? AVVISO_NAVETTA_0019 : null }
}

// ── «Arrivo e navetta» con le colonne nuove (proposta 0058, 21/09/2026) ─────
//
// Stesso principio di sopra, un piano più in là: prima si scrive tutto
// (colonne nuove + le due di sempre), e se il server non conosce ancora le
// colonne nuove si riscrivono SOLO quelle di sempre. In quel caso l'ora in
// struttura e il «serve la navetta / non serve» restano salvati e giusti; si
// perdono soltanto i dettagli (il luogo, la fascia, quale autista), e Ania lo
// legge a schermo invece di scoprirlo riaprendo la scheda.
export const AVVISO_ARRIVO_0058 = 'Ho salvato l’ora in struttura e la navetta, ma non il luogo e l’autista: va incollata la migrazione 0058 su Supabase.'

export type EsitoArrivo =
  | { esito: 'ok'; messaggio: null }
  | { esito: 'solo_vecchie'; messaggio: string }
  | { esito: 'errore'; messaggio: string }

export async function salvaArrivo(
  scriviTutto: () => PromiseLike<RispostaScrittura>,
  scriviVecchie: () => PromiseLike<RispostaScrittura>,
): Promise<EsitoArrivo> {
  const erroreTutto = await tenta(scriviTutto)
  if (!erroreTutto) return { esito: 'ok', messaggio: null }
  const erroreVecchie = await tenta(scriviVecchie)
  if (erroreVecchie) return { esito: 'errore', messaggio: messaggioNonSalvato(erroreVecchie) }
  return { esito: 'solo_vecchie', messaggio: AVVISO_ARRIVO_0058 }
}
