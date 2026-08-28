#!/usr/bin/env node
// Sequenza 0020 → verifiche → bootstrap → 0021-senza-bucket (deve fallire)
// → bucket → 0021 → 0021-bis → 81 file finti. Stop al primo problema.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { sql, rest } from './api.mjs'

const leggi = f => readFileSync(f, 'utf8')
console.log('applico 0020…')
await sql(leggi('supabase/migrations/0020_rifacimento_spese_schema.sql'))
const c = (await sql(`select
  (select count(*) from family_documents) documenti,
  (select count(*) from family_documents where doc_total_derivato) derivati,
  (select count(*) from family_expense_documents where origine='backfill_0020') ponte_backfill,
  (select count(*) from family_expenses where receipt_id is null) senza_doc,
  (select count(*) from family_receipts where document_id is null) ricevute_senza_doc,
  (select count(*) from family_expenses) spese,
  (select count(*) from family_expense_items) righe`))[0]
console.log('dopo 0020:', JSON.stringify(c))
if (c.documenti !== 81 || c.ponte_backfill !== 215 || c.senza_doc !== 6 || c.ricevute_senza_doc !== 0 || c.spese !== 221 || c.righe !== 728)
  { console.error('VERIFICA 0020 FALLITA'); process.exit(1) }

console.log('bootstrap owner…')
await sql(leggi('supabase/bootstrap_owner.sql'))
const own = await sql("select count(*) n from app_members where role='owner'")
if (own[0].n !== 1) { console.error('owner non configurato'); process.exit(1) }
console.log('owner configurato: 1')

console.log('0021 SENZA bucket (attesa: fallisce)…')
let fallita = false
try { await sql(leggi('supabase/migrations/0021_protezione_family.sql')) }
catch (e) { fallita = /bucket scontrini NON ESISTE/.test(e.message); console.log('  ✓ fallita per la precondizione bucket') }
if (!fallita) { console.error('✗ doveva fallire senza bucket'); process.exit(1) }
const parziali = await sql("select count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('is_app_member','is_app_owner')")
if (parziali[0].n !== 0) { console.error('✗ modifiche parziali dopo il fallimento'); process.exit(1) }
console.log('  ✓ nessuna modifica parziale')

const b = await rest('/storage/v1/bucket', 'service', { method: 'POST', body: JSON.stringify({ id: 'scontrini', name: 'scontrini', public: false }) })
if (!b.ok) { console.error('bucket non creato:', b.status); process.exit(1) }
console.log('bucket privato creato')
console.log('applico 0021…')
await sql(leggi('supabase/migrations/0021_protezione_family.sql'))
console.log('riapplico 0021 (idempotenza)…')
await sql(leggi('supabase/migrations/0021_protezione_family.sql'))
const pol = await sql("select (select count(*) from pg_policies where schemaname='public' and tablename like 'family_%' and policyname like '%_solo_membri') nuove, (select count(*) from pg_policies where schemaname='public' and tablename like 'family_%' and policyname not like '%_solo_membri') vecchie")
console.log('policy:', JSON.stringify(pol[0]))
if (pol[0].nuove !== 16 || pol[0].vecchie !== 0) { console.error('✗ policy inattese'); process.exit(1) }

const percorsi = JSON.parse(readFileSync(join(homedir(), '.gestionale-2b/fixture/file-finti/percorsi.json'), 'utf8'))
let ok = 0
for (const p of percorsi) {
  const r = await rest('/storage/v1/object/scontrini/' + p.storage_path, 'service', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: readFileSync(join(homedir(), '.gestionale-2b/fixture/file-finti', p.file), 'utf8'),
  })
  if (r.ok) ok++
}
console.log('file finti caricati:', ok + '/81')
if (ok !== 81) process.exit(1)
console.log('SEQUENZA 0020→bootstrap→0021 COMPLETATA')
