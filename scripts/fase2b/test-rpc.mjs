#!/usr/bin/env node
// ============================================================================
// FASE 2B — TEST REALI di integrità e RPC via PostgREST sul progetto di
// PROVA. Gli scenari vengono preparati dal service role (come farà
// l'elaboratore /scontrini) e le RPC vengono chiamate dall'OWNER via
// PostgREST, come farà il gestionale. Output senza dati sensibili.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { rest, sql } from './api.mjs'

const owner = { jwt: readFileSync(join(homedir(), '.gestionale-2b', 'jwt-owner.txt'), 'utf8').trim() }
let passati = 0, falliti = 0
const esito = (nome, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (ok) passati++; else falliti++
}
const rpc = (nome, corpo, identita = owner) =>
  rest('/rest/v1/rpc/' + nome, identita, { method: 'POST', body: JSON.stringify(corpo) })

// gruppi della fixture (per ambito)
const gruppi = await sql("select id, ambito from family_groups order by sort")
const gPers = gruppi.find(g => g.ambito === 'personale').id
const gAz = gruppi.find(g => g.ambito === 'azienda').id

// scenario: documento + bozze + righe via service role (= elaboratore)
let seq = 0
async function scenario({ kind = 'scontrino', docTotal, docExtra = '', bozze }) {
  seq++
  const doc = (await sql(`insert into family_documents (kind, doc_total, status, upload_ambito${docExtra ? ', ' + docExtra.split('=')[0] : ''})
    values ('${kind}', ${docTotal}, 'in_revisione', 'personale'${docExtra ? `, ${docExtra.split('=')[1]}` : ''}) returning id`))[0]
  const ids = { doc: doc.id, bozze: [] }
  for (const b of bozze) {
    const bozza = (await sql(`insert into family_draft_expenses
      (document_id, expense_date, group_id, payment_method, arrotondamento_cent)
      values ('${doc.id}', '2030-06-0${seq % 9 + 1}', ${b.gruppo ? `'${b.gruppo}'` : 'null'},
              ${b.metodo ? `'${b.metodo}'` : 'null'}, ${b.arrotondamentoCent || 0}) returning id`))[0]
    for (const [i, r] of (b.righe || []).entries()) {
      await sql(`insert into family_draft_items (draft_id, name, amount, qty, excluded)
        values ('${bozza.id}', 'Riga-${i + 1}', ${r.amount}, 1, ${r.excluded || false})`)
    }
    ids.bozze.push(bozza.id)
  }
  return ids
}
async function fatturaCompleta(docTotal, extra = {}) {
  const doc = (await sql(`insert into family_documents
    (kind, doc_total, status, upload_ambito, supplier, document_date, due_date)
    values ('fattura', ${docTotal}, 'in_revisione', 'azienda', 'Fornitore Finto',
            '2030-06-01', ${extra.senzaScadenza ? 'null' : "'2030-06-20'"}) returning id`))[0]
  const bozza = (await sql(`insert into family_draft_expenses (document_id, expense_date, group_id)
    values ('${doc.id}', '2030-06-01', '${gAz}') returning id`))[0]
  await sql(`insert into family_draft_items (draft_id, name, amount, qty) values ('${bozza.id}', 'Servizio', ${docTotal}, 1)`)
  return { doc: doc.id, bozza: bozza.id }
}
const spese = async docId => sql(`select e.id, e.expense_date, e.amount, e.paid_at, e.payment_method,
  (select coalesce(sum(i.amount),0) from family_expense_items i where i.expense_id = e.id) somma_righe,
  (select count(*) from family_expense_items i where i.expense_id = e.id and i.is_adjustment) rettifiche
  from family_expenses e join family_expense_documents l on l.expense_id = e.id
  where l.document_id = '${docId}' order by e.amount`)

// ---------------------------------------------------------------------------
console.log('SCONTRINI: conferme, metodo, misto, escluse, arrotondamenti')
{
  // ① scontrino personale semplice
  let s = await scenario({ docTotal: 12.50, bozze: [{ gruppo: gPers, righe: [{ amount: 12.50 }] }] })
  let r = await rpc('conferma_documento', { p_document_id: s.doc })
  esito('conferma scontrino personale', r.ok, 'status ' + r.status)
  let sp = await spese(s.doc)
  esito('… 1 spesa, importo = somma righe', sp.length === 1 && Number(sp[0].amount) === 12.5 && Number(sp[0].somma_righe) === 12.5)

  // ② Casa Ania senza metodo ⇒ respinta
  s = await scenario({ docTotal: 9.00, bozze: [{ gruppo: gAz, righe: [{ amount: 9 }] }] })
  r = await rpc('conferma_documento', { p_document_id: s.doc })
  esito('Casa Ania senza metodo respinta', !r.ok && /Casa Ania|Metodo/i.test(await r.text()), 'status ' + r.status)
  esito('… zero spese create', (await spese(s.doc)).length === 0)
  // ③ con metodo valido ⇒ riuscita
  await sql(`update family_draft_expenses set payment_method='carta_attivita' where document_id='${s.doc}'`)
  r = await rpc('conferma_documento', { p_document_id: s.doc })
  esito('Casa Ania con metodo valido confermata', r.ok, 'status ' + r.status)

  // ④ misto con sorelle + riga esclusa + riga aggiunta dall'owner
  s = await scenario({ docTotal: 30.00, bozze: [
    { gruppo: gPers, righe: [{ amount: 18 }, { amount: 99, excluded: true }] },  // la 99 è esclusa
    { gruppo: gAz, metodo: 'contanti', righe: [{ amount: 10 }] },
  ] })
  // l'owner aggiunge una riga da 2,00 alla bozza personale durante la revisione
  r = await rest('/rest/v1/family_draft_items', owner, {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ draft_id: s.bozze[0], name: 'Aggiunta a mano', amount: 2, qty: 1 }),
  })
  esito('riga aggiunta a mano dall\'owner (user_added)', r.ok && (await r.json())[0].user_added === true)
  r = await rpc('conferma_documento', { p_document_id: s.doc, p_correzioni: [
    { field: 'righe', proposed: 'Riga-2', corrected: 'esclusa: doppione OCR', draft_id: s.bozze[0] },
  ] })
  esito('conferma scontrino misto (2 sorelle, esclusa fuori)', r.ok, 'status ' + r.status)
  sp = await spese(s.doc)
  esito('… 2 spese sorelle, somma = doc_total', sp.length === 2 && sp.reduce((x, e) => x + Number(e.amount), 0) === 30)
  esito('… la riga esclusa non esiste nelle definitive',
    (await sql(`select count(*) n from family_expense_items i join family_expense_documents l on l.expense_id=i.expense_id where l.document_id='${s.doc}' and i.amount=99`))[0].n === 0)
  esito('… la riga esclusa resta nell\'audit della bozza',
    (await sql(`select count(*) n from family_draft_items where draft_id='${s.bozze[0]}' and excluded`))[0].n === 1)
  const corr = await sql(`select count(*) n from family_corrections where document_id='${s.doc}'`)
  esito('… correzione registrata nella stessa transazione', corr[0].n === 1)
  // doppio tocco
  const prima = await (await rpc('conferma_documento', { p_document_id: s.doc, p_correzioni: [{ field: 'x', corrected: 'y' }] })).json()
  esito('doppio tocco: idempotente, stesse spese', Array.isArray(prima) && prima.length === 2)
  esito('… correzioni NON duplicate', (await sql(`select count(*) n from family_corrections where document_id='${s.doc}'`))[0].n === 1)

  // ⑤ arrotondamento +1 e −1
  s = await scenario({ docTotal: 10.00, bozze: [{ gruppo: gPers, arrotondamentoCent: 1, righe: [{ amount: 9.99 }] }] })
  r = await rpc('conferma_documento', { p_document_id: s.doc })
  sp = await spese(s.doc)
  esito('arrotondamento +1: riga Arrotondamento e importo 10,00', r.ok && Number(sp[0].amount) === 10 && sp[0].rettifiche === 1)
  s = await scenario({ docTotal: 9.99, bozze: [{ gruppo: gPers, arrotondamentoCent: -1, righe: [{ amount: 10.00 }] }] })
  r = await rpc('conferma_documento', { p_document_id: s.doc })
  sp = await spese(s.doc)
  esito('arrotondamento −1: importo 9,99 e somma righe = madre', r.ok && Number(sp[0].amount) === 9.99 && Number(sp[0].somma_righe) === 9.99)

  // ⑥ quadratura errata ⇒ zero spese
  s = await scenario({ docTotal: 10.00, bozze: [{ gruppo: gPers, righe: [{ amount: 9.99 }] }] })
  r = await rpc('conferma_documento', { p_document_id: s.doc })
  esito('quadratura errata respinta', !r.ok && /Quadratura/.test(await r.text()))
  esito('… zero spese create', (await spese(s.doc)).length === 0)

  // ⑦ correzione con bozza estranea ⇒ rollback totale
  s = await scenario({ docTotal: 5.00, bozze: [{ gruppo: gPers, righe: [{ amount: 5 }] }] })
  const altra = await scenario({ docTotal: 3.00, bozze: [{ gruppo: gPers, righe: [{ amount: 3 }] }] })
  r = await rpc('conferma_documento', { p_document_id: s.doc, p_correzioni: [{ field: 'x', draft_id: altra.bozze[0] }] })
  esito('correzione con bozza estranea respinta', !r.ok && /non appartiene/.test(await r.text()))
  esito('… rollback: zero spese e zero correzioni',
    (await spese(s.doc)).length === 0 &&
    (await sql(`select count(*) n from family_corrections where document_id='${s.doc}'`))[0].n === 0)

  // ⑧ gruppo mancante bloccante
  s = await scenario({ docTotal: 4.00, bozze: [{ gruppo: null, righe: [{ amount: 4 }] }] })
  r = await rpc('conferma_documento', { p_document_id: s.doc })
  esito('gruppo mancante blocca la conferma', !r.ok && /gruppo/i.test(await r.text()))
}

// ---------------------------------------------------------------------------
console.log('FATTURE: approvazione, pagamento, scadenza, immutabilità')
{
  // fattura non pagata
  let f = await fatturaCompleta(250)
  let r = await rpc('approva_fattura_da_pagare', { p_document_id: f.doc })
  esito('approvazione fattura', r.ok, 'status ' + r.status)
  esito('… ZERO spese, stato approvata_da_pagare',
    (await spese(f.doc)).length === 0 &&
    (await sql(`select status from family_documents where id='${f.doc}'`))[0].status === 'approvata_da_pagare')
  r = await rpc('approva_fattura_da_pagare', { p_document_id: f.doc })
  esito('doppia approvazione idempotente', r.ok)
  // pagamento senza metodo ⇒ respinto
  r = await rpc('paga_fattura', { p_document_id: f.doc, p_data_pagamento: '2030-07-05', p_payment_method: null })
  esito('pagamento senza metodo respinto', !r.ok && /Metodo/.test(await r.text()))
  // pagamento vero
  r = await rpc('paga_fattura', { p_document_id: f.doc, p_data_pagamento: '2030-07-05', p_payment_method: 'bonifico' })
  esito('pagamento riuscito', r.ok, 'status ' + r.status)
  let sp = await spese(f.doc)
  esito('… expense_date = paid_at = data pagamento', sp[0].expense_date === '2030-07-05' && sp[0].paid_at === '2030-07-05')
  // doppio pagamento
  const di_nuovo = await rpc('paga_fattura', { p_document_id: f.doc, p_data_pagamento: '2030-07-09', p_payment_method: 'contanti' })
  esito('doppio pagamento: nessun duplicato', di_nuovo.ok && (await spese(f.doc)).length === 1)
  esito('… la data vera resta', (await spese(f.doc))[0].expense_date === '2030-07-05')

  // fattura già pagata senza scadenza ⇒ due_date resta NULL
  f = await fatturaCompleta(80, { senzaScadenza: true })
  r = await rpc('conferma_fattura_pagata', { p_document_id: f.doc, p_data_pagamento: '2030-07-10', p_payment_method: 'carta_attivita' })
  esito('fattura già pagata confermata', r.ok, 'status ' + r.status)
  const d = (await sql(`select due_date, document_date from family_documents where id='${f.doc}'`))[0]
  esito('… due_date resta NULL, document_date conservata', d.due_date === null && d.document_date === '2030-06-01')

  // tipo PRIMA dell'idempotenza: paga_fattura su scontrino confermato
  const sc = await scenario({ docTotal: 3.00, bozze: [{ gruppo: gPers, righe: [{ amount: 3 }] }] })
  await rpc('conferma_documento', { p_document_id: sc.doc })
  r = await rpc('paga_fattura', { p_document_id: sc.doc, p_data_pagamento: '2030-07-11', p_payment_method: 'contanti' })
  esito('paga_fattura su scontrino confermato: tipo non valido', !r.ok && /Tipo non valido/.test(await r.text()))

  // immutabilità: modifica/cancellazione browser di una spesa documentata
  const spesaDoc = (await spese(sc.doc))[0]
  r = await rest(`/rest/v1/family_expenses?id=eq.${spesaDoc.id}`, owner, { method: 'PATCH', body: JSON.stringify({ amount: 999 }) })
  esito('update spesa documentata bloccato', !r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_expenses?id=eq.${spesaDoc.id}`, owner, { method: 'DELETE' })
  esito('delete spesa documentata bloccato', !r.ok, 'status ' + r.status)
  const riga = (await sql(`select id from family_expense_items where expense_id='${spesaDoc.id}' limit 1`))[0]
  r = await rest(`/rest/v1/family_expense_items?id=eq.${riga.id}`, owner, { method: 'PATCH', body: JSON.stringify({ amount: 999 }) })
  esito('update riga definitiva documentata bloccato', !r.ok, 'status ' + r.status)
  // spesa manuale senza documento: resta modificabile/eliminabile
  r = await rest('/rest/v1/family_expenses', owner, {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ expense_date: '2030-07-12', amount: 60, group_id: gPers, source: 'manuale' }),
  })
  const man = (await r.json())[0]
  r = await rest(`/rest/v1/family_expenses?id=eq.${man.id}`, owner, { method: 'PATCH', body: JSON.stringify({ amount: 61 }) })
  esito('spesa manuale modificabile', r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_expenses?id=eq.${man.id}`, owner, { method: 'DELETE' })
  esito('spesa manuale eliminabile', r.ok, 'status ' + r.status)

  // scarto: logico, idempotente, con audit
  const daScartare = await scenario({ docTotal: 7.00, bozze: [{ gruppo: gPers, righe: [{ amount: 7 }] }] })
  r = await rpc('scarta_documento', { p_document_id: daScartare.doc, p_motivo: 'foto doppia' })
  esito('scarto riuscito', r.ok, 'status ' + r.status)
  const st = await sql(`select
    (select status from family_documents where id='${daScartare.doc}') doc,
    (select count(*) from family_draft_expenses where document_id='${daScartare.doc}') bozze_esistenti,
    (select count(*) from family_draft_expenses where document_id='${daScartare.doc}' and status='scartata') bozze_scartate,
    (select count(*) from family_corrections where document_id='${daScartare.doc}' and source='scarto') audit`)
  esito('… logico (bozze conservate) + audit source=scarto',
    st[0].doc === 'scartato' && st[0].bozze_esistenti === 1 && st[0].bozze_scartate === 1 && st[0].audit === 1)
  r = await rpc('scarta_documento', { p_document_id: daScartare.doc, p_motivo: 'di nuovo' })
  esito('scarto idempotente', r.ok && (await sql(`select count(*) n from family_corrections where document_id='${daScartare.doc}'`))[0].n === 1)
}

// ---------------------------------------------------------------------------
console.log('CONCORRENZA, FIRME, MULTIPAGINA, RIESECUZIONE 0020')
{
  // conferma concorrente: due tocchi in parallelo sullo stesso documento
  const s = await scenario({ docTotal: 6.00, bozze: [{ gruppo: gPers, righe: [{ amount: 6 }] }] })
  const [r1, r2] = await Promise.all([
    rpc('conferma_documento', { p_document_id: s.doc }),
    rpc('conferma_documento', { p_document_id: s.doc }),
  ])
  esito('conferme concorrenti: entrambe rispondono', r1.ok && r2.ok, `${r1.status}/${r2.status}`)
  esito('… UNA sola spesa creata', (await spese(s.doc)).length === 1)

  // pagamento concorrente
  const f = await fatturaCompleta(90)
  await rpc('approva_fattura_da_pagare', { p_document_id: f.doc })
  const [p1, p2] = await Promise.all([
    rpc('paga_fattura', { p_document_id: f.doc, p_data_pagamento: '2030-08-01', p_payment_method: 'bonifico' }),
    rpc('paga_fattura', { p_document_id: f.doc, p_data_pagamento: '2030-08-01', p_payment_method: 'bonifico' }),
  ])
  esito('pagamenti concorrenti: nessun doppione', p1.ok && p2.ok && (await spese(f.doc)).length === 1)

  // ultimo owner da due sessioni concorrenti: promuovo l'estraneo a owner,
  // poi provo a declassare ENTRAMBI in parallelo — deve sopravviverne uno
  await sql("insert into app_members (user_id, role) select id, 'owner' from auth.users where id not in (select user_id from app_members)")
  const owners = await sql("select user_id from app_members where role='owner'")
  esito('preparazione: due owner', owners.length === 2)
  const [d1, d2] = await Promise.all(owners.map(o =>
    rest(`/rest/v1/app_members?user_id=eq.${o.user_id}`, owner, { method: 'PATCH', body: JSON.stringify({ role: 'member' }) })))
  const rimasti = await sql("select count(*) n from app_members where role='owner'")
  esito('declassamenti concorrenti: resta ALMENO un owner', rimasti[0].n >= 1,
    `esiti ${d1.status}/${d2.status}, owner rimasti ${rimasti[0].n}`)
  await sql(`update app_members set role='owner' where user_id in (select id from auth.users where email='owner@prova2b.locale')`)
  await sql("delete from app_members where user_id in (select id from auth.users where email='estraneo@prova2b.locale')")
  const ripristino = await sql("select count(*) n from app_members where role='owner'")
  esito('ripristino: 1 owner, estraneo fuori', ripristino[0].n === 1)
  // e il singolo declassamento dell'ultimo owner resta vietato
  let bloccato = false
  try { await sql("update app_members set role='member' where role='owner'") } catch (e) { bloccato = /ULTIMO owner/.test(e.message) }
  esito('declassare l\'ultimo owner: vietato anche via SQL', bloccato)

  // una sola firma esposta per ogni RPC pubblica
  const firme = await sql(`select p.proname, count(*) n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname in
      ('conferma_documento','approva_fattura_da_pagare','paga_fattura','conferma_fattura_pagata','scarta_documento')
    group by p.proname order by p.proname`)
  esito('una sola firma per ognuna delle 5 RPC', firme.length === 5 && firme.every(f => f.n === 1),
    firme.map(f => `${f.proname}:${f.n}`).join(' '))

  // documento nuovo MULTIPAGINA + riesecuzione 0020
  const multi = (await sql(`insert into family_documents (kind, doc_total, status, upload_ambito)
    values ('fattura', 40, 'da_elaborare', 'azienda') returning id`))[0]
  await sql(`insert into family_receipts (storage_path, status, ambito, document_id, page_order)
    values ('2030-09-01/multi-p1.txt', 'da_leggere', 'azienda', '${multi.id}', 1),
           ('2030-09-01/multi-p2.txt', 'da_leggere', 'azienda', '${multi.id}', 2)`)
  const pagine = await sql(`select count(*) n from family_receipts where document_id='${multi.id}'`)
  esito('documento multipagina: 2 file sullo stesso documento', pagine[0].n === 2)
  console.log('  riesecuzione 0020 col multipagina presente…')
  let rieseguita = true
  try { await sql(readFileSync('supabase/migrations/0020_rifacimento_spese_schema.sql', 'utf8')) }
  catch (e) { rieseguita = false; console.log('    errore:', e.message.slice(0, 160)) }
  esito('0020 rieseguita senza errori', rieseguita)
  const dopo = await sql(`select
    (select count(*) from family_documents where doc_total_derivato) derivati,
    (select count(*) from family_expense_documents where origine='backfill_0020') ponte`)
  esito('… nessun duplicato dal backfill (81 derivati, 215 ponte)', dopo[0].derivati === 81 && dopo[0].ponte === 215,
    JSON.stringify(dopo[0]))
}

console.log(`\nESITO RPC/INTEGRITÀ: ${passati} superati, ${falliti} falliti`)
process.exit(falliti ? 1 : 0)
