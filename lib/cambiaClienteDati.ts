'use client'
// Cambia cliente (06/09/2026): letture e scritture su Supabase. Le regole
// stanno in lib/cambiaCliente (pure, con i test); qui solo le chiamate.
import { supabase } from './supabase'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { ricordaStruttura } from './provenienzaDati'
import { soggiorniConclusi, type RigaSoggiorno } from './nuovaPrenotazione'
import {
  campiCambioCliente, filtroCambioCliente, filtraClienti, salvaCambioCliente, messaggioCreazioneCliente,
  type ClienteBreve, type PrenotazionePerCambio, type CampiNuovoCliente,
} from './cambiaCliente'
import { cercaSchedaPerTelefono, leggiClientiPerRicerca } from './clienteTelefonoDati'
import { ordinaPerNumeroUguale, testoNumeroGiaInArchivio } from './clienteTelefono'

// Clienti che somigliano al testo (nome o cifre del telefono), letti dal
// server e poi filtrati con la stessa regola della ricerca locale; il cliente
// attuale non compare mai. Con testo vuoto: gli ultimi creati.
export async function cercaClientiPerCambio(testo: string, escludiId: string | null | undefined): Promise<{ clienti: ClienteBreve[]; errore: string | null }> {
  const q = testo.trim()
  // ricevuta, valutazione e nota servono alla riga della scheda nuova (🧾 ★ nome) e al cliente scelto
  const campi = 'id, full_name, phone, provenienza, struttura_nome, rating, vuole_ricevuta, notes'
  if (!q) {
    const { data, error } = await supabase.from('guests').select(campi).order('created_at', { ascending: false }).limit(12)
    if (error) return { clienti: [], errore: messaggioLetturaNonRiuscita(error, 'cercare i clienti') }
    // Senza testo l'ordine resta «ultimi creati»
    return { clienti: ((data || []) as ClienteBreve[]).filter(c => c.id !== escludiId), errore: null }
  }
  // Col testo la stessa lettura della Nuova prenotazione (21/10/2026): il
  // numero si trova con o senza +39/0039 e con gli spazi di WhatsApp
  const { righe, errore } = await leggiClientiPerRicerca<ClienteBreve>(q, campi, 30)
  if (errore) return { clienti: [], errore: messaggioLetturaNonRiuscita(errore, 'cercare i clienti') }
  // per nome, ma prima le schede col numero identico a quello cercato
  return { clienti: ordinaPerNumeroUguale(filtraClienti(q, righe, escludiId), q), errore: null }
}

// Quante volte ogni cliente è già stata qui: si contano i SOGGIORNI conclusi,
// non le righe (una visita con due cambi camera è una visita sola), con la
// stessa regola dell'inserimento. Se la lettura non riesce non si scrive un
// numero sbagliato: nessun conteggio.
export async function soggiorniConclusiDeiClienti(ids: string[], oggi: string): Promise<Record<string, number>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('bookings').select('id, guest_id, check_out, prenotazione_id, group_id')
    .in('guest_id', ids).neq('status', 'annullata').limit(2000)
  if (error) return {}
  return soggiorniConclusi((data ?? []) as RigaSoggiorno[], oggi)
}

// Cliente nuovo: una riga in guests (telefono UNIQUE → messaggio dedicato).
// Un nome di struttura nuovo entra nell'elenco, come in /nuova.
//
// Prima di scrivere (21/10/2026): lo stesso numero in un'altra forma («+39 333…»
// contro «333…» in archivio) il vincolo UNIQUE non lo ferma, perché confronta
// il testo. Se il numero è già su una o più schede non si crea niente: torna
// `schede` e chi chiama le mostra da scegliere. Se il controllo non riesce
// non si scrive alla cieca.
export async function creaClienteNuovo(campi: CampiNuovoCliente, struttureNote: { nome: string }[]): Promise<{ cliente: ClienteBreve; errore: null; schede?: undefined } | { cliente: null; errore: string; schede?: ClienteBreve[] }> {
  const gia = await cercaSchedaPerTelefono<ClienteBreve>(String(campi.phone ?? ''))
  if (gia.errore) return { cliente: null, errore: `Non sono riuscito a controllare se il numero è già in archivio: ${gia.errore}` }
  if (gia.schede.length) return { cliente: null, errore: testoNumeroGiaInArchivio(gia.schede) ?? '', schede: gia.schede }
  let risposta: { data: ClienteBreve | null; error: { code?: string; message?: string } | null }
  try {
    risposta = await supabase.from('guests').insert(campi).select('id, full_name, phone, provenienza, struttura_nome, rating, vuole_ricevuta, notes').single()
  } catch (err) {
    return { cliente: null, errore: messaggioCreazioneCliente(err as { message?: string }) }
  }
  if (risposta.error || !risposta.data) return { cliente: null, errore: messaggioCreazioneCliente(risposta.error) }
  if (campi.struttura_nome) await ricordaStruttura(campi.struttura_nome, struttureNote)   // se fallisce non blocca: il cliente esiste già
  return { cliente: risposta.data, errore: null }
}

// Documenti caricati sul cliente di partenza (0032): id e quanti sono. Tabella
// assente o lettura fallita → nessuna proposta (0), mai un blocco.
export async function documentiDelCliente(guestId: string | null | undefined): Promise<string[]> {
  if (!guestId) return []
  const { data, error } = await supabase.from('documenti_cliente').select('id').eq('guest_id', guestId)
  if (error || !data) return []
  return data.map(d => d.id as string)
}

// Sposta i documenti scelti al cliente nuovo: solo guest_id delle righe, con il
// filtro sul cliente vecchio (mai una riga di un altro cliente).
export function spostaDocumenti(ids: string[], vecchioGuestId: string, nuovoGuestId: string, aggiorna: () => void): Promise<string | null> {
  if (ids.length === 0) return Promise.resolve(null)
  return salvaCambioCliente(() => supabase.from('documenti_cliente').update({ guest_id: nuovoGuestId }).eq('guest_id', vecchioGuestId).in('id', ids).select('id'), aggiorna)
}

// La scrittura vera: solo guest_id (+ guest_name azzerato) sulle righe del
// soggiorno; `aggiorna` gira solo a scrittura riuscita.
export function scriviCambioCliente(b: PrenotazionePerCambio, nuovoGuestId: string, aggiorna: () => void): Promise<string | null> {
  const campi = campiCambioCliente(b, nuovoGuestId)
  const filtro = filtroCambioCliente(b)
  return salvaCambioCliente(() => supabase.from('bookings').update(campi).eq(filtro.colonna, filtro.valore).select('id'), aggiorna)
}
