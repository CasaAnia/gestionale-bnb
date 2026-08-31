#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 5: TRANSIZIONE A/B (solo nel progetto di
// prova). Sequenza:
//  5.1 prova del ROLLBACK: fase A applicata → verificata → rollback dal
//      runbook → originali ripristinati (byte per byte dal backup);
//  5.2 RIPRODUZIONE DETERMINISTICA della chiamata sospesa PRIMA delle
//      tre tabelle: X blocca app_members, Y entra nella VECCHIA
//      conferma_documento e resta sospesa in is_app_member(); si
//      applica la fase A; la CONDIZIONE della fase B (età delle
//      transazioni + orizzonte xmin) DEVE contare Y → STOP; X rilascia,
//      Y conclude col corpo vecchio; la condizione poi passa;
//  5.3 fase B: barriera, revoche, ripuntamento involucri; verifiche
//      post-commit (doppia porta, private negati, 0022 intatto, RPC
//      del contratto ancora verdi).
// STOP alla prima verifica fallita. Da eseguire DUE volte come gli
// altri collaudi (il runner del piano lo prevede).
// ============================================================================
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { bozzaSql, comeMembro, contatore, fixtureDocumento, ownerId } from './ambiente.mjs'

verificaNonProduzione(progetto().ref)
const v = contatore('PASSO 5 · transizione A/B')
const UID = await ownerId()
const LEGACY = ['conferma_documento', 'scarta_documento', 'approva_fattura_da_pagare', 'paga_fattura', 'conferma_fattura_pagata']

async function sessione() {
  const p = progetto()
  const cli = new pg.Client({ host: `db.${p.ref}.supabase.co`, port: 5432, user: 'postgres', database: 'postgres', password: p.db_pass, ssl: { rejectUnauthorized: false } })
  await cli.connect(); return cli
}
const definizioni = async schema => Object.fromEntries((await sql(`
  select p.proname as nome, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='${schema}' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})`)).map(r => [r.nome, r.def]))

// ---- 5.1 fase A + ROLLBACK provato ----------------------------------------
const originali = await definizioni('public')
v.attesa('cinque funzioni legacy presenti in public', Object.keys(originali).length === 5)
await sql(bozzaSql('transizione-fase-A.BOZZA.sql'))
{
  const private_ = await definizioni('private')
  v.attesa('copie in private per tutti e cinque i nomi', Object.keys(private_).length === 5)
  // EQUIVALENZA verbatim: corpo identico salvo l'intestazione
  const uguali = LEGACY.every(n => private_[n] && originali[n]
    && private_[n].replace(`FUNCTION private.${n}`, `FUNCTION public.${n}`) === originali[n])
  v.attesa('spostamento VERBATIM (solo l\'intestazione cambia)', uguali)
  // respingenti: P0001 PERCORSO_DISMESSO per tutti e cinque, da membro
  for (const n of LEGACY) {
    const [firma] = await sql(`select pg_get_function_identity_arguments(p.oid) as f from pg_proc p
      join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='${n}'`)
    const argomenti = firma.f.split(',').filter(Boolean).map(() => 'null').join(',')
    let esito = ''
    try { await sql(`begin; ${comeMembro(UID)} select public.${n}(${argomenti}); rollback;`) }
    catch (e) { esito = String(e.message) }
    v.attesa(`respingente ${n} → PERCORSO_DISMESSO`, esito.includes('PERCORSO_DISMESSO'), esito.slice(0, 80))
    const [p] = await sql(`select has_function_privilege('authenticated','private.${n}(${firma.f})','execute') as e`)
    v.attesa(`private.${n} negata ad authenticated`, p.e === false)
  }
  // ROLLBACK dal runbook → originali ripristinati byte per byte
  await sql(`do $$ declare r record; begin
    for r in select nome, definizione from private.transizione_backup loop execute r.definizione; end loop; end $$;`)
  const ripristinate = await definizioni('public')
  v.attesa('rollback: i cinque corpi originali tornano identici', LEGACY.every(n => ripristinate[n] === originali[n]))
  await sql(`do $$ declare r record; begin
    for r in select p.proname as nome, pg_get_function_identity_arguments(p.oid) as f
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})
    loop execute format('drop function private.%I(%s)', r.nome, r.f); end loop; end $$;
    drop table private.transizione_backup;`)
}

// ---- 5.2 chiamata sospesa PRIMA delle tabelle + condizione della fase B ---
{
  const f = await fixtureDocumento(UID)
  const X = await sessione(), Y = await sessione()
  await X.query('begin; lock table public.app_members in access exclusive mode;')
  // Y entra nel corpo VECCHIO e resta sospesa dentro is_app_member()
  const chiamataY = Y.query(`begin; ${comeMembro(UID)} select public.conferma_documento('${f.docId}'::uuid,'[]'::jsonb) as r; commit;`)
  await new Promise(r => setTimeout(r, 1500))
  // fase A mentre Y è sospesa
  await sql(bozzaSql('transizione-fase-A.BOZZA.sql'))
  const [{ t: tA }] = await sql(`select now()::text as t`)
  // la CONDIZIONE deve CONTARE la transazione di Y (nessun lock sulle tre tabelle!)
  const [pregresse] = await sql(`select count(*)::int as n from pg_stat_activity
    where pid <> pg_backend_pid() and xact_start is not null and xact_start < '${tA}'::timestamptz`)
  v.attesa('condizione fase B: la chiamata sospesa in is_app_member VIENE CONTATA (STOP)', pregresse.n >= 1, `pregresse=${pregresse.n}`)
  // una chiamata legacy invocata ADESSO (post-fase-A) → respingente immediato, senza attese
  let respinta = ''
  try { await sql(`begin; ${comeMembro(UID)} select public.scarta_documento('${f.docId}'::uuid,'x'); rollback;`) }
  catch (e) { respinta = String(e.message) }
  v.attesa('invocazione post-fase-A → PERCORSO_DISMESSO immediato', respinta.includes('PERCORSO_DISMESSO'))
  // X rilascia: Y conclude col corpo VECCHIO
  await X.query('rollback;')
  const esitoY = await chiamataY.then(() => 'conclusa').catch(e => `errore: ${e.message}`)
  v.attesa('la chiamata pregressa CONCLUDE col corpo vecchio dopo il rilascio', esitoY === 'conclusa', esitoY)
  // ora la condizione passa
  await new Promise(r => setTimeout(r, 500))
  const [dopo] = await sql(`select count(*)::int as n from pg_stat_activity
    where pid <> pg_backend_pid() and xact_start is not null and xact_start < '${tA}'::timestamptz`)
  v.attesa('a chiamate concluse la condizione è soddisfatta', dopo.n === 0, `pregresse=${dopo.n}`)
  await X.end(); await Y.end()
}

// ---- 5.3 fase B: barriera, revoche, ripuntamento, verifiche ---------------
{
  // firme correnti dei cinque nomi (le revoche usano quelle vere)
  const firme = Object.fromEntries((await sql(`select p.proname as n, pg_get_function_identity_arguments(p.oid) as f
    from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})`)).map(r => [r.n, r.f]))
  await sql(`begin;
    set local lock_timeout='5s'; set local statement_timeout='30s';
    lock table public.family_documents, public.family_draft_expenses, public.family_draft_items in access exclusive mode;
    revoke update, insert on public.family_draft_expenses from authenticated;
    revoke update, insert on public.family_draft_items from authenticated;
    revoke update on public.family_documents from authenticated;
    ${LEGACY.map(n => `revoke execute on function public.${n}(${firme[n]}) from authenticated;`).join('\n')}
    commit;`)
  // ripuntamento degli involucri alle copie private: rigenerati dalla
  // bozza del contratto sostituendo SOLO la riga della chiamata
  const contratto = bozzaSql('contratto-revisione.BOZZA.sql')
  const daA = contratto.indexOf('create or replace function public.conferma_revisione')
  const finoA = contratto.indexOf('-- 7) PERMESSI')
  const involucri = contratto.slice(daA, finoA)
    .replaceAll('public.conferma_documento(', 'private.conferma_documento(')
    .replaceAll('public.scarta_documento(', 'private.scarta_documento(')
  await sql(involucri)
  // verifiche post-commit
  let negato = ''
  try { await sql(`begin; ${comeMembro(UID)} update public.family_draft_items set name='x' where false; rollback;`) }
  catch (e) { negato = String(e.message) }
  v.attesa('scritture dirette respinte per authenticated', /permission|denied|negat/i.test(negato), negato.slice(0, 80))
  const f = await fixtureDocumento(UID)
  const op = randomUUID()
  const r = await sql(`begin; ${comeMembro(UID)}
    select public.conferma_revisione('${op}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r; commit;`)
  const esito = r.find(x => x?.r)?.r
  v.attesa('conferma_revisione funziona via copia private (APPLICATA con spese)', esito?.esito === 'APPLICATA' && esito?.spese?.length > 0, JSON.stringify(esito))
  const [porta] = await sql(`select has_function_privilege('authenticated','public.conferma_documento(${firme.conferma_documento})','execute') as e`)
  v.attesa('doppia porta: execute legacy revocato (oltre al respingente)', porta.e === false)
}

await v.chiudi()
