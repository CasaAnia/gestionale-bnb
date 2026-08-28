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
  righeCent: number[]
  arrotondamentoCent?: number
  expenseId?: string | null      // valorizzato alla conferma (unique per costruzione)
}
export type SpesaSim = {
  id: string
  expense_date: string           // per le fatture = data reale di pagamento
  amountCent: number             // SEMPRE = somma delle proprie righe
  righe: { name: string; cent: number; isAdjustment: boolean }[]
  groupId?: string | null
  paid_at?: string | null
  payment_method?: string | null
  documentId: string
}
export type Db = { documenti: DocumentoSim[]; bozze: BozzaSim[]; spese: SpesaSim[] }

const clona = (db: Db): Db => structuredClone(db)

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
    nuovo.spese.push({
      id: expenseId,
      expense_date: expenseDate ?? b.expense_date,
      amountCent: righe.reduce((s, r) => s + r.cent, 0),
      righe,
      groupId: b.groupId, paid_at: paidAt, payment_method: metodo, documentId,
    })
    const nb = nuovo.bozze.find(x => x.id === b.id)!
    nb.status = 'confermata'; nb.expenseId = expenseId
    ids.push(expenseId)
  }
  nuovo.documenti.find(d => d.id === documentId)!.status = 'confermato'
  return { db: nuovo, expenseIds: ids }
}

// ① Conferma di uno SCONTRINO (rifiuta le fatture: hanno le loro RPC).
export function confermaDocumento(db: Db, documentId: string): { db: Db; expenseIds: string[] } {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.status === 'confermato') {
    // idempotenza: doppio tocco/timeout/ripetizione ⇒ le spese già create
    return { db, expenseIds: db.bozze.filter(b => b.documentId === documentId && b.expenseId).map(b => b.expenseId!) }
  }
  if (doc.kind === 'fattura')
    throw new Error('Tipo non valido: per le fatture usare approvaDaPagare / pagaFattura / confermaFatturaPagata')
  if (doc.status !== CONFERMABILE_DA) throw new Error(`Stato non valido per la conferma: ${doc.status}`)
  return creaSpeseDaBozze(db, documentId, null, null, null)
}

// ② Approvazione di una FATTURA revisionata ma NON pagata: passa a
// approvata_da_pagare SENZA creare spese (zero righe in family_expenses);
// pretende dati completi (totale, data documento, scadenza, fornitore).
export function approvaDaPagare(db: Db, documentId: string): Db {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.status === 'approvata_da_pagare') return db // idempotente
  if (doc.kind !== 'fattura') throw new Error('Tipo non valido: solo le fatture si approvano da pagare')
  if (doc.status !== 'in_revisione') throw new Error(`Stato non valido: ${doc.status}`)
  if (doc.docTotalCent == null) throw new Error('Totale documento mancante')
  if (!doc.document_date) throw new Error('Data documento mancante')
  if (!doc.due_date) throw new Error('Scadenza mancante')
  if (!doc.supplier) throw new Error('Fornitore mancante')
  const attive = db.bozze.filter(b => b.documentId === documentId && (BOZZA_ATTIVA as string[]).includes(b.status))
  if (!attive.length) throw new Error('Nessuna bozza attiva: niente da approvare')
  const q = quadraturaDocumento(doc.docTotalCent,
    attive.map(b => ({ righeCent: b.righeCent, arrotondamentoCent: b.arrotondamentoCent })))
  if (!q.ok) throw new Error(`Quadratura non esatta: ${q.motivo}`)
  const nuovo = clona(db)
  nuovo.documenti.find(d => d.id === documentId)!.status = 'approvata_da_pagare'
  return nuovo
}

// ③ Pagamento di una fattura APPROVATA: RPC separata e idempotente.
// expense_date = paid_at = data REALE di pagamento (non la data fattura).
export function pagaFattura(db: Db, documentId: string, dataPagamento: string,
  metodo: string | null = null): { db: Db; expenseIds: string[] } {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.status === 'confermato') {
    return { db, expenseIds: db.bozze.filter(b => b.documentId === documentId && b.expenseId).map(b => b.expenseId!) }
  }
  if (doc.kind !== 'fattura') throw new Error('Tipo non valido: pagaFattura accetta solo fatture')
  if (doc.status !== PAGABILE_DA) throw new Error(`Stato non valido per il pagamento: ${doc.status}`)
  if (!dataPagamento) throw new Error('Data di pagamento obbligatoria')
  return creaSpeseDaBozze(db, documentId, dataPagamento, dataPagamento, metodo)
}

// ④ Fattura GIÀ PAGATA al momento della revisione: conferma diretta con
// data e metodo espliciti; document_date resta la data della fattura,
// la spesa nasce con expense_date = paid_at = data reale di pagamento.
export function confermaFatturaPagata(db: Db, documentId: string, dataPagamento: string,
  metodo: string | null = null): { db: Db; expenseIds: string[] } {
  const doc = db.documenti.find(d => d.id === documentId)
  if (!doc) throw new Error('Documento inesistente')
  if (doc.status === 'confermato') {
    return { db, expenseIds: db.bozze.filter(b => b.documentId === documentId && b.expenseId).map(b => b.expenseId!) }
  }
  if (doc.kind !== 'fattura') throw new Error('Tipo non valido: confermaFatturaPagata accetta solo fatture')
  if (doc.status !== 'in_revisione') throw new Error(`Stato non valido: ${doc.status}`)
  if (!dataPagamento) throw new Error('Data di pagamento obbligatoria')
  return creaSpeseDaBozze(db, documentId, dataPagamento, dataPagamento, metodo)
}
