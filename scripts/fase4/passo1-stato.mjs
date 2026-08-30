#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 1: fotografia in SOLA LETTURA dello stato
// del progetto di prova (schema e dati della 2B), senza azzerare nulla.
// Verifica anche che la 0022 NON sia già applicata.
// ============================================================================
import { sql, maschera, progetto } from '../fase2b/api.mjs'

console.log('Progetto bersaglio:', maschera(progetto().ref), '(guardia anti-produzione superata)')

const conta = async (t) => (await sql(`select count(*) as n from public.${t}`))[0].n
const righe = {}
for (const t of ['family_expenses', 'family_expense_items', 'family_receipts',
  'family_documents', 'family_expense_documents', 'family_draft_expenses',
  'app_members']) righe[t] = await conta(t)
console.log('Dati presenti (fixture 2B):', JSON.stringify(righe))

const policy = await sql(`select count(*) as n from pg_policies where schemaname='public' and policyname like '%_solo_membri'`)
console.log('Policy _solo_membri:', policy[0].n)

const colonne = await sql(`select column_name from information_schema.columns
  where table_schema='public' and table_name='family_documents'
  and column_name in ('upload_token','upload_manifest')`)
console.log('Colonne 0022 già presenti:', colonne.length ? colonne.map(c => c.column_name).join(', ') : 'NESSUNA (0022 mai applicata qui)')

const rpc = await sql(`select count(*) as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='registra_documento_caricato'`)
console.log('RPC registra_documento_caricato presente:', rpc[0].n > 0 ? 'SÌ' : 'no (attesa: no)')

const bucket = await sql(`select id, public from storage.buckets`)
console.log('Bucket:', JSON.stringify(bucket))
const oggetti = await sql(`select count(*) as n from storage.objects`)
console.log('Oggetti nello storage:', oggetti[0].n)
const owner = await sql(`select count(*) as n from public.app_members where role='owner'`)
console.log('Owner in app_members:', owner[0].n)
