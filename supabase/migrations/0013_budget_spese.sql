-- =====================================================================
-- BUDGET MENSILI PER CATEGORIA (pagina Spese)
--
-- Tetto di spesa mensile per categoria (per nome, cosi' "Mangiare fuori"
-- vale per tutti i gruppi che hanno quella voce). Separato per ambito:
-- 'personale' (Spese Famiglia) e 'azienda' (Spese B&B).
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

create table if not exists family_budgets (
  id uuid primary key default gen_random_uuid(),
  ambito text not null default 'personale',
  category_name text not null,
  monthly_amount numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (ambito, category_name)
);

alter table public.family_budgets enable row level security;

drop policy if exists "accesso_utenti_autenticati" on public.family_budgets;
create policy "accesso_utenti_autenticati" on public.family_budgets
  for all to authenticated using (true) with check (true);
