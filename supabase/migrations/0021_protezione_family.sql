-- ============================================================================
-- 0021 — PROTEZIONE FAMILY (Fase 2A, rivista in 2A.1 il 28/08/2026)
--
-- ⚠️  NON ANCORA DA APPLICARE. Ordine: 0020 → bootstrap_owner.sql → 0021.
--     Precondizione DURA anti-lockout: almeno un owner in app_members.
--
-- REALMENTE IDEMPOTENTE: rieseguirla non fallisce e non lascia doppioni.
-- Sostituisce le vecchie policy "accesso_utenti_autenticati" su TUTTE le
-- family_* (storiche e nuove) e OGNI policy del bucket 'scontrini' in
-- storage.objects (comprese le scontrini_membri_* di una esecuzione
-- precedente). Un autenticato NON in app_members non legge, non carica,
-- non modifica e non elimina né dati né foto. Nessun accesso anonimo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. PRECONDIZIONI
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.app_members') is null then
    raise exception 'PRECONDIZIONE FALLITA: manca app_members — applicare prima la 0020.';
  end if;
  if not exists (select 1 from public.app_members where role = 'owner') then
    raise exception 'PRECONDIZIONE FALLITA: nessun owner in app_members. Eseguire prima supabase/bootstrap_owner.sql.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. FUNZIONI DI SICUREZZA in schema NON esposto (indicazioni Supabase)
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- security definer: leggono public.app_members scavalcandone la RLS, così
-- le policy (anche quelle di app_members) le usano SENZA ricorsione.
-- search_path VUOTO e nomi completi: niente dirottamenti di schema.
create or replace function private.is_app_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_members where user_id = auth.uid());
$$;

create or replace function private.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_members where user_id = auth.uid() and role = 'owner');
$$;

-- permessi minimi ed ESPLICITI: solo authenticated, solo queste due funzioni
revoke execute on function private.is_app_member() from public, anon;
revoke execute on function private.is_app_owner() from public, anon;
grant execute on function private.is_app_member() to authenticated;
grant execute on function private.is_app_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. PROTEZIONE DELL'ULTIMO OWNER: mai zero proprietari
-- ---------------------------------------------------------------------------
create or replace function private.proteggi_ultimo_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and (select count(*) from public.app_members where role = 'owner') = 1 then
    raise exception 'Operazione negata: non si può eliminare o declassare l''ULTIMO owner.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists app_members_ultimo_owner on public.app_members;
create trigger app_members_ultimo_owner
  before update or delete on public.app_members
  for each row execute function private.proteggi_ultimo_owner();

-- ---------------------------------------------------------------------------
-- 3. APP_MEMBERS: membri leggono; SOLO un owner aggiunge/modifica/rimuove
-- ---------------------------------------------------------------------------
alter table public.app_members enable row level security;
drop policy if exists app_members_lettura_membri on public.app_members;
create policy app_members_lettura_membri on public.app_members
  for select to authenticated using ((select private.is_app_member()));
drop policy if exists app_members_gestione_owner on public.app_members;
create policy app_members_gestione_owner on public.app_members
  for all to authenticated
  using ((select private.is_app_owner()))
  with check ((select private.is_app_owner()));
revoke all on public.app_members from public, anon;
grant select, insert, update, delete on public.app_members to authenticated;

-- ---------------------------------------------------------------------------
-- 4. TABELLE FAMILY_* (storiche e nuove): solo membri
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'family_groups', 'family_categories', 'family_subcategories',
    'family_expenses', 'family_expense_items', 'family_receipts',
    'family_budgets', 'family_product_rules',
    'family_canonical_categories', 'family_canonical_subcategories',
    'family_subcategory_map', 'family_documents', 'family_draft_expenses',
    'family_draft_items', 'family_expense_documents', 'family_corrections'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'PRECONDIZIONE FALLITA: tabella % assente — applicare prima la 0020.', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "accesso_utenti_autenticati" on public.%I', t);
    execute format('drop policy if exists %I on public.%I', t || '_solo_membri', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.is_app_member())) with check ((select private.is_app_member()))',
      t || '_solo_membri', t);
    -- permessi espliciti: niente anon/public; CRUD ad authenticated (RLS filtra)
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. BUCKET PRIVATO 'scontrini' (storage.objects): SELECT/INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------
-- idempotente: via PRIMA le nostre quattro policy di un giro precedente…
drop policy if exists scontrini_membri_select on storage.objects;
drop policy if exists scontrini_membri_insert on storage.objects;
drop policy if exists scontrini_membri_update on storage.objects;
drop policy if exists scontrini_membri_delete on storage.objects;
-- …poi ogni ALTRA policy che tocca il bucket (nomi non prevedibili)
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
  for select to authenticated
  using (bucket_id = 'scontrini' and (select private.is_app_member()));
create policy scontrini_membri_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'scontrini' and (select private.is_app_member()));
create policy scontrini_membri_update on storage.objects
  for update to authenticated
  using (bucket_id = 'scontrini' and (select private.is_app_member()))
  with check (bucket_id = 'scontrini' and (select private.is_app_member()));
create policy scontrini_membri_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'scontrini' and (select private.is_app_member()));

-- ---------------------------------------------------------------------------
-- 6. VERIFICHE FINALI
-- ---------------------------------------------------------------------------
do $$
declare
  v int;
begin
  -- (a) nessuna vecchia policy permissiva sulle family_*
  select count(*) into v from pg_policies
  where schemaname = 'public' and tablename like 'family_%'
    and policyname not like '%_solo_membri';
  if v > 0 then
    raise exception 'VERIFICA FALLITA: % policy non previste sulle tabelle family_*.', v;
  end if;
  -- (b) sul bucket scontrini SOLO le nostre quattro
  select count(*) into v from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual, '') like '%scontrini%' or coalesce(with_check, '') like '%scontrini%')
    and policyname not in ('scontrini_membri_select', 'scontrini_membri_insert',
                           'scontrini_membri_update', 'scontrini_membri_delete');
  if v > 0 then
    raise exception 'VERIFICA FALLITA: % policy estranee sul bucket scontrini.', v;
  end if;
  -- (c) il bucket scontrini deve essere PRIVATO
  if exists (select 1 from storage.buckets where id = 'scontrini' and public) then
    raise exception 'VERIFICA FALLITA: il bucket scontrini risulta PUBBLICO.';
  end if;
  -- (d) l'owner c'è ancora (il trigger lo protegge d'ora in poi)
  if not exists (select 1 from public.app_members where role = 'owner') then
    raise exception 'VERIFICA FALLITA: owner scomparso durante l''applicazione.';
  end if;
  raise notice 'Protezione attiva: tabelle e foto accessibili SOLO ai membri; ultimo owner protetto.';
end $$;
