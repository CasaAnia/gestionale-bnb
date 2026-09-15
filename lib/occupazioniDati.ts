// ============================================================================
// CHI OCCUPA CAMERE E LETTI (15/09/2026) — la lettura, fatta bene.
//
// Prima si leggeva una volta sola all'apertura della pagina, con una query
// senza pagine e senza guardare l'esito: un errore o un elenco tagliato a
// mille righe si travestivano da «non c'è nessuno», e il salvataggio partiva
// lo stesso. Qui la lettura dice sempre com'è andata, prende tutte le pagine
// e si può rifare prima di scrivere.
//
// La protezione vera contro due prenotazioni fatte nello stesso istante NON è
// questa: è il vincolo sul database (vedi supabase/proposte/0051). Questa
// lettura serve a non proporre una camera già presa e a fermarsi per tempo.
// ============================================================================
import type { PrenotazioneMinima } from './disponibilita.ts'
import type { PrenotazioneLetti } from './lettiAggiuntivi.ts'

export type Occupazione = PrenotazioneMinima & PrenotazioneLetti
export type EsitoOccupazioni =
  | { stato: 'pronte'; righe: Occupazione[]; dal: string }
  | { stato: 'errore'; messaggio: string }

export const PAGINA = 1000
export const CAMPI_OCCUPAZIONE = 'room_id, check_in, check_out, status, num_guests, extra_bed, extra_bed_dates'
export const NON_LETTE = 'Non riesco a leggere chi occupa le camere: non posso dire se sono libere. Riprova.'

/** Chi legge una pagina: la pagina la passa già pronta, qui non c'è Supabase */
export type LeggiPagina = (da: number, a: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>

/** Tutte le righe che possono occupare qualcosa dal giorno `dal` in avanti.
 *  Si continua finché una pagina torna piena: senza, oltre le mille righe il
 *  gestionale credeva che le camere fossero libere. */
export async function leggiOccupazioni(leggi: LeggiPagina, dal: string): Promise<EsitoOccupazioni> {
  const righe: Occupazione[] = []
  for (let pagina = 0; pagina < 50; pagina++) {
    const da = pagina * PAGINA
    let risposta: { data: unknown[] | null; error: unknown }
    try {
      risposta = await leggi(da, da + PAGINA - 1)
    } catch {
      return { stato: 'errore', messaggio: NON_LETTE }
    }
    if (risposta.error) return { stato: 'errore', messaggio: NON_LETTE }
    const pezzo = (risposta.data ?? []) as Occupazione[]
    righe.push(...pezzo)
    if (pezzo.length < PAGINA) return { stato: 'pronte', righe, dal }
  }
  return { stato: 'pronte', righe, dal }
}

/** Da che giorno leggere: oggi, o l'arrivo più lontano indietro che si sta
 *  scrivendo. Una prenotazione di ieri deve vedere chi c'era ieri. */
export function daQuandoLeggere(oggi: string, arrivi: string[]): string {
  return [oggi, ...arrivi.filter(Boolean)].sort()[0]
}
