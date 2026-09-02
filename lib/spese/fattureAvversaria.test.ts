// ============================================================================
// REVISIONE AVVERSARIA della Fase 5 (02/09/2026): riproduzioni dei difetti
// trovati sul candidato 1219138, aggiunte PRIMA di ogni correzione. Nessuna
// rete, nessun database: servizio finto rigoroso e clienti finti.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creaServerFattureFinto } from './fattureServerFinto.ts'
import { apriRevisione, blocchiFattura, blocchiConferma } from './revisione.ts'
import type { TabelleGrezze } from './adattatore.ts'

const OGGI = '2026-09-02'
const GRUPPO = 'g-ania'
const ambitoDi = (id: string | null) => (id === GRUPPO ? 'azienda' : 'personale') as 'azienda' | 'personale'

// Fattura da 9 € con DUE parti: una da 10 € e una «sorella» fatta solo di un
// arrotondamento da −1 €: il totale complessivo quadra (10 − 1 = 9) ma la
// seconda parte è negativa e non può mai diventare una spesa.
export function tabelleConSorellaNegativa(): TabelleGrezze {
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
      { id: 'b-positiva', document_id: 'doc-f', status: 'da_controllare', expense_date: '2026-09-01', group_id: GRUPPO, category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, store: 'Fornitore', description: null, payment_method: null, room_id: null, expense_nature: null, confidence: {}, arrotondamento_cent: 0, expense_id: null },
      { id: 'b-negativa', document_id: 'doc-f', status: 'da_controllare', expense_date: '2026-09-01', group_id: GRUPPO, category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, store: 'Fornitore', description: null, payment_method: null, room_id: null, expense_nature: null, confidence: {}, arrotondamento_cent: -100, expense_id: null },
    ],
    righeBozza: [{ id: 'r-positiva', draft_id: 'b-positiva', raw_name: null, name: 'Lavoro', qty: 1, unit_price: 10, discount: 0, amount: 10, group_id: null, category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false }],
  } as unknown as TabelleGrezze
}

export function statoDa(t: TabelleGrezze) {
  const d = t.documenti[0]
  return apriRevisione('doc-f', d.doc_total, t.bozze as never, t.righeBozza as never, null, {
    kind: d.kind, supplier: d.supplier, invoice_number: d.invoice_number ?? null,
    document_date: d.document_date, due_date: d.due_date,
  })
}

test('D1 una parte negativa dopo l\'arrotondamento blocca PRIMA dell\'approvazione (schermo e finto), anche se il totale quadra', async () => {
  const t = tabelleConSorellaNegativa()
  const stato = statoDa(t)
  const daPagare = blocchiFattura(stato, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI)
  assert.ok(daPagare.some(x => x.includes('parte') && x.includes('negativ')), `manca il blocco a schermo: ${JSON.stringify(daPagare)}`)
  const pagata = blocchiFattura(stato, ambitoDi, undefined, { esito: 'pagata', dataPagamento: OGGI, metodo: 'bonifico' }, OGGI)
  assert.ok(pagata.some(x => x.includes('negativ')))
  // vale anche per uno scontrino: spese_crea_da_bozze rifiuterebbe comunque
  const scontrino = { ...t, documenti: [{ ...t.documenti[0], kind: 'scontrino' }] } as TabelleGrezze
  assert.ok(blocchiConferma(statoDa(scontrino), ambitoDi).some(x => x.includes('negativ')))

  // il server finto rispecchia la regola: approvazione rifiutata, stato intatto
  const server = creaServerFattureFinto(t)
  const approvazione = await server.cliente.approvaFattura('doc-f', [])
  assert.match(approvazione.errore ?? '', /negativ/i)
  assert.equal(t.documenti[0].status, 'in_revisione')
  const conferma = await server.cliente.confermaFatturaPagata('doc-f', OGGI, 'bonifico', [])
  assert.match(conferma.errore ?? '', /negativ/i)
  assert.equal(t.spese.length, 0)
  assert.equal(t.documenti[0].status, 'in_revisione')
})

test('D2 il servizio finto fa ROLLBACK totale quando il corpo della RPC fallisce a metà (nessun effetto parziale)', async () => {
  const t = tabelleConSorellaNegativa()
  t.documenti[0].status = 'approvata_da_pagare'   // approvata prima della regola D1
  const server = creaServerFattureFinto(t)
  const prima = structuredClone({ documenti: t.documenti, spese: t.spese, righe: t.righe, ponte: t.ponte, bozze: t.bozze })
  const pagamento = await server.cliente.pagaFattura('doc-f', OGGI, 'bonifico', [])
  assert.match(pagamento.errore ?? '', /negativ/i)
  assert.deepEqual({ documenti: t.documenti, spese: t.spese, righe: t.righe, ponte: t.ponte, bozze: t.bozze }, prima,
    'la prima parte era già stata scritta: il finto deve annullare tutto')
  // gli array restano gli STESSI oggetti (chi li tiene in mano continua a vederli)
  assert.equal(t.spese.length, 0)
  // un secondo tentativo trova lo stesso stato e lo stesso rifiuto: niente accumulo
  const bis = await server.cliente.pagaFattura('doc-f', OGGI, 'bonifico', [])
  assert.match(bis.errore ?? '', /negativ/i)
  assert.equal(t.documenti[0].status, 'approvata_da_pagare')
})

// ---- D3/D4: la prova di rifiuto è il codice applicativo (SQLSTATE) ---------
import { approvaFatturaRevisione, confermaFatturaPagataRevisione, type ClienteRevisione } from './revisioneScrittura.ts'
import { depositoRevisioneInMemoria } from './revisioneDurevole.ts'
import { creaPagatore } from './fatturePagamento.ts'
import { creaClienteRevisione, type SupabaseRevisione } from './revisioneClient.ts'

function clienteChe(risposta: { errore?: string; codice?: string; ids?: string[] }): ClienteRevisione {
  const ok1 = async () => ({ righe: 1 })
  return {
    aggiornaDocTotale: ok1, aggiornaDocumento: ok1, aggiornaBozza: ok1, aggiornaRiga: ok1,
    aggiungiRiga: async () => ({ id: 'x' }),
    confermaDocumento: async () => ({ ids: ['x'] }),
    scartaDocumento: async () => ({}),
    approvaFattura: async () => risposta,
    pagaFattura: async () => risposta,
    confermaFatturaPagata: async () => risposta,
  }
}

test('D3 un errore SENZA codice applicativo («Bad Gateway») è un esito INCERTO: annotazione conservata, niente «riprova»', async () => {
  const t = tabelleConSorellaNegativa()
  t.bozze.pop(); t.documenti[0].doc_total = 10
  const stato = statoDa(t)
  const gateway = clienteChe({ errore: 'Bad Gateway' })

  const dep1 = depositoRevisioneInMemoria()
  const a = await approvaFatturaRevisione(gateway, dep1, stato)
  assert.equal(a.ok, false); assert.equal(a.incerto, true)
  assert.match(a.errore, /nessun codice applicativo/)
  assert.equal(dep1.leggi('doc-f').traccia?.inCorso?.tipo, 'approvazione', 'la responsabilità resta custodita fino alla rilettura')

  const dep2 = depositoRevisioneInMemoria()
  const c = await confermaFatturaPagataRevisione(gateway, dep2, statoDa(t), OGGI, 'bonifico')
  assert.equal(c.ok, false); assert.equal(c.incerto, true)
  assert.equal(dep2.leggi('doc-f').traccia?.inCorso?.tipo, 'conferma')

  const p = await creaPagatore(gateway).paga('doc-f', { dataPagamento: OGGI, metodo: 'bonifico' }, OGGI)
  assert.equal(p.ok, false); assert.equal(p.incerto, true)
})

test('D3-bis con il codice applicativo il rifiuto è CERTO: annotazione tolta, messaggio della RPC, nessun incerto', async () => {
  const t = tabelleConSorellaNegativa()
  t.bozze.pop(); t.documenti[0].doc_total = 10
  const rifiuto = clienteChe({ errore: 'Scadenza mancante', codice: 'P0001' })
  const dep = depositoRevisioneInMemoria()
  const a = await approvaFatturaRevisione(rifiuto, dep, statoDa(t))
  assert.equal(a.ok, false); assert.ok(!a.incerto); assert.equal(a.errore, 'Scadenza mancante')
  assert.equal(dep.leggi('doc-f').traccia?.inCorso, undefined)
  const p = await creaPagatore(rifiuto).paga('doc-f', { dataPagamento: OGGI, metodo: 'bonifico' }, OGGI)
  assert.deepEqual(p, { ok: false, errore: 'Scadenza mancante' })
  // il servizio finto rigoroso rifiuta CON codice (come il gateway vero)
  const server = creaServerFattureFinto(tabelleConSorellaNegativa())
  const r = await server.cliente.approvaFattura('doc-f', [])
  assert.equal(r.codice, 'P0001')
})

test('D4 il cliente vero riporta error.code come codice; senza code niente codice (e quindi incerto a valle)', async () => {
  const conCode: SupabaseRevisione = {
    from: () => { throw new Error('non usato') },
    rpc: async () => ({ data: null, error: { message: 'Stato non valido per il pagamento', code: 'P0001' } }),
  }
  const senza: SupabaseRevisione = {
    from: () => { throw new Error('non usato') },
    rpc: async () => ({ data: null, error: { message: '<html>502 Bad Gateway</html>' } }),
  }
  assert.deepEqual(await creaClienteRevisione(conCode).pagaFattura('d', OGGI, 'bonifico', []), { errore: 'Stato non valido per il pagamento', codice: 'P0001' })
  assert.deepEqual(await creaClienteRevisione(conCode).approvaFattura('d', []), { errore: 'Stato non valido per il pagamento', codice: 'P0001' })
  assert.deepEqual(await creaClienteRevisione(senza).confermaFatturaPagata('d', OGGI, 'bonifico', []), { errore: '<html>502 Bad Gateway</html>' })
  const p = await creaPagatore(creaClienteRevisione(senza)).paga('d', { dataPagamento: OGGI, metodo: 'bonifico' }, OGGI)
  assert.equal(p.ok, false); assert.equal(p.incerto, true)
})
