#!/usr/bin/env node
// ============================================================================
// AUDIT PERMESSI IN PRODUZIONE (Fase 4) — SOLA LETTURA di metadati.
// Strumento DEDICATO: non usa gli attrezzi del collaudo (fase2b/api.mjs
// vieta la produzione per contratto). Qui la produzione è il bersaglio
// ESPLICITO e VERIFICATO, e ogni batch gira in una transazione READ ONLY
// chiusa da rollback. Implementa audit-permessi-produzione.sql.
// Sicurezze:
//  · credenziali SOLO in ~/.gestionale-audit/token.txt (mai in chat/log/
//    repo/.env.local), eliminate a fine audit;
//  · serve CONFERMA_PRODUZIONE=sola-lettura nell'ambiente: niente
//    esecuzioni per sbaglio;
//  · nessuna scrittura: solo SELECT su cataloghi, dentro READ ONLY;
//  · qualsiasi differenza viene RIPORTATA, mai corretta;
//  · risultati incompleti (oggetti mancanti) NON valgono come superati.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { refProduzione, maschera } from '../fase2b/guardia.mjs'

if (process.env.CONFERMA_PRODUZIONE !== 'sola-lettura') {
  console.error('STOP: manca CONFERMA_PRODUZIONE=sola-lettura (guardia contro le esecuzioni accidentali).')
  process.exit(1)
}
const RAPPORTO = process.env.RAPPORTO_AUDIT
if (!RAPPORTO) { console.error('STOP: RAPPORTO_AUDIT mancante (file del rapporto, fuori dalle credenziali).'); process.exit(1) }

const DIR = join(homedir(), '.gestionale-audit')
let token
try { token = readFileSync(join(DIR, 'token.txt'), 'utf8').trim() } catch {
  console.error('ACCESSO ASSENTE: serve il token dedicato in ~/.gestionale-audit/token.txt — fermarsi e chiederlo.')
  process.exit(3)
}

// ---- bersaglio ESPLICITO: la produzione, verificata via Management API ----
const PROD = refProduzione()
const mgmt = async (percorso) => fetch('https://api.supabase.com/v1' + percorso, {
  headers: { Authorization: 'Bearer ' + token },
})
const progetti = await (await mgmt('/projects')).json()
if (!Array.isArray(progetti)) { console.error('Management API non raggiungibile (token non valido?)'); process.exit(1) }
const prod = progetti.find(p => p.id === PROD)
if (!prod) { console.error('STOP: il progetto di produzione non risulta tra quelli del token.'); process.exit(1) }
if (prod.name === 'gestionale-bnb-spese-test-2b-20260828') {
  console.error('STOP: il ref di produzione coincide col progetto di PROVA: configurazione incoerente.'); process.exit(1)
}
console.log(`Bersaglio ESPLICITO: PRODUZIONE ${maschera(PROD)} («${prod.name}», ${prod.status}) — SOLA LETTURA`)

// ogni batch: transazione READ ONLY chiusa da rollback (nessuna scrittura
// possibile nemmeno per errore)
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROD}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `begin transaction read only;\n${query};\nrollback;` }),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`SQL fallito (${r.status}): ${testo.slice(0, 300)}`)
  try { return JSON.parse(testo) } catch { return [] }
}

// ---- le sezioni dell'audit (attesi accanto agli osservati) ----------------
const righe = []
let problemi = 0
const scrivi = (t) => { console.log(t); righe.push(t) }
const sezione = (nome, ok, atteso, osservato) => {
  if (!ok) problemi++
  scrivi(`\n${ok ? '✓' : '✗'} ${nome}`)
  scrivi(`  atteso:    ${atteso}`)
  scrivi(`  osservato: ${osservato}`)
}
const TAB_RISTRETTE = ['family_documents', 'family_draft_expenses', 'family_draft_items', 'family_expense_documents', 'family_corrections']

scrivi(`AUDIT PERMESSI PRODUZIONE — ${new Date().toISOString()} — bersaglio ${maschera(PROD)} — transazioni READ ONLY`)
scrivi('Nessuna correzione automatica: solo osservazioni.')

// 1. grant di TABELLA
{
  const r = await sql(`select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privilegi
    from information_schema.table_privileges
    where table_schema='public'
      and table_name in ('family_documents','family_draft_expenses','family_draft_items','family_expense_documents','family_corrections','app_members')
      and grantee in ('authenticated','anon','service_role')
    group by table_name, grantee order by table_name, grantee`)
  const perTab = Object.fromEntries(r.map(x => [`${x.table_name}/${x.grantee}`, x.privilegi]))
  const scritture = ['INSERT', 'UPDATE', 'DELETE']
  const violazioni = []
  for (const t of TAB_RISTRETTE) {
    const p = (perTab[`${t}/authenticated`] ?? '').split(',')
    for (const s of scritture) if (p.includes(s)) violazioni.push(`${t}: authenticated ha ${s} di tabella`)
    if (perTab[`${t}/anon`]) violazioni.push(`${t}: anon ha privilegi (${perTab[`${t}/anon`]})`)
  }
  // completezza: il service_role deve comparire su TUTTE e 6 (default di
  // piattaforma): righe mancanti = risultato incompleto, NON superato
  const mancanoService = [...TAB_RISTRETTE, 'app_members'].filter(t => !perTab[`${t}/service_role`])
  sezione('1. grant di TABELLA sulle tabelle ristrette',
    violazioni.length === 0 && mancanoService.length === 0,
    'authenticated senza INSERT/UPDATE/DELETE di tabella; anon niente; service_role presente ovunque (completezza)',
    violazioni.length || mancanoService.length
      ? [...violazioni, ...mancanoService.map(t => `INCOMPLETO: manca la riga service_role di ${t}`)].join(' · ')
      : `nessuna violazione; ${r.length} righe lette`)
  // TRUNCATE/REFERENCES/TRIGGER residui: RIPORTATI A PARTE, non violazioni
  const residui = TAB_RISTRETTE
    .map(t => [t, (perTab[`${t}/authenticated`] ?? '').split(',').filter(x => ['TRUNCATE', 'REFERENCES', 'TRIGGER'].includes(x))])
    .filter(([, x]) => x.length)
  scrivi(`  residui TRUNCATE/REFERENCES/TRIGGER (default di creazione, NON revocati dalla 0021 — da discutere a parte, nessuna azione): ${residui.length ? residui.map(([t, x]) => `${t}:${x.join('+')}`).join(' · ') : 'nessuno'}`)
}

// 2. grant di COLONNA (update e insert) per authenticated
{
  const r = await sql(`select table_name, privilege_type, string_agg(column_name, ',' order by column_name) as colonne
    from information_schema.column_privileges
    where table_schema='public' and grantee='authenticated'
      and table_name in ('family_documents','family_draft_expenses','family_draft_items')
    group by table_name, privilege_type order by table_name, privilege_type`)
  const attesi = {
    'family_documents/UPDATE': 'doc_total,document_date,due_date,invoice_number,kind,note,supplier',
    'family_documents/INSERT': 'doc_total,document_date,due_date,invoice_number,kind,note,supplier,upload_ambito',
    'family_draft_expenses/UPDATE': 'arrotondamento_cent,canonical_category_id,canonical_subcategory_id,category_id,description,expense_date,expense_nature,group_id,payment_method,room_id,store,subcategory',
    'family_draft_expenses/INSERT': 'arrotondamento_cent,canonical_category_id,canonical_subcategory_id,category_id,description,document_id,expense_date,expense_nature,group_id,payment_method,room_id,store,subcategory',
    'family_draft_items/UPDATE': 'amount,canonical_category_id,canonical_subcategory_id,category_id,discount,excluded,group_id,name,necessity,planning,qty,subcategory,unit_price',
    'family_draft_items/INSERT': 'amount,canonical_category_id,canonical_subcategory_id,category_id,discount,draft_id,group_id,name,necessity,planning,qty,subcategory,unit_price',
  }
  const osservati = Object.fromEntries(r.map(x => [`${x.table_name}/${x.privilege_type}`, x.colonne]))
  const diff = []
  for (const [k, a] of Object.entries(attesi)) {
    if (!(k in osservati)) diff.push(`INCOMPLETO/ASSENTE: ${k}`)
    else if (osservati[k] !== a) diff.push(`${k}: osservato [${osservati[k]}]`)
  }
  for (const k of Object.keys(osservati)) if (!(k in attesi) && ['UPDATE', 'INSERT'].includes(k.split('/')[1])) diff.push(`inatteso: ${k} [${osservati[k]}]`)
  sezione('2. grant di COLONNA (authenticated)', diff.length === 0,
    'esattamente le colonne di revisione della 0021 (mai status/error_message/upload_*)',
    diff.length ? diff.join(' · ') : `tutte e 6 le liste combaciano ESATTAMENTE`)
}

// 3. RLS abilitata (SOLO tabelle: relkind='r')
{
  const r = await sql(`select n.nspname as schema, c.relname as tabella, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and ((n.nspname='public' and c.relname like 'family_%')
      or (n.nspname='public' and c.relname='app_members')
      or (n.nspname='storage' and c.relname='objects'))
    order by n.nspname, c.relname`)
  const spente = r.filter(x => !x.rls).map(x => `${x.schema}.${x.tabella}`)
  const ok = r.length >= 18 && spente.length === 0   // 16 family + app_members + storage.objects
  sezione('3. RLS abilitata (solo tabelle, relkind=r)', ok,
    'rowsecurity=true su 16 family_* + app_members + storage.objects (18 tabelle)',
    `${r.length} tabelle lette; spente: ${spente.length ? spente.join(', ') : 'nessuna'}`)
}

// 4. policy: condizioni effettive
{
  const r = await sql(`select schemaname, tablename, policyname, roles::text as ruoli, cmd, coalesce(qual,'') as qual, coalesce(with_check,'') as with_check
    from pg_policies
    where (schemaname='public' and (tablename like 'family_%' or tablename='app_members'))
       or (schemaname='storage' and tablename='objects')
    order by schemaname, tablename, policyname`)
  const nuove = r.filter(x => x.policyname.endsWith('_solo_membri'))
  const vecchie = r.filter(x => x.schemaname === 'public' && x.tablename.startsWith('family_') && !x.policyname.endsWith('_solo_membri'))
  const senzaGuardia = nuove.filter(x => !x.qual.includes('is_app_member') || !x.with_check.includes('is_app_member'))
  const storage = r.filter(x => x.schemaname === 'storage' && x.policyname.startsWith('scontrini_membri_'))
  const storageAltre = r.filter(x => x.schemaname === 'storage' && !x.policyname.startsWith('scontrini_membri_'))
  sezione('4. policy (ruoli e condizioni effettive)',
    nuove.length === 16 && vecchie.length === 0 && senzaGuardia.length === 0 && storage.length === 4,
    '16 *_solo_membri con is_app_member() in using E with check; 0 vecchie; 4 scontrini_membri_* sullo storage',
    `nuove=${nuove.length} vecchie=${vecchie.length} senzaGuardia=${senzaGuardia.length ? senzaGuardia.map(x => x.policyname).join(',') : 0} storage=${storage.length}${storageAltre.length ? ` · ALTRE policy storage da riportare: ${storageAltre.map(x => x.policyname).join(',')}` : ''}`)
}

// 5. privilegi delle 5 RPC
{
  const r = await sql(`select proname,
      has_function_privilege('authenticated', p.oid, 'execute') as autenticato,
      has_function_privilege('anon', p.oid, 'execute') as anonimo,
      has_function_privilege('service_role', p.oid, 'execute') as service
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('conferma_documento','approva_fattura_da_pagare','paga_fattura','conferma_fattura_pagata','scarta_documento')
    order by proname`)
  const sbagliate = r.filter(x => !(x.autenticato === true && x.anonimo === false && x.service === false))
  sezione('5. privilegi delle 5 RPC (contratto 2B.1)',
    r.length === 5 && sbagliate.length === 0,
    '5 funzioni; authenticated=true, anon=false, service_role=false su tutte',
    `${r.length}/5 lette${sbagliate.length ? ' · fuori contratto: ' + sbagliate.map(x => x.proname).join(',') : ' · tutte a contratto'}`)
}

// 6. assenza della 0022
{
  const [r] = await sql(`select
    (select count(*) from information_schema.columns where table_schema='public' and table_name='family_documents' and column_name in ('upload_token','upload_manifest')) as colonne,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='registra_documento_caricato') as rpc,
    (select count(*) from pg_trigger where tgname='family_documents_manifesto_immutabile') as trg,
    (select count(*) from pg_indexes where indexname='family_documents_upload_token_uq') as indice`)
  sezione('6. assenza della 0022 in produzione',
    r.colonne === 0 && r.rpc === 0 && r.trg === 0 && r.indice === 0,
    'colonne=0, rpc=0, trigger=0, indice=0 (0022 MAI applicata qui)',
    JSON.stringify(r))
}

scrivi(`\nESITO: ${problemi === 0 ? 'NESSUNA DIFFERENZA — produzione conforme agli attesi della 0021/2B.1' : problemi + ' SEZIONI CON DIFFERENZE — da discutere, NESSUNA correzione eseguita'}`)
writeFileSync(RAPPORTO, righe.join('\n') + '\n')
console.log('\nrapporto salvato (senza segreti):', RAPPORTO)
process.exit(problemi === 0 ? 0 : 2)
