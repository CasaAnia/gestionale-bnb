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
  contesto: Contesto | 'misto'   // il misto appare in ENTRAMBI gli ambiti, come un solo documento
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
  costiCamere: { nome: string; tot: number }[]   // per l'Analisi aziendale
  andamento: number[]                            // spesa degli ultimi mesi, per il grafico
}

// Opzioni offerte dai filtri: arrivano dai DATI (l'adattatore le costruisce
// dal database; nella preview stanno nei dati sintetici), mai liste rigide
// scritte nei componenti.
export type OpzioniFiltri = {
  periodi: string[]        // es. ['Agosto', 'Luglio', 'Anno'] — il primo è il periodo iniziale
  persone?: string[]       // SOLO Casa Mia (es. ['Casa', 'Ania', 'Teo', 'M e A'])
  camere?: string[]        // SOLO Casa Ania (es. ['Generale', 'Amelia', 'Allegra', 'Ambra', 'Lena'])
  categorie: string[]
  metodi: string[]
}

export type DatiSpese = {
  mia: PanoramicaMiaVista
  ania: PanoramicaAniaVista
  movimenti: MovimentoVista[]
  documenti: DocumentoVista[]
  opzioni: { mia: OpzioniFiltri; ania: OpzioniFiltri }
}

// ---------------------------------------------------------------------------
// Il CONTESTO è un confine reale: Casa Mia = personale + misti,
// Casa Ania = azienda + misti. Un documento misto appare in entrambi,
// sempre come UNA sola voce.
// ---------------------------------------------------------------------------
export function perContesto(movimenti: MovimentoVista[], contesto: Contesto): MovimentoVista[] {
  const escluso = contesto === 'mia' ? 'ania' : 'mia'
  return movimenti.filter(m => m.contesto !== escluso)
}
export function perContestoDocumenti(documenti: DocumentoVista[], contesto: Contesto): DocumentoVista[] {
  const escluso = contesto === 'mia' ? 'ania' : 'mia'
  return documenti.filter(d => d.contesto !== escluso)
}

// Importo principale di un movimento DENTRO un contesto: per il misto è la
// quota di quel contesto (così l'elenco si può sommare senza falsare i
// totali); per gli altri è l'importo del documento.
export function importoNelContesto(m: MovimentoVista, contesto: Contesto): number {
  if (m.contesto === 'misto') {
    const quota = m.sorelle?.find(s => s.contesto === contesto)
    if (quota) return quota.importo
  }
  return m.importo
}

// ---------------------------------------------------------------------------
// Filtri — semplici, pensati per il telefono. Ogni contesto ha il SUO stato
// dei filtri (il guscio ne tiene due): niente contaminazioni tra ambiti.
// ---------------------------------------------------------------------------
export type FiltriSpese = {
  periodo: string          // una voce di opzioni.periodi
  persona: string          // 'Tutti' | voce di opzioni.persone — usato SOLO in Casa Mia
  camera: string           // 'Tutte' | voce di opzioni.camere — usato SOLO in Casa Ania
  categoria: string        // 'Tutte' | voce di opzioni.categorie
  metodo: string           // 'Tutti' | voce di opzioni.metodi
  stato: string            // 'Tutti' | etichetta di STATI_FILTRO
  soloMisti: boolean       // l'unica scelta d'ambito utile qui: il selettore in alto fa il resto
}

export function filtriIniziali(opzioni: OpzioniFiltri): FiltriSpese {
  return {
    periodo: opzioni.periodi[0] ?? 'Anno', persona: 'Tutti', camera: 'Tutte',
    categoria: 'Tutte', metodo: 'Tutti', stato: 'Tutti', soloMisti: false,
  }
}

// etichetta leggibile → stati di movimento corrispondenti
export const STATI_FILTRO: Record<string, StatoMovimento[]> = {
  'Da controllare': ['da_controllare'],
  'Da pagare': ['da_pagare'],
  'Confermati': ['confermato', 'pagata', 'senza_documento'],
}

// i filtri diversi dal valore iniziale, come coppie [chiave, etichetta]
export function filtriAttivi(f: FiltriSpese, iniziali: FiltriSpese): [keyof FiltriSpese, string][] {
  return (Object.keys(iniziali) as (keyof FiltriSpese)[])
    .filter(k => f[k] !== iniziali[k])
    .map(k => [k, k === 'soloMisti' ? 'Solo documenti misti' : String(f[k])])
}

export function applicaFiltri(movimenti: MovimentoVista[], f: FiltriSpese, contesto: Contesto, cerca = ''): MovimentoVista[] {
  const testo = cerca.trim().toLowerCase()
  return perContesto(movimenti, contesto).filter(m => {
    if (f.periodo !== 'Anno' && m.mese !== f.periodo) return false
    // "Di chi" ha senso solo in Casa Mia; "Camera" solo in Casa Ania
    if (contesto === 'mia' && f.persona !== 'Tutti' && m.persona !== f.persona) return false
    if (contesto === 'ania' && f.camera !== 'Tutte' && (m.camera ?? 'Generale') !== f.camera) return false
    if (f.categoria !== 'Tutte' && m.categoria !== f.categoria) return false
    if (f.metodo !== 'Tutti' && m.metodo !== f.metodo) return false
    if (f.stato !== 'Tutti' && !(STATI_FILTRO[f.stato] ?? []).includes(m.stato)) return false
    if (f.soloMisti && m.contesto !== 'misto') return false
    if (testo && !`${m.titolo} ${m.negozio ?? ''} ${m.categoria}`.toLowerCase().includes(testo)) return false
    return true
  })
}

// "ad agosto", "a settembre": la d eufonica solo davanti a vocale
export function nelMese(mese: string): string {
  const minuscolo = mese.toLowerCase()
  return (/^[aeiou]/.test(minuscolo) ? 'ad ' : 'a ') + minuscolo
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
