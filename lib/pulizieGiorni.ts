// ============================================================================
// PULIZIE DI DOMANI E DEI GIORNI DOPO (riferimento approvato da Ania il
// 02/10/2026, docs/design/pulizie-domani-riferimento.html, colonna 2).
//
// La linguetta «Oggi» si muove di giorno in giorno con le frecce ‹ › accanto
// alla data: mai prima di oggi, con le frecce fino a 13 giorni avanti. Il
// giorno sta nell'indirizzo (/pulizie?giorno=2026-10-02), così il tasto
// indietro del telefono e i link da fuori (la striscia della Home arriva a 28
// giorni) funzionano; senza parametro è oggi. Qui solo date e parole:
// funzioni pure, provate con node --test.
// ============================================================================
import { addDaysStr, diffDays } from './pulizie.ts'
import { GIORNI_STRISCIA } from './numeriOggi.ts'

/** con le frecce: fino a 13 giorni dopo oggi */
export const GIORNI_AVANTI = 13

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const giornoSettimana = (iso: string) => GIORNI[new Date(iso + 'T00:00:00Z').getUTCDay()]

/** Il giorno da mostrare: quello dell'indirizzo se è oggi o dopo (fino
 *  all'ultimo giorno della striscia della Home), altrimenti oggi. */
export function giornoDaMostrare(parametro: string | null, oggi: string): string {
  if (!parametro || !/^\d{4}-\d{2}-\d{2}$/.test(parametro) || parametro <= oggi) return oggi
  return diffDays(parametro, oggi) <= GIORNI_STRISCIA - 1 ? parametro : oggi
}

/** «‹»: il giorno prima, mai prima di oggi (su oggi la freccia non c'è) */
export const giornoPrima = (giorno: string, oggi: string): string | null => (giorno > oggi ? addDaysStr(giorno, -1) : null)
/** «›»: il giorno dopo, fino a 13 giorni avanti */
export const giornoDopo = (giorno: string, oggi: string): string | null => (diffDays(giorno, oggi) < GIORNI_AVANTI ? addDaysStr(giorno, 1) : null)

/** L'indirizzo del giorno: oggi senza parametro */
export const indirizzoGiorno = (giorno: string, oggi: string) => (giorno === oggi ? '/pulizie' : `/pulizie?giorno=${giorno}`)

/** Sotto la data, su un giorno che deve venire: «domani · 2 da fare»,
 *  «sabato · 1 da fare», «sabato · niente da fare» (in maiuscoletto dalla veste) */
export function contoGiornoFuturo(giorno: string, oggi: string, daFare: number): string {
  const quando = diffDays(giorno, oggi) === 1 ? 'domani' : giornoSettimana(giorno)
  return `${quando} · ${daFare > 0 ? `${daFare} da fare` : 'niente da fare'}`
}

/** In fondo alla scheda di un giorno che deve venire: «Da fare domani», «Da fare sabato 3» */
export function daFareIl(giorno: string, oggi: string): string {
  return diffDays(giorno, oggi) === 1 ? 'Da fare domani' : `Da fare ${giornoSettimana(giorno)} ${Number(giorno.slice(8))}`
}

/** Nel grafico, la camera senza niente: «niente oggi», «niente domani», «niente quel giorno» */
export function nienteNelGiorno(giorno: string, oggi: string): string {
  const d = diffDays(giorno, oggi)
  return d <= 0 ? 'niente oggi' : d === 1 ? 'niente domani' : 'niente quel giorno'
}
