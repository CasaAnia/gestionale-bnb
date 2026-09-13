// ============================================================================
// COME PAGA (13/09/2026) — un solo modo di dirlo, in tutto il gestionale.
//
// Prima la stessa cosa si chiamava «Come paga» nella proposta, «Pagamento»
// nell'inserimento e «Accordo» nella scheda, con nomi diversi per la stessa
// scelta («Pagamento completo», «intero in anticipo», «tutto anticipato»).
// Qui stanno i SEI modi con i loro nomi e le loro frasi: nessun altro file
// deve riscriverseli.
//
// I sei modi, in due gruppi:
//   QUANDO ARRIVA        Contanti · Bonifico · Da vedere
//   PRIMA DI ARRIVARE    Tutto · Caparra del 50% · Caparra
//
// La banca dati NON cambia: si continua a scrivere in `accordo_pagamento` i
// cinque valori della proposta 0041 (che ha un vincolo: o null, o uno di
// quelli). «Da vedere» è il caso in cui il mezzo non è stato detto, cioè
// quello che il gestionale salva già oggi quando non si specifica niente:
// `accordo_pagamento` vuoto e la spunta «bonifico» spenta.
// ============================================================================

export type ComePaga = 'contanti' | 'bonifico' | 'da_vedere' | 'tutto' | 'meta' | 'caparra'

export const NOME_COME_PAGA: Record<ComePaga, string> = {
  contanti: 'Contanti',
  bonifico: 'Bonifico',
  da_vedere: 'Da vedere',
  tutto: 'Tutto',
  meta: 'Caparra del 50%',
  caparra: 'Caparra',
}

// La riga sotto le pastiglie: come si dice per esteso
export const FRASE_COME_PAGA: Record<ComePaga, string> = {
  contanti: 'paga tutto in contanti quando arriva',
  bonifico: 'paga tutto con bonifico quando arriva',
  da_vedere: 'paga tutto quando arriva, contanti o bonifico',
  tutto: 'paga tutto in anticipo con bonifico',
  meta: 'caparra del 50%, il resto all’arrivo',
  caparra: 'caparra, il resto all’arrivo',
}

export type GruppoComePaga = { id: 'arrivo' | 'prima'; etichetta: string; modi: ComePaga[] }
export const GRUPPI_COME_PAGA: GruppoComePaga[] = [
  { id: 'arrivo', etichetta: 'Quando arriva', modi: ['contanti', 'bonifico', 'da_vedere'] },
  { id: 'prima', etichetta: 'Prima di arrivare', modi: ['tutto', 'meta', 'caparra'] },
]
export const MODI_COME_PAGA: ComePaga[] = GRUPPI_COME_PAGA.flatMap(g => g.modi)

// Con queste due si chiede anche quando è attesa (data e ora)
export const chiedeScadenza = (modo: ComePaga) => modo === 'meta' || modo === 'caparra'
// Solo la caparra decisa da Ania ha un importo da scrivere a mano
export const chiedeImporto = (modo: ComePaga) => modo === 'caparra'

// ── Dal database ai sei modi ────────────────────────────────────────────────
// Niente valore salvato: se la spunta «bonifico» è accesa il mezzo lo sappiamo,
// altrimenti non è stato detto → «Da vedere».
export function comePagaSalvato(accordo: string | null | undefined, bonifico?: boolean | null): ComePaga {
  switch ((accordo ?? '').trim()) {
    case 'contanti': return 'contanti'
    case 'bonifico_arrivo': return 'bonifico'
    case 'bonifico_intero': return 'tutto'
    case 'caparra_meta': return 'meta'
    case 'caparra_libera': return 'caparra'
    default: return bonifico ? 'bonifico' : 'da_vedere'
  }
}

// ── Dai sei modi al database ────────────────────────────────────────────────
export const ACCORDO_SALVATO: Record<ComePaga, string | null> = {
  contanti: 'contanti',
  bonifico: 'bonifico_arrivo',
  da_vedere: null,
  tutto: 'bonifico_intero',
  meta: 'caparra_meta',
  caparra: 'caparra_libera',
}
// La vecchia spunta resta coerente: acceso vuol dire «arriva un bonifico»
export const bonificoDelModo = (modo: ComePaga) => modo !== 'contanti' && modo !== 'da_vedere'

export type CampiComePaga = {
  accordo_pagamento: string | null
  caparra_centesimi: number | null
  caparra_entro: string | null
  bonifico: boolean
}

/**
 * I campi da scrivere su bookings. La caparra del 50% è la metà del totale
 * fotografata adesso (come fa già l'inserimento); la caparra libera è quella
 * scritta a mano. Senza caparra i due campi tornano vuoti, come vuole il
 * vincolo della proposta 0041.
 */
export function campiComePaga(modo: ComePaga, dati: { totaleCent?: number | null; importoCent?: number | null; entro?: string | null }): CampiComePaga {
  const caparra = modo === 'meta'
    ? (dati.totaleCent != null && dati.totaleCent > 0 ? Math.round(dati.totaleCent / 2) : null)
    : modo === 'caparra'
      ? (dati.importoCent != null && dati.importoCent > 0 ? Math.round(dati.importoCent) : null)
      : null
  return {
    accordo_pagamento: ACCORDO_SALVATO[modo],
    caparra_centesimi: caparra,
    caparra_entro: chiedeScadenza(modo) ? (dati.entro ?? null) : null,
    bonifico: bonificoDelModo(modo),
  }
}

// ── Le due righe che si leggono in giro ─────────────────────────────────────
/** «Caparra del 50%» — il nome corto, per la riga del conto e i riepiloghi */
export const nomeComePaga = (modo: ComePaga) => NOME_COME_PAGA[modo]
/** «caparra del 50%, il resto all'arrivo» — la frase per esteso */
export const fraseComePaga = (modo: ComePaga) => FRASE_COME_PAGA[modo]
/** Quello che si legge quando si parte dai campi salvati */
export function comePagaInParole(accordo: string | null | undefined, bonifico?: boolean | null): { nome: string; frase: string } {
  const modo = comePagaSalvato(accordo, bonifico)
  return { nome: NOME_COME_PAGA[modo], frase: FRASE_COME_PAGA[modo] }
}
