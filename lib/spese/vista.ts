// ============================================================================
// VISTA SPESE (Fase 3.1 → 3.2A) — il contratto dati del nuovo guscio.
//
// Il guscio (components/spese/SpeseShell) NON parla con Supabase: riceve
// questi tipi già pronti. Li costruisce l'adattatore (lib/spese/adattatore.ts)
// dai dati reali, oppure i dati sintetici nella preview. Regole chiave:
//  · in "Movimenti" UNA voce = UN documento (lo scontrino misto è un
//    movimento solo, con le spese sorelle dentro), mai una riga per spesa;
//  · un documento può toccare PIÙ categorie, persone e camere: la vista
//    porta gli INSIEMI veri (per i filtri) e una categoria principale solo
//    per titolo e icona;
//  · date ISO e periodi con identificatore stabile (agosto 2025 ≠ 2026).
// ============================================================================

// Stato generico dei dati che il guscio sa disegnare.
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

// Ogni riga porta ciò che serve per capirla e filtrarla: ambito, categoria,
// sottocategoria, persona/gruppo e camera. La divisione riga per riga dello
// scontrino non si perde mai.
export type RigaMovimentoVista = {
  nome: string
  importo: number
  contesto: Contesto            // ambito della riga
  categoria?: string
  sottocategoria?: string
  persona?: string              // etichetta del gruppo (Casa, Ania, Teo, M e A)
  camera?: string               // solo righe aziendali; assente = Generale
  dubbio?: string               // motivo del dubbio (confidence sotto soglia)
  // dettagli per la revisione (Fase 4) — l'adattatore li porta già oggi
  nomeGrezzo?: string           // testo letto dall'OCR prima della pulizia
  quantita?: number
  prezzoUnitario?: number
  sconto?: number
  necessita?: string            // 'necessario' | 'discrezionale'
  pianificazione?: string       // 'previsto' | 'impulsivo'
  arrotondamento?: boolean      // riga di rettifica: fuori dalle analisi
  esclusa?: boolean             // audit: resta visibile, MAI nei conti
  aggiuntaUtente?: boolean      // riga aggiunta a mano in revisione
}

export type MovimentoVista = {
  id: string
  titolo: string
  negozio?: string
  data: string          // ISO YYYY-MM-DD (per periodi e ordinamenti)
  giorno: string        // etichetta leggibile: "Oggi", "26 ago"
  importo: number       // totale del documento
  categoria: string     // categoria PRINCIPALE, solo per icona e titolo
  contesto: Contesto | 'misto'
  persona: string       // etichetta principale, per la riga
  metodo?: string       // etichetta di pagamento principale, per la riga
  stato: StatoMovimento
  // insiemi REALI ricavati da spese e righe: i filtri trovano il documento
  // se ALMENO UNA riga/spesa corrisponde
  categorie: string[]
  sottocategorie: string[]
  persone: string[]     // solo dai gruppi personali
  camere: string[]      // solo dalle spese aziendali; 'Generale' = senza camera
  metodi: string[]
  // scontrino misto: quote per ambito. La quota può essere legittimamente
  // ZERO (es. tutte le righe personali escluse): resta esplicita, mai
  // sottintesa. L'arrotondamento della sorella è già DENTRO l'importo,
  // e viene riportato a parte per mostrarlo nel dettaglio.
  sorelle?: { contesto: Contesto; importo: number; arrotondamento?: number }[]
  righe?: RigaMovimentoVista[]                          // dettaglio espandibile
  dubbio?: string       // es. "2 campi dubbi"
  avviso?: string       // problema BLOCCANTE dentro un documento in revisione
  arrotondamentoCent?: number
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
  tipo: 'scontrino' | 'fattura' | 'altro'
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
  ritmo: { mediaGiorno: number; previsione: number } | null   // solo mese corrente
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
  budget: { nome: string; speso: number; tetto: number }[]
  ritmo: { mediaGiorno: number; previsione: number } | null   // solo mese corrente
}

// ---------------------------------------------------------------------------
// Periodi — identificatore STABILE separato dall'etichetta leggibile.
// Mese, Anno, Settimana e Dal–al come nel gestionale attuale.
// (L'anno scolastico resta per la fase dedicata.)
// ---------------------------------------------------------------------------
export type PeriodoVista = {
  id: string            // stabile: '2026-08', '2026', '2026-s35', 'intervallo'
  etichetta: string     // leggibile: 'Agosto 2026', 'Anno 2026', 'Questa settimana', 'Dal–al…'
  tipo: 'mese' | 'anno' | 'settimana' | 'intervallo'
  dal: string           // ISO, incluso ('' per l'intervallo da compilare)
  al: string            // ISO, incluso
}

// Opzioni offerte dai filtri: arrivano dai DATI (l'adattatore le costruisce
// dal database; nella preview stanno nei dati sintetici), mai liste rigide
// scritte nei componenti.
export type OpzioniFiltri = {
  periodi: PeriodoVista[]  // il primo è il periodo iniziale
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
    // la quota può essere ZERO (esplicita); una quota MANCANTE è un dato
    // incompleto e vale 0 — mai il totale del documento, che gonfierebbe
    // l'elenco dell'ambito (controllaMisto segnala l'incompletezza)
    return m.sorelle?.find(s => s.contesto === contesto)?.importo ?? 0
  }
  return m.importo
}

// Controllo dello scontrino misto: quote per ambito presenti e somma quote
// = totale documento, al centesimo. Ritorna l'elenco dei problemi (vuoto=ok).
export function controllaMisto(m: MovimentoVista): string[] {
  const problemi: string[] = []
  if (m.contesto !== 'misto') return problemi
  if (!m.sorelle || m.sorelle.length === 0) { problemi.push('misto senza quote per ambito'); return problemi }
  for (const c of ['mia', 'ania'] as const) {
    if (!m.sorelle.some(q => q.contesto === c))
      problemi.push(`quota ${c === 'mia' ? 'Casa Mia' : 'Casa Ania'} mancante (deve esserci, anche se zero)`)
  }
  const cent = (n: number) => Math.round(n * 100)
  const somma = m.sorelle.reduce((s, q) => s + cent(q.importo), 0)
  if (somma !== cent(m.importo)) problemi.push(`somma quote ${somma} ≠ totale ${cent(m.importo)} (centesimi)`)
  const ambiti = m.sorelle.map(q => q.contesto)
  if (new Set(ambiti).size !== ambiti.length) problemi.push('quote duplicate per lo stesso ambito')
  if (m.righe) {
    // le righe ESCLUSE sono audit: fuori da quadratura e quote
    const attive = m.righe.filter(r => !r.esclusa)
    const daRighe = attive.reduce((s, r) => s + cent(r.importo), 0) + (m.arrotondamentoCent ?? 0)
    if (daRighe !== cent(m.importo)) problemi.push(`somma righe ${daRighe} ≠ totale ${cent(m.importo)} (centesimi)`)
  }
  return problemi
}

// ---------------------------------------------------------------------------
// Filtri — semplici, pensati per il telefono. Ogni contesto ha il SUO stato
// dei filtri (il guscio ne tiene due): niente contaminazioni tra ambiti.
// ---------------------------------------------------------------------------
export type FiltriSpese = {
  periodo: string          // id di un PeriodoVista tra opzioni.periodi
  dal: string              // solo per il periodo 'intervallo' (ISO, '' = aperto)
  al: string               // idem
  persona: string          // 'Tutti' | voce di opzioni.persone — usato SOLO in Casa Mia
  camera: string           // 'Tutte' | voce di opzioni.camere — usato SOLO in Casa Ania
  categoria: string        // 'Tutte' | voce di opzioni.categorie
  metodo: string           // 'Tutti' | voce di opzioni.metodi
  stato: string            // 'Tutti' | etichetta di STATI_FILTRO
  soloMisti: boolean       // l'unica scelta d'ambito utile qui: il selettore in alto fa il resto
}

export function filtriIniziali(opzioni: OpzioniFiltri): FiltriSpese {
  return {
    periodo: opzioni.periodi[0]?.id ?? 'intervallo', dal: '', al: '',
    persona: 'Tutti', camera: 'Tutte', categoria: 'Tutte', metodo: 'Tutti',
    stato: 'Tutti', soloMisti: false,
  }
}

// etichetta leggibile → stati di movimento corrispondenti
export const STATI_FILTRO: Record<string, StatoMovimento[]> = {
  'Da controllare': ['da_controllare'],
  'Da pagare': ['da_pagare'],
  'Confermati': ['confermato', 'pagata', 'senza_documento'],
}

// l'intervallo di date del periodo scelto (ISO inclusivi; '' = senza limite)
export function intervalloDelPeriodo(f: FiltriSpese, periodi: PeriodoVista[]): { dal: string; al: string } {
  const p = periodi.find(x => x.id === f.periodo)
  if (!p) return { dal: '', al: '' }
  if (p.tipo === 'intervallo') return { dal: f.dal, al: f.al }
  return { dal: p.dal, al: p.al }
}

// i filtri diversi dal valore iniziale, come coppie [chiave, etichetta]
export function filtriAttivi(f: FiltriSpese, iniziali: FiltriSpese, periodi: PeriodoVista[] = []): [keyof FiltriSpese, string][] {
  return (Object.keys(iniziali) as (keyof FiltriSpese)[])
    .filter(k => k !== 'dal' && k !== 'al' && f[k] !== iniziali[k])
    .map(k => [k,
      k === 'soloMisti' ? 'Solo documenti misti'
        : k === 'periodo' ? (periodi.find(p => p.id === f.periodo)?.etichetta ?? String(f[k]))
          : String(f[k]),
    ])
}

export function applicaFiltri(movimenti: MovimentoVista[], f: FiltriSpese, contesto: Contesto, periodi: PeriodoVista[], cerca = ''): MovimentoVista[] {
  const testo = cerca.trim().toLowerCase()
  const { dal, al } = intervalloDelPeriodo(f, periodi)
  return perContesto(movimenti, contesto).filter(m => {
    if (dal && m.data < dal) return false
    if (al && m.data > al) return false
    // insiemi: il documento passa se ALMENO UNA riga/spesa corrisponde.
    // "Di chi" ha senso solo in Casa Mia; "Camera" solo in Casa Ania.
    if (contesto === 'mia' && f.persona !== 'Tutti' && !m.persone.includes(f.persona)) return false
    if (contesto === 'ania' && f.camera !== 'Tutte' && !m.camere.includes(f.camera)) return false
    if (f.categoria !== 'Tutte' && !m.categorie.includes(f.categoria)) return false
    if (f.metodo !== 'Tutti' && !m.metodi.includes(f.metodo)) return false
    if (f.stato !== 'Tutti' && !(STATI_FILTRO[f.stato] ?? []).includes(m.stato)) return false
    if (f.soloMisti && m.contesto !== 'misto') return false
    if (testo && !`${m.titolo} ${m.negozio ?? ''} ${m.categorie.join(' ')}`.toLowerCase().includes(testo)) return false
    return true
  })
}

// I gruppi del dettaglio di un movimento: per il misto un gruppo per ambito,
// altrimenti uno solo. Il subtotale del gruppo = righe ATTIVE + arrotondamento
// della sorella (nelle bozze; nelle definitive l'arrotondamento è già una riga
// e qui arrotondamento=0: niente doppio conteggio). Subtotali e quote
// coincidono sempre.
export type GruppoDettaglio = {
  nome: string | null            // 'Casa Mia' | 'Casa Ania' | null (non misto)
  righe: RigaMovimentoVista[]
  arrotondamento: number         // in euro, già compreso nel subtotale
  subtotale: number              // = quota della sorella per i misti
}
export function gruppiDettaglio(m: MovimentoVista): GruppoDettaglio[] {
  if (!m.righe) return []
  const cent = (n: number) => Math.round(n * 100)
  const gruppo = (nome: string | null, righe: RigaMovimentoVista[], arrCent: number): GruppoDettaglio => ({
    nome, righe,
    arrotondamento: arrCent / 100,
    subtotale: (righe.filter(r => !r.esclusa).reduce((s, r) => s + cent(r.importo), 0) + arrCent) / 100,
  })
  if (m.contesto !== 'misto') return [gruppo(null, m.righe, m.arrotondamentoCent ?? 0)]
  return ([['mia', 'Casa Mia'], ['ania', 'Casa Ania']] as const)
    .map(([c, nome]) => gruppo(nome,
      m.righe!.filter(r => r.contesto === c),
      Math.round((m.sorelle?.find(q => q.contesto === c)?.arrotondamento ?? 0) * 100)))
    .filter(g => g.righe.length > 0 || g.arrotondamento !== 0)
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
