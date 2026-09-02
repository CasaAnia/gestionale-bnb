// Fase 5 — letture pure delle fatture: scadenzario (classificazione ed
// etichette), adattatore (ordine, contatori, campi di vista) e fabbrica
// del cliente RPC (nomi e argomenti ESATTI, colonne concesse in UPDATE).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classificaScadenza, etichettaScadenza, giorniTra, dettaglioFattura } from './fattureVista.ts'
import { costruisciDatiSpese, type TabelleGrezze } from './adattatore.ts'
import { creaClienteRevisione, type SupabaseRevisione } from './revisioneClient.ts'

test('classificaScadenza: scaduta sotto oggi, in scadenza entro 7 giorni (oggi compreso), non scaduta oltre; senza data', () => {
  assert.deepEqual(classificaScadenza(null, '2026-09-02'), { stato: 'senza_scadenza', giorni: null })
  assert.deepEqual(classificaScadenza('2026-09-01', '2026-09-02'), { stato: 'scaduta', giorni: -1 })
  assert.deepEqual(classificaScadenza('2026-09-02', '2026-09-02'), { stato: 'in_scadenza', giorni: 0 })
  assert.deepEqual(classificaScadenza('2026-09-09', '2026-09-02'), { stato: 'in_scadenza', giorni: 7 })
  assert.deepEqual(classificaScadenza('2026-09-10', '2026-09-02'), { stato: 'non_scaduta', giorni: 8 })
  assert.equal(giorniTra('2026-08-31', '2026-09-01'), 1)             // a cavallo del mese
  assert.equal(giorniTra('2026-12-31', '2027-01-01'), 1)
})

test('etichettaScadenza: parole giuste per ieri/oggi/domani, giorni, data lontana', () => {
  const g = (iso: string) => `il giorno ${iso}`
  assert.equal(etichettaScadenza('2026-09-01', classificaScadenza('2026-09-01', '2026-09-02'), g), 'scaduta ieri')
  assert.equal(etichettaScadenza('2026-08-30', classificaScadenza('2026-08-30', '2026-09-02'), g), 'scaduta da 3 giorni')
  assert.equal(etichettaScadenza('2026-09-02', classificaScadenza('2026-09-02', '2026-09-02'), g), 'scade oggi')
  assert.equal(etichettaScadenza('2026-09-03', classificaScadenza('2026-09-03', '2026-09-02'), g), 'scade domani')
  assert.equal(etichettaScadenza('2026-09-07', classificaScadenza('2026-09-07', '2026-09-02'), g), 'scade tra 5 giorni')
  assert.equal(etichettaScadenza('2026-09-20', classificaScadenza('2026-09-20', '2026-09-02'), g), 'scade il il giorno 2026-09-20')
  assert.equal(etichettaScadenza(null, classificaScadenza(null, '2026-09-02'), g), 'senza scadenza')
})

const documento = (x: Partial<TabelleGrezze['documenti'][0]> & { id: string }): TabelleGrezze['documenti'][0] => ({
  kind: 'fattura', status: 'approvata_da_pagare', doc_total: 100, supplier: 'F',
  document_date: '2026-08-01', due_date: null, upload_ambito: 'azienda',
  error_message: null, note: null, created_at: '2026-08-01T10:00:00Z', ...x,
})
function tabelle(): TabelleGrezze {
  return {
    gruppi: [{ id: 'g-bnb', name: 'Casa Ania', ambito: 'azienda' }],
    categorie: [], categorieCanoniche: [], sottocategorieCanoniche: [],
    camere: [{ id: 'r-lena', name: 'Lena' }], budget: [],
    documenti: [
      documento({ id: 'd-lontana', supplier: 'Lontana', due_date: '2026-09-30', doc_total: 30 }),
      documento({ id: 'd-scaduta', supplier: 'Scaduta', due_date: '2026-08-25', doc_total: 120 }),
      documento({ id: 'd-vicina', supplier: 'Vicina', due_date: '2026-09-04', doc_total: 50 }),
      documento({ id: 'd-pagata', supplier: 'Pagata', status: 'confermato', due_date: '2026-08-20', doc_total: 80 }),
      documento({ id: 'd-rev', supplier: 'In revisione', status: 'in_revisione', due_date: '2026-08-01', doc_total: 10 }),
    ],
    ponte: [{ expense_id: 's-p', document_id: 'd-pagata' }],
    spese: [{ id: 's-p', amount: 80, expense_date: '2026-09-01', group_id: 'g-bnb', category_id: null, subcategory: null, description: null, store: null, product: null, receipt_id: null, payment_method: 'bonifico', paid_at: '2026-09-01', room_id: 'r-lena' }],
    righe: [], ricevute: [], bozze: [], righeBozza: [],
  }
}

test('adattatore: scadenzario ordinato con le scadute per prime, contatori e stati; la pagata e quella in revisione non ci sono', () => {
  const d = costruisciDatiSpese(tabelle(), '2026-09-02')
  assert.deepEqual(d.ania.scadenze.map(s => [s.id, s.stato, s.giorni]), [
    ['d-scaduta', 'scaduta', -8], ['d-vicina', 'in_scadenza', 2], ['d-lontana', 'non_scaduta', 28],
  ])
  assert.equal(d.ania.scadenze[0].etichetta, 'scaduta da 8 giorni')
  assert.equal(d.ania.scadenze[1].etichetta, 'scade tra 2 giorni')
  assert.equal(d.ania.scadenze[2].etichetta, 'scade il 30 set')
  assert.deepEqual(d.ania.scadenzario, { scadute: 1, inScadenza: 1, nonScadute: 1, totScadute: 120 })
  assert.deepEqual(d.ania.impegnato, { tot: 200, n: 3 })
  assert.equal(d.ania.speso, 80)                                    // solo la pagata
  assert.equal(d.ania.fattureDaControllare, 1)
  const doc = d.documenti.find(x => x.id === 'd-scaduta')!
  assert.equal(doc.stato, 'da_pagare')
  assert.equal(doc.scadenza?.stato, 'scaduta')
  assert.equal(doc.scade, '25 ago')
  assert.equal(d.documenti.find(x => x.id === 'd-pagata')!.scadenza, undefined)
  assert.equal(d.documenti.find(x => x.id === 'd-pagata')!.stato, 'pagata')
  assert.equal(d.documenti.find(x => x.id === 'd-pagata')!.giorno, '1 set')   // il giorno del PAGAMENTO, non della fattura (1 ago)
  const mov = d.movimenti.find(m => m.id === 'doc-d-scaduta')!
  assert.equal(mov.scadenza?.stato, 'scaduta')
  assert.equal(d.movimenti.find(m => m.id === 'doc-d-pagata')!.scadenza, undefined)
})

test('adattatore: lo stesso scadenzario letto un\'altra mattina cambia stato senza toccare i dati', () => {
  const t = tabelle()
  const prima = costruisciDatiSpese(t, '2026-09-02')
  const dopo = costruisciDatiSpese(t, '2026-09-06')
  assert.equal(prima.ania.scadenze.find(s => s.id === 'd-vicina')!.stato, 'in_scadenza')
  assert.equal(dopo.ania.scadenze.find(s => s.id === 'd-vicina')!.stato, 'scaduta')
  assert.deepEqual(dopo.ania.scadenzario, { scadute: 2, inScadenza: 0, nonScadute: 1, totScadute: 170 })
  assert.equal(dopo.ania.speso, 80)
})

test('dettaglioFattura: documento assente → null; pagata → righe dalle spese e pagamento; in revisione → righe dalle bozze', () => {
  const t = tabelle()
  assert.equal(dettaglioFattura(t, 'x', '2026-09-02'), null)
  const pagata = dettaglioFattura(t, 'd-pagata', '2026-09-02')!
  assert.equal(pagata.stato, 'pagata')
  assert.deepEqual(pagata.pagamento, { data: '2026-09-01', metodo: 'bonifico' })
  assert.deepEqual(pagata.camere, ['Lena'])
  assert.equal(pagata.righe.length, 1)                              // ripiego sulla spesa senza righe
  assert.equal(pagata.scadenza.stato, 'senza_scadenza')             // una pagata non è mai scaduta
  const rev = dettaglioFattura(t, 'd-rev', '2026-09-02')!
  assert.equal(rev.stato, 'in_revisione')
  assert.equal(rev.righe.length, 0)
  assert.equal(rev.pagamento, null)
})

// ---- la fabbrica del cliente: nomi e argomenti delle RPC, colonne UPDATE ---
test('creaClienteRevisione: le tre RPC fattura con nomi e argomenti esatti; l\'UPDATE della testata solo sulle colonne concesse', async () => {
  const chiamate: unknown[] = []
  const CONCESSE = new Set(['kind', 'doc_total', 'supplier', 'invoice_number', 'document_date', 'due_date', 'note'])
  const finto: SupabaseRevisione = {
    from(tabella) {
      return {
        update(campi) {
          assert.equal(tabella, 'family_documents')
          for (const k of Object.keys(campi)) if (!CONCESSE.has(k)) throw new Error(`colonna non concessa: ${k}`)
          return { eq(col, val) { return { async select() { chiamate.push({ update: tabella, col, val, campi }); return { data: [{ id: val }], error: null } } } } }
        },
        insert() { throw new Error('non atteso') },
      }
    },
    async rpc(nome, argomenti) {
      chiamate.push({ rpc: nome, argomenti })
      if (nome === 'approva_fattura_da_pagare') return { data: null, error: null }
      if (nome === 'paga_fattura' || nome === 'conferma_fattura_pagata') return { data: ['s-1'], error: null }
      return { data: null, error: { message: `RPC imprevista ${nome}` } }
    },
  }
  const c = creaClienteRevisione(finto)
  assert.deepEqual(await c.aggiornaDocumento('d', { supplier: 'X', due_date: '2026-09-05' }), { righe: 1 })
  assert.deepEqual(await c.approvaFattura('d', [{ field: 'supplier' }]), {})
  assert.deepEqual(await c.pagaFattura('d', '2026-09-02', 'bonifico', []), { ids: ['s-1'] })
  assert.deepEqual(await c.confermaFatturaPagata('d', '2026-09-01', 'contanti', []), { ids: ['s-1'] })
  assert.deepEqual(chiamate, [
    { update: 'family_documents', col: 'id', val: 'd', campi: { supplier: 'X', due_date: '2026-09-05' } },
    { rpc: 'approva_fattura_da_pagare', argomenti: { p_document_id: 'd', p_correzioni: [{ field: 'supplier' }] } },
    { rpc: 'paga_fattura', argomenti: { p_document_id: 'd', p_data_pagamento: '2026-09-02', p_payment_method: 'bonifico', p_correzioni: [] } },
    { rpc: 'conferma_fattura_pagata', argomenti: { p_document_id: 'd', p_data_pagamento: '2026-09-01', p_payment_method: 'contanti', p_correzioni: [] } },
  ])
  // un errore RESTITUITO dalla RPC arriva com'è; una risposta non-array è zero spese
  const rotto: SupabaseRevisione = { ...finto, async rpc(nome) { return nome === 'paga_fattura' ? { data: null, error: null } : { data: null, error: { message: 'Accesso negato' } } } }
  const c2 = creaClienteRevisione(rotto)
  assert.deepEqual(await c2.pagaFattura('d', '2026-09-02', 'bonifico', []), { ids: [] })
  assert.deepEqual(await c2.approvaFattura('d', []), { errore: 'Accesso negato' })
})
