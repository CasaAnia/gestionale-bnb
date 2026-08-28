// Modello PURO del ciclo documenti/bozze/spese (Fase 2A): la stessa logica
// delle RPC conferma_documento e paga_fattura della 0020, riprodotta in
// memoria per testare invariante economica, atomicità logica e idempotenza
// SENZA database. Nessun accesso a Supabase.
//
// Invariante economica (Ania, 28/08/2026): in `spese` entra SOLO denaro
// realmente uscito. Le fatture approvate ma non pagate restano documenti
// 'approvata_da_pagare' con le righe nelle bozze: scadenzario e
// "Impegnato/Da pagare", MAI nello Speso.
import type { DocumentoStato, BozzaStato } from './stati.ts'
import { CONFERMABILE_DA, PAGABILE_DA, BOZZA_ATTIVA } from './stati.ts'
import { quadraturaDocumento } from './controlli.ts'

export type DocumentoSim = {
  id: string
  kind: 'scontrino' | 'fattura' | 'altro'
  status: DocumentoStato
  docTotalCent: number | null
  document_date?: string | null
  due_date?: string | null
  supplier?: string | null
  // upload_ambito = SOLO provenienza del caricamento: mai usato nei totali
  upload_ambito?: 'personale' | 'azienda'
}
export type BozzaSim = {
  id: string
  documentId: string
  status: BozzaStato
  expense_date: string
  groupId?: string | null
  groupAmbito?: 'personale' | 'azienda'   // per la regola sul metodo di pagamento
  paymentMethod?: string | null
  righeCent: number[]
  arrotondamentoCent?: number
  expenseId?: string | null      // valorizzato alla conferma (unique per costruzione)
}
export type CorrezioneSim = {
  field: string
  proposed?: unknown
  corrected?: unknown
  draftId?: string
  draftItemId?: string
  documentId?: string            // impostato dal registro
  ruleApplied?: string
}
export const METODI_VALIDI = ['contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro'] as const
export type SpesaSim = {
  id: string
  expense_date: string           // per le fatture = data reale di pagamento
  amountCent: number             // SEMPRE = somma delle proprie righe
  righe: { name: string; cent: number; isAdjustment: boolean }[]
  groupId?: string | null
  paid_at?: string | null
  payment_method?: string | null
  documentId: string | null      // null = spesa MANUALE senza documento
}
export type Db = { documenti: DocumentoSim[]; bozze: BozzaSim[]; spese: SpesaSim[]; correzioni?: CorrezioneSim[] }

const clona = (db: Db): Db => structuredClone(db)

// Correzioni della revisione: come private.registra_correzioni della 0020.
// La VALIDAZIONE avviene prima di qualsiasi creazione (un riferimento
// estraneo fa fallire TUTTA l'operazione: nessuna spesa creata); la
// registrazione avviene nella stessa "transazione" (stessa copia del db).
function validaCorrezioni(db: Db, documentId: string, correzioni: CorrezioneSim[]) {
  for (const c of correzioni) {
    if (!c.field) throw new Error('Correzione senza campo')
    if (c.draftId && !db.bozze.some(b => b.id === c.draftId && b.documentId === documentId))
      throw new Error(`Correzione respinta: la bozza ${c.draftId} non appartiene al documento`)
  }
}
function registraCorrezioni(nuovo: Db, documentId: string, correzioni: CorrezioneSim[]) {
  nuovo.correzioni = [...(nuovo.correzioni || []), ...correzioni.map(c => ({ ...c, documentId }))]
}

// Eliminazione di una spesa: le MANUALI senza documento si eliminano come
// oggi; una spesa collegata a un documento è protetta (restrict del ponte):
// sparirebbe lasciando il documento "confermato" con un totale orfano.
// L'eventuale annullamento futuro sarà un'operazione esplicita e tracciata.
export function eliminaSpesa(db: Db, expenseId: string): Db {
  const e = db.spese.find(x => x.id === expenseId)
  if (!e) throw new Error('Spesa inesistente')
  if (e.documentId != null)
    throw new Error('Operazione negata: spesa collegata a un documento (restrict) — serve un annullamento esplicito')
  const nuovo = clona(db)
  nuovo.spese = nuovo.spese.filter(x => x.id !== expenseId)
  return nuovo
}

// Validazione COMUNE delle fatture (approvazione e conferma-già-pagata):
// totale, data documento, fornitore, bozze attive, gruppi, quadratura;
// scadenza obbligatoria solo per una fattura DA PAGARE.
function validaFattura(db: Db, doc: DocumentoSim, richiediScadenza: boolean) {
  if (doc.docTotalCent == null) throw new Error('Totale documento mancante')
  if (!doc.document_date) throw new Error('Data documento mancante')
  if (richiediScadenza && !doc.due_date) throw new Error('Scadenza mancante')
  if (!doc.supplier) throw new Error('Fornitore mancante')
  const attive = db.bozze.filter(b => b.documentId === doc.id && (BOZZA_ATTIVA as string[]).includes(b.status))
  if (!attive.length) throw new Error('Nessuna bozza attiva: niente da approvare')
  if (attive.some(b => !b.groupId)) throw new Error('Bozza senza gruppo: assegnare il gruppo prima di approvare')
  const q = quadraturaDocumento(doc.docTotalCent,
    attive.map(b => ({ righeCent: b.righeCent, arrotondamentoCent: b.arrotondamentoCent })))
  if (!q.ok) throw new Error(`Quadratura non esatta: ${q.motivo}`)
}
const metodoValido = (m: string | null | undefined) => m != null && (METODI_VALIDI as readonly string[]).includes(m)

// ---------------------------------------------------------------------------
// Letture (scadenzario, Impegnato, Speso)
// ---------------------------------------------------------------------------
// "Impegnato/Da pagare": fatture approvate ma non pagate — il totale viene
// dal documento, mai dalle spese (che non esistono ancora).
export function impegnatoCent(db: Db): number {
  return db.documenti.filter(d => d.status === 'approvata_da_pagare')
    .reduce((s, d) => s + (d.docTotalCent || 0), 0)
}

// "Scaduta" è uno stato DERIVATO: approvata_da_pagare + scadenza superata.
export function scadute(db: Db, oggi: string): DocumentoSim[] {
  return db.documenti.filter(d =>
    d.status === 'approvata_da_pagare' && d.due_date != null && d.due_date < oggi)
}

// Lo "Speso" del periodo: SOLO le spese (denaro uscito), per expense_date.
// Bozze e fatture non pagate sono escluse per costruzione: vivono altrove.
export function spesoCent(db: Db, [da, a]: [string, string]): number {
  return db.spese.filter(e => e.expense_date >= da && e.expense_date <= a)
    .reduce((s, e) => s + e.amountCent, 0)
}

// ---------------------------------------------------------------------------
// Operazioni (le RPC, in versione pura): ATOMICHE per costruzione — su
// errore lanciano PRIMA di toccare la copia, e il db di partenza non viene
// mai mutato. IDEMPOTENTI: ripetere l'operazione non crea doppioni.
// ---------------------------------------------------------------------------
function creaSpeseDaBozze(db: Db, documentId: string, expenseDate: string | null,
  paidAt: string | null, metodo: string | null): { db: Db; expenseIds: string[] } {
  const doc = db.documenti.find(d => d.id === documentId)!
  const attive = db.bozze.filter(b => b.documentId === documentId && (BOZZA_ATTIVA as string[]).includes(b.status))
  if (!attive.length) throw new Error('Nessuna bozza attiva: documento senza bozze o con bozze scartate/in errore')
  // gruppo mancante = BLOCCANTE (senza non si distingue Casa/Ania/Teo/Casa Ania)
  if (attive.some(b => !b.groupId)) throw new Error('Bozza senza gruppo: assegnare il gruppo prima di confermare')
  // metodo di pagamento obbligatorio sulle righe Casa Ania (2A.2), salvo
  // quando la RPC lo fornisce per tutte (fatture pagate)
  if (metodo == null && attive.some(b => b.groupAmbito === 'azienda' && !b.paymentMethod))
    throw new Error('Metodo di pagamento mancante sulle righe Casa Ania: obbligatorio prima della conferma')
  const q = quadraturaDocumento(doc.docTotalCent,
    attive.map(b => ({ righeCent: b.righeCent, arrotondamentoCent: b.arrotondamentoCent })))
  if (!q.ok) throw new Error(`Quadratura non esatta: ${q.motivo} (diff ${q.diffCent} cent)`)

  const nuovo = clona(db)
  const ids: string[] = []
  for (const b of attive) {
    const expenseId = `spesa-${b.id}` // deterministico: una bozza → al più una spesa
    if (nuovo.spese.some(e => e.id === expenseId)) throw new Error('Bozza già confermata') // vincolo unique
    // l'arrotondamento (±) è una riga ESPLICITA, mai nascosto nei prezzi:
    // così l'importo della sorella = somma delle sue righe definitive, e la
    // somma delle sorelle = doc_total
    const righe = b.righeCent.map((c, i) => ({ name: `riga-${i + 1}`, cent: c, isAdjustment: false }))
    const arr = b.arrotondamentoCent || 0
    if (arr !== 0) righe.push({ name: 'Arrotondamento', cent: arr, isAdjustment: true })
    const amountCent = righe.reduce((s, r) => s + r.cent, 0)
    // (2A.2) una sorella non può diventare negativa per l'arrotondamento
    if (amountCent < 0) throw new Error(`Importo sorella negativo (${amountCent} cent) dopo l'arrotondamento: non valido`)
    nuovo.spese.push({
      id: expenseId,
      expense_date: expenseDate ?? b.expense_date,
      amountCent,
      righe,
      groupId: b.groupId, paid_at: paidAt, payment_method: metodo ?? b.paymentMethod ?? null, documentId,
    })
    const nb = nuovo.bozze.find(x => x.id === b.id)!
    nb.status = 'confermata'; nb.expenseId = expenseId
    ids.push(expenseId)
  }
  nuovo.documenti.find(d => d.id === documentId)!.status = 'confermato'
  return { db: nuovo, expenseIds: ids }
}

// ① Conferma di uno SCONTRINO (rifiuta le fatture: hanno le loro RPC).
// Il TIPO si controlla PRIMA del ramo idempotente (2A.2).
export function confermaDocumento(db: Db, documentId: string,
  correzioni: CorrezioneSim[] = []): { db: Db; expenseIds: string[] } {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.kind === 'fattura')
    throw new Error('Tipo non valido: per le fatture usare approvaDaPagare / pagaFattura / confermaFatturaPagata')
  if (doc.status === 'confermato') {
    // idempotenza: doppio tocco ⇒ le spese già create, correzioni NON duplicate
    return { db, expenseIds: db.bozze.filter(b => b.documentId === documentId && b.expenseId).map(b => b.expenseId!) }
  }
  if (doc.status !== CONFERMABILE_DA) throw new Error(`Stato non valido per la conferma: ${doc.status}`)
  validaCorrezioni(db, documentId, correzioni)
  const r = creaSpeseDaBozze(db, documentId, null, null, null)
  registraCorrezioni(r.db, documentId, correzioni)
  return r
}

// ② Approvazione di una FATTURA revisionata ma NON pagata: passa a
// approvata_da_pagare SENZA creare spese (zero righe in family_expenses);
// pretende dati completi (totale, data documento, scadenza, fornitore).
export function approvaDaPagare(db: Db, documentId: string,
  correzioni: CorrezioneSim[] = []): Db {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.kind !== 'fattura') throw new Error('Tipo non valido: solo le fatture si approvano da pagare')
  if (doc.status === 'approvata_da_pagare') return db // idempotente (correzioni non duplicate)
  if (doc.status !== 'in_revisione') throw new Error(`Stato non valido: ${doc.status}`)
  validaFattura(db, doc, true)   // scadenza OBBLIGATORIA per una fattura da pagare
  validaCorrezioni(db, documentId, correzioni)
  const nuovo = clona(db)
  nuovo.documenti.find(d => d.id === documentId)!.status = 'approvata_da_pagare'
  registraCorrezioni(nuovo, documentId, correzioni)
  return nuovo
}

// ③ Pagamento di una fattura APPROVATA: RPC separata e idempotente.
// expense_date = paid_at = data REALE di pagamento (non la data fattura).
export function pagaFattura(db: Db, documentId: string, dataPagamento: string,
  metodo: string | null = null, correzioni: CorrezioneSim[] = []): { db: Db; expenseIds: string[] } {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.kind !== 'fattura') throw new Error('Tipo non valido: pagaFattura accetta solo fatture')
  if (doc.status === 'confermato') {
    return { db, expenseIds: db.bozze.filter(b => b.documentId === documentId && b.expenseId).map(b => b.expenseId!) }
  }
  if (doc.status !== PAGABILE_DA) throw new Error(`Stato non valido per il pagamento: ${doc.status}`)
  if (!dataPagamento) throw new Error('Data di pagamento obbligatoria')
  // il metodo può restare vuoto SOLO finché la fattura è "da pagare"
  if (!metodoValido(metodo)) throw new Error('Metodo di pagamento obbligatorio e valido quando la fattura viene pagata')
  validaCorrezioni(db, documentId, correzioni)
  const r = creaSpeseDaBozze(db, documentId, dataPagamento, dataPagamento, metodo)
  registraCorrezioni(r.db, documentId, correzioni)
  return r
}

// ④ Fattura GIÀ PAGATA al momento della revisione: conferma diretta con
// data e metodo espliciti; document_date resta la data della fattura,
// la spesa nasce con expense_date = paid_at = data reale di pagamento.
export function confermaFatturaPagata(db: Db, documentId: string, dataPagamento: string,
  metodo: string | null = null, correzioni: CorrezioneSim[] = []): { db: Db; expenseIds: string[] } {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.kind !== 'fattura') throw new Error('Tipo non valido: confermaFatturaPagata accetta solo fatture')
  if (doc.status === 'confermato') {
    return { db, expenseIds: db.bozze.filter(b => b.documentId === documentId && b.expenseId).map(b => b.expenseId!) }
  }
  if (doc.status !== 'in_revisione') throw new Error(`Stato non valido: ${doc.status}`)
  if (!dataPagamento) throw new Error('Data di pagamento obbligatoria')
  if (!metodoValido(metodo)) throw new Error('Metodo di pagamento obbligatorio e valido per una fattura già pagata')
  validaFattura(db, doc, false)  // scadenza facoltativa qui…
  validaCorrezioni(db, documentId, correzioni)
  const r = creaSpeseDaBozze(db, documentId, dataPagamento, dataPagamento, metodo)
  // …e se manca davvero viene posta = data di pagamento (scelta esplicita:
  // una fattura già pagata non ha più uno scadenzario da rispettare)
  const d = r.db.documenti.find(x => x.id === documentId)!
  if (!d.due_date) d.due_date = dataPagamento
  registraCorrezioni(r.db, documentId, correzioni)
  return r
}
