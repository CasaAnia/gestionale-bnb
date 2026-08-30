#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 2: applica la 0022 al progetto di PROVA
// (guardia anti-produzione dentro api.mjs) e la RIESEGUE per provarne
// l'idempotenza. Nessun dato esistente viene toccato.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql, maschera, progetto } from '../fase2b/api.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const testo = readFileSync(join(REPO, 'supabase/migrations/0022_caricamento_idempotente.sql'), 'utf8')
console.log('Bersaglio:', maschera(progetto().ref))

for (const giro of ['applicazione', 'riesecuzione (idempotenza)']) {
  await sql(testo)
  const col = await sql(`select count(*) as n from information_schema.columns
    where table_schema='public' and table_name='family_documents'
    and column_name in ('upload_token','upload_manifest')`)
  const rpc = await sql(`select count(*) as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='registra_documento_caricato'`)
  const trg = await sql(`select count(*) as n from pg_trigger where tgname='family_documents_manifesto_immutabile'`)
  const idx = await sql(`select count(*) as n from pg_indexes where indexname='family_documents_upload_token_uq'`)
  console.log(`${giro}: colonne=${col[0].n}/2 rpc=${rpc[0].n} trigger=${trg[0].n} indice=${idx[0].n}`)
  if (col[0].n !== 2 || rpc[0].n !== 1 || trg[0].n !== 1 || idx[0].n !== 1) {
    console.error('VERIFICA FALLITA dopo', giro); process.exit(1)
  }
}
// i permessi effettivi della funzione (ruolo per ruolo)
const priv = await sql(`select r.rolname, has_function_privilege(r.rolname,
    'public.registra_documento_caricato(uuid,text,text,text,jsonb)','execute') as puo
  from pg_roles r where r.rolname in ('anon','authenticated','service_role')`)
console.log('privilegi execute:', JSON.stringify(priv))
const attesi = { anon: false, authenticated: true, service_role: false }
for (const p of priv) if (p.puo !== attesi[p.rolname]) { console.error('PRIVILEGI SBAGLIATI'); process.exit(1) }
console.log('Applicazione + riesecuzione OK; privilegi come da contratto (solo authenticated).')
