// Revisione indipendente del candidato 1219138: nessuna rete e nessun database.
// Gli assert descrivono il comportamento sicuro atteso; non modificarli per
// far passare il candidato. Esecuzione:
//   node --test scripts/revisioni/fase5-fatture-1219138.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creaServerFattureFinto } from '../../lib/spese/fattureServerFinto.ts'
import { creaPagatore } from '../../lib/spese/fatturePagamento.ts'
import {
  apriRevisione, blocchiFattura,
} from '../../lib/spese/revisione.ts'
import { approvaFatturaRevisione } from '../../lib/spese/revisioneScrittura.ts'
import { depositoRevisioneInMemoria } from '../../lib/spese/revisioneDurevole.ts'

const OGGI = '2026-09-02'
const GRUPPO = 'g-ania'
const ambitoDi = id => id === GRUPPO ? 'azienda' : 'personale'

function tabelleConSorellaNegativa() {
  return {
    gruppi: [{ id: GRUPPO, name: 'Casa Ania', ambito: 'azienda' }],
    categorie: [], categorieCanoniche: [], sottocategorieCanoniche: [], camere: [], budget: [],
    documenti: [{
      id: 'doc-f', kind: 'fattura', status: 'in_revisione', doc_total: 9,
      supplier: 'Fornitore', invoice_number: '1', document_date: '2026-09-01',
      due_date: '2026-09-10', upload_ambito: 'azienda', error_message: null,
      note: null, created_at: '2026-09-01T08:00:00Z',
    }],
    ponte: [], spese: [], righe: [], ricevute: [],
    bozze: [
      {
        id: 'b-positiva', document_id: 'doc-f', status: 'da_controllare',
        expense_date: '2026-09-01', group_id: GRUPPO, category_id: null,
        subcategory: null, canonical_category_id: null, canonical_subcategory_id: null,
        store: 'Fornitore', description: null, payment_method: null, room_id: null,
        expense_nature: null, confidence: {}, arrotondamento_cent: 0, expense_id: null,
      },
      {
        id: 'b-negativa', document_id: 'doc-f', status: 'da_controllare',
        expense_date: '2026-09-01', group_id: GRUPPO, category_id: null,
        subcategory: null, canonical_category_id: null, canonical_subcategory_id: null,
        store: 'Fornitore', description: null, payment_method: null, room_id: null,
        expense_nature: null, confidence: {}, arrotondamento_cent: -100, expense_id: null,
      },
    ],
    righeBozza: [{
      id: 'r-positiva', draft_id: 'b-positiva', raw_name: null, name: 'Lavoro',
      qty: 1, unit_price: 10, discount: 0, amount: 10, group_id: null,
      category_id: null, subcategory: null, canonical_category_id: null,
      canonical_subcategory_id: null, necessity: null, planning: null,
      confidence: {}, excluded: false, user_added: false,
    }],
  }
}

function statoDa(t) {
  const d = t.documenti[0]
  return apriRevisione('doc-f', d.doc_total, t.bozze, t.righeBozza, null, {
    kind: d.kind, supplier: d.supplier, invoice_number: d.invoice_number,
    document_date: d.document_date, due_date: d.due_date,
  })
}

test('R1: una sorella negativa deve bloccare PRIMA dell\'approvazione, anche se il totale complessivo quadra', async () => {
  const t = tabelleConSorellaNegativa()
  const stato = statoDa(t)
  const blocchi = blocchiFattura(stato, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI)
  assert.ok(blocchi.some(x => x.includes('parte') && x.includes('negativ')),
    `manca il blocco della sorella negativa: ${JSON.stringify(blocchi)}`)

  const server = creaServerFattureFinto(t)
  const approvazione = await server.cliente.approvaFattura('doc-f', [])
  assert.match(approvazione.errore ?? '', /negativ/i,
    'anche il contratto server deve respingere la fattura prima di renderla non modificabile')
  assert.equal(t.documenti[0].status, 'in_revisione')
})

test('R1-bis: un pagamento rifiutato non lascia effetti parziali nel server finto rigoroso', async () => {
  const t = tabelleConSorellaNegativa()
  t.documenti[0].status = 'approvata_da_pagare'
  const server = creaServerFattureFinto(t)
  const prima = structuredClone({ spese: t.spese, righe: t.righe, ponte: t.ponte, bozze: t.bozze })
  const pagamento = await server.cliente.pagaFattura('doc-f', OGGI, 'bonifico', [])
  assert.match(pagamento.errore ?? '', /negativ/i)
  assert.deepEqual({ spese: t.spese, righe: t.righe, ponte: t.ponte, bozze: t.bozze }, prima,
    'il finto deve fare rollback di tutto quando il corpo della RPC fallisce')
})

test('R2: Bad Gateway dopo una approvazione partita e un pagamento partito e esito INCERTO, non rifiuto dimostrato', async () => {
  const t = tabelleConSorellaNegativa()
  t.bozze.pop()
  t.documenti[0].doc_total = 10
  const stato = statoDa(t)
  const deposito = depositoRevisioneInMemoria()
  const cliente = {
    aggiornaDocTotale: async () => ({ righe: 1 }),
    aggiornaDocumento: async () => ({ righe: 1 }),
    aggiornaBozza: async () => ({ righe: 1 }),
    aggiornaRiga: async () => ({ righe: 1 }),
    aggiungiRiga: async () => ({ id: 'x' }),
    confermaDocumento: async () => ({ ids: ['x'] }),
    scartaDocumento: async () => ({}),
    approvaFattura: async () => ({ errore: 'Bad Gateway' }),
    pagaFattura: async () => ({ errore: 'Bad Gateway' }),
    confermaFatturaPagata: async () => ({ errore: 'Bad Gateway' }),
  }

  const approvazione = await approvaFatturaRevisione(cliente, deposito, stato)
  assert.equal(approvazione.incerto, true,
    'senza SQLSTATE applicativo Bad Gateway non dimostra che la RPC sia stata rifiutata')
  assert.equal(deposito.leggi('doc-f').traccia?.inCorso?.tipo, 'approvazione',
    'la responsabilita deve restare custodita fino alla rilettura dello stato')

  const pagamento = await creaPagatore(cliente).paga('doc-f', { dataPagamento: OGGI, metodo: 'bonifico' }, OGGI)
  assert.equal(pagamento.incerto, true,
    'anche il pagamento deve richiedere il ricontrollo quando il gateway non prova il rifiuto')
})
