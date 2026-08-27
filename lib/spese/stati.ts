// Stati e transizioni del nuovo modello (Fase 2A) — la stessa macchina a
// stati dichiarata nei CHECK della 0020 e usata dalle RPC. Pura, testabile.
//
// Documento:  da_elaborare → in_revisione → confermato            (scontrini)
//             da_elaborare → in_revisione → approvata_da_pagare → confermato (fatture)
//             da_elaborare|in_revisione → errore → da_elaborare   (nuovo tentativo)
//             da_elaborare|in_revisione|errore → scartato
// Bozza:      da_controllare ↔ pronta → confermata; da_controllare|pronta → scartata

export type DocumentoStato =
  'da_elaborare' | 'in_revisione' | 'approvata_da_pagare' | 'confermato' | 'errore' | 'scartato'
export type BozzaStato = 'da_controllare' | 'pronta' | 'confermata' | 'scartata' | 'errore'

const TRANSIZIONI_DOCUMENTO: Record<DocumentoStato, DocumentoStato[]> = {
  da_elaborare: ['in_revisione', 'errore', 'scartato'],
  in_revisione: ['approvata_da_pagare', 'confermato', 'errore', 'scartato'],
  approvata_da_pagare: ['confermato'],       // solo tramite paga_fattura
  confermato: [],                            // finale: non si torna indietro
  errore: ['da_elaborare', 'scartato'],      // nuovo tentativo di elaborazione
  scartato: [],                              // finale
}

const TRANSIZIONI_BOZZA: Record<BozzaStato, BozzaStato[]> = {
  da_controllare: ['pronta', 'confermata', 'scartata'],
  pronta: ['da_controllare', 'confermata', 'scartata'],
  confermata: [],                            // finale (expense_id valorizzato)
  scartata: [],                              // finale
  errore: ['scartata'],
}

export const transizioneDocumentoValida = (da: DocumentoStato, a: DocumentoStato) =>
  TRANSIZIONI_DOCUMENTO[da]?.includes(a) ?? false

export const transizioneBozzaValida = (da: BozzaStato, a: BozzaStato) =>
  TRANSIZIONI_BOZZA[da]?.includes(a) ?? false

// Gli stati da cui la conferma/il pagamento sono ammessi (come nelle RPC)
export const CONFERMABILE_DA: DocumentoStato = 'in_revisione'
export const PAGABILE_DA: DocumentoStato = 'approvata_da_pagare'
// Bozze "attive" = quelle che la conferma trasforma in spese
export const BOZZA_ATTIVA: BozzaStato[] = ['da_controllare', 'pronta']
