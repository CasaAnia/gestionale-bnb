#!/usr/bin/env node
// ============================================================================
// PREFLIGHT 0022 in PRODUZIONE — tutto in SOLA LETTURA. Qualunque verifica
// fallita = exit 1 e non si prosegue.
//  1. rilettura COMPLETA della produzione (stessa via del backup: service
//     key da .env.local, SOLO GET/HEAD) e confronto col backup del giorno
//     ID per ID e CAMPO PER CAMPO;
//  2. riferimenti agli allegati: HEAD su ogni storage_path (81 attesi);
//  3. 0022 ancora ASSENTE (via token dedicato, transazione READ ONLY);
//  4. protezioni dell'audit INVARIATE (verificatore testato: policy 22/22,
//     RLS 18/18, RPC 5/5, grant delle tabelle ristrette).
// Uso: node scripts/fase4/preflight-0022-produzione.mjs "<cartella backup>"
// ============================================================================
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import {
  TAB_FAMILY, verificaPolicy, verificaRpc, verificaTabelleRls,
} from './verificaAudit.mjs'

const BACKUP = process.argv[2]
if (!BACKUP) { console.error('serve la cartella del backup'); process.exit(1) }
// DOPO_0022=si → modalità post-applicazione: le DUE nuove colonne dei
// documenti sono ammesse ma devono essere NULL su TUTTI i preesistenti;
// la presenza della 0022 è attesa (invece dell'assenza)
const DOPO = process.env.DOPO_0022 === 'si'
const COLONNE_0022 = ['upload_token', 'upload_manifest']

const REPO = join(dirname(new URL(import.meta.url).pathname), '..', '..')
const env = Object.fromEntries(readFileSync(join(REPO, '.env.local'), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const URL_PROD = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
const REF = URL_PROD.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1]
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const TOKEN = readFileSync(join(homedir(), '.gestionale-0022', 'token.txt'), 'utf8').trim()
console.log('bersaglio:', REF.slice(0, 4) + '****', '· PREFLIGHT in sola lettura')

async function fetchProd(percorso, metodo = 'GET') {
  if (metodo !== 'GET' && metodo !== 'HEAD') { console.error('GUARDIA: solo GET/HEAD'); process.exit(3) }
  const r = await fetch(URL_PROD + percorso, {
    method: metodo, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  })
  return r
}
async function sqlReadOnly(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `begin transaction read only;\n${query};\nrollback;` }),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`SQL fallito (${r.status}): ${testo.slice(0, 200)}`)
  try { return JSON.parse(testo) } catch { return [] }
}

let falliti = 0
const esito = (nome, ok, dettaglio = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nome}${dettaglio ? ' — ' + dettaglio : ''}`)
  if (!ok) falliti++
}

// ---- 1. confronto ID per ID e CAMPO per CAMPO col backup ----
const TABELLE = {
  family_groups: 'id', family_categories: 'id', family_subcategories: 'id',
  family_expenses: 'id', family_expense_items: 'id', family_receipts: 'id',
  family_budgets: 'id', family_product_rules: 'id',
  family_canonical_categories: 'id', family_canonical_subcategories: 'id',
  family_subcategory_map: 'id', family_documents: 'id',
  family_draft_expenses: 'id', family_draft_items: 'id',
  family_expense_documents: 'id', family_corrections: 'id',
  app_members: 'user_id', rooms: 'id',
}
async function tabella(nome, ordine) {
  const righe = []
  for (let da = 0; ; da += 1000) {
    const r = await fetchProd(`/rest/v1/${nome}?select=*&order=${ordine}`, 'GET')
    if (!r.ok) throw new Error(`${nome}: ${r.status}`)
    // Range via header non disponibile qui: uso offset/limit espliciti
    break
  }
  // rilettura con offset/limit per pagine oltre 1000
  for (let da = 0; ; da += 1000) {
    const r = await fetchProd(`/rest/v1/${nome}?select=*&order=${ordine}&offset=${da}&limit=1000`, 'GET')
    if (!r.ok) throw new Error(`${nome}: ${r.status}`)
    const blocco = await r.json()
    righe.splice(da, 0, ...blocco)
    if (blocco.length < 1000) break
  }
  return righe
}
for (const [t, ordine] of Object.entries(TABELLE)) {
  const backup = JSON.parse(readFileSync(join(BACKUP, 'tabelle', `${t}.json`), 'utf8'))
  const vivo = await tabella(t, ordine)
  if (vivo.length !== backup.length) { esito(`tabella ${t}`, false, `righe ${vivo.length} ≠ backup ${backup.length}`); continue }
  const chiave = TABELLE[t]
  const perId = new Map(vivo.map(r => [r[chiave], r]))
  let diff = null
  for (const rb of backup) {
    const rv = perId.get(rb[chiave])
    if (!rv) { diff = `${chiave}=${rb[chiave]} assente dal vivo`; break }
    for (const campo of new Set([...Object.keys(rb), ...Object.keys(rv)])) {
      if (DOPO && t === 'family_documents' && COLONNE_0022.includes(campo)) {
        // unica differenza AMMESSA: le colonne della 0022, e SOLO se NULL
        if (rv[campo] != null) { diff = `${chiave}=${rb[chiave]}: ${campo} NON nullo`; break }
        continue
      }
      if (JSON.stringify(rb[campo] ?? null) !== JSON.stringify(rv[campo] ?? null)) {
        diff = `${chiave}=${rb[chiave]} campo «${campo}» diverso`; break
      }
    }
    if (diff) break
  }
  esito(`tabella ${t}: ${backup.length} righe identiche campo per campo`, !diff, diff ?? '')
}

// ---- 2. riferimenti agli allegati: HEAD su ogni percorso ----
const manifest = JSON.parse(readFileSync(join(BACKUP, 'manifest.json'), 'utf8'))
let mancanti = 0
for (const f of manifest.file) {
  const r = await fetchProd('/storage/v1/object/scontrini/' + f.storage_path.split('/').map(encodeURIComponent).join('/'), 'HEAD')
  if (!r.ok) { mancanti++; console.error('  allegato NON raggiungibile:', f.storage_path, r.status) }
}
esito(`allegati: ${manifest.file.length} percorsi tutti raggiungibili (HEAD)`, mancanti === 0, mancanti ? `${mancanti} mancanti` : '')

// ---- 3. 0022 ancora ASSENTE ----
const [z] = await sqlReadOnly(`select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='family_documents' and column_name in ('upload_token','upload_manifest')) as colonne,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='registra_documento_caricato') as rpc,
  (select count(*) from pg_trigger where tgname='family_documents_manifesto_immutabile') as trg,
  (select count(*) from pg_indexes where indexname='family_documents_upload_token_uq') as idx`)
if (DOPO) esito('0022 PRESENTE (colonne=2, rpc=1, trigger=1, indice=1)', z.colonne === 2 && z.rpc === 1 && z.trg === 1 && z.idx === 1, JSON.stringify(z))
else esito('0022 ancora assente (colonne/rpc/trigger/indice = 0)', z.colonne === 0 && z.rpc === 0 && z.trg === 0 && z.idx === 0, JSON.stringify(z))

// ---- 4. protezioni dell'audit invariate ----
const pol = await sqlReadOnly(`select schemaname, tablename, policyname, roles::text as roles, cmd, permissive, coalesce(qual,'') as qual, coalesce(with_check,'') as with_check
  from pg_policies where (schemaname='public' and (tablename like 'family_%' or tablename='app_members')) or (schemaname='storage' and tablename='objects')`)
const vp = verificaPolicy(pol)
esito('policy 22/22 come da matrice 0021', vp.ok, vp.ok ? '' : vp.differenze.slice(0, 3).join(' · '))
const rls = await sqlReadOnly(`select n.nspname as schema, c.relname as tabella, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and ((n.nspname='public' and c.relname in (${[...TAB_FAMILY, 'app_members'].map(x => `'${x}'`).join(',')})) or (n.nspname='storage' and c.relname='objects'))`)
const vr = verificaTabelleRls(rls)
esito('RLS 18/18 per identità', vr.ok, vr.ok ? '' : vr.differenze.slice(0, 3).join(' · '))
const rpc = await sqlReadOnly(`select p.proname, pg_get_function_identity_arguments(p.oid) as firma,
    has_function_privilege('authenticated', p.oid, 'execute') as autenticato,
    has_function_privilege('anon', p.oid, 'execute') as anonimo,
    has_function_privilege('service_role', p.oid, 'execute') as service
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('conferma_documento','approva_fattura_da_pagare','paga_fattura','conferma_fattura_pagata','scarta_documento')`)
const vf = verificaRpc(rpc)
esito('RPC 5/5 a contratto', vf.ok, vf.ok ? '' : vf.differenze.slice(0, 3).join(' · '))
const g = await sqlReadOnly(`select count(*)::int as n from information_schema.table_privileges
  where table_schema='public' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')
  and table_name in ('family_documents','family_draft_expenses','family_draft_items','family_expense_documents','family_corrections')`)
esito('grant di tabella ristretti (0 scritture per authenticated)', g[0].n === 0, `trovate: ${g[0].n}`)

console.log(falliti === 0 ? '\nPREFLIGHT TUTTO VERDE: si può applicare.' : `\nPREFLIGHT FALLITO (${falliti}): STOP.`)
process.exit(falliti === 0 ? 0 : 1)
