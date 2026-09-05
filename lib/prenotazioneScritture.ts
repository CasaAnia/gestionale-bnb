// Scritture e riletture della scheda prenotazione con esito controllato
// (errori di salvataggio visibili, parte 2, 05/09/2026).
//
// - salvaInSequenza: più update uno dopo l'altro (i segmenti di un soggiorno);
//   al primo errore si ferma e dice se qualcosa era già stato salvato, così
//   Ania sa che deve ricontrollare invece di credere che nulla sia cambiato.
// - leggiConEsito: una lettura che non lancia mai e non torna mai null al
//   posto di un errore; serve alla rilettura dopo un salvataggio riuscito
//   («Prenotazione non trovata» non deve più comparire per un errore di rete)
//   e allo storico del cliente in /nuova.
//
// Nessun import di lib/supabase: le chiamate arrivano già pronte, i test le
// esercitano con un finto.
import { messaggioNonSalvato, type RispostaScrittura } from './scritturaSicura.ts'
import { isErroreDiRete } from './connessione.ts'

export const MESSAGGIO_SALVATO_IN_PARTE = 'Salvato solo in parte, riprova e controlla le date di ogni camera'
export const MESSAGGIO_RILETTURA = 'Salvato, ma non riesco a ricaricare la scheda: riaprila per vedere i dati aggiornati'

export async function salvaInSequenza(scritture: Array<() => PromiseLike<RispostaScrittura>>): Promise<{ riusciti: number; errore: string | null }> {
  let riusciti = 0
  for (const scrivi of scritture) {
    let risposta: RispostaScrittura
    try {
      risposta = await scrivi()
    } catch (err) {
      return { riusciti, errore: riusciti > 0 ? MESSAGGIO_SALVATO_IN_PARTE : messaggioNonSalvato(err) }
    }
    if (risposta && risposta.error) return { riusciti, errore: riusciti > 0 ? MESSAGGIO_SALVATO_IN_PARTE : messaggioNonSalvato(risposta.error) }
    riusciti++
  }
  return { riusciti, errore: null }
}

export function messaggioLetturaNonRiuscita(err: unknown, cosa: string): string {
  return isErroreDiRete(err) ? `Non riesco a ${cosa}: nessuna connessione` : `Non riesco a ${cosa}, riprova`
}

export async function leggiConEsito<T>(
  leggi: () => PromiseLike<{ data: T | null; error: unknown }>,
  cosa: string,
): Promise<{ data: T | null; errore: string | null }> {
  try {
    const risposta = await leggi()
    if (risposta.error) return { data: null, errore: messaggioLetturaNonRiuscita(risposta.error, cosa) }
    return { data: risposta.data, errore: null }
  } catch (err) {
    return { data: null, errore: messaggioLetturaNonRiuscita(err, cosa) }
  }
}
