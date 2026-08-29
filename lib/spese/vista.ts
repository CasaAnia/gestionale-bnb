// ============================================================================
// VISTA SPESE (Fase 3.1) — il contratto dati del nuovo guscio.
//
// Il guscio (components/spese/SpeseShell) NON parla con Supabase: riceve
// questi tipi già pronti. Nella preview /nuove-spese arrivano dati sintetici;
// quando le pagine vere adotteranno il guscio, un adattatore costruirà le
// stesse strutture dai dati reali. Regola chiave: in "Movimenti" UNA voce =
// UN documento (lo scontrino misto è un movimento solo, con le spese
// sorelle dentro), mai una riga per spesa.
// ============================================================================

// Stato generico dei dati che il guscio sa disegnare: mentre arrivano,
// se qualcosa va storto, o pronti.
export type StatoDati<T> =
  | { stato: 'caricamento' }
  | { stato: 'errore'; messaggio: string }
  | { stato: 'pronto'; dati: T }

export type Contesto = 'mia' | 'ania'

// ---------------------------------------------------------------------------
// Movimenti — una voce per documento (o per spesa manuale senza documento)
// ---------------------------------------------------------------------------
export type StatoMovimento =
  | 'senza_documento'   // spesa manuale
  | 'da_controllare'    // documento in revisione
  | 'confermato'
  | 'da_pagare'         // fattura approvata, denaro non ancora uscito
  | 'pagata'
  | 'scartato'

export type RigaMovimentoVista = {
  nome: string
  importo: number
  contesto: Contesto
  dubbio?: string       // es. "importo poco leggibile"
}

export type MovimentoVista = {
  id: string
  titolo: string
  negozio?: string
  giorno: string        // etichetta leggibile: "Oggi", "Mar 26"
  mese: string          // "Agosto", "Luglio" — per il filtro periodo
  importo: number       // totale del documento
  categoria: string     // categoria prevalente, per icona e filtro
  contesto: Contesto | 'misto'
  persona: string       // "Casa", "Ania", "Teo", "A + M"
  metodo?: string       // "Contanti", "Carta", "Bonifico", "Carta attività"
  camera?: string       // solo Casa Ania
  stato: StatoMovimento
  sorelle?: { contesto: Contesto; importo: number }[]  // scontrino misto
  righe?: RigaMovimentoVista[]                          // dettaglio espandibile
  dubbio?: string       // avviso a livello di documento
  senzaFoto?: boolean
}

// ---------------------------------------------------------------------------
// Documenti — per stato del ciclo di vita (schema 0020)
// ---------------------------------------------------------------------------
export type StatoDocumento =
  | 'da_elaborare' | 'da_controllare' | 'da_pagare'
  | 'pagata' | 'confermato' | 'scartato' | 'errore'

export type DocumentoVista = {
  id: string
  titolo: string
  tipo: 'scontrino' | 'fattura'
  stato: StatoDocumento
  importo?: number
  giorno?: string
  scade?: string        // solo fatture da pagare
  pagine?: number
  dubbi?: number        // campi dubbi in revisione
  senzaFoto?: boolean   // documento registrato senza fotografia
  motivo?: string       // per errori e scarti
}

// ---------------------------------------------------------------------------
// Panoramiche
// ---------------------------------------------------------------------------
export type PanoramicaMiaVista = {
  mese: string
  speso: number
  confrontoPct: number | null       // vs mese precedente, null = non calcolabile
  daControllare: { n: number; tot: number }
  budget: { nome: string; speso: number; tetto: number }[]
  ripetute: { frase: string; tot: number; esempio: string } | null
  categorie: { nome: string; tot: number }[]
  teo: { tot: number; voci: [string, number][] } | null
}

export type PanoramicaAniaVista = {
  mese: string
  speso: number                     // denaro uscito davvero
  impegnato: { tot: number; n: number }
  scadenze: { fornitore: string; importo: number; scade: string; giorni: number }[]
  fattureDaControllare: number
  metodi: { nome: string; quota: number }[]
}

export type DatiSpese = {
  mia: PanoramicaMiaVista
  ania: PanoramicaAniaVista
  movimenti: MovimentoVista[]
  documenti: DocumentoVista[]
}

// ---------------------------------------------------------------------------
// Filtri — semplici, pensati per il telefono
// ---------------------------------------------------------------------------
export type FiltriSpese = {
  periodo: string          // 'Agosto' | 'Luglio' | 'Anno'
  persona: string          // 'Tutti' | 'Casa' | 'Ania' | 'Teo' | 'A + M'
  categoria: string        // 'Tutte' | nome categoria
  ambito: string           // 'Tutti' | 'Casa Mia' | 'Casa Ania' | 'Misti'
  metodo: string           // 'Tutti' | 'Contanti' | 'Carta' | 'Bonifico' | 'Carta attività'
  stato: string            // 'Tutti' | etichetta di STATI_FILTRO
}

export const FILTRI_INIZIALI: FiltriSpese = {
  periodo: 'Agosto', persona: 'Tutti', categoria: 'Tutte',
  ambito: 'Tutti', metodo: 'Tutti', stato: 'Tutti',
}

// etichetta leggibile → stati di movimento corrispondenti
export const STATI_FILTRO: Record<string, StatoMovimento[]> = {
  'Da controllare': ['da_controllare'],
  'Da pagare': ['da_pagare'],
  'Confermati': ['confermato', 'pagata', 'senza_documento'],
}

// i filtri diversi dal valore iniziale, come coppie [chiave, valore]
export function filtriAttivi(f: FiltriSpese): [keyof FiltriSpese, string][] {
  return (Object.keys(FILTRI_INIZIALI) as (keyof FiltriSpese)[])
    .filter(k => f[k] !== FILTRI_INIZIALI[k])
    .map(k => [k, f[k]])
}

export function applicaFiltri(movimenti: MovimentoVista[], f: FiltriSpese, cerca = ''): MovimentoVista[] {
  const testo = cerca.trim().toLowerCase()
  return movimenti.filter(m => {
    if (f.periodo !== 'Anno' && m.mese !== f.periodo) return false
    if (f.persona !== 'Tutti' && m.persona !== f.persona) return false
    if (f.categoria !== 'Tutte' && m.categoria !== f.categoria) return false
    if (f.ambito === 'Casa Mia' && !(m.contesto === 'mia' || m.contesto === 'misto')) return false
    if (f.ambito === 'Casa Ania' && !(m.contesto === 'ania' || m.contesto === 'misto')) return false
    if (f.ambito === 'Misti' && m.contesto !== 'misto') return false
    if (f.metodo !== 'Tutti' && m.metodo !== f.metodo) return false
    if (f.stato !== 'Tutti' && !(STATI_FILTRO[f.stato] ?? []).includes(m.stato)) return false
    if (testo && !`${m.titolo} ${m.negozio ?? ''} ${m.categoria}`.toLowerCase().includes(testo)) return false
    return true
  })
}

// importi: interi senza decimali, altrimenti due decimali, stile "1.247,60 €".
// Formato scritto a mano (niente toLocaleString): identico su server, browser
// e nei test, anche dove i dati di localizzazione sono ridotti.
export function eurVista(n: number): string {
  const cent = Math.round(Math.abs(n) * 100)
  const interi = Math.floor(cent / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const dec = cent % 100
  const corpo = dec ? `${interi},${dec.toString().padStart(2, '0')}` : interi
  return (n < 0 ? '−' : '') + corpo + ' €'
}
