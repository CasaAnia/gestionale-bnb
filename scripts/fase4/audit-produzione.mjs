#!/usr/bin/env node
// ============================================================================
// AUDIT PERMESSI IN PRODUZIONE (Fase 4, revisionato) — SOLA LETTURA di
// metadati. Strumento DEDICATO (niente attrezzi del collaudo, che vietano
// la produzione). Ogni batch in transazione READ ONLY chiusa da rollback.
// Il giudizio è del VERIFICATORE TESTATO (verificaAudit.mjs): matrici
// esplicite per identità, ruoli, comandi e condizioni — mai sottostringhe
// né conteggi. Il rapporto conserva le EVIDENZE GREZZE complete di ogni
// query (senza segreti): atteso, osservato e righe lette, revisionabili.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { refProduzione, maschera } from '../fase2b/guardia.mjs'
import {
  COLONNE_CONSENTITE, COLONNE_RISERVATE_MINIME, TAB_FAMILY,
  verificaColonneEffettive, verificaEffettiviTabella, verificaPolicy,
  verificaRpc, verificaTabelleRls,
} from './verificaAudit.mjs'

if (process.env.CONFERMA_PRODUZIONE !== 'sola-lettura') {
  console.error('STOP: manca CONFERMA_PRODUZIONE=sola-lettura (guardia contro le esecuzioni accidentali).')
  process.exit(1)
}
const RAPPORTO = process.env.RAPPORTO_AUDIT
if (!RAPPORTO) { console.error('STOP: RAPPORTO_AUDIT mancante.'); process.exit(1) }

const DIR = join(homedir(), '.gestionale-audit')
let token
try { token = readFileSync(join(DIR, 'token.txt'), 'utf8').trim() } catch {
  console.error('ACCESSO ASSENTE: serve il token dedicato in ~/.gestionale-audit/token.txt — fermarsi e chiederlo.')
  process.exit(3)
}

// ---- bersaglio ESPLICITO: la produzione, verificata via Management API ----
const PROD = refProduzione()
const progetti = await (await fetch('https://api.supabase.com/v1/projects', {
  headers: { Authorization: 'Bearer ' + token },
})).json()
if (!Array.isArray(progetti)) { console.error('Management API non raggiungibile (token non valido?)'); process.exit(1) }
const prod = progetti.find(p => p.id === PROD)
if (!prod) { console.error('STOP: il progetto di produzione non risulta tra quelli del token.'); process.exit(1) }
if (prod.name === 'gestionale-bnb-spese-test-2b-20260828') {
  console.error('STOP: il ref di produzione coincide col progetto di PROVA.'); process.exit(1)
}
console.log(`Bersaglio ESPLICITO: PRODUZIONE ${maschera(PROD)} («${prod.name}», ${prod.status}) — SOLA LETTURA`)

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

// ---- raccolta con EVIDENZE: ogni sezione conserva query e righe grezze ----
const evidenze = { quando: new Date().toISOString(), bersaglio: maschera(PROD), sezioni: [] }
let problemi = 0
function sezione(nome, query, righe, atteso, esitoOk, osservato) {
  if (!esitoOk) problemi++
  evidenze.sezioni.push({ nome, ok: esitoOk, atteso, osservato, query, righe_lette: righe })
  console.log(`\n${esitoOk ? '✓' : '✗'} ${nome}`)
  console.log(`  atteso:    ${atteso}`)
  console.log(`  osservato: ${osservato}`)
}
const TAB_RISTRETTE = ['family_documents', 'family_draft_expenses', 'family_draft_items', 'family_expense_documents', 'family_corrections']
const lista = (v) => v.map(x => `'${x}'`).join(',')

// 1. grant di TABELLA (espliciti, information_schema — PUBLIC incluso)
{
  const q = `select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privilegi
    from information_schema.table_privileges
    where table_schema='public' and table_name in (${lista([...TAB_RISTRETTE, 'app_members'])})
      and grantee in ('authenticated','anon','service_role','PUBLIC')
    group by table_name, grantee order by table_name, grantee`
  const r = await sql(q)
  const perTab = Object.fromEntries(r.map(x => [`${x.table_name}/${x.grantee}`, x.privilegi]))
  const violazioni = []
  for (const t of TAB_RISTRETTE) {
    const p = (perTab[`${t}/authenticated`] ?? '').split(',')
    for (const s of ['INSERT', 'UPDATE', 'DELETE']) if (p.includes(s)) violazioni.push(`${t}: authenticated ha ${s} di tabella`)
    if (perTab[`${t}/anon`]) violazioni.push(`${t}: anon ha privilegi (${perTab[`${t}/anon`]})`)
    if (perTab[`${t}/PUBLIC`]) violazioni.push(`${t}: PUBLIC ha privilegi (${perTab[`${t}/PUBLIC`]})`)
  }
  const mancanoService = [...TAB_RISTRETTE, 'app_members'].filter(t => !perTab[`${t}/service_role`])
  sezione('1. grant di TABELLA espliciti (con PUBLIC)', q, r,
    'authenticated senza INSERT/UPDATE/DELETE sulle 5 ristrette; anon e PUBLIC a zero; service_role presente su tutte e 6 (completezza)',
    violazioni.length === 0 && mancanoService.length === 0,
    violazioni.length || mancanoService.length
      ? [...violazioni, ...mancanoService.map(t => `INCOMPLETO: manca service_role su ${t}`)].join(' · ')
      : `${r.length} righe lette, nessuna violazione`)
  const residui = TAB_RISTRETTE
    .map(t => [t, (perTab[`${t}/authenticated`] ?? '').split(',').filter(x => ['TRUNCATE', 'REFERENCES', 'TRIGGER'].includes(x))])
    .filter(([, x]) => x.length)
  console.log(`  residui TRUNCATE/REFERENCES/TRIGGER (default di creazione, non revocati dalla 0021 — riportati a parte, nessuna azione): ${residui.length ? residui.map(([t, x]) => `${t}:${x.join('+')}`).join(' · ') : 'nessuno'}`)
  evidenze.sezioni.at(-1).residui_default = residui
}

// 1-bis. privilegi EFFETTIVI (has_table_privilege: ereditarietà e PUBLIC
// inclusi — distinti dagli espliciti della sezione 1)
{
  const casi = TAB_RISTRETTE.flatMap(t => ['INSERT', 'UPDATE', 'DELETE'].flatMap(p =>
    ['authenticated', 'anon'].map(ruolo => ({ t, p, ruolo }))))
  const q = `select x.tabella, x.privilegio, x.ruolo,
      has_table_privilege(x.ruolo, ('public.' || x.tabella)::regclass, x.privilegio) as effettivo
    from (values ${casi.map(c => `('${c.t}','${c.p}','${c.ruolo}')`).join(',')}) as x(tabella, privilegio, ruolo)`
  const r = await sql(q)
  // il giudizio è del verificatore TESTATO: booleani ESPLICITI obbligatori
  // (30 «effettivo=null» NON sono «tutti negati») e completezza per identità
  const v = verificaEffettiviTabella(r, casi.map(c => ({ tabella: c.t, privilegio: c.p, ruolo: c.ruolo })))
  sezione('1-bis. privilegi EFFETTIVI di scrittura di TABELLA (ereditarietà e PUBLIC compresi)', q, r,
    'has_table_privilege = false ESPLICITO per authenticated e anon su INSERT/UPDATE/DELETE delle 5 tabelle ristrette (30 casi, tutti presenti)',
    v.ok, v.ok ? `${r.length}/30 casi, tutti esplicitamente negati` : v.differenze.join(' · '))
}

// 1-ter. privilegi EFFETTIVI di COLONNA (has_column_privilege: un
// UPDATE(status) concesso a PUBLIC o ereditato NON sfugge più) + evidenza
// delle ACL di colonna
{
  const q = `select c.table_name as tabella, c.column_name as colonna, r.ruolo, p.priv as privilegio,
      has_column_privilege(r.ruolo, ('public.' || c.table_name)::regclass, c.column_name, p.priv) as effettivo
    from information_schema.columns c
    cross join (values ('authenticated'),('anon')) as r(ruolo)
    cross join (values ('INSERT'),('UPDATE')) as p(priv)
    where c.table_schema='public' and c.table_name in (${lista(TAB_RISTRETTE)})
    order by c.table_name, c.column_name, r.ruolo, p.priv`
  const r = await sql(q)
  const v = verificaColonneEffettive(r)
  sezione('1-ter. privilegi EFFETTIVI di COLONNA contro le autorizzazioni della 0021', q, r,
    'colonne CONSENTITE dalla 0021 presenti e vere per authenticated; riservate negate; anon senza scritture su nessuna colonna; booleani espliciti e completezza per identità',
    v.ok, v.ok ? `${r.length} casi letti, tutti conformi alla 0021` : v.differenze.join(' · '))
  evidenze.sezioni.at(-1).matrice_0021 = { consentite: COLONNE_CONSENTITE, riservate_minime: COLONNE_RISERVATE_MINIME }
  // evidenza: ACL di COLONNA grezze con grantor (riportate senza giudizio)
  const qAcl = `select c.relname as tabella, a.attname as colonna,
      x.grantor::regrole::text as grantor, x.grantee::regrole::text as grantee, x.privilege_type
    from pg_attribute a join pg_class c on c.oid = a.attrelid, aclexplode(a.attacl) x
    where c.relkind='r' and c.relname in (${lista(TAB_RISTRETTE)}) and a.attnum > 0 and a.attacl is not null
    order by c.relname, a.attname, x.grantee::regrole::text, x.privilege_type`
  const rAcl = await sql(qAcl)
  sezione('1-quater. ACL di COLONNA grezze con grantor (evidenza, senza giudizio automatico)', qAcl, rAcl,
    'evidenza completa per la revisione umana (il giudizio è in 1-ter e 2)',
    true, `${rAcl.length} voci ACL di colonna conservate nel rapporto`)
}

// 2. grant di COLONNA (authenticated)
{
  const q = `select table_name, privilege_type, string_agg(column_name, ',' order by column_name) as colonne
    from information_schema.column_privileges
    where table_schema='public' and grantee='authenticated'
      and table_name in ('family_documents','family_draft_expenses','family_draft_items')
    group by table_name, privilege_type order by table_name, privilege_type`
  const r = await sql(q)
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
  sezione('2. grant di COLONNA (authenticated)', q, r,
    'esattamente le 6 liste della 0021 (mai status/error_message/upload_*)',
    diff.length === 0, diff.length ? diff.join(' · ') : 'tutte e 6 le liste combaciano ESATTAMENTE')
}

// 3. ACL grezze con GRANTOR (come da file SQL): evidenza per distinguere i
// default di creazione dai grant espliciti — riportate, non giudicate
{
  const q = `select c.relname, a.grantor::regrole::text as grantor,
      a.grantee::regrole::text as grantee, a.privilege_type
    from pg_class c, aclexplode(c.relacl) a
    where c.relkind='r' and c.relname in (${lista(TAB_RISTRETTE)})
      and a.grantee::regrole::text in ('authenticated','anon','-')
    order by c.relname, a.grantee::regrole::text, a.privilege_type`
  const r = await sql(q)
  sezione('3. ACL grezze con grantor (evidenza, riportata senza giudizio automatico)', q, r,
    'evidenza completa per la revisione umana (il giudizio sui grant è nelle sezioni 1 e 1-bis)',
    true, `${r.length} voci ACL conservate nel rapporto`)
}

// 4. RLS per IDENTITÀ qualificata (solo tabelle, relkind='r')
{
  const q = `select n.nspname as schema, c.relname as tabella, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and ((n.nspname='public' and c.relname in (${lista([...TAB_FAMILY, 'app_members'])}))
      or (n.nspname='storage' and c.relname='objects'))
    order by n.nspname, c.relname`
  const r = await sql(q)
  const v = verificaTabelleRls(r)
  sezione('4. RLS abilitata sulle 18 tabelle attese (per NOME qualificato)', q, r,
    `le ${v.attese} tabelle attese, tutte presenti per identità e con RLS attiva (mancanti o sostituite = fallito)`,
    v.ok, v.ok ? `${r.length} tabelle, identità e RLS a posto` : v.differenze.join(' · '))
}

// 5. POLICY: matrice completa (identità, ruoli, cmd, modalità, condizioni)
{
  const q = `select schemaname, tablename, policyname, roles::text as roles, cmd,
      permissive, coalesce(qual,'') as qual, coalesce(with_check,'') as with_check
    from pg_policies
    where (schemaname='public' and (tablename in (${lista(TAB_FAMILY)}) or tablename='app_members'))
       or (schemaname='storage' and tablename='objects')
    order by schemaname, tablename, policyname`
  const r = await sql(q)
  const v = verificaPolicy(r)
  sezione('5. policy: matrice 0021 completa (22 attese: 16 family + 2 app_members + 4 storage col vincolo sul bucket)', q, r,
    `${v.attese} policy con ruoli/cmd/modalità/USING/WITH CHECK esatti; nessuna aggiuntiva non analizzata`,
    v.ok, v.ok ? `${r.length} policy lette, matrice combaciante` : v.differenze.join(' · '))
}

// 6. le 5 RPC per nome e FIRMA (overload inclusi)
{
  const q = `select p.proname, pg_get_function_identity_arguments(p.oid) as firma,
      has_function_privilege('authenticated', p.oid, 'execute') as autenticato,
      has_function_privilege('anon', p.oid, 'execute') as anonimo,
      has_function_privilege('service_role', p.oid, 'execute') as service
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (${lista(Object.keys({ conferma_documento: 1, approva_fattura_da_pagare: 1, paga_fattura: 1, conferma_fattura_pagata: 1, scarta_documento: 1 }))})
    order by p.proname`
  const r = await sql(q)
  const v = verificaRpc(r)
  sezione('6. le 5 RPC per nome e firma esatta (un solo overload; privilegi a contratto)', q, r,
    'firme esatte della 0020; authenticated=true, anon=false, service_role=false; niente overload o sostituti',
    v.ok, v.ok ? '5/5 a contratto' : v.differenze.join(' · '))
}

// 7. assenza della 0022
{
  const q = `select
    (select count(*) from information_schema.columns where table_schema='public' and table_name='family_documents' and column_name in ('upload_token','upload_manifest')) as colonne,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='registra_documento_caricato') as rpc,
    (select count(*) from pg_trigger where tgname='family_documents_manifesto_immutabile') as trg,
    (select count(*) from pg_indexes where indexname='family_documents_upload_token_uq') as indice`
  const r = await sql(q)
  const x = r[0] ?? {}
  sezione('7. assenza della 0022 in produzione', q, r,
    'colonne=0, rpc=0, trigger=0, indice=0',
    x.colonne === 0 && x.rpc === 0 && x.trg === 0 && x.indice === 0, JSON.stringify(x))
}

const conclusione = problemi === 0
  ? 'NESSUNA DIFFERENZA nelle sezioni verificate dal codice (evidenze grezze conservate nel rapporto)'
  : `${problemi} SEZIONI CON DIFFERENZE — riportate, NESSUNA correzione eseguita`
console.log(`\nESITO: ${conclusione}`)
evidenze.conclusione = conclusione
writeFileSync(RAPPORTO, JSON.stringify(evidenze, null, 2))
console.log('rapporto con evidenze grezze salvato (senza segreti):', RAPPORTO)
process.exit(problemi === 0 ? 0 : 2)
