'use client'
// Cambia cliente (06/09/2026): letture e scritture su Supabase. Le regole
// stanno in lib/cambiaCliente (pure, con i test); qui solo le chiamate.
import { supabase } from './supabase'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { ricordaStruttura } from './provenienzaDati'
import {
  campiCambioCliente, filtroCambioCliente, filtraClienti, salvaCambioCliente, messaggioCreazioneCliente,
  type ClienteBreve, type PrenotazionePerCambio, type CampiNuovoCliente,
} from './cambiaCliente'

// Clienti che somigliano al testo (nome o cifre del telefono), letti dal
// server e poi filtrati con la stessa regola della ricerca locale; il cliente
// attuale non compare mai. Con testo vuoto: gli ultimi creati.
export async function cercaClientiPerCambio(testo: string, escludiId: string | null | undefined): Promise<{ clienti: ClienteBreve[]; errore: string | null }> {
  const q = testo.trim()
  const cifre = q.replace(/\D/g, '')
  let query = supabase.from('guests').select('id, full_name, phone, provenienza, struttura_nome')
  if (q && cifre.length >= 3) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${cifre}%`)
  else if (q) query = query.ilike('full_name', `%${q}%`)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(q ? 30 : 12)
  if (error) return { clienti: [], errore: messaggioLetturaNonRiuscita(error, 'cercare i clienti') }
  const righe = (data || []) as ClienteBreve[]
  // Senza testo l'ordine resta «ultimi creati»; col testo, per nome
  return { clienti: q ? filtraClienti(q, righe, escludiId) : righe.filter(c => c.id !== escludiId), errore: null }
}

// Cliente nuovo: una riga in guests (telefono UNIQUE → messaggio dedicato).
// Un nome di struttura nuovo entra nell'elenco, come in /nuova.
export async function creaClienteNuovo(campi: CampiNuovoCliente, struttureNote: { nome: string }[]): Promise<{ cliente: ClienteBreve; errore: null } | { cliente: null; errore: string }> {
  let risposta: { data: ClienteBreve | null; error: { code?: string; message?: string } | null }
  try {
    risposta = await supabase.from('guests').insert(campi).select('id, full_name, phone, provenienza, struttura_nome').single()
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
