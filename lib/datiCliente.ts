// ============================================================================
// I DATI DELLA CLIENTE (16/09/2026) — la logica pura del foglio «Dati della
// cliente» della scheda nuova e del cliente nuovo dell'inserimento.
//
// Il modulo è lo stesso dell'inserimento (components/nuova/NuovoCliente):
// nome e cognome, telefono, ricevuta, valutazione col motivo, come ci ha
// trovato con le strutture, la nota. Qui si passa dal modulo ai campi di
// `guests` e viceversa, con le regole già scritte altrove: nomeCompleto per
// mettere insieme nome e cognome e le maiuscole (nomeDaSalvare, regola fissa n. 1),
// normalizzaTelefono per il numero, payloadValutazione per le tre voci e la
// ricevuta (prima e dopo la 0038), campiProvenienza per la provenienza.
// Niente Supabase: la scrittura la fa il foglio.
// ============================================================================
import { nomeDaSalvare, spezzaNome } from './guestName.ts'
import { normalizzaTelefono, numeroUsabile } from './whatsapp.ts'
import { valutazioneDi, vuoleRicevuta, payloadValutazione, type Valutazione } from './valutazione.ts'
import { normalizzaProvenienza, campiProvenienza, type Provenienza } from './provenienza.ts'

export const TITOLO_DATI_CLIENTE = 'Dati della cliente'
export const AVVISO_TUTTI_I_SOGGIORNI = 'Questi dati sono della cliente: valgono per tutti i suoi soggiorni, non solo per questo.'
export const SENZA_TELEFONO = 'Il numero di telefono è obbligatorio: senza non si può né chiamare né scrivere.'
export const SENZA_NOME = 'Della cliente serve il nome.'

export type ModuloCliente = {
  nome: string
  cognome: string
  telefono: string
  /** può restare vuota (17/09/2026): guests.email, prima solo nella scheda attuale */
  email: string
  ricevuta: boolean
  valutazione: Valutazione
  motivo: string
  provenienza: Provenienza | null
  struttura: string
  note: string
}

export type ClienteSalvato = {
  id?: string
  full_name?: string | null
  phone?: string | null
  email?: string | null
  rating?: string | null
  vuole_ricevuta?: boolean | null
  notes?: string | null
  motivo_problematico?: string | null
  provenienza?: string | null
  struttura_nome?: string | null
}

// ── Dal cliente salvato al modulo ──────────────────────────────────────────
export function moduloDaCliente(c: ClienteSalvato | null | undefined): ModuloCliente {
  const { nome, cognome } = spezzaNome(c?.full_name)
  return {
    nome, cognome,
    telefono: (c?.phone ?? '').trim(),
    email: (c?.email ?? '').trim(),
    ricevuta: vuoleRicevuta(c),
    valutazione: valutazioneDi(c),
    motivo: (c?.motivo_problematico ?? '').trim(),
    provenienza: c?.provenienza ? normalizzaProvenienza(c.provenienza) : null,
    struttura: (c?.struttura_nome ?? '').trim(),
    note: (c?.notes ?? '').trim(),
  }
}

// ── Dal modulo ai campi di guests ──────────────────────────────────────────
export type OpzioniCampi = {
  /** la colonna vuole_ricevuta esiste sulla riga letta (dopo la 0038) */
  colonnaRicevuta: boolean
  /** la provenienza si può scrivere (colonne della 0037 e strutture leggibili) */
  conProvenienza: boolean
}

/** I campi del cliente NUOVO, come li scrive l'inserimento (/nuova-prenotazione). */
export function campiNuovoCliente(m: ModuloCliente, conProvenienza: boolean): Record<string, unknown> {
  return {
    full_name: nomeDaSalvare({ nome: m.nome, cognome: m.cognome }),
    phone: m.telefono.replace(/\s/g, ''),
    ...(m.email.trim() ? { email: m.email.trim() } : {}),
    rating: m.valutazione,
    vuole_ricevuta: m.ricevuta,
    notes: m.note.trim() || null,
    ...(m.valutazione === 'problematico' && m.motivo.trim() ? { motivo_problematico: m.motivo.trim() } : {}),
    ...(conProvenienza && m.provenienza ? { provenienza: m.provenienza, struttura_nome: m.provenienza === 'altra_struttura' ? (m.struttura.trim() || null) : null } : {}),
  }
}

/**
 * I campi da scrivere su un cliente che ESISTE già. Il telefono si tocca solo
 * se è stato cambiato (altrimenti resta scritto com'era); il motivo interno
 * entra solo se è cambiato, così chi non ha la colonna della 0046 non si
 * blocca per niente; la provenienza solo se si può scrivere e ne è stata
 * scelta una.
 */
export function campiDaModulo(m: ModuloCliente, c: ClienteSalvato, o: OpzioniCampi): { ok: true; campi: Record<string, unknown> } | { ok: false; errore: string } {
  const full_name = nomeDaSalvare({ nome: m.nome, cognome: m.cognome })
  if (!full_name) return { ok: false, errore: SENZA_NOME }
  const telefonoDiPrima = (c.phone ?? '').trim()
  let phone = c.phone ?? null
  if (m.telefono.trim() !== telefonoDiPrima) {
    if (!numeroUsabile(m.telefono)) return { ok: false, errore: SENZA_TELEFONO }
    phone = normalizzaTelefono(m.telefono).numero
  }
  const motivo = m.valutazione === 'problematico' ? (m.motivo.trim() || null) : null
  const motivoDiPrima = (c.motivo_problematico ?? '').trim() || null
  const campi: Record<string, unknown> = {
    full_name,
    phone,
    email: m.email.trim() || null,
    notes: m.note.trim() || null,
    ...payloadValutazione(m.valutazione, m.ricevuta, o.colonnaRicevuta),
    ...(motivo !== motivoDiPrima ? { motivo_problematico: motivo } : {}),
    ...(o.conProvenienza && m.provenienza ? campiProvenienza(m.provenienza, m.struttura) : {}),
  }
  return { ok: true, campi }
}
