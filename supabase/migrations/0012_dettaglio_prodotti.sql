-- =====================================================================
-- DETTAGLIO PRODOTTI DEGLI SCONTRINI
--
-- Ogni spesa (family_expenses) può avere le sue righe di dettaglio: i
-- singoli prodotti dello scontrino con il loro prezzo. La lista spese
-- resta pulita (una riga per spesa), ma da questi dettagli si ricava
-- "dove spendi di più" prodotto per prodotto — anche cose insospettabili.
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

create table if not exists family_expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references family_expenses(id) on delete cascade,
  name text not null,          -- nome del prodotto (es. "Acqua Lauretana")
  amount numeric(10,2) not null,
  qty numeric(10,3) not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists family_expense_items_expense_idx on family_expense_items (expense_id);

alter table public.family_expense_items enable row level security;
drop policy if exists "accesso_utenti_autenticati" on public.family_expense_items;
create policy "accesso_utenti_autenticati" on public.family_expense_items
  for all to authenticated using (true) with check (true);
