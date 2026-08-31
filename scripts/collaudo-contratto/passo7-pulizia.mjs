#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 7: PULIZIA del progetto di prova, guidata e
// verificata (mai cieca). Rimuove SOLO ciò che questo collaudo ha
// creato: oggetti del contratto, resti della transizione, fixture dei
// passi (documenti «Voce collaudo …»). Alla fine il progetto torna alla
// base 0020–0022 e lo si VERIFICA. In caso di interruzione a metà: si
// rilancia questo passo (idempotente), oppure si azzera e si riapplica
// la sequenza 2B (scripts/fase2b/esegui-sequenza.mjs) — mai lasciare lo
// stato a metà senza dichiararlo.
// ============================================================================
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { contatore } from './ambiente.mjs'

verificaNonProduzione(progetto().ref)
const v = contatore('PASSO 7 · pulizia verificata')
const LEGACY = ['conferma_documento', 'scarta_documento', 'approva_fattura_da_pagare', 'paga_fattura', 'conferma_fattura_pagata']

// 1) se la transizione è applicata: rollback dal backup (originali in
//    public), poi via copie private e backup
const [backup] = await sql(`select count(*)::int as n from information_schema.tables
  where table_schema='private' and table_name='transizione_backup'`)
if (backup.n === 1) {
  await sql(`do $$ declare r record; begin
    for r in select nome, definizione from private.transizione_backup loop execute r.definizione; end loop; end $$;`)
  await sql(`do $$ declare r record; begin
    for r in select p.proname as nome, pg_get_function_identity_arguments(p.oid) as f
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})
    loop execute format('drop function private.%I(%s)', r.nome, r.f); end loop; end $$;
    drop table private.transizione_backup;`)
  // ri-grant di ciò che la fase B aveva revocato (base 0021)
  await sql(`grant update (expense_date, group_id, category_id, subcategory, canonical_category_id,
      canonical_subcategory_id, store, description, payment_method, room_id, expense_nature, arrotondamento_cent)
    on public.family_draft_expenses to authenticated;
    grant insert (document_id, expense_date, group_id, category_id, subcategory, canonical_category_id,
      canonical_subcategory_id, store, description, payment_method, room_id, expense_nature, arrotondamento_cent)
    on public.family_draft_expenses to authenticated;
    grant update (name, qty, unit_price, discount, amount, group_id, category_id, subcategory,
      canonical_category_id, canonical_subcategory_id, necessity, planning, excluded)
    on public.family_draft_items to authenticated;
    grant insert (draft_id, name, qty, unit_price, discount, amount, group_id, category_id, subcategory,
      canonical_category_id, canonical_subcategory_id, necessity, planning)
    on public.family_draft_items to authenticated;
    grant update (kind, doc_total, supplier, invoice_number, document_date, due_date, note)
    on public.family_documents to authenticated;`)
  for (const n of LEGACY) {
    await sql(`do $$ declare f text; begin
      select pg_get_function_identity_arguments(p.oid) into f from pg_proc p
        join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='${n}';
      execute format('grant execute on function public.${n}(%s) to authenticated', f); end $$;`)
  }
  console.log('transizione smontata: originali ripristinati, grant 0021 rimessi')
}

// 2) fixture dei passi (documenti creati dal collaudo, con le loro
//    bozze/righe/spese/giornale a cascata dove serve)
await sql(`delete from public.family_revision_ops where document_id in
  (select id from public.family_documents where id in
    (select document_id from public.family_draft_expenses where id in
      (select draft_id from public.family_draft_items where name like 'Voce collaudo %' or name in ('Sacchetto','Voce','V','W'))))
  or op_key = '00000000-0000-0000-0000-00000000c0l1'`)
await sql(`delete from public.family_expense_documents where document_id in
  (select document_id from public.family_draft_expenses where id in
    (select draft_id from public.family_draft_items where name like 'Voce collaudo %'))`)
await sql(`delete from public.family_documents where id in
  (select document_id from public.family_draft_expenses where id in
    (select draft_id from public.family_draft_items where name like 'Voce collaudo %'))`)

// 3) oggetti del contratto
await sql(`drop function if exists public.salva_revisione(uuid, uuid, bigint, jsonb);
  drop function if exists public.esito_revisione(uuid);
  drop function if exists public.conferma_revisione(uuid, uuid, bigint, jsonb);
  drop function if exists public.scarta_revisione(uuid, uuid, bigint, text);
  drop function if exists private.impronta_canonica(jsonb);
  drop function if exists private.canonico(jsonb);
  drop table if exists public.family_revision_ops;
  alter table public.family_documents drop column if exists revisione_rev;`)

// 4) VERIFICA finale: base pulita
const [residui] = await sql(`select
  (select count(*)::int from information_schema.tables where table_name='family_revision_ops') as giornale,
  (select count(*)::int from information_schema.columns where table_name='family_documents' and column_name='revisione_rev') as rev,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like '%_revisione') as funzioni,
  (select count(*)::int from public.family_draft_items where name like 'Voce collaudo %') as fixture`)
v.attesa('nessun residuo del contratto', residui.giornale === 0 && residui.rev === 0 && residui.funzioni === 0)
v.attesa('nessuna fixture residua', residui.fixture === 0, JSON.stringify(residui))
const [legacy] = await sql(`select count(*)::int as n from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace
  where n2.nspname='public' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})`)
v.attesa('le cinque funzioni legacy sono al loro posto', legacy.n === 5)

await v.chiudi()
