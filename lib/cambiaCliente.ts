// ============================================================================
// CAMBIA CLIENTE su una prenotazione (06/09/2026).
//
// Il caso: Ania inserisce una prenotazione a nome della struttura che le manda
// l'ospite («Nida») perché al telefono non ha ancora i dati della persona.
// All'arrivo sposta QUELLA prenotazione su un cliente vero (esistente o nuovo)
// senza toccare la scheda della struttura, che ha altre prenotazioni, e senza
// perdere nulla della prenotazione: documenti, date, prezzo, note, letti,
// persone per notte, pagamenti restano dove sono. Cambia SOLO il riferimento
// al cliente (bookings.guest_id); il nome scritto sulla singola prenotazione
// (bookings.guest_name, «Nida») si azzera così vale il nome del cliente nuovo.
// Un soggiorno con cambio camera è fatto di più righe con lo stesso group_id:
// si spostano tutte insieme, altrimenti resterebbe diviso fra due clienti.
//
// Funzioni pure, senza Supabase: la scrittura arriva già pronta (come in
// lib/scritturaSicura) e i test la esercitano con un finto.
// ============================================================================
import { scriviPoiAggiorna, type RispostaScrittura } from './scritturaSicura.ts'
import { nomeCompleto } from './guestName.ts'
import { conIniziali } from './maiuscole.ts'
import { matchNome, matchTelefono } from './ricerca.ts'
import { normalizzaTelefono } from './whatsapp.ts'
import { campiProvenienza, strutturaNota, type Provenienza, type CampiProvenienza } from './provenienza.ts'

export type ClienteBreve = {
  id: string
  full_name?: string | null
  phone?: string | null
  provenienza?: string | null
  struttura_nome?: string | null
}

export type PrenotazionePerCambio = {
  id: string
  guest_id?: string | null
  group_id?: string | null
  guest_name?: string | null
  guests?: ClienteBreve | null
}

// ── Cosa scrivere ───────────────────────────────────────────────────────────

// Solo il riferimento al cliente. guest_name (colonna migrata a mano) si
// azzera se la riga la porta: altrimenti la scheda continuerebbe a mostrare
// «Nida» e farebbe scattare l'avviso rosso «numero già usato con un altro
// nominativo». Nessun altro campo della prenotazione entra nel payload.
export function campiCambioCliente(b: PrenotazionePerCambio, nuovoGuestId: string): { guest_id: string; guest_name?: null } {
  return 'guest_name' in b ? { guest_id: nuovoGuestId, guest_name: null } : { guest_id: nuovoGuestId }
}

// Quali righe: tutti i segmenti del soggiorno (group_id) oppure la sola riga
export function filtroCambioCliente(b: PrenotazionePerCambio): { colonna: 'group_id' | 'id'; valore: string } {
  return b.group_id ? { colonna: 'group_id', valore: b.group_id } : { colonna: 'id', valore: b.id }
}

// Stesso cliente di prima: niente da salvare
export function stessoCliente(b: PrenotazionePerCambio, nuovoGuestId: string): boolean {
  return (b.guest_id ?? b.guests?.id ?? null) === nuovoGuestId
}

// ── Avvisi (non bloccano) ───────────────────────────────────────────────────

export function avvisiCambioCliente(x: { pagamenti: number; confermaInviata: boolean; segmenti?: number; nomeVecchio?: string | null }): string[] {
  const avvisi: string[] = []
  if (x.confermaInviata) avvisi.push(`La conferma è già stata inviata${x.nomeVecchio ? ` a ${x.nomeVecchio}` : ''}: dopo il cambio ricordati di mandarla al cliente nuovo`)
  if (x.pagamenti > 0) avvisi.push(x.pagamenti === 1
    ? 'C’è già un movimento di pagamento: resta sulla prenotazione e passa al cliente nuovo'
    : `Ci sono già ${x.pagamenti} movimenti di pagamento: restano sulla prenotazione e passano al cliente nuovo`)
  if ((x.segmenti ?? 1) > 1) avvisi.push(`Il soggiorno ha un cambio camera (${x.segmenti} righe): passano tutte al cliente nuovo`)
  return avvisi
}

// ── Cliente nuovo ───────────────────────────────────────────────────────────

export type ValoreProvenienzaModulo = { provenienza: Provenienza; struttura: string }

// Provenienza da proporre per il cliente nuovo: se il cliente di partenza è
// una struttura (provenienza «Altra struttura → Nida», oppure il suo nome è
// una struttura nota) si propone «Altra struttura → quella»; altrimenti la
// sua provenienza; senza nulla, «Non so».
export function provenienzaProposta(clienteAttuale: ClienteBreve | null | undefined, strutture: { nome: string }[]): ValoreProvenienzaModulo {
  if (!clienteAttuale) return { provenienza: 'non_so', struttura: '' }
  const c = campiProvenienza(clienteAttuale.provenienza, clienteAttuale.struttura_nome)
  if (c.provenienza === 'altra_struttura' && c.struttura_nome) return { provenienza: 'altra_struttura', struttura: c.struttura_nome }
  const nota = strutturaNota((clienteAttuale.full_name ?? '').trim(), strutture)
  if (nota) return { provenienza: 'altra_struttura', struttura: nota }
  return { provenienza: c.provenienza, struttura: c.struttura_nome ?? '' }
}

export type ModuloNuovoCliente = { nome: string; cognome: string; telefono: string; provenienza: Provenienza; struttura: string }
export type CampiNuovoCliente = { full_name: string; phone: string } & Partial<CampiProvenienza>

export const ERRORE_NOME_MANCANTE = 'Scrivi almeno il nome'
export const ERRORE_TELEFONO_MANCANTE = 'Scrivi il telefono del cliente'
export const ERRORE_TELEFONO_CORTO = 'Controlla il telefono: sembra incompleto'

// Dal modulo ai campi di guests: «Nome Cognome» (prima il nome), telefono a
// sole cifre col prefisso 39 come nel resto del gestionale, provenienza solo
// se le colonne della 0037 esistono (conProvenienza).
export function nuovoClienteDaModulo(m: ModuloNuovoCliente, conProvenienza: boolean): { ok: true; campi: CampiNuovoCliente } | { ok: false; errore: string } {
  const full_name = nomeCompleto({ nome: conIniziali(m.nome), cognome: conIniziali(m.cognome) })
  if (!full_name) return { ok: false, errore: ERRORE_NOME_MANCANTE }
  const t = normalizzaTelefono(m.telefono)
  if (!t.numero) return { ok: false, errore: ERRORE_TELEFONO_MANCANTE }
  if (t.numero.length < 8) return { ok: false, errore: ERRORE_TELEFONO_CORTO }
  const campi: CampiNuovoCliente = { full_name, phone: t.numero }
  if (conProvenienza) Object.assign(campi, campiProvenienza(m.provenienza, m.struttura))
  return { ok: true, campi }
}

// Telefono già in archivio (guests.phone è UNIQUE): non è un errore di rete,
// va detto con le parole giuste
export const ERRORE_TELEFONO_DOPPIO = 'Questo telefono è già di un cliente in archivio: cercalo fra i clienti esistenti'
export function messaggioCreazioneCliente(err: { code?: string; message?: string } | null | undefined): string {
  const codice = String(err?.code ?? ''), msg = String(err?.message ?? '')
  if (codice === '23505' || /duplicate key|guests_phone_key/i.test(msg)) return ERRORE_TELEFONO_DOPPIO
  return 'Cliente non creato, riprova'
}

// ── Ricerca fra i clienti esistenti ─────────────────────────────────────────

// Filtro locale sull'elenco letto: nome (tutte le parole) o telefono (cifre),
// mai il cliente attuale; ordine per nome
export function filtraClienti<T extends ClienteBreve>(testo: string, clienti: T[], escludiId?: string | null): T[] {
  const q = testo.trim()
  return clienti
    .filter(c => c.id !== escludiId)
    .filter(c => !q || matchNome([c.full_name], q) || matchTelefono(c.phone, q))
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'it'))
}

// ── Documenti caricati sul cliente di partenza ──────────────────────────────
// I documenti (0032) stanno sul CLIENTE, non sulla prenotazione: la carta
// d'identità dell'ospite fotografata «su Nida» resterebbe su Nida. Nella
// scheda si propone di spostarli (scelta di Ania, proposta già spuntata):
// cambia solo documenti_cliente.guest_id, il file resta dov'è (le anteprime
// leggono `percorso`, non la cartella del cliente).
export function testoDocumentiDaSpostare(n: number, nomeVecchio: string | null | undefined): string | null {
  if (n <= 0) return null
  const chi = nomeVecchio ? ` su ${nomeVecchio}` : ''
  return n === 1 ? `Sposta anche il documento caricato${chi} al cliente nuovo` : `Sposta anche i ${n} documenti caricati${chi} al cliente nuovo`
}
export const MESSAGGIO_DOCUMENTI_NON_SPOSTATI = 'Prenotazione passata al cliente nuovo, ma i documenti non sono stati spostati'

// ── Salvataggio ─────────────────────────────────────────────────────────────

export const MESSAGGIO_NESSUNA_RIGA = 'Non salvato: prenotazione non trovata, ricarica la scheda'

// Scrittura con esito controllato (lib/scritturaSicura) più un controllo in
// più: l'update deve aver toccato almeno una riga (select('id') sulla
// risposta). Con zero righe (prenotazione sparita) niente cambia sullo schermo.
export async function salvaCambioCliente(
  scrivi: () => PromiseLike<RispostaScrittura & { data?: unknown[] | null }>,
  aggiorna: () => void,
): Promise<string | null> {
  let righe: unknown[] | null | undefined
  const errore = await scriviPoiAggiorna(async () => {
    const r = await scrivi()
    righe = r?.data
    return r
  }, () => {})
  if (errore) return errore
  if (Array.isArray(righe) && righe.length === 0) return MESSAGGIO_NESSUNA_RIGA
  aggiorna()
  return null
}
