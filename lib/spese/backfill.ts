// Verifica ESATTA del backfill storico (Fase 2A.1) — modello PURO dei
// controlli della sezione 8 della 0020: coppia per coppia, mai un semplice
// count(*) globale. Testabile senza database.

export type SpesaStorica = { id: string; receipt_id: string | null }
export type ReceiptStorico = { id: string; document_id: string | null }
export type Collegamento = { expenseId: string; documentId: string; origine: 'app' | 'backfill_0020' }
export type DocumentoDerivato = { id: string; docTotalCent: number | null; derivato: boolean }

export type EsitoBackfill = { ok: boolean; errori: string[] }

export function verificaBackfillEsatto(
  spese: SpesaStorica[],
  receipts: ReceiptStorico[],
  ponte: Collegamento[],
  documenti: DocumentoDerivato[] = [],
  importiCent: Record<string, number> = {},   // expenseId → importo (per il totale derivato)
): EsitoBackfill {
  const errori: string[] = []
  const receiptById = new Map(receipts.map(r => [r.id, r]))

  // (a) ogni coppia storica attesa expense↔document esiste nel ponte
  const chiavePonte = new Set(ponte.map(l => `${l.expenseId}|${l.documentId}`))
  const coppieAttese: [string, string][] = []
  for (const e of spese) {
    if (!e.receipt_id) continue
    const r = receiptById.get(e.receipt_id)
    if (!r) { errori.push(`spesa ${e.id}: receipt inesistente`); continue }
    if (!r.document_id) { errori.push(`ricevuta ${r.id}: senza documento`); continue }
    coppieAttese.push([e.id, r.document_id])
    if (!chiavePonte.has(`${e.id}|${r.document_id}`))
      errori.push(`coppia MANCANTE nel ponte: ${e.id} ↔ ${r.document_id}`)
  }

  // (b) nessuna coppia di backfill errata o eccedente
  const attesaSet = new Set(coppieAttese.map(([a, b]) => `${a}|${b}`))
  for (const l of ponte) {
    if (l.origine !== 'backfill_0020') continue   // i collegamenti NUOVI dell'app non c'entrano
    if (!attesaSet.has(`${l.expenseId}|${l.documentId}`))
      errori.push(`coppia di backfill ERRATA o ECCEDENTE: ${l.expenseId} ↔ ${l.documentId}`)
  }

  // (c) due ricevute storiche fuse sullo stesso documento (backfill 1:1)
  const perDoc = new Map<string, number>()
  for (const r of receipts) if (r.document_id)
    perDoc.set(r.document_id, (perDoc.get(r.document_id) || 0) + 1)
  for (const [doc, n] of perDoc) if (n > 1)
    errori.push(`documento ${doc}: ${n} ricevute FUSE (atteso 1:1)`)

  // (d) totale derivato = somma ESATTA delle spese sorelle collegate
  for (const d of documenti) {
    if (!d.derivato) continue
    const somma = ponte.filter(l => l.documentId === d.id)
      .reduce((s, l) => s + (importiCent[l.expenseId] ?? 0), 0)
    if ((d.docTotalCent ?? 0) !== somma)
      errori.push(`documento ${d.id}: totale derivato ${d.docTotalCent} ≠ somma sorelle ${somma}`)
  }

  return { ok: errori.length === 0, errori }
}
