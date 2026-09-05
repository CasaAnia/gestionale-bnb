// ============================================================================
// STATISTICHE — FONDAMENTA (blocco 4, 04/09/2026): tipi di ingresso delle
// funzioni pure. Nessuna query nuova: sono le colonne che le pagine leggono già
// (bookings, payments, rooms, family_expenses, richieste, family_documents).
// Denaro SEMPRE in centesimi interi. Regola già decisa da Ania (24/07/2026):
// gli incassi si contano per CASSA (quando i soldi arrivano), i ricavi per
// camera per COMPETENZA (notti dormite): i due totali non coincidono ed è voluto.
// ============================================================================

export type PrenotazioneStat = {
  id: string
  group_id?: string | null
  room_id: string
  check_in: string            // YYYY-MM-DD
  check_out: string
  status: string              // confermata | completata | in_attesa | annullata
  total_amount: number | string | null
  pagato?: boolean | null
  bonifico?: boolean | null
  num_guests?: number | string | null
  guest_name?: string | null
}

export type PagamentoStat = { booking_id: string; amount: number | string; paid_on: string | null }

export type CameraStat = { id: string; name: string; active?: boolean | null }

// Camera FUORI SERVIZIO in un periodo [da, a): oggi non esiste una tabella; la
// struttura è definita qui e vuota (TODO: tabella `room_closures` o campo in
// `rooms`, da decidere con Ania). Riduce le notti disponibili.
export type FuoriServizio = { room_id: string; da: string; a: string; motivo?: string | null }
export const FUORI_SERVIZIO_VUOTO: FuoriServizio[] = []

export type SpesaStat = { expense_date: string; amount: number | string; paid_at?: string | null }

export type RichiestaStat = {
  id: string
  created_at: string
  stato: string               // in_attesa | proposta_inviata | confermata | rifiutata
  canale: string              // web | telefono | whatsapp
  origine?: string | null
  motivo_rifiuto?: string | null
  proposta_inviata_at?: string | null
  chiusa_at?: string | null
  arrivo: string
  partenza: string
  proposta_soluzione?: { manuale?: boolean; segmenti?: { prezzo_manuale?: boolean }[] } | null
}

export type DocumentoStat = { id: string; kind: string; status: string; due_date: string | null; doc_total: number | string | null; supplier?: string | null }

// Denaro: da euro (numero/stringa del database) a centesimi interi
export const cent = (n: number | string | null | undefined): number => {
  const v = Number(n)
  return Number.isFinite(v) ? Math.round(v * 100) : 0
}

// Gli stati che contano davvero: mai una prenotazione o una richiesta «in attesa»
export const STATI_PRENOTAZIONE_VALIDI = new Set(['confermata', 'completata'])
export const prenotazioneValida = (b: { status: string }) => STATI_PRENOTAZIONE_VALIDI.has(b.status)
