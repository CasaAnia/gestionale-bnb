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
