// ============================================================================
// Fase 5 — FATTURE nella REVISIONE: testata (tipo, fornitore, numero, date)
// con originali custoditi e correzioni, blocchi per «da pagare» e «già
// pagata», approvazione e conferma-già-pagata con un cliente SIMULATO
// rigoroso: doppio clic, errore certo, rete incerta, risposta persa, zero
// spese; presa in carico dopo un'approvazione annotata.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  apriRevisione, applicaVincoli, blocchiConferma, blocchiFattura, correzioniDa,
  documentoCorrente, eVincolatoDocumento, modificaBozza, modificaDocumento,
  modifichePendenti, riconciliaPresa, tracciaDa, vincoliDaOperazione, vincoliVuoti,
  type BozzaGrezza, type DocumentoGrezzoRevisione, type RigaGrezza,
} from './revisione.ts'
import {
  approvaFatturaRevisione, confermaFatturaPagataRevisione, confermaRevisione,
  salvaModifiche, type ClienteRevisione,
} from './revisioneScrittura.ts'
import { orchestrazioneLegacy, orchestrazioneContratto, MESSAGGIO_FATTURE_FUORI_CONTRATTO } from './orchestrazioneRevisione.ts'
import { depositoRevisioneInMemoria, depositoRevisioneLocale } from './revisioneDurevole.ts'
import { creaGuardiaInvio } from './scrittura.ts'
import { creaServerContratto } from './contrattoServerFinto.ts'
import { depositoOperazioniDurevole } from './depositoOperazioniDurevole.ts'
import { ponteContrattoDurevole } from './ponteContratto.ts'
import { improntaSha256 } from './improntaTesto.ts'

const OGGI = '2026-09-02'
const AMBITI: Record<string, 'personale' | 'azienda'> = { 'g-casa': 'personale', 'g-bnb': 'azienda' }
const ambitoDi = (g: string | null) => (g ? AMBITI[g] : 'personale')

const bozza = (x: Partial<BozzaGrezza> & { id: string }): BozzaGrezza => ({
  document_id: 'doc-f', status: 'da_controllare', expense_date: '2026-08-05',
  group_id: 'g-bnb', category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null,
  store: null, description: null, payment_method: null,
  room_id: 'r-lena', expense_nature: null, arrotondamento_cent: 0, confidence: null, ...x,
})
const riga = (x: Partial<RigaGrezza> & { id: string; draft_id: string; amount: number }): RigaGrezza => ({
  raw_name: null, name: 'Voce', qty: 1, unit_price: null, discount: 0,
  group_id: null, category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null,
  necessity: null, planning: null, excluded: false, user_added: false, confidence: null, ...x,
})
const TESTATA: DocumentoGrezzoRevisione = {
  kind: 'fattura', supplier: 'Lavanderia Girasole', invoice_number: '2026/18',
  document_date: '2026-08-05', due_date: '2026-09-05',
}
const fattura = (testata: Partial<DocumentoGrezzoRevisione> = {}) => apriRevisione('doc-f', 250,
  [bozza({ id: 'b1' })],
  [riga({ id: 'r1', draft_id: 'b1', name: 'Lavaggio lenzuola', amount: 250 })],
  null, { ...TESTATA, ...testata })

// cliente SIMULATO: registra le chiamate; le risposte si possono forzare
function clienteFinto(risposte: Partial<Record<keyof ClienteRevisione, unknown>> = {}) {
  const chiamate: { azione: string; payload?: unknown }[] = []
  const rispondi = (k: keyof ClienteRevisione, base: unknown) => {
    const r = risposte[k]
    if (typeof r === 'function') { const v = (r as () => unknown)(); return (v ?? base) as never }
    return (r ?? base) as never
  }
  const CAMPI_DOC = new Set(['kind', 'supplier', 'invoice_number', 'document_date', 'due_date'])
  const cliente: ClienteRevisione = {
    async aggiornaDocTotale(id, totale) { chiamate.push({ azione: 'doc_total', payload: totale }); return rispondi('aggiornaDocTotale', { righe: 1 }) },
    async aggiornaDocumento(id, campi) {
      for (const k of Object.keys(campi)) if (!CAMPI_DOC.has(k)) throw new Error(`colonna NON concessa su family_documents: ${k}`)
      chiamate.push({ azione: 'documento', payload: { id, campi } }); return rispondi('aggiornaDocumento', { righe: 1 })
    },
    async aggiornaBozza(id, campi) { chiamate.push({ azione: 'bozza', payload: { id, campi } }); return rispondi('aggiornaBozza', { righe: 1 }) },
    async aggiornaRiga(id, campi) { chiamate.push({ azione: 'riga', payload: { id, campi } }); return rispondi('aggiornaRiga', { righe: 1 }) },
    async aggiungiRiga(r) { chiamate.push({ azione: 'nuova', payload: r }); return rispondi('aggiungiRiga', { id: 'srv-1' }) },
    async confermaDocumento(id, correzioni) { chiamate.push({ azione: 'conferma', payload: { id, correzioni } }); return rispondi('confermaDocumento', { ids: ['spesa-1'] }) },
    async scartaDocumento(id, motivo) { chiamate.push({ azione: 'scarta', payload: { id, motivo } }); return rispondi('scartaDocumento', {}) },
    async approvaFattura(id, correzioni) { chiamate.push({ azione: 'approva', payload: { id, correzioni } }); return rispondi('approvaFattura', {}) },
    async pagaFattura(id, data, metodo, correzioni) { chiamate.push({ azione: 'paga', payload: { id, data, metodo, correzioni } }); return rispondi('pagaFattura', { ids: ['spesa-f'] }) },
    async confermaFatturaPagata(id, data, metodo, correzioni) { chiamate.push({ azione: 'pagata', payload: { id, data, metodo, correzioni } }); return rispondi('confermaFatturaPagata', { ids: ['spesa-f'] }) },
  }
  return { cliente, chiamate }
}
const esplode = () => { throw new Error('Failed to fetch') }

// ---- testata: originali intatti, correzioni, custodia ---------------------
test('testata della fattura: gli originali restano, le modifiche diventano correzioni senza draft_id', () => {
  let s = fattura()
  assert.equal(modifichePendenti(s), false)
  s = modificaDocumento(s, { supplier: 'Lavanderia Girasole S.r.l.', invoice_number: '  ' })
  assert.equal(s.documento.supplier, 'Lavanderia Girasole')          // mai mutato
  assert.equal(documentoCorrente(s).supplier, 'Lavanderia Girasole S.r.l.')
  assert.equal(documentoCorrente(s).invoice_number, null)             // testo vuoto → null
  assert.equal(modifichePendenti(s), true)
  assert.deepEqual(correzioniDa(s), [
    { field: 'supplier', proposed: 'Lavanderia Girasole', corrected: 'Lavanderia Girasole S.r.l.' },
    { field: 'invoice_number', proposed: '2026/18', corrected: null },
  ])
})

test('un documento senza testata (scontrino) apre come prima: nessuna modifica di testata, correzioni invariate', () => {
  const s = apriRevisione('doc-s', 5, [bozza({ id: 'b1', document_id: 'doc-s', group_id: 'g-casa' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  assert.equal(documentoCorrente(s).kind, 'scontrino')
  assert.deepEqual(s.modificheDocumento, {})
  assert.deepEqual(correzioniDa(s), [])
  assert.deepEqual(blocchiConferma(s, ambitoDi), [])
})

test('riapertura con traccia: gli originali della testata tornano dalla custodia e la correzione già salvata riaffiora', () => {
  let s = fattura()
  s = modificaDocumento(s, { due_date: '2026-09-15' })
  const traccia = tracciaDa(s)
  assert.deepEqual(traccia.originaliDocumento, TESTATA)
  // il database, dopo il Salva, restituisce già il valore corretto
  const dalDb = { ...TESTATA, due_date: '2026-09-15' }
  const righeDb = [riga({ id: 'r1', draft_id: 'b1', name: 'Lavaggio lenzuola', amount: 250 })]
  const riaperta = apriRevisione('doc-f', 250, [bozza({ id: 'b1' })], righeDb, traccia, dalDb)
  assert.equal(riaperta.documento.due_date, '2026-09-05')            // originale dalla custodia
  assert.deepEqual(riaperta.modificheDocumento, { due_date: '2026-09-15' })
  assert.deepEqual(correzioniDa(riaperta), [{ field: 'due_date', proposed: '2026-09-05', corrected: '2026-09-15' }])
  // una traccia SENZA testata (precedente alla Fase 5) resta valida: la
  // testata riparte dal database
  const vecchia = { ...traccia }
  delete vecchia.originaliDocumento; delete vecchia.modificheDocumento
  const memoria = new Map<string, string>()
  const dep = depositoRevisioneLocale('t', () => ({ getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => { memoria.set(k, v) } }))
  assert.equal(dep.salva(vecchia).errore, undefined)
  const r2 = apriRevisione('doc-f', 250, [bozza({ id: 'b1' })], righeDb, vecchia, dalDb)
  assert.equal(r2.documento.due_date, '2026-09-15')
  assert.deepEqual(r2.modificheDocumento, {})
})

test('vincoli della testata: un Salva annotato senza esito vincola i campi di testata modificati', () => {
  let s = fattura()
  s = modificaDocumento(s, { supplier: 'Altro fornitore' })
  const v = vincoliDaOperazione({ ...tracciaDa(s), inCorso: { tipo: 'salva', generazione: 1 } })
  assert.deepEqual(v.documento, ['supplier'])
  assert.equal(vincoliVuoti(v), false)
  const vincolata = applicaVincoli(fattura(), v)
  assert.equal(eVincolatoDocumento(vincolata, 'supplier'), true)
  assert.equal(eVincolatoDocumento(vincolata, 'due_date'), false)
  // il campo vincolato non entra nemmeno nello stato
  const tentata = modificaDocumento(vincolata, { supplier: 'X', due_date: '2026-10-01' })
  assert.deepEqual(tentata.modificheDocumento, { due_date: '2026-10-01' })
  assert.ok(blocchiFattura(tentata, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI).some(b => b.includes('vincolati')))
})

// ---- blocchi: da pagare / già pagata / camera e ambito ----------------------
test('da pagare: totale, data documento, fornitore, scadenza, gruppo e quadratura; il metodo per parte NON è richiesto', () => {
  const s = fattura()
  assert.deepEqual(blocchiFattura(s, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI), [])
  const senza = fattura({ supplier: null, document_date: null, due_date: null })
  const b = blocchiFattura(senza, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI)
  assert.ok(b.some(x => x.includes('fornitore')))
  assert.ok(b.some(x => x.includes('data della fattura')))
  assert.ok(b.some(x => x.includes('scadenza')))
  const dataFinta = fattura({ document_date: '2026-02-30' })
  assert.ok(blocchiFattura(dataFinta, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI).some(x => x.includes('non è valida')))
  const scontrino = fattura({ kind: 'scontrino' })
  assert.ok(blocchiFattura(scontrino, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI).some(x => x.includes('non è segnato come fattura')))
  // conferma come SCONTRINO di una fattura: bloccata (la RPC la rifiuterebbe)
  assert.ok(blocchiConferma(s, ambitoDi).some(x => x.includes('è una fattura')))
  // gruppo mancante e quadratura rotta: come per gli scontrini
  const rotta = modificaBozza(fattura(), 'b1', { group_id: null, arrotondamento_cent: 5 })
  const br = blocchiFattura(rotta, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI)
  assert.ok(br.some(x => x.includes('destinatario (gruppo)')))
  assert.ok(br.some(x => x.includes('non quadra')))
})

test('già pagata: data reale e non futura, metodo obbligatorio e valido; la scadenza può mancare', () => {
  const s = fattura({ due_date: null })
  assert.deepEqual(blocchiFattura(s, ambitoDi, undefined, { esito: 'pagata', dataPagamento: '2026-09-01', metodo: 'bonifico' }, OGGI), [])
  const b1 = blocchiFattura(s, ambitoDi, undefined, { esito: 'pagata', dataPagamento: null, metodo: null }, OGGI)
  assert.ok(b1.some(x => x.includes('data del pagamento')))
  assert.ok(b1.some(x => x.includes('metodo di pagamento')))
  const b2 = blocchiFattura(s, ambitoDi, undefined, { esito: 'pagata', dataPagamento: '2026-09-03', metodo: 'carta' }, OGGI)
  assert.ok(b2.some(x => x.includes('nel futuro')))
  assert.ok(b2.some(x => x.includes('metodo di pagamento')))
  // pagata oggi va bene
  assert.deepEqual(blocchiFattura(s, ambitoDi, undefined, { esito: 'pagata', dataPagamento: OGGI, metodo: 'contanti' }, OGGI), [])
})

test('camera e ambito coerenti: una parte con gruppo Casa Mia blocca la fattura; la camera resta facoltativa (Generale)', () => {
  const s = modificaBozza(fattura(), 'b1', { group_id: 'g-casa' })
  assert.ok(blocchiFattura(s, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI).some(x => x.includes('Casa Ania')))
  const generale = modificaBozza(fattura(), 'b1', { room_id: null })
  assert.deepEqual(blocchiFattura(generale, ambitoDi, undefined, { esito: 'da_pagare' }, OGGI), [])
})

// ---- approvazione: zero spese, RPC giusta, correzioni, traccia tolta -------
test('approvazione: prima il Salva della testata, poi SOLO approva_fattura_da_pagare con le correzioni; nessuna spesa; traccia rimossa', async () => {
  let s = fattura()
  s = modificaDocumento(s, { supplier: 'Lavanderia Girasole S.r.l.' })
  s = modificaBozza(s, 'b1', { room_id: 'r-ambra' })
  const { cliente, chiamate } = clienteFinto()
  const dep = depositoRevisioneInMemoria()
  const esito = await approvaFatturaRevisione(cliente, dep, s)
  assert.equal(esito.ok, true)
  assert.deepEqual(chiamate.map(c => c.azione), ['documento', 'bozza', 'approva'])
  const approva = chiamate.find(c => c.azione === 'approva')!.payload as { correzioni: Record<string, unknown>[] }
  assert.deepEqual(approva.correzioni, [
    { field: 'supplier', proposed: 'Lavanderia Girasole', corrected: 'Lavanderia Girasole S.r.l.' },
    { field: 'room_id', proposed: 'r-lena', corrected: 'r-ambra', draft_id: 'b1' },
  ])
  assert.ok(!chiamate.some(c => c.azione === 'conferma' || c.azione === 'paga' || c.azione === 'pagata'))
  assert.equal(dep.leggi('doc-f').traccia, undefined)              // revisione chiusa
})

test('doppio clic sull\'approvazione: una sola RPC', async () => {
  const s = fattura()
  const { cliente, chiamate } = clienteFinto()
  const guardia = creaGuardiaInvio()
  const dep = depositoRevisioneInMemoria()
  await Promise.all([
    guardia(() => approvaFatturaRevisione(cliente, dep, s)),
    guardia(() => approvaFatturaRevisione(cliente, dep, s)),
  ])
  assert.equal(chiamate.filter(c => c.azione === 'approva').length, 1)
})

test('approvazione: errore certo = rifiuto con messaggio e annotazione tolta; rete restituita e risposta persa = INCERTO con annotazione conservata', async () => {
  const s = fattura()
  const certo = clienteFinto({ approvaFattura: { errore: 'Scadenza mancante', codice: 'P0001' } })
  const dep1 = depositoRevisioneInMemoria()
  const e1 = await approvaFatturaRevisione(certo.cliente, dep1, s)
  assert.equal(e1.ok, false)
  assert.ok(!e1.ok && e1.errore.includes('Scadenza mancante') && !e1.incerto)
  assert.equal(dep1.leggi('doc-f').traccia?.inCorso, undefined)

  const rete = clienteFinto({ approvaFattura: { errore: 'Failed to fetch' } })
  const dep2 = depositoRevisioneInMemoria()
  const e2 = await approvaFatturaRevisione(rete.cliente, dep2, s)
  assert.ok(!e2.ok && e2.incerto && e2.errore.includes('approvazione dall\'esito incerto'))
  assert.equal(dep2.leggi('doc-f').traccia?.inCorso?.tipo, 'approvazione')

  const persa = clienteFinto({ approvaFattura: esplode })
  const dep3 = depositoRevisioneInMemoria()
  const e3 = await approvaFatturaRevisione(persa.cliente, dep3, s)
  assert.ok(!e3.ok && e3.incerto)
  assert.equal(dep3.leggi('doc-f').traccia?.inCorso?.tipo, 'approvazione')
})

test('presa in carico dopo un\'approvazione annotata: documento approvato → chiusa (coerente); ancora in revisione → bloccata; confermato → chiusa ma esito diverso', () => {
  const traccia = { ...tracciaDa(fattura()), inCorso: { tipo: 'approvazione' as const, generazione: 1 } }
  const ok = riconciliaPresa(traccia, { id: 'doc-f', status: 'approvata_da_pagare' }, [bozza({ id: 'b1' })])
  assert.equal(ok.esito, 'chiusa')
  assert.ok(ok.esito === 'chiusa' && !ok.motivo.includes('DIVERSO'))
  const attesa = riconciliaPresa(traccia, { id: 'doc-f', status: 'in_revisione' }, [bozza({ id: 'b1' })])
  assert.equal(attesa.esito, 'bloccata')
  const diverso = riconciliaPresa(traccia, { id: 'doc-f', status: 'confermato' }, [bozza({ id: 'b1', status: 'confermata' })])
  assert.ok(diverso.esito === 'chiusa' && diverso.motivo.includes('DIVERSO'))
  // una conferma annotata su un documento poi risultato approvato: chiusa ma DIVERSA
  const conferma = { ...traccia, inCorso: { tipo: 'conferma' as const, generazione: 1 } }
  const c = riconciliaPresa(conferma, { id: 'doc-f', status: 'approvata_da_pagare' }, [bozza({ id: 'b1' })])
  assert.ok(c.esito === 'chiusa' && c.motivo.includes('DIVERSO'))
})

// ---- già pagata: RPC dedicata con data e metodo, spese pretese -------------
test('già pagata: conferma_fattura_pagata con data e metodo espliciti; zero spese restituite = incerto, mai un successo', async () => {
  const s = fattura({ due_date: null })
  const { cliente, chiamate } = clienteFinto()
  const dep = depositoRevisioneInMemoria()
  const e = await confermaFatturaPagataRevisione(cliente, dep, s, '2026-09-01', 'bonifico')
  assert.equal(e.ok, true)
  assert.deepEqual(chiamate.map(c => c.azione), ['pagata'])
  assert.deepEqual(chiamate[0].payload, { id: 'doc-f', data: '2026-09-01', metodo: 'bonifico', correzioni: [] })
  assert.equal(dep.leggi('doc-f').traccia, undefined)

  const zero = clienteFinto({ confermaFatturaPagata: { ids: [] } })
  const e0 = await confermaFatturaPagataRevisione(zero.cliente, depositoRevisioneInMemoria(), s, '2026-09-01', 'bonifico')
  assert.ok(!e0.ok && e0.incerto && e0.errore.includes('non ha restituito le spese'))

  const rifiuto = clienteFinto({ confermaFatturaPagata: { errore: 'Metodo di pagamento obbligatorio e valido per una fattura già pagata', codice: 'P0001' } })
  const er = await confermaFatturaPagataRevisione(rifiuto.cliente, depositoRevisioneInMemoria(), s, '2026-09-01', 'bonifico')
  assert.ok(!er.ok && !er.incerto && er.errore.includes('Metodo'))
})

test('la conferma come scontrino resta identica: conferma_documento, ids pretesi (regressione)', async () => {
  const s = apriRevisione('doc-s', 5, [bozza({ id: 'b1', document_id: 'doc-s', group_id: 'g-casa' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  const { cliente, chiamate } = clienteFinto()
  const e = await confermaRevisione(cliente, depositoRevisioneInMemoria(), s)
  assert.equal(e.ok, true)
  assert.deepEqual(chiamate.map(c => c.azione), ['conferma'])
})

test('Salva della testata: una sola UPDATE con le colonne concesse; zero righe toccate NON è un successo', async () => {
  let s = fattura()
  s = modificaDocumento(s, { invoice_number: '2026/19', kind: 'fattura' })
  const ok = clienteFinto()
  const e = await salvaModifiche(ok.cliente, depositoRevisioneInMemoria(), s)
  assert.equal(e.ok, true)
  assert.deepEqual(ok.chiamate, [{ azione: 'documento', payload: { id: 'doc-f', campi: { invoice_number: '2026/19', kind: 'fattura' } } }])
  const zero = clienteFinto({ aggiornaDocumento: { righe: 0 } })
  const ez = await salvaModifiche(zero.cliente, depositoRevisioneInMemoria(), s)
  assert.ok(!ez.ok && ez.errore.includes('nessuna riga toccata'))
})

test('orchestrazione: legacy delega alle due chiusure fattura; il percorso a contratto le RIFIUTA esplicitamente senza scrivere', async () => {
  const s = fattura()
  const { cliente, chiamate } = clienteFinto()
  const legacy = orchestrazioneLegacy(cliente, depositoRevisioneInMemoria())
  assert.equal((await legacy.approvaFattura(s)).ok, true)
  assert.equal((await legacy.confermaFatturaPagata(fattura(), '2026-09-01', 'bonifico')).ok, true)
  assert.deepEqual(chiamate.map(c => c.azione), ['approva', 'pagata'])

  const memoria = new Map<string, string>()
  const mem = { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => { memoria.set(k, v) }, removeItem: (k: string) => { memoria.delete(k) } }
  const server = creaServerContratto({
    documenti: new Map([['doc-f', { status: 'in_revisione', revisione_rev: 0, doc_total: 250 }]]),
    bozze: new Map(), righe: new Map(),
  }, improntaSha256)
  const contratto = orchestrazioneContratto({
    cliente: server.cliente,
    depositoRevisione: depositoRevisioneLocale('rev', () => mem as unknown as Storage),
    depositoOperazioni: depositoOperazioniDurevole(mem as unknown as Storage, 'ops'),
    ponte: ponteContrattoDurevole(mem as unknown as Storage, 'ponte'),
    revisioneIniziale: 0,
  })
  const ra = await contratto.approvaFattura(s)
  assert.ok(!ra.ok && ra.errore === MESSAGGIO_FATTURE_FUORI_CONTRATTO)
  const rp = await contratto.confermaFatturaPagata(s, '2026-09-01', 'bonifico')
  assert.ok(!rp.ok && rp.errore === MESSAGGIO_FATTURE_FUORI_CONTRATTO)
  assert.equal(server.giornale.size, 0)                              // nessuna scrittura
})
