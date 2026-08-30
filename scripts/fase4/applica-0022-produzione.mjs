#!/usr/bin/env node
// ============================================================================
// APPLICAZIONE DELLA 0022 IN PRODUZIONE — canale DEDICATO (token in
// ~/.gestionale-0022, mai le guardie del collaudo disabilitate: qui la
// produzione è il bersaglio ESPLICITO, autorizzato e verificato).
//  · applica SOLO il file approvato (identità SHA-256 richiesta), UNA
//    volta, in UN'UNICA transazione con statement/lock timeout limitati;
//  · VERIFICHE STRUTTURALI PRIMA DEL COMMIT (do-block che solleva
//    eccezione: qualunque fallimento = rollback totale);
//  · risposta del commit INCERTA → verifica dello stato in SOLA LETTURA,
//    MAI ritentativi alla cieca.
// Richiede: CONFERMA_APPLICAZIONE_0022=si
// ============================================================================
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

if (process.env.CONFERMA_APPLICAZIONE_0022 !== 'si') {
  console.error('STOP: manca CONFERMA_APPLICAZIONE_0022=si'); process.exit(1)
}
const SHA_APPROVATO = 'b4d9f86781bc9f61c588a145194fae1ddc3556a705b94024f58de80a4abf1d04'
const REPO = join(dirname(new URL(import.meta.url).pathname), '..', '..')
const testoSql = readFileSync(join(REPO, 'supabase/migrations/0022_caricamento_idempotente.sql'), 'utf8')
const shaFile = createHash('sha256').update(testoSql).digest('hex')
if (shaFile !== SHA_APPROVATO) {
  console.error('STOP: il file 0022 NON è quello approvato (sha diverso).'); process.exit(1)
}
console.log('identità del file confermata:', shaFile.slice(0, 12) + '…')

const env = Object.fromEntries(readFileSync(join(REPO, '.env.local'), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const REF = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1]
const TOKEN = readFileSync(join(homedir(), '.gestionale-0022', 'token.txt'), 'utf8').trim()

// bersaglio ESPLICITO, verificato via Management API
const progetti = await (await fetch('https://api.supabase.com/v1/projects', {
  headers: { Authorization: 'Bearer ' + TOKEN },
})).json()
const prod = Array.isArray(progetti) && progetti.find(p => p.id === REF)
if (!prod) { console.error('STOP: produzione non trovata col token.'); process.exit(1) }
if (prod.name === 'gestionale-bnb-spese-test-2b-20260828') { console.error('STOP: è il progetto di prova.'); process.exit(1) }
console.log(`bersaglio ESPLICITO: PRODUZIONE ${REF.slice(0, 4)}**** («${prod.name}», ${prod.status})`)

async function sqlProd(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`SQL fallito (${r.status}): ${testo.slice(0, 400)}`)
  try { return JSON.parse(testo) } catch { return [] }
}

// UN'UNICA transazione: timeout limitati → 0022 → VERIFICHE → commit
const batch = `begin;
set local statement_timeout = '120s';
set local lock_timeout = '10s';
${testoSql}
-- ============ VERIFICHE STRUTTURALI PRE-COMMIT (fallite = rollback) ========
do $$
declare c int;
begin
  select count(*) into c from information_schema.columns
    where table_schema='public' and table_name='family_documents'
    and column_name in ('upload_token','upload_manifest');
  if c <> 2 then raise exception 'PRE-COMMIT: colonne % (attese 2)', c; end if;
  if to_regprocedure('public.registra_documento_caricato(uuid,text,text,text,jsonb)') is null then
    raise exception 'PRE-COMMIT: RPC assente'; end if;
  select count(*) into c from pg_trigger where tgname='family_documents_manifesto_immutabile';
  if c <> 1 then raise exception 'PRE-COMMIT: trigger % (atteso 1)', c; end if;
  select count(*) into c from pg_indexes where indexname='family_documents_upload_token_uq';
  if c <> 1 then raise exception 'PRE-COMMIT: indice % (atteso 1)', c; end if;
  if has_function_privilege('anon','public.registra_documento_caricato(uuid,text,text,text,jsonb)','execute') then
    raise exception 'PRE-COMMIT: anon può eseguire la RPC'; end if;
  if has_function_privilege('service_role','public.registra_documento_caricato(uuid,text,text,text,jsonb)','execute') then
    raise exception 'PRE-COMMIT: service_role può eseguire la RPC'; end if;
  if not has_function_privilege('authenticated','public.registra_documento_caricato(uuid,text,text,text,jsonb)','execute') then
    raise exception 'PRE-COMMIT: authenticated NON può eseguire la RPC'; end if;
  select count(*) into c from public.family_documents
    where upload_token is not null or upload_manifest is not null;
  if c <> 0 then raise exception 'PRE-COMMIT: % documenti con token/manifest valorizzati (attesi 0)', c; end if;
  select count(*) into c from public.family_documents;
  if c <> 81 then raise exception 'PRE-COMMIT: % documenti (attesi 81)', c; end if;
end $$;
commit;
select 'APPLICATA' as esito, now() as quando`

let applicata = false
try {
  const r = await sqlProd(batch)
  const riga = Array.isArray(r) ? r[r.length - 1] ?? r[0] : null
  console.log('risposta del commit:', JSON.stringify(riga ?? r).slice(0, 120))
  applicata = true
} catch (e) {
  const msg = String(e.message)
  if (/fetch|network|timeout|timed out|abort|econn|socket/i.test(msg)) {
    // COMMIT INCERTO: si VERIFICA in sola lettura, niente ritentativi
    console.log('risposta INCERTA (', msg.slice(0, 80), ') → verifica dello stato in sola lettura…')
    const [z] = await sqlProd(`begin transaction read only;
select (select count(*) from information_schema.columns where table_schema='public' and table_name='family_documents' and column_name in ('upload_token','upload_manifest')) as colonne,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='registra_documento_caricato') as rpc;
rollback;`)
    if (z.colonne === 2 && z.rpc === 1) { console.log('lo stato dice: APPLICATA (il commit era passato)'); applicata = true }
    else { console.error('lo stato dice: NON applicata. STOP senza ritentare — decidere insieme.'); process.exit(2) }
  } else {
    console.error('APPLICAZIONE FALLITA (rollback automatico della transazione):', msg.slice(0, 300))
    process.exit(1)
  }
}
if (applicata) console.log('\n0022 APPLICATA IN PRODUZIONE (una transazione, verifiche pre-commit superate).')
