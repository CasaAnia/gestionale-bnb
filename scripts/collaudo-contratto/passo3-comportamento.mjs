#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 3: COMPORTAMENTO delle RPC nel contesto
// authenticated (claims del membro + set local role, come nel passo3
// della 0022). Ogni caso ha la sua fixture; gli esiti negativi
// verificano anche che NULLA sia stato scritto (fotografia identica).
// ============================================================================
import { randomUUID } from 'node:crypto'
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { comeMembro, contatore, fixtureDocumento, fotografiaDocumento, ownerId } from './ambiente.mjs'

verificaNonProduzione(progetto().ref)
const v = contatore('PASSO 3 · comportamento delle RPC')
const UID = await ownerId()

const salva = (op, doc, rev, modifiche) =>
  `select public.salva_revisione('${op}'::uuid,'${doc}'::uuid,${rev},'${JSON.stringify(modifiche).replaceAll("'", "''")}'::jsonb) as r`
const chiama = async corpo => {
  const righe = await sql(`begin; ${comeMembro(UID)} ${corpo}; commit;`)
  return righe.find(x => x?.r)?.r ?? righe[righe.length - 1]?.r ?? righe
}
const batch = (doc, extra = {}) => ({ bozze: {}, righe: {}, nuove: [], ...extra })

// ---- APPLICATA con mappa, replay RIPETUTA, niente doppioni ----------------
{
  const f = await fixtureDocumento(UID)
  const op = randomUUID()
  const b = batch(f.docId, {
    doc_total: 5.5,
    bozze: { [f.bozzaId]: { store: 'Iper' } },
    righe: { [f.rigaId]: { amount: 4.5 } },
    nuove: [{ client_ref: 'loc-1', draft_id: f.bozzaId, name: 'Sacchetto', qty: 1, unit_price: null, discount: 0, amount: 1, group_id: null, category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null }],
  })
  const r1 = await chiama(salva(op, f.docId, 0, b))
  v.attesa('APPLICATA con rev_dopo=1 e mappa client_ref→id', r1.esito === 'APPLICATA' && r1.rev_dopo === 1 && r1.righe_nuove?.[0]?.client_ref === 'loc-1' && !!r1.righe_nuove?.[0]?.id, JSON.stringify(r1))
  const [dopo] = await sql(`select doc_total::numeric as t, revisione_rev from public.family_documents where id='${f.docId}'`)
  v.attesa('effetti applicati (totale e rev)', Number(dopo.t) === 5.5 && dopo.revisione_rev === 1)
  const [conta1] = await sql(`select count(*)::int as n from public.family_draft_items where draft_id='${f.bozzaId}'`)
  const r2 = await chiama(salva(op, f.docId, 0, b))
  const [conta2] = await sql(`select count(*)::int as n from public.family_draft_items where draft_id='${f.bozzaId}'`)
  v.attesa('replay → RIPETUTA con la STESSA mappa, nessun doppione',
    r2.esito === 'RIPETUTA' && JSON.stringify(r2.righe_nuove) === JSON.stringify(r1.righe_nuove) && conta1.n === conta2.n, JSON.stringify(r2))
  // identità: stessa chiave con contenuto/documento/kind diversi
  const r3 = await chiama(salva(op, f.docId, 0, batch(f.docId, { bozze: { [f.bozzaId]: { store: 'Altro' } } })))
  v.attesa('stessa chiave, contenuto diverso → CHIAVE_RIUSATA', r3.esito === 'CHIAVE_RIUSATA', JSON.stringify(r3))
  const g = await fixtureDocumento(UID)
  const r4 = await chiama(salva(op, g.docId, 0, batch(g.docId, { bozze: { [g.bozzaId]: { store: 'X' } } })))
  v.attesa('stessa chiave, documento diverso → CHIAVE_RIUSATA', r4.esito === 'CHIAVE_RIUSATA', JSON.stringify(r4))
  const r5 = await chiama(`select public.conferma_revisione('${op}'::uuid,'${f.docId}'::uuid,1,'[]'::jsonb) as r`)
  v.attesa('stessa chiave, kind diverso → CHIAVE_RIUSATA', r5.esito === 'CHIAVE_RIUSATA', JSON.stringify(r5))
}

// ---- SUPERATA (anche per conferma e scarto tardivi) -----------------------
{
  const f = await fixtureDocumento(UID)
  await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { bozze: { [f.bozzaId]: { store: 'Nuovo di B' } } })))
  const prima = await fotografiaDocumento(f.docId)
  const rA = await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { bozze: { [f.bozzaId]: { store: 'Vecchio di A' } } })))
  v.attesa('Salva tardivo → SUPERATA e nulla scritto', rA.esito === 'SUPERATA' && await fotografiaDocumento(f.docId) === prima, JSON.stringify(rA))
  const rC = await chiama(`select public.conferma_revisione('${randomUUID()}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r`)
  const rS = await chiama(`select public.scarta_revisione('${randomUUID()}'::uuid,'${f.docId}'::uuid,0,'tardi') as r`)
  const [stato] = await sql(`select status from public.family_documents where id='${f.docId}'`)
  v.attesa('conferma e scarto tardivi → SUPERATA, documento intatto',
    rC.esito === 'SUPERATA' && rS.esito === 'SUPERATA' && stato.status === 'in_revisione', JSON.stringify({ rC, rS, stato }))
}

// ---- STATI (lista positiva) e PERIMETRO con atomicità ---------------------
{
  const f = await fixtureDocumento(UID, { stato: 'approvata_da_pagare' })
  const prima = await fotografiaDocumento(f.docId)
  const r = await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { bozze: { [f.bozzaId]: { store: 'X' } } })))
  v.attesa('approvata_da_pagare → DOCUMENTO_NON_MODIFICABILE, intatto',
    r.esito === 'DOCUMENTO_NON_MODIFICABILE' && await fotografiaDocumento(f.docId) === prima, JSON.stringify(r))
}
{
  const f = await fixtureDocumento(UID)
  await sql(`update public.family_draft_expenses set status='confermata' where id='${f.bozzaId}'`)
  const [alt] = await sql(`insert into public.family_draft_expenses (document_id, status, expense_date, group_id, arrotondamento_cent)
    values ('${f.docId}','da_controllare','2026-08-29',(select group_id from public.family_draft_expenses where id='${f.bozzaId}'),0) returning id`)
  const prima = await fotografiaDocumento(f.docId)
  const r = await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, {
    bozze: { [alt.id]: { store: 'valida' }, [f.bozzaId]: { store: 'storica toccata' } },
  })))
  v.attesa('bozza storica nel batch → BOZZA_NON_MODIFICABILE, ATOMICO (nemmeno la parte valida)',
    r.esito === 'BOZZA_NON_MODIFICABILE' && await fotografiaDocumento(f.docId) === prima, JSON.stringify(r))
}
{
  const f = await fixtureDocumento(UID)
  const g = await fixtureDocumento(UID)
  const estraneo = await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { bozze: { [g.bozzaId]: { store: 'furto' } } })))
  v.attesa('bozza di un altro documento → RIFERIMENTO_ESTRANEO', estraneo.esito === 'RIFERIMENTO_ESTRANEO', JSON.stringify(estraneo))
  const mancante = await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { righe: { '00000000-0000-0000-0000-000000000009': { amount: 1 } } })))
  v.attesa('riga inesistente → IDENTIFICATIVO_MANCANTE', mancante.esito === 'IDENTIFICATIVO_MANCANTE', JSON.stringify(mancante))
  const voce = { client_ref: 'x', draft_id: f.bozzaId, name: 'V', qty: 1, unit_price: null, discount: 0, amount: 1, group_id: null, category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null }
  const doppio = await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { nuove: [voce, { ...voce, name: 'W' }] })))
  v.attesa('client_ref duplicati → CLIENT_REF_DUPLICATO', doppio.esito === 'CLIENT_REF_DUPLICATO', JSON.stringify(doppio))
  const estraneoCampo = await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { bozze: { [f.bozzaId]: { confidence: {} } } })))
  v.attesa('campo estraneo → CAMPO_NON_CONSENTITO', estraneoCampo.esito === 'CAMPO_NON_CONSENTITO', JSON.stringify(estraneoCampo))
  const malformato = await chiama(salva(randomUUID(), f.docId, 0, { bozze: {}, righe: {} }))
  v.attesa('batch malformato → MODIFICHE_MALFORMATE', malformato.esito === 'MODIFICHE_MALFORMATE', JSON.stringify(malformato))
}

// ---- vincoli 0020 sui valori (rete di sicurezza, non sentinella) ----------
{
  const f = await fixtureDocumento(UID)
  const prima = await fotografiaDocumento(f.docId)
  let respinto = false
  try { await chiama(salva(randomUUID(), f.docId, 0, batch(f.docId, { righe: { [f.rigaId]: { amount: -1 } } }))) }
  catch (e) { respinto = /check|violat|amount/i.test(String(e.message)) }
  v.attesa('amount negativo → respinto dal CHECK 0020, nulla scritto', respinto && await fotografiaDocumento(f.docId) === prima)
}

// ---- CONFERMA versionata: quadratura del server, spese, replay ------------
{
  const f = await fixtureDocumento(UID)                       // totale 5, righe 5: quadra
  const op = randomUUID()
  const r1 = await chiama(`select public.conferma_revisione('${op}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r`)
  v.attesa('conferma → APPLICATA con spese', r1.esito === 'APPLICATA' && Array.isArray(r1.spese) && r1.spese.length > 0, JSON.stringify(r1))
  const [dopo] = await sql(`select status, revisione_rev from public.family_documents where id='${f.docId}'`)
  const [bz] = await sql(`select status from public.family_draft_expenses where id='${f.bozzaId}'`)
  v.attesa('documento confermato, bozza confermata, rev+1', dopo.status === 'confermato' && dopo.revisione_rev === 1 && bz.status === 'confermata')
  const r2 = await chiama(`select public.conferma_revisione('${op}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r`)
  v.attesa('replay della conferma → RIPETUTA con le stesse spese', r2.esito === 'RIPETUTA' && JSON.stringify(r2.spese) === JSON.stringify(r1.spese), JSON.stringify(r2))
}
{
  const f = await fixtureDocumento(UID, { totale: 30 })       // righe 5: NON quadra
  const prima = await fotografiaDocumento(f.docId)
  let messaggio = ''
  try { await chiama(`select public.conferma_revisione('${randomUUID()}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r`) }
  catch (e) { messaggio = String(e.message) }
  v.attesa('quadratura sbagliata → RAISE del server (P0001), nulla scritto e giornale vuoto',
    /quadratura/i.test(messaggio) && await fotografiaDocumento(f.docId) === prima, messaggio.slice(0, 120))
}

// ---- SCARTO versionato ----------------------------------------------------
{
  const f = await fixtureDocumento(UID)
  const r = await chiama(`select public.scarta_revisione('${randomUUID()}'::uuid,'${f.docId}'::uuid,0,'foto doppia') as r`)
  const [dopo] = await sql(`select status from public.family_documents where id='${f.docId}'`)
  v.attesa('scarto → APPLICATA e documento scartato', r.esito === 'APPLICATA' && dopo.status === 'scartato', JSON.stringify(r))
}

// ---- esito_revisione ------------------------------------------------------
{
  const f = await fixtureDocumento(UID)
  const op = randomUUID()
  await chiama(salva(op, f.docId, 0, batch(f.docId, { bozze: { [f.bozzaId]: { store: 'Iper' } } })))
  const g = await chiama(`select public.esito_revisione('${op}'::uuid) as r`)
  v.attesa('esito_revisione: applicata con documento/kind/base_rev/impronta',
    g.stato === 'applicata' && g.document_id === f.docId && g.kind === 'salva' && g.base_rev === 0 && typeof g.manifesto_sha256 === 'string', JSON.stringify(g))
  const assente = await chiama(`select public.esito_revisione('${randomUUID()}'::uuid) as r`)
  v.attesa('esito_revisione: assente per chiave mai vista', assente.stato === 'assente', JSON.stringify(assente))
}

await v.chiudi()
