// ============================================================================
// RICHIESTE CHE SI ACCAVALLANO (Ania, 12/09/2026).
//
// Fino a ieri il segno ⇄ diceva due cose diverse — il cambio camera e le
// richieste che si accavallano — e non si capiva quale fosse quale. Adesso le
// richieste che vogliono le stesse notti hanno un segno tutto loro, che si
// tocca e restringe l'elenco a quel gruppo.
//
// Conta SOLO la notte in comune, non la camera chiesta: due persone che
// vogliono le stesse notti si contendono la casa anche se hanno chiesto
// camere diverse. (È la differenza con `sovrapposizioni` di
// lib/richiesteCalendario, che guarda la riga del calendario.)
// Contano solo le richieste ancora APERTE: una chiusa non toglie posto.
// ============================================================================
import { condividonoGiorni, type Intervallo } from './richiesteCalendario.ts'
import { eAperta, type StatoRichiesta } from './richieste.ts'

export type RichiestaStesseDate = Intervallo & { id: string; stato: StatoRichiesta; created_at: string }

// Le ALTRE richieste aperte con almeno una notte in comune (sé stessa esclusa)
export function altreStesseDate<T extends RichiestaStesseDate>(richiesta: RichiestaStesseDate, aperte: T[]): T[] {
  return aperte.filter(a => a.id !== richiesta.id && eAperta(a) && condividonoGiorni(richiesta, a))
}

// Il gruppo intero: la richiesta toccata e le altre, dalla più VECCHIA alla
// più recente — la prima arrivata si guarda per prima.
export function gruppoStesseDate<T extends RichiestaStesseDate>(richiesta: T, aperte: T[]): T[] {
  const dentro = [richiesta, ...altreStesseDate(richiesta, aperte)]
  return dentro.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

// «altra 1 richiesta» · «altre 3 richieste» · null quando è sola
export function etichettaStesseDate(quante: number): string | null {
  if (quante <= 0) return null
  return quante === 1 ? 'altra 1 richiesta' : `altre ${quante} richieste`
}

// «3 richieste, la più vecchia per prima» — il sottotitolo della barra
export const sottotitoloGruppo = (quante: number): string =>
  `${quante} ${quante === 1 ? 'richiesta' : 'richieste'}, la più vecchia per prima`

// «3 per queste date» — al posto del conteggio di sempre, mentre il filtro è attivo
export const contatoreGruppo = (quante: number): string => `${quante} per queste date`
