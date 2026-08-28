// Test del nuovo modello documenti/bozze/spese (Fase 2A). Dati SINTETICI.
// Copre: invariante economica delle fatture, conferma atomica, idempotenza,
// stati e transizioni, avvisi, duplicati, coerenza canonica.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  type Db, impegnatoCent, scadute, spesoCent,
  confermaDocumento, approvaDaPagare, pagaFattura, confermaFatturaPagata, eliminaSpesa,
} from './fatture.ts'
import { modificaMembro, puoAccedereAiDati, puoGestireMembri, type Membro } from './sicurezza.ts'
import { scartaDocumento, SORGENTI_CORREZIONE } from './fatture.ts'
import { verificaBackfillEsatto } from './backfill.ts'
import { transizioneDocumentoValida, transizioneBozzaValida } from './stati.ts'
import { quadraturaDocumento, avvisiBozza, canonicaCoerente, possibileDuplicato } from './controlli.ts'
import { monthRange } from './periodo.ts'

// ---- mondo sintetico: una fattura di agosto da 250 € e uno scontrino ----
function dbBase(): Db {
  return {
    documenti: [
      { id: 'doc-fatt', kind: 'fattura', status: 'in_revisione', docTotalCent: 25000,
        document_date: '2026-08-05', due_date: '2026-08-20', supplier: 'Fornitore Prova' },
      { id: 'doc-scontr', kind: 'scontrino', status: 'in_revisione', docTotalCent: 1547 },
    ],
    bozze: [
      { id: 'b-fatt', documentId: 'doc-fatt', status: 'da_controllare',
        expense_date: '2026-08-05', groupId: 'g-bnb', groupAmbito: 'azienda', righeCent: [25000] },
      // scontrino misto: due bozze sorelle (casa + B&B) sullo stesso documento
      { id: 'b-casa', documentId: 'doc-scontr', status: 'da_controllare',
        expense_date: '2026-08-10', groupId: 'g-casa', groupAmbito: 'personale', righeCent: [1133] },
      { id: 'b-bnb', documentId: 'doc-scontr', status: 'pronta',
        expense_date: '2026-08-10', groupId: 'g-bnb', groupAmbito: 'azienda',
        paymentMethod: 'carta_attivita', righeCent: [414] },
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
  const { db: pagato } = pagaFattura(db, 'doc-fatt', '2026-09-02', 'bonifico')
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
  const { db: dopo } = pagaFattura(db, 'doc-fatt', '2026-09-02', 'bonifico')
  assert.equal(spesoCent(dopo, monthRange('2026-08')), 0)       // agosto: niente
  assert.equal(spesoCent(dopo, monthRange('2026-09')), 25000)   // settembre: 250 €
})

test('secondo tentativo di pagamento: nessun duplicato (idempotente)', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')
  const { db: dopo1, expenseIds: ids1 } = pagaFattura(db, 'doc-fatt', '2026-09-02', 'bonifico')
  const { db: dopo2, expenseIds: ids2 } = pagaFattura(dopo1, 'doc-fatt', '2026-09-05', 'contanti')
  assert.equal(dopo2.spese.length, 1)                           // sempre UNA spesa
  assert.deepEqual(ids2, ids1)                                  // le stesse spese di prima
  assert.equal(dopo2.spese[0].expense_date, '2026-09-02')       // la data vera resta
})

test('metodo di pagamento: vuoto solo finché "da pagare"; obbligatorio e valido al pagamento', () => {
  const db = approvaDaPagare(dbBase(), 'doc-fatt')     // approvata SENZA metodo: ok
  assert.throws(() => pagaFattura(db, 'doc-fatt', '2026-09-02'), /Metodo di pagamento obbligatorio/)
  assert.throws(() => pagaFattura(db, 'doc-fatt', '2026-09-02', 'assegno'), /obbligatorio e valido/)
  assert.throws(() => confermaFatturaPagata(dbBase(), 'doc-fatt', '2026-08-06'), /obbligatorio e valido/)
  const { db: dopo } = pagaFattura(db, 'doc-fatt', '2026-09-02', 'bonifico')
  assert.equal(dopo.spese[0].payment_method, 'bonifico')
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
  db.documenti[1].status = 'da_elaborare'
  assert.throws(() => confermaDocumento(db, 'doc-scontr'), /Stato non valido/)
  db.documenti[0].status = 'da_elaborare'
  assert.throws(() => pagaFattura(db, 'doc-fatt', '2026-09-02', 'bonifico'), /Stato non valido/)
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
  assert.ok(!campi.includes('group_id'))  // il gruppo NON è più un avviso: è bloccante (2A.1)
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

// ============================================================
// 2A.1 — tipi per RPC, fattura già pagata, gruppo bloccante,
//        arrotondamenti nelle righe definitive
// ============================================================

test('tipo sbagliato per ogni RPC: fatture e scontrini non si scambiano', () => {
  const db = dbBase()
  assert.throws(() => confermaDocumento(db, 'doc-fatt'), /Tipo non valido/)          // fattura → no conferma scontrino
  assert.throws(() => approvaDaPagare(db, 'doc-scontr'), /Tipo non valido/)          // scontrino → no approva fattura
  assert.throws(() => pagaFattura(db, 'doc-scontr', '2026-09-02', 'bonifico'), /Tipo non valido/)
  assert.throws(() => confermaFatturaPagata(db, 'doc-scontr', '2026-09-02', 'bonifico'), /Tipo non valido/)
})

test('approvazione fattura: pretende totale, data documento, scadenza e fornitore', () => {
  for (const campo of ['docTotalCent', 'document_date', 'due_date', 'supplier'] as const) {
    const db = dbBase()
    const doc = db.documenti[0] as unknown as Record<string, unknown>
    doc[campo] = null
    assert.throws(() => approvaDaPagare(db, 'doc-fatt'), /mancante/)
  }
})

test('doppia approvazione: idempotente', () => {
  const db1 = approvaDaPagare(dbBase(), 'doc-fatt')
  const db2 = approvaDaPagare(db1, 'doc-fatt')
  assert.equal(db2.documenti.find(d => d.id === 'doc-fatt')!.status, 'approvata_da_pagare')
  assert.equal(db2.spese.length, 0)
})

test('fattura già pagata durante la revisione: RPC dedicata, document_date conservata', () => {
  const { db, expenseIds } = confermaFatturaPagata(dbBase(), 'doc-fatt', '2026-08-06', 'carta_attivita')
  assert.equal(expenseIds.length, 1)
  assert.equal(db.spese[0].expense_date, '2026-08-06')            // = paid_at
  assert.equal(db.spese[0].paid_at, '2026-08-06')
  assert.equal(db.documenti[0].document_date, '2026-08-05')       // la data fattura resta
  // idempotente anche lei
  const seconda = confermaFatturaPagata(db, 'doc-fatt', '2026-08-07', 'bonifico')
  assert.equal(seconda.db.spese.length, 1)
})

test('gruppo mancante: BLOCCANTE alla conferma (non un avviso)', () => {
  const db = dbBase()
  db.bozze.find(b => b.id === 'b-casa')!.groupId = null
  assert.throws(() => confermaDocumento(db, 'doc-scontr'), /senza gruppo/)
  assert.equal(db.spese.length, 0)
})

test('arrotondamento +1: riga esplicita, somma righe = spesa madre, sorelle = documento', () => {
  const db = dbBase()
  db.documenti[1].docTotalCent = 1548
  db.bozze.find(b => b.id === 'b-bnb')!.arrotondamentoCent = 1
  const { db: dopo } = confermaDocumento(db, 'doc-scontr')
  const conArr = dopo.spese.find(e => e.righe.some(r => r.isAdjustment))!
  assert.equal(conArr.righe.at(-1)!.name, 'Arrotondamento')
  assert.equal(conArr.righe.at(-1)!.cent, 1)
  // somma righe definitive = importo della spesa madre, per OGNI sorella
  for (const e of dopo.spese)
    assert.equal(e.amountCent, e.righe.reduce((s, r) => s + r.cent, 0))
  // somma sorelle definitive = totale documento (arrotondamento sulla sorella giusta)
  assert.equal(dopo.spese.reduce((s, e) => s + e.amountCent, 0), 1548)
  assert.equal(conArr.amountCent, 415)                            // 414 + 1 alla sorella B&B
})

test('arrotondamento -1: negativo conservato, totali sempre quadrati', () => {
  const db = dbBase()
  db.documenti[1].docTotalCent = 1546
  db.bozze.find(b => b.id === 'b-casa')!.arrotondamentoCent = -1
  const { db: dopo } = confermaDocumento(db, 'doc-scontr')
  const conArr = dopo.spese.find(e => e.righe.some(r => r.isAdjustment))!
  assert.equal(conArr.righe.at(-1)!.cent, -1)
  assert.equal(conArr.amountCent, 1132)                           // 1133 - 1 alla sorella Casa
  assert.equal(dopo.spese.reduce((s, e) => s + e.amountCent, 0), 1546)
})

test('fattura con arrotondamento: la somma delle sorelle resta = doc_total', () => {
  const db = dbBase()
  db.documenti[0].docTotalCent = 25001
  db.bozze.find(b => b.id === 'b-fatt')!.arrotondamentoCent = 1
  const approvato = approvaDaPagare(db, 'doc-fatt')
  const { db: dopo } = pagaFattura(approvato, 'doc-fatt', '2026-09-02', 'bonifico')
  assert.equal(dopo.spese[0].amountCent, 25001)
  assert.ok(dopo.spese[0].righe.some(r => r.isAdjustment && r.cent === 1))
})

// ============================================================
// 2A.1 — ultimo owner e verifica esatta del backfill (modelli puri)
// ============================================================

test("ultimo owner: impossibile eliminarlo o declassarlo; con due owner si può", () => {
  const unoSolo: Membro[] = [{ userId: 'u1', role: 'owner' }, { userId: 'u2', role: 'member' }]
  assert.throws(() => modificaMembro(unoSolo, 'u1', { tipo: 'rimuovi' }), /ULTIMO owner/)
  assert.throws(() => modificaMembro(unoSolo, 'u1', { tipo: 'cambia_ruolo', ruolo: 'member' }), /ULTIMO owner/)
  const due: Membro[] = [{ userId: 'u1', role: 'owner' }, { userId: 'u2', role: 'owner' }]
  assert.equal(modificaMembro(due, 'u1', { tipo: 'rimuovi' }).length, 1)
  // e il membro normale si gestisce liberamente
  assert.equal(modificaMembro(unoSolo, 'u2', { tipo: 'rimuovi' }).length, 1)
})

test('accessi: niente anonimi, niente autenticati fuori lista; gestione solo owner', () => {
  const membri: Membro[] = [{ userId: 'ania', role: 'owner' }, { userId: 'teo', role: 'member' }]
  assert.ok(!puoAccedereAiDati(membri, null))            // anonimo
  assert.ok(!puoAccedereAiDati(membri, 'estraneo'))      // autenticato ma non in lista
  assert.ok(puoAccedereAiDati(membri, 'teo'))
  assert.ok(puoGestireMembri(membri, 'ania'))
  assert.ok(!puoGestireMembri(membri, 'teo'))
})

test('backfill: coppie esatte ok; mancante, errata/eccedente e ricevute fuse rilevate', () => {
  const spese = [{ id: 'e1', receipt_id: 'r1' }, { id: 'e2', receipt_id: 'r1' }, { id: 'e3', receipt_id: null }]
  const receipts = [{ id: 'r1', document_id: 'd1' }]
  const ponteOk = [
    { expenseId: 'e1', documentId: 'd1', origine: 'backfill_0020' as const },
    { expenseId: 'e2', documentId: 'd1', origine: 'backfill_0020' as const },
  ]
  assert.ok(verificaBackfillEsatto(spese, receipts, ponteOk).ok)
  // coppia mancante
  const manca = verificaBackfillEsatto(spese, receipts, ponteOk.slice(0, 1))
  assert.ok(!manca.ok && manca.errori.some(e => e.includes('MANCANTE')))
  // coppia eccedente/errata di backfill
  const eccede = verificaBackfillEsatto(spese, receipts,
    [...ponteOk, { expenseId: 'e3', documentId: 'd1', origine: 'backfill_0020' as const }])
  assert.ok(!eccede.ok && eccede.errori.some(e => e.includes('ECCEDENTE')))
  // i collegamenti NUOVI dell'app non sono considerati eccedenti
  assert.ok(verificaBackfillEsatto(spese, receipts,
    [...ponteOk, { expenseId: 'e3', documentId: 'd1', origine: 'app' as const }]).ok)
  // ricevuta senza documento
  const senzaDoc = verificaBackfillEsatto(spese, [{ id: 'r1', document_id: null }], [])
  assert.ok(!senzaDoc.ok && senzaDoc.errori.some(e => e.includes('senza documento')))
  // due ricevute STORICHE fuse sullo stesso documento di backfill
  const fuse = verificaBackfillEsatto(spese,
    [{ id: 'r1', document_id: 'd1' }, { id: 'r2', document_id: 'd1' }], ponteOk,
    [{ id: 'd1', docTotalCent: null, derivato: true }])
  assert.ok(!fuse.ok && fuse.errori.some(e => e.includes('FUSE')))
  // un documento NUOVO multipagina (derivato=false) con più file è legittimo
  const multipagina = verificaBackfillEsatto(spese,
    [{ id: 'r1', document_id: 'd1' }, { id: 'r-pag2', document_id: 'd-nuovo' }, { id: 'r-pag3', document_id: 'd-nuovo' }],
    ponteOk, [{ id: 'd1', docTotalCent: null, derivato: true }, { id: 'd-nuovo', docTotalCent: null, derivato: false }])
  assert.ok(multipagina.ok)
  // totale derivato diverso dalla somma delle sorelle
  const tot = verificaBackfillEsatto(spese, receipts, ponteOk,
    [{ id: 'd1', docTotalCent: 999, derivato: true }], { e1: 500, e2: 400 })
  assert.ok(!tot.ok && tot.errori.some(e => e.includes('somma sorelle')))
  assert.ok(verificaBackfillEsatto(spese, receipts, ponteOk,
    [{ id: 'd1', docTotalCent: 900, derivato: true }], { e1: 500, e2: 400 }).ok)
})

// ============================================================
// 2A.2 — spese documentate protette, sorelle mai negative,
//        scadenze, correzioni atomiche
// ============================================================

test('spesa documentata: la X non può farla sparire (restrict); la manuale sì', () => {
  const { db } = confermaDocumento(dbBase(), 'doc-scontr')
  const documentata = db.spese[0].id
  assert.throws(() => eliminaSpesa(db, documentata), /annullamento esplicito/)
  assert.equal(db.spese.length, 2)                       // nulla è sparito
  const conManuale = structuredClone(db)
  conManuale.spese.push({ id: 'e-manuale', expense_date: '2026-08-20', amountCent: 6000, righe: [{ name: 'Benzina', cent: 6000, isAdjustment: false }], documentId: null })
  const dopo = eliminaSpesa(conManuale, 'e-manuale')     // manuale senza documento: come oggi
  assert.equal(dopo.spese.length, 2)
})

test('arrotondamento che renderebbe negativa una sorella: bloccato', () => {
  const db = dbBase()
  db.documenti[1].docTotalCent = 1133                    // 1133 + 414 - 415 + 1? no: forza il caso
  db.bozze.find(b => b.id === 'b-bnb')!.arrotondamentoCent = -415
  db.documenti[1].docTotalCent = 1133 + 414 - 415
  assert.throws(() => confermaDocumento(db, 'doc-scontr'), /Importo sorella negativo/)
  assert.equal(db.spese.length, 0)
})

test('scontrino con righe Casa Ania: metodo obbligatorio; solo personale: facoltativo', () => {
  const senzaMetodo = dbBase()
  senzaMetodo.bozze.find(b => b.id === 'b-bnb')!.paymentMethod = null
  assert.throws(() => confermaDocumento(senzaMetodo, 'doc-scontr'), /righe Casa Ania/)
  // solo personale: nessun obbligo
  const soloCasa = dbBase()
  soloCasa.documenti[1].docTotalCent = 1133
  soloCasa.bozze = soloCasa.bozze.filter(b => b.id !== 'b-bnb')
  const { db } = confermaDocumento(soloCasa, 'doc-scontr')
  assert.equal(db.spese[0].payment_method, null)
})

test('approvazione: gruppo mancante blocca anche lo scadenzario', () => {
  const db = dbBase()
  db.bozze.find(b => b.id === 'b-fatt')!.groupId = null
  assert.throws(() => approvaDaPagare(db, 'doc-fatt'), /senza gruppo/)
})

test('scadenza: obbligatoria per approvare; per una già pagata NON si inventa (resta null)', () => {
  const senzaScadenza = dbBase()
  senzaScadenza.documenti[0].due_date = null
  assert.throws(() => approvaDaPagare(senzaScadenza, 'doc-fatt'), /Scadenza mancante/)
  // 2A.3: document_date, due_date e paid_at sono informazioni diverse —
  // se la fattura già pagata non riporta una scadenza, resta NULL
  const { db } = confermaFatturaPagata(senzaScadenza, 'doc-fatt', '2026-08-06', 'bonifico')
  assert.equal(db.documenti[0].due_date, null)
  assert.equal(db.spese[0].paid_at, '2026-08-06')
  assert.equal(db.documenti[0].document_date, '2026-08-05')
})

test('tipo controllato PRIMA dell\'idempotenza: paga_fattura su scontrino confermato', () => {
  const { db } = confermaDocumento(dbBase(), 'doc-scontr')
  assert.throws(() => pagaFattura(db, 'doc-scontr', '2026-09-02', 'bonifico'), /Tipo non valido/)
  assert.throws(() => confermaFatturaPagata(db, 'doc-scontr', '2026-09-02', 'bonifico'), /Tipo non valido/)
})

test('correzioni: zero correzioni ok; categoria e importo registrate col documento', () => {
  const { db } = confermaDocumento(dbBase(), 'doc-scontr', [])
  assert.equal((db.correzioni || []).length, 0)
  const { db: con } = confermaDocumento(dbBase(), 'doc-scontr', [
    { field: 'categoria', proposed: 'Varie', corrected: 'Detersivi', draftId: 'b-bnb', ruleApplied: 'aceto→Detersivi' },
    { field: 'importo', proposed: 413, corrected: 414, draftId: 'b-bnb' },
  ])
  assert.equal(con.correzioni!.length, 2)
  assert.ok(con.correzioni!.every(c => c.documentId === 'doc-scontr'))
  assert.equal(con.correzioni![0].field, 'categoria')
})

test('correzioni: bozza di un altro documento respinta e NESSUNA spesa creata', () => {
  const db = dbBase()
  assert.throws(() => confermaDocumento(db, 'doc-scontr', [
    { field: 'importo', draftId: 'b-fatt' },              // appartiene a doc-fatt!
  ]), /non appartiene al documento/)
  assert.equal(db.spese.length, 0)
  assert.equal((db.correzioni || []).length, 0)
  // stessa cosa per un campo mancante (errore nel log ⇒ niente spese)
  assert.throws(() => confermaDocumento(db, 'doc-scontr', [{ field: '' }]), /senza campo/)
  assert.equal(db.spese.length, 0)
})

test('doppia conferma: nessuna correzione duplicata', () => {
  const prima = confermaDocumento(dbBase(), 'doc-scontr', [{ field: 'negozio', corrected: 'X' }])
  assert.equal(prima.db.correzioni!.length, 1)
  const seconda = confermaDocumento(prima.db, 'doc-scontr', [{ field: 'negozio', corrected: 'X' }])
  assert.equal(seconda.db.correzioni!.length, 1)          // ramo idempotente: non registra
})

test('anche approvazione e pagamento registrano correzioni nella stessa operazione', () => {
  const approvato = approvaDaPagare(dbBase(), 'doc-fatt', [{ field: 'fornitore', corrected: 'Fornitore Prova' }])
  assert.equal(approvato.correzioni!.length, 1)
  const doppia = approvaDaPagare(approvato, 'doc-fatt', [{ field: 'fornitore', corrected: 'Fornitore Prova' }])
  assert.equal(doppia.correzioni!.length, 1)              // idempotente
  const { db: pagato } = pagaFattura(approvato, 'doc-fatt', '2026-09-02', 'bonifico', [{ field: 'totale', corrected: 250 }])
  assert.equal(pagato.correzioni!.length, 2)
})

// ============================================================
// 2A.3 — scarto valido per il CHECK, esclusione righe OCR
// ============================================================

test("scarto: si completa e lascia un audit con source ammesso dal CHECK SQL", () => {
  const db = scartaDocumento(dbBase(), 'doc-scontr', 'foto doppia')
  assert.equal(db.documenti.find(d => d.id === 'doc-scontr')!.status, 'scartato')
  assert.ok(db.bozze.filter(b => b.documentId === 'doc-scontr').every(b => b.status === 'scartata'))
  const audit = db.correzioni!.find(c => c.field === 'scarto')!
  assert.equal(audit.source, 'scarto')
  assert.equal(audit.corrected, 'foto doppia')
  // specchio ESATTO del vincolo family_corrections_source_valida
  assert.ok((SORGENTI_CORREZIONE as readonly string[]).includes(audit.source!))
  assert.deepEqual([...SORGENTI_CORREZIONE], ['revisione', 'duplicato', 'avviso', 'scarto'])
  // idempotente e mai fisico: le bozze esistono ancora
  const doppio = scartaDocumento(db, 'doc-scontr', 'di nuovo')
  assert.equal(doppio.correzioni!.length, db.correzioni!.length)
  assert.equal(doppio.bozze.length, db.bozze.length)
})

test('riga OCR esclusa: fuori da quadratura e spese, ma conservata nell\'audit', () => {
  const db = dbBase()
  // lo scontrino da 15,47: la bozza Casa ha una riga fantasma da 5,00 esclusa
  db.bozze.find(b => b.id === 'b-casa')!.righe = [
    { name: 'Pane', cent: 1133 },
    { name: 'Riga fantasma (letta due volte)', cent: 500, excluded: true },
  ]
  const { db: dopo } = confermaDocumento(db, 'doc-scontr', [
    { field: 'righe', proposed: 'Riga fantasma (letta due volte)', corrected: 'esclusa: doppione OCR', draftId: 'b-casa' },
  ])
  const spesaCasa = dopo.spese.find(e => e.groupId === 'g-casa')!
  assert.equal(spesaCasa.amountCent, 1133)                          // la fantasma non c'è
  assert.ok(!spesaCasa.righe.some(r => r.name.includes('fantasma')))
  // l'originale resta nell'audit della bozza
  const bozza = dopo.bozze.find(b => b.id === 'b-casa')!
  assert.ok(bozza.righe!.some(r => r.excluded && r.name.includes('fantasma')))
  assert.equal(dopo.correzioni!.length, 1)                          // motivo registrato
})

test('riga aggiunta a mano (user_added) inclusa; quadratura aggiornata', () => {
  const db = dbBase()
  db.documenti[1].docTotalCent = 1547 + 200
  db.bozze.find(b => b.id === 'b-casa')!.righe = [
    { name: 'Pane', cent: 1133 },
    { name: 'Riga aggiunta in revisione', cent: 200, userAdded: true },
  ]
  const { db: dopo } = confermaDocumento(db, 'doc-scontr')
  const spesaCasa = dopo.spese.find(e => e.groupId === 'g-casa')!
  assert.equal(spesaCasa.amountCent, 1333)
  assert.ok(spesaCasa.righe.some(r => r.name === 'Riga aggiunta in revisione'))
  assert.equal(dopo.spese.reduce((s, e) => s + e.amountCent, 0), 1747)
  // e l'originale distingue la riga manuale dall'OCR
  assert.ok(dopo.bozze.find(b => b.id === 'b-casa')!.righe!.some(r => r.userAdded))
})

test('immutabilità (specchio del trigger 0021): documentate bloccate, manuali libere', () => {
  // eliminaSpesa già copre la cancellazione; qui la regola completa è
  // demandata al trigger SQL: il modello puro garantisce che una spesa
  // documentata non possa sparire e che la manuale resti gestibile.
  const { db } = confermaDocumento(dbBase(), 'doc-scontr')
  assert.throws(() => eliminaSpesa(db, db.spese[0].id), /annullamento esplicito|rettifica/)
})
