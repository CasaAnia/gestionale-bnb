-- ============================================================================
-- 0021 — PROTEZIONE FAMILY: funzioni di sicurezza e nuove policy
-- (Fase 2A: solo scritta. Si applica in 2B/2C, SEMPRE dopo bootstrap_owner.sql)
--
-- ⚠️  NON ANCORA DA APPLICARE. Precondizione DURA: almeno un owner in
--     app_members — altrimenti questo script si ferma subito (anti-lockout:
--     sostituire le policy senza un owner chiuderebbe fuori il gestionale).
--
-- Sostituisce le vecchie policy "accesso_utenti_autenticati" (authenticated
-- using (true)) su TUTTE le tabelle family_* — storiche e nuove — e sul
-- bucket privato 'scontrini' in storage.objects: un account autenticato ma
-- NON in app_members non legge, non carica, non modifica e non elimina
-- né dati né foto. La modalità dimostrazione resta solo interfaccia.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. PRECONDIZIONE: owner presente (bootstrap già fatto)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from app_members where role = 'owner') then
    raise exception 'PRECONDIZIONE FALLITA: nessun owner in app_members. Eseguire prima supabase/bootstrap_owner.sql.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. FUNZIONI DI SICUREZZA — niente sottoquery ricorsive nelle policy
-- ---------------------------------------------------------------------------
-- security definer: leggono app_members scavalcandone la RLS, così le
-- policy di app_members possono usarle senza ricorsione.
-- stable: una sola valutazione per riga/istruzione. search_path bloccato.
create or replace function is_app_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from app_members where user_id = auth.uid());
$$;

create or replace function is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from app_members where user_id = auth.uid() and role = 'owner');
$$;

-- permessi minimi: niente accesso anonimo, solo utenti autenticati
revoke execute on function is_app_member() from public, anon;
revoke execute on function is_app_owner() from public, anon;
grant execute on function is_app_member() to authenticated;
grant execute on function is_app_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. APP_MEMBERS: i membri si vedono; solo un owner aggiunge/toglie/modifica
-- ---------------------------------------------------------------------------
drop policy if exists app_members_lettura_membri on app_members;
create policy app_members_lettura_membri on app_members
  for select to authenticated using (is_app_member());

drop policy if exists app_members_gestione_owner on app_members;
create policy app_members_gestione_owner on app_members
  for all to authenticated using (is_app_owner()) with check (is_app_owner());

-- ---------------------------------------------------------------------------
-- 3. TABELLE FAMILY_* (storiche e nuove): via le vecchie policy, dentro
--    is_app_member(). Idempotente: drop if exists + create.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    -- storiche
    'family_groups', 'family_categories', 'family_subcategories',
    'family_expenses', 'family_expense_items', 'family_receipts',
    'family_budgets', 'family_product_rules',
    -- nuove (0020)
    'family_canonical_categories', 'family_canonical_subcategories',
    'family_subcategory_map', 'family_documents', 'family_draft_expenses',
    'family_draft_items', 'family_expense_documents', 'family_corrections'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'PRECONDIZIONE FALLITA: tabella % assente — applicare prima la 0020.', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    -- vecchia policy permissiva (authenticated using (true)): via
    execute format('drop policy if exists "accesso_utenti_autenticati" on public.%I', t);
    execute format('drop policy if exists %I on public.%I', t || '_solo_membri', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (is_app_member()) with check (is_app_member())',
      t || '_solo_membri', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. BUCKET PRIVATO 'scontrini' in storage.objects
-- ---------------------------------------------------------------------------
-- Via ogni policy esistente che riguarda il bucket scontrini (i nomi non
-- sono prevedibili: si individuano dal contenuto), poi policy per membri.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%scontrini%' or coalesce(with_check, '') like '%scontrini%')
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy scontrini_membri_select on storage.objects
  for select to authenticated using (bucket_id = 'scontrini' and is_app_member());
create policy scontrini_membri_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'scontrini' and is_app_member());
create policy scontrini_membri_update on storage.objects
  for update to authenticated using (bucket_id = 'scontrini' and is_app_member())
  with check (bucket_id = 'scontrini' and is_app_member());
create policy scontrini_membri_delete on storage.objects
  for delete to authenticated using (bucket_id = 'scontrini' and is_app_member());

-- ---------------------------------------------------------------------------
-- 5. VERIFICA FINALE: nessuna tabella family_* con la vecchia policy
-- ---------------------------------------------------------------------------
do $$
declare
  v int;
begin
  select count(*) into v from pg_policies
  where schemaname = 'public' and tablename like 'family_%'
    and policyname = 'accesso_utenti_autenticati';
  if v > 0 then
    raise exception 'VERIFICA FALLITA: % vecchie policy ancora presenti.', v;
  end if;
  raise notice 'Protezione attiva: accesso solo per i membri di app_members (tabelle e bucket scontrini).';
end $$;
