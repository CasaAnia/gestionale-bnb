// ============================================================================
// Fase 5 — il PERCORSO COMPLETO delle fatture di Casa Ania sul SERVIZIO
// FINTO RIGOROSO (fattureServerFinto: stesse regole delle RPC 0020 sulle
// tabelle grezze) letto con l'ADATTATORE VERO (costruisciDatiSpese) e col
// dettaglio (dettaglioFattura). Invarianti economiche dimostrate:
//  · approvata ma non pagata: ZERO spese, fuori dallo Speso, in Impegnato
//    e nello scadenzario;
//  · pagamento: UNA spesa, expense_date = data del pagamento (agosto pagata
//    a settembre → Speso di settembre), metodo = quello scelto;
//  · doppio tocco, replay e risposta persa: nessun duplicato;
//  · scaduta/non scaduta cambia col giorno; quadratura al centesimo con
//    arrotondamento; documento a più pagine; dettaglio dopo il pagamento.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { costruisciDatiSpese, type TabelleGrezze } from './adattatore.ts'
import { creaServerFattureFinto, type GuastoFinto } from './fattureServerFinto.ts'
import { dettaglioFattura } from './fattureVista.ts'
import { creaPagatore, MESSAGGIO_PAGAMENTO_IN_CORSO } from './fatturePagamento.ts'
import { apriRevisione, blocchiFattura, modificaBozza, modificaDocumento, type DocumentoGrezzoRevisione } from './revisione.ts'
import { orchestrazioneLegacy } from './orchestrazioneRevisione.ts'
import { depositoRevisioneInMemoria } from './revisioneDurevole.ts'
import { creaGuardiaInvio } from './scrittura.ts'

const AGO = '2026-08-28', SET = '2026-09-02'
const AMBITI: Record<string, 'personale' | 'azienda'> = { 'g-casa': 'personale', 'g-bnb': 'azienda' }
const ambitoDi = (g: string | null) => (g ? AMBITI[g] : 'personale')

// una fattura a DUE pagine, in revisione, con una parte Casa Ania su Lena
function tabelle(): TabelleGrezze {
  return {
    gruppi: [{ id: 'g-casa', name: 'Casa', ambito: 'personale' }, { id: 'g-bnb', name: 'Casa Ania', ambito: 'azienda' }],
    categorie: [{ id: 'c-lav', name: 'Lavori e manutenzione' }],
    categorieCanoniche: [], sottocategorieCanoniche: [],
    camere: [{ id: 'r-lena', name: 'Lena' }, { id: 'r-ambra', name: 'Ambra' }],
    budget: [],
    documenti: [{
      id: 'd-f', kind: 'fattura', status: 'in_revisione', doc_total: 250,
      supplier: 'Elettricista Fumagalli', invoice_number: '44/2026', document_date: '2026-08-05', due_date: '2026-09-05',
      upload_ambito: 'azienda', error_message: null, note: null, created_at: '2026-08-06T09:00:00Z',
    }],
    ponte: [], spese: [], righe: [],
    ricevute: [
      { id: 'p1', document_id: 'd-f', storage_path: '2026-08-06/t-p1.jpg', page_order: 1, mime_type: 'image/jpeg' },
      { id: 'p2', document_id: 'd-f', storage_path: '2026-08-06/t-p2.jpg', page_order: 2, mime_type: 'image/jpeg' },
    ],
    bozze: [{
      id: 'b-f', document_id: 'd-f', status: 'da_controllare', expense_date: '2026-08-05',
      group_id: 'g-bnb', category_id: 'c-lav', subcategory: null, canonical_category_id: null, canonical_subcategory_id: null,
      store: null, description: null, payment_method: null, room_id: 'r-lena', expense_nature: 'straordinaria',
      confidence: {}, arrotondamento_cent: 0, expense_id: null,
    }],
    righeBozza: [
      { id: 'rb1', draft_id: 'b-f', raw_name: null, name: 'Sostituzione interruttore', qty: 1, unit_price: null, discount: 0, amount: 180, group_id: null, category_id: null, subcategory: 'Elettricista', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
      { id: 'rb2', draft_id: 'b-f', raw_name: null, name: 'Manodopera', qty: 1, unit_price: null, discount: 0, amount: 70, group_id: null, category_id: null, subcategory: 'Elettricista', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    ],
  }
}
const testataDi = (t: TabelleGrezze): DocumentoGrezzoRevisione => {
  const d = t.documenti[0]
  return { kind: d.kind, supplier: d.supplier, invoice_number: d.invoice_number ?? null, document_date: d.document_date, due_date: d.due_date }
}
const revisione = (t: TabelleGrezze) => apriRevisione('d-f', t.documenti[0].doc_total,
  t.bozze as never, t.righeBozza as never, null, testataDi(t))
const speseAnia = (t: TabelleGrezze, oggi: string) => costruisciDatiSpese(t, oggi).ania

// ---- F01/F02: approvata e non pagata → zero spese, scadenzario, Impegnato --
test('F01 approvazione senza pagamento: ZERO spese, fuori dallo Speso, dentro Impegnato e scadenzario; dettaglio leggibile', async () => {
  const t = tabelle()
  const server = creaServerFattureFinto(t)
  const orch = orchestrazioneLegacy(server.cliente, depositoRevisioneInMemoria())
  let s = revisione(t)
  s = modificaDocumento(s, { invoice_number: '44/2026-bis' })
  assert.deepEqual(blocchiFattura(s, ambitoDi, undefined, { esito: 'da_pagare' }, AGO), [])
  const e = await orch.approvaFattura(s)
  assert.equal(e.ok, true)
  assert.equal(t.spese.length, 0)                                   // NESSUNA spesa definitiva
  assert.equal(t.documenti[0].status, 'approvata_da_pagare')
  assert.equal(t.documenti[0].invoice_number, '44/2026-bis')       // la testata è stata salvata
  assert.equal(t.bozze[0].status, 'da_controllare')                // le bozze restano per il pagamento
  assert.deepEqual(server.correzioni.map(c => c.field), ['invoice_number'])
  const ania = speseAnia(t, AGO)
  assert.equal(ania.speso, 0)
  assert.deepEqual(ania.impegnato, { tot: 250, n: 1 })
  assert.equal(ania.scadenze.length, 1)
  assert.equal(ania.scadenze[0].stato, 'non_scaduta')
  assert.equal(ania.scadenze[0].giorni, 8)
  const dati = costruisciDatiSpese(t, AGO)
  const doc = dati.documenti.find(d => d.id === 'd-f')!
  assert.equal(doc.stato, 'da_pagare')
  assert.equal(doc.pagine, 2)                                       // documento a più pagine
  assert.equal(doc.scadenza?.stato, 'non_scaduta')
  const mov = dati.movimenti.find(m => m.id === 'doc-d-f')!
  assert.equal(mov.stato, 'da_pagare')
  assert.deepEqual(mov.camere, ['Lena'])
  const det = dettaglioFattura(t, 'd-f', AGO)!
  assert.equal(det.stato, 'da_pagare')
  assert.equal(det.righe.length, 2)
  assert.equal(det.sommaCent, 25000)
  assert.equal(det.pagine.length, 2)
  assert.equal(det.pagamento, null)
  // un'approvazione ripetuta (replay) non cambia nulla e non crea spese
  const e2 = await server.cliente.approvaFattura('d-f', [])
  assert.equal(e2.errore, undefined)
  assert.equal(t.spese.length, 0)
})

// ---- F03/F04: cambio del giorno, pagamento a settembre ---------------------
test('F02 scaduta/in scadenza/non scaduta cambiano col giorno, mai coi dati', async () => {
  const t = tabelle()
  await creaServerFattureFinto(t).cliente.approvaFattura('d-f', [])
  assert.equal(speseAnia(t, '2026-08-20').scadenze[0].stato, 'non_scaduta')
  assert.equal(speseAnia(t, '2026-08-29').scadenze[0].stato, 'in_scadenza')  // 7 giorni prima
  assert.equal(speseAnia(t, '2026-09-05').scadenze[0].stato, 'in_scadenza')  // il giorno stesso
  assert.equal(speseAnia(t, '2026-09-05').scadenze[0].etichetta, 'scade oggi')
  const dopo = speseAnia(t, '2026-09-08')
  assert.equal(dopo.scadenze[0].stato, 'scaduta')
  assert.equal(dopo.scadenze[0].etichetta, 'scaduta da 3 giorni')
  assert.deepEqual(dopo.scadenzario, { scadute: 1, inScadenza: 0, nonScadute: 0, totScadute: 250 })
  assert.equal(dopo.speso, 0)                                       // scaduta ≠ spesa
})

test('F03 pagamento a settembre di una fattura di agosto: UNA spesa, expense_date = data del pagamento, metodo scelto, Speso di settembre', async () => {
  const t = tabelle()
  const server = creaServerFattureFinto(t)
  await server.cliente.approvaFattura('d-f', [])
  const pagatore = creaPagatore(server.cliente)
  const e = await pagatore.paga('d-f', { dataPagamento: '2026-09-02', metodo: 'bonifico' }, SET)
  assert.equal(e.ok, true)
  assert.equal(t.spese.length, 1)
  const spesa = t.spese[0]
  assert.equal(spesa.expense_date, '2026-09-02')                    // NON la data della fattura
  assert.equal(spesa.paid_at, '2026-09-02')
  assert.equal(spesa.payment_method, 'bonifico')
  assert.equal(spesa.amount, 250)
  assert.equal(spesa.room_id, 'r-lena')
  assert.equal(spesa.expense_nature, 'straordinaria')
  assert.equal(t.documenti[0].status, 'confermato')
  assert.equal(t.documenti[0].document_date, '2026-08-05')          // la data della fattura resta
  assert.equal(t.bozze[0].status, 'confermata')
  assert.equal(t.bozze[0].expense_id, spesa.id)
  assert.equal(t.righe.filter(r => r.expense_id === spesa.id).length, 2)
  // Speso: agosto 0, settembre 250; Impegnato 0; scadenzario vuoto
  assert.equal(speseAnia(t, AGO).speso, 0)
  const set = speseAnia(t, SET)
  assert.equal(set.speso, 250)
  assert.deepEqual(set.impegnato, { tot: 0, n: 0 })
  assert.equal(set.scadenze.length, 0)
  assert.deepEqual(set.costiCamere, [{ nome: 'Lena', tot: 250 }])
  assert.deepEqual(set.metodi, [{ nome: 'Bonifico', quota: 100 }])
  // il dettaglio si legge anche dopo il pagamento
  const det = dettaglioFattura(t, 'd-f', SET)!
  assert.equal(det.stato, 'pagata')
  assert.deepEqual(det.pagamento, { data: '2026-09-02', metodo: 'bonifico' })
  assert.equal(det.righe.length, 2)
  assert.deepEqual(det.camere, ['Lena'])
  assert.equal(det.due_date, '2026-09-05')
  const dati = costruisciDatiSpese(t, SET)
  assert.equal(dati.documenti.find(d => d.id === 'd-f')!.stato, 'pagata')
  assert.equal(dati.movimenti.find(m => m.id === 'doc-d-f')!.stato, 'pagata')
  assert.equal(dati.movimenti.find(m => m.id === 'doc-d-f')!.data, '2026-09-02')
})

// ---- F04: doppio tocco, replay, risposta persa: nessun duplicato -----------
test('F04 doppio tocco e replay del pagamento: una sola spesa; risposta persa → incerto, e il ritentativo trova la fattura già pagata', async () => {
  const t = tabelle()
  const guasto: GuastoFinto = null
  const server = creaServerFattureFinto(t, { guasto: () => guasto })
  await server.cliente.approvaFattura('d-f', [])
  const pagatore = creaPagatore(server.cliente)
  const richiesta = { dataPagamento: '2026-09-02', metodo: 'bonifico' }
  // doppio tocco: la seconda chiamata non parte
  const [a, b] = await Promise.all([pagatore.paga('d-f', richiesta, SET), pagatore.paga('d-f', richiesta, SET)])
  assert.equal(a.ok, true)
  assert.ok(!b.ok && b.errore === MESSAGGIO_PAGAMENTO_IN_CORSO)
  assert.equal(server.chiamate.filter(c => c.rpc === 'paga_fattura').length, 1)
  assert.equal(t.spese.length, 1)
  // replay esplicito (idempotente): stesse spese, nessun duplicato
  const c = await pagatore.paga('d-f', richiesta, SET)
  assert.ok(c.ok && c.ids.length === 1 && c.ids[0] === t.spese[0].id)
  assert.equal(t.spese.length, 1)
  assert.equal(speseAnia(t, SET).speso, 250)

  // risposta PERSA dopo l'effetto reale: esito incerto, niente reinvio automatico
  const t2 = tabelle()
  let g2: GuastoFinto = null
  const s2 = creaServerFattureFinto(t2, { guasto: () => g2 })
  await s2.cliente.approvaFattura('d-f', [])
  g2 = 'persa'
  const p2 = creaPagatore(s2.cliente)
  const persa = await p2.paga('d-f', richiesta, SET)
  assert.ok(!persa.ok && persa.incerto)
  assert.equal(t2.spese.length, 1)                                  // l'effetto c'era
  g2 = null
  // «chiudi e ricontrolla»: la fattura risulta pagata; un ritentativo è innocuo
  assert.equal(costruisciDatiSpese(t2, SET).documenti[0].stato, 'pagata')
  const di_nuovo = await p2.paga('d-f', richiesta, SET)
  assert.ok(di_nuovo.ok)
  assert.equal(t2.spese.length, 1)
})

test('F04-bis errore certo, rete restituita e zero spese: mai un successo; data futura e metodo mancante fermati PRIMA della RPC', async () => {
  const t = tabelle()
  let guasto: GuastoFinto = null
  const server = creaServerFattureFinto(t, { guasto: () => guasto })
  await server.cliente.approvaFattura('d-f', [])
  const pagatore = creaPagatore(server.cliente)
  const richiesta = { dataPagamento: '2026-09-02', metodo: 'bonifico' }
  const prima = server.chiamate.length
  const b1 = await pagatore.paga('d-f', { dataPagamento: '2026-09-09', metodo: 'bonifico' }, SET)
  assert.ok(!b1.ok && b1.errore.includes('futuro'))
  const b2 = await pagatore.paga('d-f', { dataPagamento: '2026-09-02', metodo: null }, SET)
  assert.ok(!b2.ok && b2.errore.includes('metodo'))
  const b3 = await pagatore.paga('d-f', { dataPagamento: '2026-09-02', metodo: 'carta' }, SET)
  assert.ok(!b3.ok && b3.errore.includes('metodo'))
  assert.equal(server.chiamate.length, prima)                       // nessuna RPC partita
  guasto = 'errore'
  const e = await pagatore.paga('d-f', richiesta, SET)
  assert.ok(!e.ok && !e.incerto && e.errore.includes('Quadratura'))
  guasto = 'rete'
  const r = await pagatore.paga('d-f', richiesta, SET)
  assert.ok(!r.ok && r.incerto)
  assert.equal(t.spese.length, 0)                                   // rete e rifiuto: nessun effetto
  guasto = 'zero'
  const z = await pagatore.paga('d-f', richiesta, SET)
  assert.ok(!z.ok && z.incerto && z.errore.includes('non ha restituito'))
  guasto = null
  assert.equal(t.spese.length, 1)                                   // l'effetto del giro «zero» c'era: il ricontrollo lo vede
  assert.equal(costruisciDatiSpese(t, SET).documenti[0].stato, 'pagata')
})

// ---- F05: già pagata in revisione ------------------------------------------
test('F05 fattura già pagata in revisione: conferma_fattura_pagata, spesa alla data reale, scadenza non inventata', async () => {
  const t = tabelle()
  t.documenti[0].due_date = null
  const server = creaServerFattureFinto(t)
  const orch = orchestrazioneLegacy(server.cliente, depositoRevisioneInMemoria())
  const s = revisione(t)
  assert.deepEqual(blocchiFattura(s, ambitoDi, undefined, { esito: 'pagata', dataPagamento: '2026-08-20', metodo: 'carta_attivita' }, AGO), [])
  const e = await orch.confermaFatturaPagata(s, '2026-08-20', 'carta_attivita')
  assert.equal(e.ok, true)
  assert.deepEqual(server.chiamate.map(c => c.rpc), ['conferma_fattura_pagata'])
  assert.equal(t.spese.length, 1)
  assert.equal(t.spese[0].expense_date, '2026-08-20')
  assert.equal(t.spese[0].payment_method, 'carta_attivita')
  assert.equal(t.documenti[0].due_date, null)                       // non inventata
  assert.equal(t.documenti[0].status, 'confermato')
  assert.equal(speseAnia(t, AGO).speso, 250)
  assert.equal(speseAnia(t, SET).speso, 0)
  assert.equal(dettaglioFattura(t, 'd-f', SET)!.stato, 'pagata')
  // replay: nessun duplicato
  const again = await server.cliente.confermaFatturaPagata('d-f', '2026-08-20', 'carta_attivita', [])
  assert.deepEqual(again.ids, [t.spese[0].id])
  assert.equal(t.spese.length, 1)
})

// ---- F06: quadratura e arrotondamento ---------------------------------------
test('F06 quadratura al centesimo: la fattura non approva se non quadra; con arrotondamento dichiarato quadra e la spesa ha la riga esplicita', async () => {
  const t = tabelle()
  t.documenti[0].doc_total = 250.01
  const server = creaServerFattureFinto(t)
  const orch = orchestrazioneLegacy(server.cliente, depositoRevisioneInMemoria())
  let s = revisione(t)
  assert.ok(blocchiFattura(s, ambitoDi, undefined, { esito: 'da_pagare' }, AGO).some(b => b.includes('non quadra')))
  const forzata = await server.cliente.approvaFattura('d-f', [])    // il server rifiuta comunque
  assert.ok(forzata.errore?.includes('Quadratura'))
  assert.equal(t.documenti[0].status, 'in_revisione')
  s = modificaBozza(s, 'b-f', { arrotondamento_cent: 1 })
  assert.deepEqual(blocchiFattura(s, ambitoDi, undefined, { esito: 'da_pagare' }, AGO), [])
  assert.equal((await orch.approvaFattura(s)).ok, true)
  assert.equal(speseAnia(t, AGO).impegnato.tot, 250.01)
  const p = await creaPagatore(server.cliente).paga('d-f', { dataPagamento: SET, metodo: 'contanti' }, SET)
  assert.ok(p.ok)
  assert.equal(t.spese[0].amount, 250.01)
  const righe = t.righe.filter(r => r.expense_id === t.spese[0].id)
  assert.equal(righe.length, 3)
  assert.ok(righe.some(r => r.is_adjustment && r.amount === 0.01))
  assert.equal(speseAnia(t, SET).speso, 250.01)
  const det = dettaglioFattura(t, 'd-f', SET)!
  assert.equal(det.sommaCent, 25001)
})

// ---- F07: camera e metodo mancanti o incoerenti -----------------------------
test('F07 camera e ambito: gruppo Casa Mia su una fattura → bloccata a schermo; metodo mancante al pagamento → RPC rifiuta, zero spese', async () => {
  const t = tabelle()
  const server = creaServerFattureFinto(t)
  let s = revisione(t)
  s = modificaBozza(s, 'b-f', { group_id: 'g-casa' })
  assert.ok(blocchiFattura(s, ambitoDi, undefined, { esito: 'da_pagare' }, AGO).some(b => b.includes('Casa Ania')))
  await server.cliente.approvaFattura('d-f', [])
  const senzaMetodo = await server.cliente.pagaFattura('d-f', SET, '', [])
  assert.ok(senzaMetodo.errore?.includes('Metodo di pagamento'))
  assert.equal(t.spese.length, 0)
  assert.equal(t.documenti[0].status, 'approvata_da_pagare')
  const senzaData = await server.cliente.pagaFattura('d-f', '', 'bonifico', [])
  assert.ok(senzaData.errore?.includes('Data di pagamento'))
  assert.equal(t.spese.length, 0)
})

// ---- F08: rilettura dopo chiusura e riapertura -------------------------------
test('F08 chiusura e riapertura: con la custodia gli originali della testata tornano; dopo l\'approvazione non c\'è più una revisione da riaprire', async () => {
  const t = tabelle()
  const server = creaServerFattureFinto(t)
  const dep = depositoRevisioneInMemoria()
  const orch = orchestrazioneLegacy(server.cliente, dep)
  let s = revisione(t)
  s = modificaDocumento(s, { supplier: 'Fumagalli Impianti' })
  const salvato = await orch.salva(s)
  assert.equal(salvato.ok, true)
  assert.equal(t.documenti[0].supplier, 'Fumagalli Impianti')      // il db ha già il valore corretto
  // riapertura: pagina ricreata, tabelle rilette, custodia conservata
  const riaperta = apriRevisione('d-f', t.documenti[0].doc_total, t.bozze as never, t.righeBozza as never,
    dep.leggi('d-f').traccia ?? null, testataDi(t))
  assert.equal(riaperta.documento.supplier, 'Elettricista Fumagalli')
  assert.deepEqual(riaperta.modificheDocumento, { supplier: 'Fumagalli Impianti' })
  const e = await orch.approvaFattura(riaperta)
  assert.equal(e.ok, true)
  assert.deepEqual(server.correzioni.map(c => [c.field, c.proposed, c.corrected]),
    [['supplier', 'Elettricista Fumagalli', 'Fumagalli Impianti']])
  assert.equal(dep.leggi('d-f').traccia, undefined)
  // il documento approvato non è più modificabile: la vista lo dice
  assert.equal(costruisciDatiSpese(t, AGO).documenti[0].stato, 'da_pagare')
  const seconda = apriRevisione('d-f', 250, t.bozze as never, t.righeBozza as never, null, testataDi(t))
  assert.equal(seconda.documento.supplier, 'Fumagalli Impianti')    // rilettura fresca, originali = db
  assert.equal(seconda.bozze.length, 1)
})

// ---- doppio clic sull'approvazione con guardia e cliente lento -------------
test('doppio clic sull\'approvazione con servizio lento: parte una sola RPC e nasce zero spese', async () => {
  const t = tabelle()
  const server = creaServerFattureFinto(t, { guasto: () => 'lenta', attesaMs: 30 })
  const orch = orchestrazioneLegacy(server.cliente, depositoRevisioneInMemoria())
  const guardia = creaGuardiaInvio()
  const s = revisione(t)
  const [a, b] = await Promise.all([guardia(() => orch.approvaFattura(s)), guardia(() => orch.approvaFattura(s))])
  assert.equal(a?.ok, true)
  assert.equal(b, null)
  assert.equal(server.chiamate.filter(c => c.rpc === 'approva_fattura_da_pagare').length, 1)
  assert.equal(t.spese.length, 0)
})

// ---- scontrini: nessuna regressione sul servizio finto ---------------------
test('regressione scontrini: la conferma come scontrino crea le spese alla data della bozza e rifiuta le fatture', async () => {
  const t = tabelle()
  t.documenti[0].kind = 'scontrino'
  t.bozze[0].payment_method = 'contanti'
  const server = creaServerFattureFinto(t)
  const c = await server.cliente.confermaDocumento('d-f', [])
  assert.equal(c.ids?.length, 1)
  assert.equal(t.spese[0].expense_date, '2026-08-05')
  assert.equal(speseAnia(t, AGO).speso, 250)
  const t2 = tabelle()
  const s2 = creaServerFattureFinto(t2)
  const rifiuto = await s2.cliente.confermaDocumento('d-f', [])
  assert.ok(rifiuto.errore?.includes('Tipo non valido'))
  assert.equal(t2.spese.length, 0)
})
