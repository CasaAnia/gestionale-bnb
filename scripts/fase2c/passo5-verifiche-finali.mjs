#!/usr/bin/env node
// ============================================================================
// 2C-B · PASSO 5 — verifiche finali di sicurezza (come 2B.1, ma in versione
// SOLA LETTURA da catalogo: in produzione NON si creano utenti né dati di
// prova). RLS, policy, bucket, ultimo owner, privilegi RPC, helper privati,
// trigger, ponte e correzioni protetti.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql, destinatarioVerificato } from './api2c.mjs'

let passati = 0, falliti = 0
const esito = (nome, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (ok) passati++; else falliti++
}

// --- policy: 16 nuove _solo_membri, zero vecchie ---
const pol = (await sql(`select
  (select count(*) from pg_policies where schemaname='public' and tablename like 'family_%' and policyname like '%_solo_membri') nuove,
  (select count(*) from pg_policies where schemaname='public' and tablename like 'family_%' and policyname not like '%_solo_membri') vecchie,
  (select count(*) from pg_policies where schemaname='public' and tablename='app_members') membri`))[0]
esito('16 policy nuove _solo_membri, 0 vecchie', pol.nuove === 16 && pol.vecchie === 0, JSON.stringify(pol))
esito('app_members ha le sue policy', pol.membri > 0, 'policy: ' + pol.membri)

// --- RLS attiva su tutte le tabelle family_* e app_members ---
const rls = await sql(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and (c.relname like 'family_%' or c.relname='app_members') and c.relkind='r' order by 1`)
esito('RLS attiva su tutte (' + rls.length + ' tabelle)', rls.length >= 12 && rls.every(t => t.relrowsecurity === true),
  rls.filter(t => !t.relrowsecurity).map(t => t.relname).join(',') || 'tutte ok')

// --- nessuna policy aperta ad anon; niente using(true) sulle family_ ---
const anonPol = (await sql(`select count(*) n from pg_policies where schemaname='public'
  and (tablename like 'family_%' or tablename='app_members') and 'anon' = any(roles)`))[0]
esito('nessuna policy per anon', anonPol.n === 0)
const aperte = (await sql(`select count(*) n from pg_policies where schemaname='public'
  and tablename like 'family_%' and qual = 'true'`))[0]
esito('nessuna policy using(true) sulle family_*', aperte.n === 0)

// --- bucket privato e policy storage per soli membri ---
const ref = await destinatarioVerificato()
const env = Object.fromEntries(readFileSync('/Users/amerigogranata/gestionale-bnb/.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const rb = await fetch(`https://${ref}.supabase.co/storage/v1/bucket/scontrini`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY },
})
const bucket = rb.ok ? await rb.json() : null
esito('bucket scontrini privato', !!bucket && bucket.public === false)
const stor = (await sql(`select count(*) n from pg_policies where schemaname='storage' and tablename='objects'
  and policyname like '%scontrini%membri%'`))[0]
esito('policy storage per soli membri presenti', stor.n >= 4, 'trovate: ' + stor.n)

// --- privilegi delle 5 RPC: service NO, authenticated SÌ, anon NO ---
const RPC5 = ['conferma_documento(uuid, jsonb)', 'approva_fattura_da_pagare(uuid, jsonb)',
  'paga_fattura(uuid, date, text, jsonb)', 'conferma_fattura_pagata(uuid, date, text, jsonb)',
  'scarta_documento(uuid, text)']
const priv = await sql(RPC5.map(f => `select '${f.split('(')[0]}' rpc,
  has_function_privilege('service_role', 'public.${f}', 'execute') servizio,
  has_function_privilege('authenticated', 'public.${f}', 'execute') autenticato,
  has_function_privilege('anon', 'public.${f}', 'execute') anonimo`).join(' union all '))
esito('5 RPC blindate (service NO · authenticated SÌ · anon NO)',
  priv.length === 5 && priv.every(x => x.servizio === false && x.autenticato === true && x.anonimo === false),
  priv.map(x => `${x.rpc}:${x.servizio ? 'SERVICE!' : x.anonimo ? 'ANON!' : !x.autenticato ? 'NOAUTH!' : 'ok'}`).join(' '))

// --- helper privati: come nei file approvati (0021 righe 45+73-74):
//     authenticated PUÒ eseguirli (servono alle policy RLS), anon e
//     service_role restano senza usage sullo schema private ---
const helper = await sql(`select p.proname,
  has_function_privilege('authenticated', p.oid, 'execute') aut
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('is_app_member','is_app_owner') order by 1`)
esito('helper private.is_app_member/is_app_owner presenti', helper.length === 2)
esito('… eseguibili da authenticated (richiesto dalle policy)', helper.every(h => h.aut === true))
const usoPrivate = (await sql(`select has_schema_privilege('anon','private','usage') anon,
  has_schema_privilege('service_role','private','usage') serv`))[0]
esito('… schema private senza usage per anon e service_role', usoPrivate.anon === false && usoPrivate.serv === false)
const esposte = (await sql(`select count(*) n from information_schema.routines
  where routine_schema='public' and routine_name in ('is_app_member','is_app_owner','spese_crea_da_bozze')`))[0]
esito('helper NON esposti nello schema public', esposte.n === 0)

// --- protezione ultimo owner e trigger sulle tabelle ---
const trg = await sql(`select t.tgname, c.relname from pg_trigger t
  join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
    and (c.relname like 'family_%' or c.relname='app_members') order by 2,1`)
// i 4 trigger definiti nei file approvati, tutti presenti e nessuno in più
const ATTESI = ['app_members_ultimo_owner', 'family_draft_items_marca_utente',
  'family_expenses_immutabili_documentate', 'family_expense_items_immutabili_documentate']
const nomi = trg.map(x => x.tgname).sort()
esito('i 4 trigger approvati, tutti presenti e nessun altro',
  JSON.stringify(nomi) === JSON.stringify([...ATTESI].sort()), nomi.join(','))

// --- ponte e registro correzioni: sola lettura per i membri, imposta a
//     livello di GRANT di tabella (insert/update/delete revocati),
//     come verificato con le prove reali della 2B.1 ---
const roGrant = await sql(`select t.tab,
  has_table_privilege('authenticated', t.tab, 'select') sel,
  has_table_privilege('authenticated', t.tab, 'insert') ins,
  has_table_privilege('authenticated', t.tab, 'update') upd,
  has_table_privilege('authenticated', t.tab, 'delete') del
  from (values ('family_expense_documents'),('family_corrections')) t(tab)`)
esito('ponte e correzioni: membri in sola lettura (grant di tabella)',
  roGrant.every(x => x.sel === true && x.ins === false && x.upd === false && x.del === false),
  roGrant.map(x => `${x.tab}:${x.ins || x.upd || x.del ? 'SCRIVIBILE!' : 'ok'}`).join(' '))

// --- colonne riservate: default di status e campi di sistema non insertabili ---
const grants = (await sql(`select count(*) n from information_schema.column_privileges
  where grantee='authenticated' and table_schema='public'
    and table_name in ('family_documents','family_draft_expenses','family_draft_items')
    and privilege_type='INSERT'
    and column_name in ('status','expense_id','confidence','user_added','confirmed_at')`))[0]
esito('colonne riservate NON insertabili dai membri', grants.n === 0, 'grant trovati: ' + grants.n)

console.log(`\nPASSO 5 ${falliti ? 'ROSSO' : '✓'} — ${passati} verifiche superate, ${falliti} fallite`)
process.exit(falliti ? 1 : 0)
