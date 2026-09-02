// ============================================================================
// REVISIONE DELLE BOZZE (Fase 4, blocco 3) — logica PURA della schermata.
// Contratto (0020/0021 + piano §9):
//  · si modificano SOLO i campi di revisione consentiti dalla 0021; i campi
//    riservati (confidence, raw_name, status, expense_id, user_added) NON
//    compaiono nemmeno nei tipi delle modifiche: impossibile riscriverli;
//  · il valore ESTRATTO originale si conserva: le differenze diventano
//    CORREZIONI {field, proposed, corrected, draft_id/draft_item_id} e
//    viaggiano nella p_correzioni della RPC atomica alla conferma;
//  · quadratura ESATTA e BLOCCANTE (controlli.quadraturaDocumento): somma
//    righe attive + arrotondamenti = doc_total, differenza zero;
//  · gruppo mancante = bloccante; metodo obbligatorio per Casa Ania;
//  · necessità e pianificazione FACOLTATIVE: mai valori inventati.
// ============================================================================
import { canonicaCoerente, quadraturaDocumento, rigaCoerente, SOGLIA_CONFIDENCE } from './controlli.ts'
import { METODI_VALIDI } from './fatture.ts'

// gli UNICI campi che la 0021 consente dal browser (fonte unica per tipi,
// payload, snapshot degli originali e test):
export const CAMPI_BOZZA_REVISIONE = [
  'expense_date', 'group_id', 'category_id', 'subcategory',
  'canonical_category_id', 'canonical_subcategory_id', 'store',
  'description', 'payment_method', 'room_id', 'expense_nature',
  'arrotondamento_cent',
] as const
export const CAMPI_RIGA_REVISIONE = [
  'name', 'qty', 'unit_price', 'discount', 'amount', 'group_id',
  'category_id', 'subcategory', 'canonical_category_id',
  'canonical_subcategory_id', 'necessity', 'planning', 'excluded',
] as const
// le colonne concesse in INSERT sulle righe (0021: niente id, niente excluded)
export const CAMPI_RIGA_NUOVA = [
  'draft_id', 'name', 'qty', 'unit_price', 'discount', 'amount', 'group_id',
  'category_id', 'subcategory', 'canonical_category_id',
  'canonical_subcategory_id', 'necessity', 'planning',
] as const

// i campi del DOCUMENTO che la revisione può correggere (grant UPDATE della
// 0021 su family_documents; doc_total ha il suo canale). Per le FATTURE
// (Fase 5) sono i dati di testata — fornitore, numero, data del documento e
// scadenza — più il tipo, perché una fattura arriva come foto («scontrino»)
// o PDF («altro») e va riconosciuta in revisione. Gli ORIGINALI restano
// intatti: le differenze diventano correzioni {field, proposed, corrected}
// senza draft_id, come prevede private.registra_correzioni.
export const CAMPI_DOCUMENTO_REVISIONE = ['kind', 'supplier', 'invoice_number', 'document_date', 'due_date'] as const
export type DocumentoGrezzoRevisione = {
  kind: string
  supplier: string | null
  invoice_number: string | null
  document_date: string | null
  due_date: string | null
}
export type ModificaDocumento = Partial<DocumentoGrezzoRevisione>
export const DOCUMENTO_SENZA_TESTATA: DocumentoGrezzoRevisione =
  { kind: 'scontrino', supplier: null, invoice_number: null, document_date: null, due_date: null }

// una data ISO che ESISTE davvero (non solo col formato giusto)
export function dataIsoValida(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  const [a, m, g] = x.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g
}

export type Confidenza = Record<string, { proposto?: unknown; confidence?: number; doubt_reason?: string }>

// come arrivano da fonte.leggiTutto (bozze e righe del documento)
export type BozzaGrezza = {
  id: string; document_id: string; status: string
  expense_date: string; group_id: string | null
  category_id: string | null; subcategory: string | null
  canonical_category_id: string | null; canonical_subcategory_id: string | null
  store: string | null; description: string | null
  payment_method: string | null; room_id: string | null
  expense_nature: string | null; arrotondamento_cent: number
  confidence: Confidenza | null
}
export type RigaGrezza = {
  id: string; draft_id: string
  raw_name: string | null; name: string
  // fedeli alla 0020: qty numeric(10,3) NOT NULL > 0 (default 1),
  // unit_price numeric(10,3) NULL o ≥ 0, discount numeric(10,2) NOT NULL ≥ 0
  qty: number; unit_price: number | null; discount: number
  amount: number
  group_id: string | null
  category_id: string | null; subcategory: string | null
  canonical_category_id: string | null; canonical_subcategory_id: string | null
  necessity: string | null; planning: string | null
  excluded: boolean; user_added: boolean
  confidence: Confidenza | null
}

// SOLO i campi che la 0021 consente di aggiornare dal browser
export type ModificaBozza = Partial<Pick<BozzaGrezza,
  'expense_date' | 'group_id' | 'category_id' | 'subcategory'
  | 'canonical_category_id' | 'canonical_subcategory_id' | 'store'
  | 'description' | 'payment_method' | 'room_id' | 'expense_nature'
  | 'arrotondamento_cent'>>
export type ModificaRiga = Partial<Pick<RigaGrezza,
  'name' | 'qty' | 'unit_price' | 'discount' | 'amount' | 'group_id'
  | 'category_id' | 'subcategory' | 'canonical_category_id'
  | 'canonical_subcategory_id' | 'necessity' | 'planning' | 'excluded'>>
export type RigaNuova = {
  draft_id: string; name: string; amount: number
  qty?: number; unit_price?: number | null; discount?: number
  group_id?: string | null; category_id?: string | null; subcategory?: string | null
  canonical_category_id?: string | null; canonical_subcategory_id?: string | null
  necessity?: string | null; planning?: string | null
}
// una riga nuova nello stato: con la sua RESPONSABILITÀ tracciata.
//  'nuova'    = mai inviata;
//  'in_invio' = custodita PRIMA della richiesta: se la pagina muore qui,
//               alla riapertura diventa 'incerta' (mai un secondo INSERT);
//  'salvata'  = inserita, id noto (MAI reinviata);
//  'incerta'  = esito ignoto: si risolve SOLO con una scelta esplicita
//               dell'utente (nessun reinvio automatico, nessuna
//               riconciliazione arbitraria).
export type RigaNuovaPendente = RigaNuova & {
  idLocale: string
  //  'riconosciuta' = l'utente ha collegato la pendenza a una voce del
  //  database IDENTICA in ogni campo: la voce vera conta nei totali, la
  //  pendenza resta ANNOTATA (l'esito della richiesta originale non è
  //  dimostrato — solo il contratto idempotente 0023 potrà chiuderlo)
  stato: 'nuova' | 'in_invio' | 'salvata' | 'incerta' | 'riconosciuta'
  id?: string                             // l'id vero, dopo l'inserimento
  gemella?: string                        // riapertura: id di una voce del
                                          // database IDENTICA in ogni campo
                                          // (proposta all'utente, mai applicata da sola)
}

// il payload ESPLICITO dell'INSERT: solo le colonne concesse dalla 0021,
// con i DEFAULT della 0020 dove NULL è vietato (qty=1, discount=0) — un
// NULL esplicito non applicherebbe il default e verrebbe rifiutato
export function payloadRigaNuova(r: RigaNuova): RigaNuova {
  return {
    draft_id: r.draft_id, name: r.name, amount: r.amount,
    qty: r.qty ?? 1, unit_price: r.unit_price ?? null, discount: r.discount ?? 0,
    group_id: r.group_id ?? null, category_id: r.category_id ?? null,
    subcategory: r.subcategory ?? null,
    canonical_category_id: r.canonical_category_id ?? null,
    canonical_subcategory_id: r.canonical_subcategory_id ?? null,
    necessity: r.necessity ?? null, planning: r.planning ?? null,
  }
}

// due righe sono «la stessa operazione» SOLO se identiche in TUTTI i campi
// del payload (nome e importo non bastano: quantità o destinatario diversi
// smentiscono l'identità). Anche così resta una FORTE somiglianza, non una
// prova: per questo la gemella viene PROPOSTA, mai collegata da sola.
export function stessaRigaNuova(db: RigaGrezza, pendente: RigaNuova): boolean {
  const p = payloadRigaNuova(pendente)
  return db.draft_id === p.draft_id && db.name === p.name
    && Math.round(db.amount * 100) === Math.round(p.amount * 100)
    && db.qty === p.qty && (db.unit_price ?? null) === (p.unit_price ?? null)
    && db.discount === p.discount
    && (db.group_id ?? null) === (p.group_id ?? null)
    && (db.category_id ?? null) === (p.category_id ?? null)
    && (db.subcategory ?? null) === (p.subcategory ?? null)
    && (db.canonical_category_id ?? null) === (p.canonical_category_id ?? null)
    && (db.canonical_subcategory_id ?? null) === (p.canonical_subcategory_id ?? null)
    && (db.necessity ?? null) === (p.necessity ?? null)
    && (db.planning ?? null) === (p.planning ?? null)
}

// lo STATO della revisione in corso: originali intatti + modifiche pendenti
export type StatoRevisione = {
  documentId: string
  // COORDINAMENTO fra schermate e operazioni sullo stesso documento: ogni
  // APERTURA reclama una generazione nuova; la custodia rifiuta le
  // scritture di generazioni superate, così la risposta di un Salva
  // rimasto per aria non può calpestare uno stato più recente
  generazione: number
  docTotaleCent: number | null            // valore corrente (modificabile)
  docTotaleOriginaleCent: number | null
  // la TESTATA del documento (tipo, fornitore, numero, date): ORIGINALE
  // intatta + modifiche pendenti, come per le bozze
  documento: DocumentoGrezzoRevisione
  modificheDocumento: ModificaDocumento
  bozze: BozzaGrezza[]                    // ORIGINALI, mai mutati
  righe: RigaGrezza[]                     // ORIGINALI, mai mutati
  modificheBozze: Record<string, ModificaBozza>
  modificheRighe: Record<string, ModificaRiga>
  righeNuove: RigaNuovaPendente[]
  // campi VINCOLATI da un'operazione precedente senza esito riferibile:
  // non modificabili, e finché esistono la conferma resta bloccata
  vincoli?: Vincoli
}

// ---- TRACCIA DUREVOLE: gli originali sopravvivono a Salva e riaperture ----
// Il database, dopo un Salva, contiene già i valori corretti: senza questa
// traccia l'originale sparirebbe e le correzioni per la RPC verrebbero
// azzerate in silenzio. La traccia si scrive PRIMA di ogni salvataggio e
// si toglie solo a documento confermato o scartato.
// un'operazione remota AVVIATA e non ancora chiusa: si annota nella
// traccia PRIMA delle scritture. Se all'apertura c'è ancora, la richiesta
// della sessione precedente potrebbe essere per aria: la nuova schermata
// deve PRENDERE IN CARICO il documento esplicitamente prima di scrivere.
// 'approvazione' = approva_fattura_da_pagare (Fase 5): chiude la revisione
// SENZA spese, il documento diventa approvata_da_pagare; 'conferma' copre
// sia conferma_documento sia conferma_fattura_pagata (entrambe → confermato)
export type OperazioneInCorsa = { tipo: 'salva' | 'conferma' | 'scarto' | 'approvazione'; generazione: number }

export type TracciaRevisione = {
  documentId: string
  generazione: number
  inCorso?: OperazioneInCorsa | null
  vincoli?: Vincoli
  docTotaleCent: number | null
  docTotaleOriginaleCent: number | null
  // testata del documento (facoltativa: le tracce precedenti alla Fase 5
  // non la contengono e restano valide — senza originali custoditi la
  // testata riparte da ciò che il database restituisce)
  originaliDocumento?: Partial<DocumentoGrezzoRevisione>
  modificheDocumento?: ModificaDocumento
  originaliBozze: Record<string, Partial<BozzaGrezza>>
  originaliRighe: Record<string, Partial<RigaGrezza>>
  modificheBozze: Record<string, ModificaBozza>
  modificheRighe: Record<string, ModificaRiga>
  righeNuove: RigaNuovaPendente[]
}

const foto = <T extends object>(riga: T, campi: readonly string[]): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const c of campi) out[c] = (riga as Record<string, unknown>)[c] ?? null
  return out as Partial<T>
}

export function tracciaDa(s: StatoRevisione): TracciaRevisione {
  return {
    documentId: s.documentId, generazione: s.generazione,
    ...(vincoliVuoti(s.vincoli) ? {} : { vincoli: s.vincoli }),
    docTotaleCent: s.docTotaleCent, docTotaleOriginaleCent: s.docTotaleOriginaleCent,
    originaliDocumento: foto(s.documento, CAMPI_DOCUMENTO_REVISIONE),
    modificheDocumento: s.modificheDocumento,
    originaliBozze: Object.fromEntries(s.bozze.map(b => [b.id, foto(b, CAMPI_BOZZA_REVISIONE)])),
    originaliRighe: Object.fromEntries(s.righe.map(r => [r.id, foto(r, CAMPI_RIGA_REVISIONE)])),
    modificheBozze: s.modificheBozze, modificheRighe: s.modificheRighe,
    righeNuove: s.righeNuove,
  }
}

// le differenze tra ciò che il database restituisce ORA e l'originale
// custodito: sono le correzioni già salvate, che tornano pendenti
const diffCampi = <T extends object>(
  adesso: T, originale: Partial<T>, campi: readonly string[],
): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const c of campi) {
    const dopo = (adesso as Record<string, unknown>)[c] ?? null
    const prima = (originale as Record<string, unknown>)[c] ?? null
    if (JSON.stringify(dopo) !== JSON.stringify(prima)) out[c] = dopo
  }
  return out as Partial<T>
}

export function apriRevisione(
  documentId: string, docTotale: number | null,
  bozze: BozzaGrezza[], righe: RigaGrezza[],
  traccia?: TracciaRevisione | null,
  // la testata come la restituisce il database ORA (Fase 5); assente =
  // scontrino senza testata, comportamento identico a prima
  documento: DocumentoGrezzoRevisione = DOCUMENTO_SENZA_TESTATA,
): StatoRevisione {
  const attive = bozze.filter(b => b.status === 'da_controllare' || b.status === 'pronta')
  const idAttivi = new Set(attive.map(b => b.id))
  const righeAttive = righe.filter(r => idAttivi.has(r.draft_id))
  const cent = docTotale == null ? null : Math.round(docTotale * 100)
  const testata = foto(documento, CAMPI_DOCUMENTO_REVISIONE) as DocumentoGrezzoRevisione
  // ogni apertura reclama una GENERAZIONE nuova: da qui in poi la custodia
  // rifiuterà le scritture delle operazioni rimaste indietro
  const generazione = (traccia?.generazione ?? 0) + 1
  if (!traccia || traccia.documentId !== documentId) {
    return {
      documentId, generazione, docTotaleCent: cent, docTotaleOriginaleCent: cent,
      documento: testata, modificheDocumento: {},
      bozze: attive, righe: righeAttive,
      modificheBozze: {}, modificheRighe: {}, righeNuove: [],
    }
  }
  // RIAPERTURA con traccia: originali dalla custodia, correzioni ricostruite
  // (differenze database↔originale) + modifiche non ancora salvate
  const origDoc = traccia.originaliDocumento
  const documentoOriginale = origDoc ? { ...testata, ...origDoc } as DocumentoGrezzoRevisione : testata
  const modificheDocumento: ModificaDocumento = {
    ...(origDoc ? diffCampi(testata, origDoc, CAMPI_DOCUMENTO_REVISIONE) : {}),
    ...traccia.modificheDocumento,
  }
  const modificheBozze: Record<string, ModificaBozza> = {}
  const bozzeOriginali = attive.map(b => {
    const orig = traccia.originaliBozze[b.id]
    if (!orig) return b
    const originale = { ...b, ...orig } as BozzaGrezza
    const diff = { ...diffCampi(b, orig, CAMPI_BOZZA_REVISIONE), ...traccia.modificheBozze[b.id] }
    if (Object.keys(diff).length) modificheBozze[b.id] = diff
    return originale
  })
  const modificheRighe: Record<string, ModificaRiga> = {}
  const righeOriginali = righeAttive.map(r => {
    const orig = traccia.originaliRighe[r.id]
    if (!orig) return r
    const originale = { ...r, ...orig } as RigaGrezza
    const diff = { ...diffCampi(r, orig, CAMPI_RIGA_REVISIONE), ...traccia.modificheRighe[r.id] }
    if (Object.keys(diff).length) modificheRighe[r.id] = diff
    return originale
  })
  // righe nuove: le 'salvata' arrivate dal database si tolgono (l'id è la
  // prova). 'in_invio' significa che la pagina è morta con una richiesta
  // per aria: diventa 'incerta'. Le 'incerta' NON si riconciliano da sole
  // (una somiglianza non è un'identità): se tra le righe user_added
  // comparse dopo lo snapshot ce n'è una IDENTICA in tutti i campi, viene
  // PROPOSTA come gemella — decide l'utente, mai il codice.
  const noteAlloSnapshot = new Set(Object.keys(traccia.originaliRighe))
  const comparse = righeAttive.filter(r => r.user_added && !noteAlloSnapshot.has(r.id))
  const reclamate = new Set(traccia.righeNuove.filter(n => n.id).map(n => n.id as string))
  const righeNuove = traccia.righeNuove
    .filter(n => n.stato !== 'salvata' || !n.id || !righeAttive.some(r => r.id === n.id))
    .map(n => {
      if (n.stato !== 'incerta' && n.stato !== 'in_invio') return n   // 'riconosciuta' resta annotata
      const gemella = comparse.find(r => !reclamate.has(r.id) && stessaRigaNuova(r, n))
      if (gemella) reclamate.add(gemella.id)
      return { ...n, stato: 'incerta' as const, gemella: gemella?.id }
    })
  return {
    documentId, generazione,
    ...(vincoliVuoti(traccia.vincoli) ? {} : { vincoli: traccia.vincoli }),
    docTotaleCent: traccia.docTotaleCent,
    docTotaleOriginaleCent: traccia.docTotaleOriginaleCent,
    documento: documentoOriginale, modificheDocumento,
    bozze: bozzeOriginali, righe: righeOriginali,
    modificheBozze, modificheRighe, righeNuove,
  }
}

// i valori CORRENTI (originale + modifica pendente), senza mutare nulla
export const documentoCorrente = (s: StatoRevisione): DocumentoGrezzoRevisione =>
  ({ ...s.documento, ...s.modificheDocumento })
export const bozzaCorrente = (s: StatoRevisione, id: string): BozzaGrezza => {
  const b = s.bozze.find(x => x.id === id)!
  return { ...b, ...s.modificheBozze[id] }
}
export const rigaCorrente = (s: StatoRevisione, id: string): RigaGrezza => {
  const r = s.righe.find(x => x.id === id)!
  return { ...r, ...s.modificheRighe[id] }
}

// le modifiche RISPETTANO i vincoli: un campo vincolato da un'operazione
// precedente senza esito riferibile non è modificabile — la scrittura
// incompatibile non può nemmeno entrare nello stato
const senzaVincolati = <T extends object>(campi: T, vincolati?: string[]): T => {
  if (!vincolati?.length) return campi
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(campi)) if (!vincolati.includes(k)) out[k] = v
  return out as T
}
// la testata: stessi vincoli; i testi vuoti diventano null (mai «» nel
// database, che per il fornitore equivale a mancante)
export const modificaDocumento = (s: StatoRevisione, campi: ModificaDocumento): StatoRevisione => {
  const puliti: ModificaDocumento = {}
  for (const [k, v] of Object.entries(campi))
    (puliti as Record<string, unknown>)[k] = typeof v === 'string' && v.trim() === '' && k !== 'kind' ? null : v
  const ammessi = senzaVincolati(puliti, s.vincoli?.documento)
  if (Object.keys(ammessi).length === 0) return s
  return { ...s, modificheDocumento: { ...s.modificheDocumento, ...ammessi } }
}
export const modificaBozza = (s: StatoRevisione, id: string, campi: ModificaBozza): StatoRevisione => {
  const ammessi = senzaVincolati(campi, s.vincoli?.bozze[id])
  if (Object.keys(ammessi).length === 0) return s
  return { ...s, modificheBozze: { ...s.modificheBozze, [id]: { ...s.modificheBozze[id], ...ammessi } } }
}
export const modificaRiga = (s: StatoRevisione, id: string, campi: ModificaRiga): StatoRevisione => {
  const ammessi = senzaVincolati(campi, s.vincoli?.righe[id])
  if (Object.keys(ammessi).length === 0) return s
  return { ...s, modificheRighe: { ...s.modificheRighe, [id]: { ...s.modificheRighe[id], ...ammessi } } }
}
export const aggiungiRiga = (s: StatoRevisione, riga: RigaNuova, idLocale: string): StatoRevisione =>
  ({ ...s, righeNuove: [...s.righeNuove, { ...riga, idLocale, stato: 'nuova' }] })
// si toglie SOLO una riga mai inviata: 'salvata' è nel database (la 0021
// non concede DELETE), 'incerta' è una responsabilità da riconciliare
export const togliRigaNuova = (s: StatoRevisione, idLocale: string): StatoRevisione =>
  ({ ...s, righeNuove: s.righeNuove.filter(r => r.idLocale !== idLocale || r.stato !== 'nuova') })
// una riga incerta CON gemella si può RICONOSCERE (scelta esplicita
// dell'utente): è solo un'ANNOTAZIONE — la pendenza non sparisce (resta
// col suo idLocale) e continua a BLOCCARE la conferma, perché nemmeno la
// gemella dimostra l'esito della richiesta originale. Solo il contratto
// idempotente (proposta 0023) potrà chiudere queste pendenze.
// In nessun caso il codice reinvia o cancella da solo.
export const riconosciRigaIncerta = (s: StatoRevisione, idLocale: string): StatoRevisione =>
  ({ ...s, righeNuove: s.righeNuove.map(r =>
    r.idLocale === idLocale && r.stato === 'incerta' && r.gemella
      ? { ...r, stato: 'riconosciuta' as const } : r) })
export const modificaTotale = (s: StatoRevisione, cent: number | null): StatoRevisione =>
  s.vincoli?.docTotale ? s : { ...s, docTotaleCent: cent }

// ---- dubbi: campi sotto soglia, col motivo --------------------------------
export function dubbiDi(confidence: Confidenza | null): { campo: string; motivo: string }[] {
  return Object.entries(confidence ?? {})
    .filter(([, v]) => v?.confidence != null && v.confidence < SOGLIA_CONFIDENCE)
    .map(([campo, v]) => ({
      campo,
      motivo: `affidabilità ${Math.round((v.confidence ?? 0) * 100)}%${v.doubt_reason ? `: ${v.doubt_reason}` : ''}`,
    }))
}

// ---- totali e quadratura (centesimi interi) -------------------------------
const centDi = (n: number) => Math.round(n * 100)

export function totaliSorella(s: StatoRevisione, bozzaId: string) {
  const righe = s.righe.filter(r => r.draft_id === bozzaId).map(r => rigaCorrente(s, r.id))
  // nei totali contano solo 'nuova' e 'salvata': le 'incerta'/'in_invio'
  // non si sa se esistano (e bloccano), le 'riconosciute' sono già
  // rappresentate dalla loro voce vera tra le righe del database
  const nuove = s.righeNuove.filter(r => r.draft_id === bozzaId && (r.stato === 'nuova' || r.stato === 'salvata'))
  const attiveCent = [
    ...righe.filter(r => !r.excluded).map(r => centDi(r.amount)),
    ...nuove.map(r => centDi(r.amount)),
  ]
  const arrotondamentoCent = bozzaCorrente(s, bozzaId).arrotondamento_cent ?? 0
  return {
    righeCent: attiveCent,
    sommaCent: attiveCent.reduce((a, b) => a + b, 0),
    arrotondamentoCent,
    totaleCent: attiveCent.reduce((a, b) => a + b, 0) + arrotondamentoCent,
    escluse: righe.filter(r => r.excluded).length,
    aggiunte: nuove.length + righe.filter(r => r.user_added).length,
  }
}

export function quadratura(s: StatoRevisione) {
  return quadraturaDocumento(
    s.docTotaleCent,
    s.bozze.map(b => {
      const t = totaliSorella(s, b.id)
      return { righeCent: t.righeCent, arrotondamentoCent: t.arrotondamentoCent }
    }),
  )
}

// ---- cosa blocca la conferma (il server rifarà gli stessi controlli) ------
export function blocchiConferma(
  s: StatoRevisione,
  ambitoDelGruppo: (groupId: string | null) => 'personale' | 'azienda',
  sottoCanoniche?: { id: string; canonical_category_id?: string | null }[],
): string[] {
  const blocchi = blocchiComuni(s, ambitoDelGruppo, sottoCanoniche, true)
  // conferma_documento RIFIUTA le fatture: hanno le loro RPC (Fase 5)
  if (documentoCorrente(s).kind === 'fattura')
    blocchi.push('questo documento è una fattura: si approva «da pagare» o si conferma «già pagata», non si conferma come scontrino')
  return [...new Set(blocchi)]
}

// ---- FATTURE (Fase 5): cosa blocca approvazione e conferma «già pagata» ---
// Specchio di private.valida_fattura + approva_fattura_da_pagare /
// conferma_fattura_pagata: totale, data documento, fornitore, bozze attive,
// gruppo, quadratura; scadenza SOLO per una fattura da pagare; data e
// metodo di pagamento SOLO per una già pagata. In più la regola della
// casa: le fatture sono di Casa Ania (ogni parte con un gruppo azienda),
// e il metodo per parte NON è richiesto qui (lo fornisce il pagamento).
export type SceltaFattura =
  | { esito: 'da_pagare' }
  | { esito: 'pagata'; dataPagamento: string | null; metodo: string | null }

export function blocchiFattura(
  s: StatoRevisione,
  ambitoDelGruppo: (groupId: string | null) => 'personale' | 'azienda',
  sottoCanoniche: { id: string; canonical_category_id?: string | null }[] | undefined,
  scelta: SceltaFattura,
  oggi: string,
): string[] {
  const blocchi = blocchiComuni(s, ambitoDelGruppo, sottoCanoniche, false)
  const d = documentoCorrente(s)
  if (d.kind !== 'fattura') blocchi.push('il documento non è segnato come fattura')
  if (!d.supplier || !d.supplier.trim()) blocchi.push('manca il fornitore')
  if (!d.document_date) blocchi.push('manca la data della fattura')
  else if (!dataIsoValida(d.document_date)) blocchi.push('la data della fattura non è valida')
  for (const b of s.bozze) {
    const c = bozzaCorrente(s, b.id)
    if (c.group_id && ambitoDelGruppo(c.group_id) !== 'azienda')
      blocchi.push('una fattura è di Casa Ania: ogni parte deve avere un gruppo Casa Ania')
  }
  if (scelta.esito === 'da_pagare') {
    if (!d.due_date) blocchi.push('per una fattura da pagare serve la scadenza')
    else if (!dataIsoValida(d.due_date)) blocchi.push('la scadenza non è una data valida')
  } else {
    if (d.due_date && !dataIsoValida(d.due_date)) blocchi.push('la scadenza non è una data valida')
    if (!scelta.dataPagamento) blocchi.push('manca la data del pagamento')
    else if (!dataIsoValida(scelta.dataPagamento)) blocchi.push('la data del pagamento non è valida')
    else if (scelta.dataPagamento > oggi) blocchi.push('la data del pagamento è nel futuro: una fattura già pagata ha una data passata o di oggi')
    if (!scelta.metodo || !(METODI_VALIDI as readonly string[]).includes(scelta.metodo))
      blocchi.push('per una fattura già pagata serve il metodo di pagamento')
  }
  return [...new Set(blocchi)]
}

// i controlli condivisi da scontrini e fatture; `metodoPerBozza` = la
// regola «metodo obbligatorio sulle parti Casa Ania» (vale per gli
// scontrini; per le fatture il metodo arriva col pagamento)
function blocchiComuni(
  s: StatoRevisione,
  ambitoDelGruppo: (groupId: string | null) => 'personale' | 'azienda',
  sottoCanoniche: { id: string; canonical_category_id?: string | null }[] | undefined,
  metodoPerBozza: boolean,
): string[] {
  const blocchi: string[] = []
  const q = quadratura(s)
  if (!q.ok) {
    blocchi.push(q.diffCent == null
      ? 'totale del documento mancante'
      : q.diffCent > 0
        ? `non quadra: mancano ${(q.diffCent / 100).toFixed(2).replace('.', ',')} € (${q.sommaCent} vs ${s.docTotaleCent} cent)`
        : `non quadra: ci sono ${(-q.diffCent / 100).toFixed(2).replace('.', ',')} € di troppo (${q.sommaCent} vs ${s.docTotaleCent} cent)`)
  }
  for (const b of s.bozze) {
    const c = bozzaCorrente(s, b.id)
    if (!c.group_id) { blocchi.push('una parte non ha il destinatario (gruppo): assegnalo'); continue }
    const ambitoParte = ambitoDelGruppo(c.group_id)
    if (metodoPerBozza && ambitoParte === 'azienda' && !c.payment_method)
      blocchi.push('per Casa Ania il metodo di pagamento è obbligatorio')
    // COERENZA: nessuna voce può avere un destinatario dell'altro ambito
    // rispetto alla sua parte (il salvataggio incoerente romperebbe la vista)
    for (const r of s.righe.filter(x => x.draft_id === b.id)) {
      const rc = rigaCorrente(s, r.id)
      if (!rc.excluded && rc.group_id && ambitoDelGruppo(rc.group_id) !== ambitoParte)
        blocchi.push('una voce ha un destinatario dell\'altro ambito rispetto alla sua parte: correggila')
    }
    for (const n of s.righeNuove.filter(x => x.draft_id === b.id))
      if (n.group_id && ambitoDelGruppo(n.group_id) !== ambitoParte)
        blocchi.push('una voce ha un destinatario dell\'altro ambito rispetto alla sua parte: correggila')
  }
  // QUALSIASI pendenza d'invio non dimostrata blocca — anche quella
  // RICONOSCIUTA: collegare la gemella è un'annotazione, non una prova
  // dell'esito della richiesta originale
  if (s.righeNuove.some(r => r.stato === 'in_invio' || r.stato === 'incerta' || r.stato === 'riconosciuta'))
    blocchi.push('un invio di voce è rimasto senza esito dimostrato: la conferma resta bloccata (si sblocca col contratto idempotente — proposta 0023)')
  if (!vincoliVuoti(s.vincoli))
    blocchi.push('alcuni campi sono vincolati da un salvataggio precedente senza esito riferibile: la conferma resta bloccata (lo scarto è possibile; per gli aggiornamenti servirà un contratto dedicato, da proporre)')
  // coerenza canonica (la stessa FK composita della 0020): la
  // sottocategoria deve appartenere alla categoria scelta
  if (sottoCanoniche) {
    const canoniche = sottoCanoniche.map(x => ({ id: x.id, canonical_category_id: x.canonical_category_id ?? '' }))
    const controlla = (scelta: { canonical_category_id: string | null; canonical_subcategory_id: string | null }) => {
      if (!canonicaCoerente(scelta, canoniche))
        blocchi.push('la sottocategoria non appartiene alla categoria scelta: sistemala')
    }
    for (const b of s.bozze) controlla(bozzaCorrente(s, b.id))
    for (const r of s.righe) controlla(rigaCorrente(s, r.id))
    for (const n of s.righeNuove) controlla({ canonical_category_id: n.canonical_category_id ?? null, canonical_subcategory_id: n.canonical_subcategory_id ?? null })
  }
  return [...new Set(blocchi)]
}

// ---- VINCOLI e RICONCILIAZIONE della presa in carico ----------------------
// Una richiesta GIÀ PARTITA non si può fermare da qui, e NESSUN confronto
// di valori può dimostrare che sia terminata: un valore osservato uguale
// può venire da un salvataggio precedente mentre un duplicato è ancora
// per aria — appena qualcuno lo cambia, l'arrivo tardivo lo calpesta.
// Quindi:
//  · 'salva' annotato → la presa è consentita ma i campi del write-set
//    dell'operazione diventano VINCOLATI: non modificabili (una
//    scrittura incompatibile è impossibile) e la CONFERMA resta bloccata
//    finché i vincoli esistono. Localmente non decadono mai (l'esito non
//    è riferibile all'operazione): l'uscita è lo SCARTO del documento,
//    oppure un futuro contratto lato database per gli aggiornamenti —
//    da proporre a parte (la proposta 0023 copre SOLO gli INSERT delle
//    righe nuove, NON questi UPDATE);
//  · 'conferma'/'scarto' annotati → serve lo STATO EFFETTIVO del
//    documento: dati mancanti, incoerenti o uno stato inatteso NON sono
//    una prova. Un documento che risulta chiuso si tratta da chiuso
//    (nessuna revisione modificabile da riaprire).
export type Vincoli = {
  docTotale?: boolean
  documento?: string[]                    // campi di testata (Fase 5)
  bozze: Record<string, string[]>
  righe: Record<string, string[]>
}
export const vincoliVuoti = (v?: Vincoli): boolean =>
  !v || (!v.docTotale && !(v.documento?.length) && Object.keys(v.bozze).length === 0 && Object.keys(v.righe).length === 0)

// il write-set dell'operazione annotata (le modifiche custodite al suo
// avvio: la schermata resta bloccata durante e dopo, quindi coincidono)
export function vincoliDaOperazione(traccia: TracciaRevisione): Vincoli {
  const bozze: Record<string, string[]> = {}
  const righe: Record<string, string[]> = {}
  for (const [id, campi] of Object.entries(traccia.modificheBozze))
    if (Object.keys(campi).length) bozze[id] = Object.keys(campi)
  for (const [id, campi] of Object.entries(traccia.modificheRighe))
    if (Object.keys(campi).length) righe[id] = Object.keys(campi)
  const documento = Object.keys(traccia.modificheDocumento ?? {})
  return {
    docTotale: traccia.docTotaleCent !== traccia.docTotaleOriginaleCent || undefined,
    ...(documento.length ? { documento } : {}),
    bozze, righe,
  }
}

const unioneListe = (a: Record<string, string[]>, b: Record<string, string[]>) => {
  const out: Record<string, string[]> = { ...a }
  for (const [id, campi] of Object.entries(b)) out[id] = [...new Set([...(out[id] ?? []), ...campi])]
  return out
}
export const applicaVincoli = (s: StatoRevisione, v: Vincoli): StatoRevisione => {
  const documento = [...new Set([...(s.vincoli?.documento ?? []), ...(v.documento ?? [])])]
  return {
    ...s,
    vincoli: {
      docTotale: s.vincoli?.docTotale || v.docTotale || undefined,
      ...(documento.length ? { documento } : {}),
      bozze: unioneListe(s.vincoli?.bozze ?? {}, v.bozze),
      righe: unioneListe(s.vincoli?.righe ?? {}, v.righe),
    },
  }
}

export const eVincolato = (s: StatoRevisione, tipo: 'bozza' | 'riga', id: string, campo: string): boolean =>
  !!(tipo === 'bozza' ? s.vincoli?.bozze[id] : s.vincoli?.righe[id])?.includes(campo)
export const eVincolatoDocumento = (s: StatoRevisione, campo: string): boolean =>
  !!s.vincoli?.documento?.includes(campo)

export type EsitoPresa =
  | { esito: 'libera' }
  | { esito: 'vincolata'; vincoli: Vincoli; motivo: string }
  | { esito: 'bloccata'; motivo: string }
  | { esito: 'chiusa'; motivo: string }

export function riconciliaPresa(
  traccia: TracciaRevisione,
  documento: { id: string; status?: string | null },
  bozze: BozzaGrezza[],
): EsitoPresa {
  // IDENTITÀ prima di tutto: dati di un altro documento non provano nulla
  if (documento.id !== traccia.documentId)
    return { esito: 'bloccata', motivo: 'i dati non appartengono al documento custodito: non riprendo nulla' }
  const inCorso = traccia.inCorso
  if (!inCorso) return { esito: 'libera' }
  if (inCorso.tipo === 'salva') {
    const vincoli = vincoliDaOperazione(traccia)
    if (vincoliVuoti(vincoli)) return { esito: 'libera' }   // solo righe nuove: già nel regime «incerta»
    return {
      esito: 'vincolata', vincoli,
      motivo: 'un salvataggio precedente non ha un esito riferibile: i suoi campi restano VINCOLATI (non modificabili) e la conferma bloccata — lo scarto resta possibile',
    }
  }
  // conferma/scarto/approvazione: decide lo stato EFFETTIVO del documento
  const attive = bozze.some(b => b.status === 'da_controllare' || b.status === 'pronta')
  const nomeOp = inCorso.tipo === 'conferma' ? 'la conferma annotata'
    : inCorso.tipo === 'approvazione' ? 'l\'approvazione annotata' : 'lo scarto annotato'
  // l'APPROVAZIONE (fattura da pagare) lascia le bozze attive di proposito:
  // alimentano lo scadenzario e il pagamento. Il documento approvato NON
  // ha una revisione da riprendere (modificabile solo in_revisione).
  if (documento.status === 'approvata_da_pagare') {
    const coerente = inCorso.tipo === 'approvazione'
    return {
      esito: 'chiusa',
      motivo: `il documento risulta APPROVATO DA PAGARE${coerente ? '' : ` — esito DIVERSO da ${nomeOp}: segnalalo`}: non c'è una revisione da riprendere (si paga dallo scadenzario)`,
    }
  }
  if (documento.status === 'confermato' || documento.status === 'scartato') {
    if (attive)
      return { esito: 'bloccata', motivo: `dati incoerenti: il documento risulta «${documento.status}» ma alcune bozze sono ancora attive — ricarica e riprova` }
    const coerente = (inCorso.tipo === 'conferma') === (documento.status === 'confermato')
    return {
      esito: 'chiusa',
      motivo: `il documento risulta ${documento.status === 'confermato' ? 'CONFERMATO' : 'SCARTATO'}${coerente ? '' : ` — esito DIVERSO da ${nomeOp}: segnalalo`}: non c'è una revisione da riprendere`,
    }
  }
  if (!documento.status)
    return { esito: 'bloccata', motivo: 'lo stato del documento non è disponibile: senza, nulla è dimostrabile — ricarica e riprova' }
  const inviata = inCorso.tipo === 'conferma' ? 'la conferma inviata'
    : inCorso.tipo === 'approvazione' ? 'l\'approvazione inviata' : 'lo scarto inviato'
  return {
    esito: 'bloccata',
    motivo: `${inviata} non risulta ancora (documento «${documento.status}»): la richiesta potrebbe completarsi tardi — ricarica e riprova`,
  }
}

// ---- scelte CANONICHE (i gestori veri della schermata) --------------------
// Perché la scelta sia EFFETTIVA anche alla rilettura, insieme alle
// canoniche si azzerano le STORICHE che riaffiorerebbero nella catena di
// ripiego (canonica riga → storica riga → canonica madre → storica madre):
//  · cambiare categoria azzera la sottocategoria canonica E storica (la
//    vecchia non deve ricomparire incompatibile);
//  · «Come la parte» sulla riga azzera TUTTO il livello riga (canoniche e
//    storiche): solo così eredita davvero dalla madre.
// Le assegnazioni delle altre voci non vengono mai toccate.
export const scegliCanonicaBozza = (id: string | null): ModificaBozza =>
  ({ canonical_category_id: id, canonical_subcategory_id: null, subcategory: null })
export const scegliSottoCanonicaBozza = (id: string | null): ModificaBozza =>
  ({ canonical_subcategory_id: id, subcategory: null })
export const scegliCanonicaRiga = (id: string | null): ModificaRiga =>
  id === null
    ? { canonical_category_id: null, canonical_subcategory_id: null, category_id: null, subcategory: null }
    : { canonical_category_id: id, canonical_subcategory_id: null, subcategory: null }
export const scegliSottoCanonicaRiga = (id: string | null): ModificaRiga =>
  ({ canonical_subcategory_id: id, subcategory: null })

// coerenza quantità × prezzo unitario (avviso NON bloccante, come da
// controlli.rigaCoerente: tolleranza di 1 cent solo sul prezzo stampato)
export function avvisoCoerenzaRiga(r: Pick<RigaGrezza, 'qty' | 'unit_price' | 'discount' | 'amount' | 'excluded'>): string | null {
  if (r.excluded || r.qty == null || r.qty <= 0 || r.unit_price == null) return null
  if (rigaCoerente(r.unit_price, r.qty, Math.round(r.amount * 100), Math.round((r.discount ?? 0) * 100))) return null
  return `quantità × prezzo non torna con l'importo (${r.qty} × ${r.unit_price.toFixed(2).replace('.', ',')} ${r.discount ? `− sconto ${r.discount.toFixed(2).replace('.', ',')} ` : ''}≠ ${r.amount.toFixed(2).replace('.', ',')})`
}

// ---- CORREZIONI per la RPC: differenze tra originale e corrente -----------
// { field, proposed, corrected, draft_id | draft_item_id } come da contratto
// di private.registra_correzioni. Le righe AGGIUNTE a mano non sono
// correzioni (nascono già dall'utente e la marca user_added le distingue).
export function correzioniDa(s: StatoRevisione): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  if (s.docTotaleCent !== s.docTotaleOriginaleCent) {
    out.push({
      field: 'doc_total',
      proposed: s.docTotaleOriginaleCent == null ? null : s.docTotaleOriginaleCent / 100,
      corrected: s.docTotaleCent == null ? null : s.docTotaleCent / 100,
    })
  }
  // testata del documento: correzioni SENZA draft_id (riferite al documento)
  for (const [campo, valore] of Object.entries(s.modificheDocumento)) {
    const prima = s.documento[campo as keyof DocumentoGrezzoRevisione] ?? null
    if (JSON.stringify(prima) !== JSON.stringify(valore ?? null))
      out.push({ field: campo, proposed: prima, corrected: valore ?? null })
  }
  for (const [id, campi] of Object.entries(s.modificheBozze)) {
    const originale = s.bozze.find(b => b.id === id)!
    for (const [campo, valore] of Object.entries(campi)) {
      const prima = originale[campo as keyof BozzaGrezza] ?? null
      if (JSON.stringify(prima) !== JSON.stringify(valore ?? null))
        out.push({ field: campo, proposed: prima, corrected: valore ?? null, draft_id: id })
    }
  }
  for (const [id, campi] of Object.entries(s.modificheRighe)) {
    const originale = s.righe.find(r => r.id === id)!
    for (const [campo, valore] of Object.entries(campi)) {
      const prima = originale[campo as keyof RigaGrezza] ?? null
      if (JSON.stringify(prima) !== JSON.stringify(valore ?? null))
        out.push({ field: campo, proposed: prima, corrected: valore ?? null, draft_id: originale.draft_id, draft_item_id: id })
    }
  }
  return out
}

// c'è qualcosa da salvare?
export const modifichePendenti = (s: StatoRevisione): boolean =>
  s.docTotaleCent !== s.docTotaleOriginaleCent
  || Object.keys(s.modificheDocumento).length > 0
  || Object.keys(s.modificheBozze).length > 0
  || Object.keys(s.modificheRighe).length > 0
  || s.righeNuove.length > 0
