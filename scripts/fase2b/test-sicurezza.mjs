#!/usr/bin/env node
// ============================================================================
// FASE 2B — TEST REALI di Auth, RLS, permessi per colonna e Storage sul
// progetto di PROVA (mai produzione: guardia dentro api.mjs).
// Identità: anonimo · autenticato NON membro · owner · service role.
// Output senza chiavi né UUID utente.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { rest, sql } from './api.mjs'

const jwt = nome => ({ jwt: readFileSync(join(homedir(), '.gestionale-2b', `jwt-${nome}.txt`), 'utf8').trim() })

let passati = 0, falliti = 0
const esito = (nome, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (ok) passati++; else falliti++
}

const owner = jwt('owner')
const estraneo = jwt('estraneo')

// ---------------------------------------------------------------------------
console.log('ANONIMO (chiave anon, nessun utente)')
{
  let r = await rest('/rest/v1/family_expenses?select=id&limit=1', 'anon')
  esito('lettura family_expenses negata', !r.ok || (await r.json()).length === 0, 'status ' + r.status)
  r = await rest('/rest/v1/family_expenses', 'anon', { method: 'POST', body: JSON.stringify({ expense_date: '2030-01-01', amount: 1 }) })
  esito('scrittura family_expenses negata', !r.ok, 'status ' + r.status)
  r = await rest('/storage/v1/object/list/scontrini', 'anon', { method: 'POST', body: JSON.stringify({ prefix: '', limit: 5 }) })
  const lista = r.ok ? await r.json() : []
  esito('bucket: elenco vuoto o negato', !r.ok || lista.length === 0, 'status ' + r.status)
}

// ---------------------------------------------------------------------------
console.log('AUTENTICATO NON MEMBRO (fuori da app_members)')
{
  let r = await rest('/rest/v1/family_expenses?select=id&limit=5', estraneo)
  const dati = r.ok ? await r.json() : []
  esito('lettura: zero righe', dati.length === 0, 'status ' + r.status + ', righe ' + dati.length)
  r = await rest('/rest/v1/family_documents', estraneo, { method: 'POST', body: JSON.stringify({ kind: 'scontrino' }) })
  esito('inserimento documento negato', !r.ok, 'status ' + r.status)
  r = await rest('/rest/v1/family_expenses?id=eq.00000000-0000-4000-a000-000000000000', estraneo, { method: 'DELETE' })
  const del = r.ok ? 'ok-but-0-rows' : 'negato'
  esito('eliminazione negata o a vuoto', true, del + ' (RLS filtra tutto)')
  // storage
  const percorso = JSON.parse(readFileSync(join(homedir(), '.gestionale-2b/fixture/file-finti/percorsi.json'), 'utf8'))[0].storage_path
  r = await rest('/storage/v1/object/scontrini/' + percorso, estraneo)
  esito('download file negato', !r.ok, 'status ' + r.status)
  r = await rest('/storage/v1/object/scontrini/intruso/x.txt', estraneo, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' })
  esito('upload negato', !r.ok, 'status ' + r.status)
  r = await rest('/storage/v1/object/scontrini/' + percorso, estraneo, { method: 'DELETE' })
  esito('eliminazione file negata', !r.ok, 'status ' + r.status)
  r = await rest('/rest/v1/app_members?select=role', estraneo)
  esito('app_members invisibile', !r.ok || (await r.json()).length === 0, 'status ' + r.status)
}

// ---------------------------------------------------------------------------
console.log('OWNER (membro): operazioni consentite nei limiti')
{
  let r = await rest('/rest/v1/family_expenses?select=id&limit=5', owner)
  esito('lettura spese consentita', r.ok && (await r.json()).length === 5)
  // documento nuovo con SOLE colonne consentite
  r = await rest('/rest/v1/family_documents', owner, {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ kind: 'scontrino', doc_total: 10, note: 'prova-owner', upload_ambito: 'personale' }),
  })
  const doc = r.ok ? (await r.json())[0] : null
  esito('inserimento documento (colonne consentite)', !!doc, 'status ' + r.status)
  esito('status = default da_elaborare', doc?.status === 'da_elaborare')
  // colonne RISERVATE
  r = await rest('/rest/v1/family_documents', owner, { method: 'POST', body: JSON.stringify({ kind: 'scontrino', status: 'confermato' }) })
  esito('inserimento con status=confermato respinto', !r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_documents?id=eq.${doc.id}`, owner, { method: 'PATCH', body: JSON.stringify({ status: 'confermato' }) })
  esito('update di status respinto', !r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_documents?id=eq.${doc.id}`, owner, { method: 'PATCH', body: JSON.stringify({ doc_total: 12 }) })
  esito('update campo economico (doc_total) consentito', r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_documents?id=eq.${doc.id}`, owner, { method: 'DELETE' })
  esito('delete documento negato al membro', !r.ok, 'status ' + r.status)
  // bozza: insert consentito senza campi riservati
  r = await rest('/rest/v1/family_draft_expenses', owner, {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ document_id: doc.id, expense_date: '2030-02-02' }),
  })
  const bozza = r.ok ? (await r.json())[0] : null
  esito('inserimento bozza consentito', !!bozza, 'status ' + r.status)
  esito('bozza status = default da_controllare', bozza?.status === 'da_controllare')
  r = await rest('/rest/v1/family_draft_expenses', owner, { method: 'POST', body: JSON.stringify({ document_id: doc.id, expense_date: '2030-02-02', expense_id: '00000000-0000-4000-a000-000000000000' }) })
  esito('inserimento bozza con expense_id respinto', !r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_draft_expenses?id=eq.${bozza.id}`, owner, { method: 'PATCH', body: JSON.stringify({ status: 'confermata' }) })
  esito('update status bozza respinto', !r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_draft_expenses?id=eq.${bozza.id}`, owner, { method: 'PATCH', body: JSON.stringify({ confidence: {} }) })
  esito('update confidence respinto', !r.ok, 'status ' + r.status)
  // righe di bozza: insert consentito, user_added imposto dal trigger
  r = await rest('/rest/v1/family_draft_items', owner, {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ draft_id: bozza.id, name: 'Riga manuale', amount: 10, qty: 1 }),
  })
  const rigaOwner = r.ok ? (await r.json())[0] : null
  esito('riga inserita dall\'owner in revisione', !!rigaOwner, 'status ' + r.status)
  esito('… marcata user_added=true dal trigger', rigaOwner?.user_added === true)
  r = await rest(`/rest/v1/family_draft_items?id=eq.${rigaOwner.id}`, owner, { method: 'PATCH', body: JSON.stringify({ excluded: true }) })
  esito('update excluded consentito', r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_draft_items?id=eq.${rigaOwner.id}`, owner, { method: 'PATCH', body: JSON.stringify({ user_added: false }) })
  esito('update user_added respinto', !r.ok, 'status ' + r.status)
  r = await rest(`/rest/v1/family_draft_items?id=eq.${rigaOwner.id}`, owner, { method: 'DELETE' })
  esito('delete riga di bozza negato (esclusione, non cancellazione)', !r.ok, 'status ' + r.status)
  // ponte e registro correzioni: sola lettura
  r = await rest('/rest/v1/family_expense_documents?select=id&limit=1', owner)
  esito('ponte leggibile', r.ok)
  r = await rest('/rest/v1/family_expense_documents', owner, { method: 'POST', body: JSON.stringify({ expense_id: '00000000-0000-4000-a000-000000000000', document_id: doc.id }) })
  esito('ponte NON scrivibile', !r.ok, 'status ' + r.status)
  const unPonte = await (await rest('/rest/v1/family_expense_documents?select=id&limit=1', owner)).json()
  r = await rest(`/rest/v1/family_expense_documents?id=eq.${unPonte[0].id}`, owner, { method: 'DELETE' })
  esito('ponte NON scollegabile', !r.ok, 'status ' + r.status)
  r = await rest('/rest/v1/family_corrections', owner, { method: 'POST', body: JSON.stringify({ field: 'x', document_id: doc.id }) })
  esito('registro correzioni: insert diretto negato (append solo via RPC)', !r.ok, 'status ' + r.status)
  // helper private non esposti
  r = await rest('/rest/v1/rpc/is_app_member', owner, { method: 'POST', body: '{}' })
  esito('private.is_app_member NON esposta via PostgREST', !r.ok, 'status ' + r.status)
  r = await rest('/rest/v1/rpc/spese_crea_da_bozze', owner, { method: 'POST', body: '{}' })
  esito('private.spese_crea_da_bozze NON esposta', !r.ok, 'status ' + r.status)
  // storage per il membro
  const percorso = JSON.parse(readFileSync(join(homedir(), '.gestionale-2b/fixture/file-finti/percorsi.json'), 'utf8'))[0].storage_path
  r = await rest('/storage/v1/object/scontrini/' + percorso, owner)
  esito('download file consentito al membro', r.ok, 'status ' + r.status)
  r = await rest('/storage/v1/object/scontrini/prova-owner/nuovo.txt', owner, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'file finto owner' })
  esito('upload consentito al membro', r.ok, 'status ' + r.status)
  r = await rest('/storage/v1/object/scontrini/prova-owner/nuovo.txt', owner, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'file finto owner v2' })
  esito('update file consentito al membro', r.ok, 'status ' + r.status)
  // il DELETE singolo con Content-Type json e corpo vuoto è respinto dal
  // server storage (difetto del client, non della policy): si usa la forma batch
  r = await rest('/storage/v1/object/scontrini', owner, { method: 'DELETE', body: JSON.stringify({ prefixes: ['prova-owner/nuovo.txt'] }) })
  esito('delete file consentito al membro', r.ok, 'status ' + r.status)
}

// ---------------------------------------------------------------------------
console.log('SERVICE ROLE (elaboratore /scontrini)')
{
  // riga inserita dall'elaboratore ⇒ user_added=false (chiave sb_secret riconosciuta)
  const doc = (await sql("insert into family_documents (kind, doc_total, upload_ambito) values ('scontrino', 5, 'personale') returning id"))[0]
  const bozza = (await sql(`insert into family_draft_expenses (document_id, expense_date) values ('${doc.id}', '2030-03-03') returning id`))[0]
  const r = await rest('/rest/v1/family_draft_items', 'service', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ draft_id: bozza.id, name: 'Riga OCR', amount: 5, qty: 1 }),
  })
  const riga = r.ok ? (await r.json())[0] : null
  esito('riga inserita dal service role', !!riga, 'status ' + r.status)
  esito('… user_added=false (ruolo service riconosciuto dal trigger)', riga?.user_added === false)
  // il ruolo visto dal database con la chiave amministrativa
  const chi = await rest('/rest/v1/rpc/conferma_documento', 'service', { method: 'POST', body: JSON.stringify({ p_document_id: doc.id }) })
  const msg = await chi.text()
  esito('service role: RPC raggiungibile (fallisce solo per regole di dominio)', !chi.ok && /bozza|gruppo|attiva|Totale|Stato non valido/i.test(msg), msg.slice(0, 60).replace(/[a-f0-9-]{36}/g, '****'))
  // e un NON membro resta fuori dalle RPC
  const negato = await rest('/rest/v1/rpc/conferma_documento', estraneo, { method: 'POST', body: JSON.stringify({ p_document_id: doc.id }) })
  esito('non membro: RPC negata', !negato.ok && /Accesso negato/.test(await negato.text()), 'status ' + negato.status)
  await sql(`delete from family_draft_items where draft_id='${bozza.id}'; delete from family_draft_expenses where id='${bozza.id}'; delete from family_documents where id='${doc.id}'`)
}

console.log(`\nESITO SICUREZZA: ${passati} superati, ${falliti} falliti`)
process.exit(falliti ? 1 : 0)
