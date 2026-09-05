// Richieste arrivate dal sito (bookings in_attesa con source sito_web):
// lettura con esito controllato. Errori di salvataggio visibili (05/09/2026):
// prima un errore di lettura tornava una lista vuota, indistinguibile da
// «nessuna richiesta». Qui l'esito distingue sempre le due cose e nessuna
// eccezione resta silenziosa.
//
// Nessun import di lib/supabase: la funzione riceve l'interrogazione già
// pronta (una promessa PostgREST) così i test la esercitano con un finto.
import { nomeOspite, nomeDiverso } from './guestName.ts'
import { isErroreDiRete } from './connessione.ts'

export type WebRequest = {
  id: string
  check_in: string
  check_out: string
  num_guests: number
  total_amount: number
  room_name: string
  guest_name: string
  guest_phone: string
  // Il numero è già in archivio con un nominativo diverso da quello della
  // richiesta: nome_archivio è quello della scheda, per l'avviso rosso
  nome_diverso: boolean
  nome_archivio: string
}

export type EsitoRichiesteWeb = { richieste: WebRequest[]; errore: string | null }

export const MESSAGGIO_RICHIESTE_NON_CARICATE = 'Non riesco a caricare le richieste dal sito'

export function messaggioRichiesteNonCaricate(err: unknown): string {
  return isErroreDiRete(err) ? `${MESSAGGIO_RICHIESTE_NON_CARICATE}: nessuna connessione` : `${MESSAGGIO_RICHIESTE_NON_CARICATE}, riprova`
}

export const COLONNE_RICHIESTE_WEB = 'id, check_in, check_out, num_guests, total_amount, guest_name, rooms(name), guests(full_name, phone)'
// Ripiego se bookings.guest_name non è ancora migrata.
export const COLONNE_RICHIESTE_WEB_SENZA_NOME = 'id, check_in, check_out, num_guests, total_amount, rooms(name), guests(full_name, phone)'

type RispostaLettura = { data: unknown[] | null; error: unknown }
export type Interrogazione = (colonne: string) => PromiseLike<RispostaLettura>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function daRiga(b: any): WebRequest {
  return {
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    num_guests: b.num_guests,
    total_amount: Number(b.total_amount) || 0,
    room_name: b.rooms?.name?.split(' ').slice(-1)[0] || 'Camera',
    guest_name: nomeOspite(b),
    guest_phone: b.guests?.phone || '',
    nome_diverso: nomeDiverso(b),
    nome_archivio: b.guests?.full_name || '',
  }
}

export async function caricaRichiesteWeb(interroga: Interrogazione): Promise<EsitoRichiesteWeb> {
  try {
    let risposta = await interroga(COLONNE_RICHIESTE_WEB)
    if (risposta.error) risposta = await interroga(COLONNE_RICHIESTE_WEB_SENZA_NOME)
    if (risposta.error) return { richieste: [], errore: messaggioRichiesteNonCaricate(risposta.error) }
    return { richieste: (risposta.data || []).map(daRiga), errore: null }
  } catch (err) {
    return { richieste: [], errore: messaggioRichiesteNonCaricate(err) }
  }
}

// I tre stati che lo schermo deve distinguere: «caricamento», «pronto»
// (anche con zero richieste) ed «errore». Un errore non è mai «nessuna richiesta».
export type StatoRichiesteWeb =
  | { stato: 'caricamento'; richieste: WebRequest[]; errore: null }
  | { stato: 'pronto'; richieste: WebRequest[]; errore: null }
  | { stato: 'errore'; richieste: WebRequest[]; errore: string }

export const RICHIESTE_WEB_IN_CARICAMENTO: StatoRichiesteWeb = { stato: 'caricamento', richieste: [], errore: null }

// Dallo stato precedente e dall'esito della lettura al nuovo stato: con un
// errore le richieste già mostrate restano (non spariscono come «nessuna»).
export function statoDopoLettura(prima: StatoRichiesteWeb, esito: EsitoRichiesteWeb): StatoRichiesteWeb {
  if (esito.errore) return { stato: 'errore', richieste: prima.richieste, errore: esito.errore }
  return { stato: 'pronto', richieste: esito.richieste, errore: null }
}
