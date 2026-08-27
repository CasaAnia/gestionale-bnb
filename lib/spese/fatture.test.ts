// Test del nuovo modello documenti/bozze/spese (Fase 2A). Dati SINTETICI.
// Copre: invariante economica delle fatture, conferma atomica, idempotenza,
// stati e transizioni, avvisi, duplicati, coerenza canonica.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  type Db, impegnatoCent, scadute, spesoCent,
  confermaDocumento, approvaDaPagare, pagaFattura,
} from './fatture.ts'
import { transizioneDocumentoValida, transizioneBozzaValida } from './stati.ts'
import { quadraturaDocumento, avvisiBozza, canonicaCoerente, possibileDuplicato } from './controlli.ts'
import { monthRange } from './periodo.ts'

// ---- mondo sintetico: una fattura di agosto da 250 € e uno scontrino ----
function dbBase(): Db {
  return {
    documenti: [
      { id: 'doc-fatt', kind: 'fattura', status: 'in_revisione', docTotalCent: 25000,
        document_date: '2026-08-05', due_date: '2026-08-20' },
      { id: 'doc-scontr', kind: 'scontrino', status: 'in_revisione', docTotalCent: 1547 },
    ],
    bozze: [
      { id: 'b-fatt', documentId: 'doc-fatt', status: 'da_controllare',
        expense_date: '2026-08-05', groupId: 'g-bnb', righeCent: [25000] },
      // scontrino misto: due bozze sorelle (casa + B&B) sullo stesso documento
      { id: 'b-casa', documentId: 'doc-scontr', status: 'da_controllare',
        expense_date: '2026-08-10', groupId: 'g-casa', righeCent: [1133] },
      { id: 'b-bnb', documentId: 'doc-scontr', status: 'pronta',
        expense_date: '2026-08-10', groupId: 'g-bnb', righeCent: [414] },
    ],
    spese: [],
  }
}

// ============================================================
// Invariante economica delle fatture
// ============================================================

test('fattura ricevuta e non pagata: ZERO righe tra le spese, ma presente in Impegnato', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')
  assert.equal(db.spese.length, 0)                              // niente in family_expenses
  assert.equal(impegnatoCent(db), 25000)                        // Impegnato/Da pagare
  assert.equal(spesoCent(db, monthRange('2026-08')), 0)         // e niente nello Speso
  assert.equal(db.documenti.find(d => d.id === 'doc-fatt')!.status, 'approvata_da_pagare')
})

test('scaduta è derivato: non pagata + oltre scadenza', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')
  assert.equal(scadute(db, '2026-08-15').length, 0)             // prima della scadenza
  assert.equal(scadute(db, '2026-08-27').length, 1)             // dopo
  const { db: pagato } = pagaFattura(db, 'doc-fatt', '2026-09-02')
  assert.equal(scadute(pagato, '2026-09-27').length, 0)         // pagata: mai più scaduta
})

test('pagamento: creazione atomica con expense_date = paid_at', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')
  const { db: dopo, expenseIds } = pagaFattura(db, 'doc-fatt', '2026-09-02', 'bonifico')
  assert.equal(expenseIds.length, 1)
  const spesa = dopo.spese[0]
  assert.equal(spesa.expense_date, '2026-09-02')                // data REALE di pagamento
  assert.equal(spesa.paid_at, '2026-09-02')
  assert.equal(spesa.payment_method, 'bonifico')
  assert.equal(spesa.amountCent, 25000)
  // il documento conserva la data della fattura e la scadenza
  const doc = dopo.documenti.find(d => d.id === 'doc-fatt')!
  assert.equal(doc.document_date, '2026-08-05')
  assert.equal(doc.due_date, '2026-08-20')
  assert.equal(doc.status, 'confermato')
  assert.equal(impegnatoCent(dopo), 0)                          // via dall'Impegnato
})

test('fattura di agosto pagata a settembre: conta nello Speso di settembre', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')
  const { db: dopo } = pagaFattura(db, 'doc-fatt', '2026-09-02')
  assert.equal(spesoCent(dopo, monthRange('2026-08')), 0)       // agosto: niente
  assert.equal(spesoCent(dopo, monthRange('2026-09')), 25000)   // settembre: 250 €
})

test('secondo tentativo di pagamento: nessun duplicato (idempotente)', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')
  const { db: dopo1, expenseIds: ids1 } = pagaFattura(db, 'doc-fatt', '2026-09-02')
  const { db: dopo2, expenseIds: ids2 } = pagaFattura(dopo1, 'doc-fatt', '2026-09-05', 'contanti')
  assert.equal(dopo2.spese.length, 1)                           // sempre UNA spesa
  assert.deepEqual(ids2, ids1)                                  // le stesse spese di prima
  assert.equal(dopo2.spese[0].expense_date, '2026-09-02')       // la data vera resta
})

test('il metodo di pagamento può restare vuoto finché la fattura non è pagata', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')
  const { db: dopo } = pagaFattura(db, 'doc-fatt', '2026-09-02') // senza metodo
  assert.equal(dopo.spese[0].payment_method, null)
})

// ============================================================
// Conferma atomica e idempotente (scontrino misto)
// ============================================================

test('conferma scontrino misto: due spese sorelle in un colpo, bozze collegate', () => {
  const { db, expenseIds } = confermaDocumento(dbBase(), 'doc-scontr')
  assert.equal(expenseIds.length, 2)
  assert.equal(db.spese.length, 2)
  assert.deepEqual(db.spese.map(e => e.amountCent).sort((a, b) => a - b), [414, 1133])
  // collegamento certo bozza → spesa
  for (const b of db.bozze.filter(x => x.documentId === 'doc-scontr')) {
    assert.equal(b.status, 'confermata')
    assert.ok(b.expenseId)
  }
  assert.equal(db.documenti.find(d => d.id === 'doc-scontr')!.status, 'confermato')
})

test('doppio tocco sulla conferma: idempotente, zero doppioni', () => {
  const prima = confermaDocumento(dbBase(), 'doc-scontr')
  const seconda = confermaDocumento(prima.db, 'doc-scontr')
  assert.equal(seconda.db.spese.length, 2)
  assert.deepEqual(seconda.expenseIds.sort(), prima.expenseIds.sort())
})

test('quadratura non esatta: conferma rifiutata e NESSUNA spesa creata (atomicità)', () => {
  const db = dbBase()
  db.documenti[1].docTotalCent = 1548                           // 1 centesimo non dichiarato
  assert.throws(() => confermaDocumento(db, 'doc-scontr'), /Quadratura non esatta/)
  assert.equal(db.spese.length, 0)                              // il db di partenza è intatto
  assert.ok(db.bozze.every(b => b.status !== 'confermata'))
})

test('arrotondamento dichiarato: la stessa differenza diventa valida', () => {
  const db = dbBase()
  db.documenti[1].docTotalCent = 1548
  db.bozze.find(b => b.id === 'b-bnb')!.arrotondamentoCent = 1  // letto dal documento
  const { db: dopo } = confermaDocumento(db, 'doc-scontr')
  assert.equal(dopo.spese.length, 2)
})

test('stati non validi: conferma e pagamento rifiutati', () => {
  const db = dbBase()
  db.documenti[0].status = 'da_elaborare'
  assert.throws(() => confermaDocumento(db, 'doc-fatt'), /Stato non valido/)
  assert.throws(() => pagaFattura(db, 'doc-fatt', '2026-09-02'), /Stato non valido/)
  assert.throws(() => confermaDocumento(db, 'doc-inesistente'), /inesistente/)
})

test('totale documento mancante: conferma bloccata', () => {
  const db = dbBase()
  db.documenti[1].docTotalCent = null
  assert.throws(() => confermaDocumento(db, 'doc-scontr'), /totale documento mancante/)
})

// ============================================================
// Stati e transizioni
// ============================================================

test('transizioni documento: solo quelle dichiarate', () => {
  assert.ok(transizioneDocumentoValida('da_elaborare', 'in_revisione'))
  assert.ok(transizioneDocumentoValida('in_revisione', 'approvata_da_pagare'))
  assert.ok(transizioneDocumentoValida('approvata_da_pagare', 'confermato'))
  assert.ok(transizioneDocumentoValida('errore', 'da_elaborare'))       // nuovo tentativo
  assert.ok(!transizioneDocumentoValida('confermato', 'in_revisione'))  // finale
  assert.ok(!transizioneDocumentoValida('approvata_da_pagare', 'scartato'))
  assert.ok(!transizioneDocumentoValida('scartato', 'da_elaborare'))
})

test('transizioni bozza: confermata e scartata sono finali', () => {
  assert.ok(transizioneBozzaValida('da_controllare', 'pronta'))
  assert.ok(transizioneBozzaValida('pronta', 'da_controllare'))
  assert.ok(transizioneBozzaValida('da_controllare', 'scartata'))
  assert.ok(!transizioneBozzaValida('confermata', 'da_controllare'))
  assert.ok(!transizioneBozzaValida('scartata', 'pronta'))
})

// ============================================================
// Controlli: quadratura sorelle, avvisi, canoniche, duplicati
// ============================================================

test('quadratura sulle sorelle: somma di TUTTE le bozze del documento', () => {
  assert.ok(quadraturaDocumento(1547, [{ righeCent: [1133] }, { righeCent: [414] }]).ok)
  const ko = quadraturaDocumento(1547, [{ righeCent: [1133] }])   // manca una sorella
  assert.ok(!ko.ok)
  assert.equal(ko.diffCent, 414)
})

test('avvisi non bloccanti: data pre-novembre 2024, futura, sottocategoria, confidence', () => {
  const avvisi = avvisiBozza({
    expense_date: '2024-10-15', group_id: null,
    confidence: { store: { confidence: 0.5, doubt_reason: 'foto sfocata' } },
  }, '2026-08-28')
  const campi = avvisi.map(a => a.campo)
  assert.ok(campi.includes('expense_date'))      // pre novembre 2024
  assert.ok(campi.includes('subcategory'))       // "Non specificata"
  assert.ok(campi.includes('group_id'))
  assert.ok(campi.includes('store'))             // confidence 0,5 < 0,8
  // sono AVVISI: nessuno di questi blocca (lo dimostra la conferma che
  // guarda solo la quadratura, testata sopra)
  assert.equal(avvisiBozza({ expense_date: '2026-08-10', group_id: 'g', subcategory: 'Pane' }, '2026-08-28').length, 0)
  assert.equal(avvisiBozza({ expense_date: '2026-09-01', group_id: 'g', subcategory: 'Pane' }, '2026-08-28')[0].messaggio, 'data futura')
})

test('coerenza canonica: la sottocategoria deve appartenere alla categoria', () => {
  const sotts = [
    { id: 's-libri', canonical_category_id: 'c-scuola' },
    { id: 's-benzina', canonical_category_id: 'c-auto' },
  ]
  assert.ok(canonicaCoerente({ canonical_category_id: 'c-scuola', canonical_subcategory_id: 's-libri' }, sotts))
  assert.ok(!canonicaCoerente({ canonical_category_id: 'c-auto', canonical_subcategory_id: 's-libri' }, sotts))
  assert.ok(!canonicaCoerente({ canonical_subcategory_id: 's-libri' }, sotts))  // sottocategoria senza categoria
  assert.ok(canonicaCoerente({ canonical_category_id: 'c-auto' }, sotts))       // sottocategoria facoltativa
})

test('duplicati: certo per stesso file, probabile per negozio+data+totale', () => {
  const a = { date: '2026-08-10', totCent: 4734, store: 'Supermercato Rozzano', sha256: 'abc' }
  assert.equal(possibileDuplicato(a, { ...a }), 'certo')
  assert.equal(possibileDuplicato(a, { ...a, sha256: 'xyz' }), 'probabile')
  assert.equal(possibileDuplicato(a, { ...a, sha256: null, store: 'Supermercato' }), 'possibile')
  assert.equal(possibileDuplicato(a, { ...a, sha256: null, totCent: 4735 }), null)
})
