-- =====================================================================
-- SCONTRINI DA LEGGERE
--
-- Le foto degli scontrini vengono caricate nello spazio archivio di
-- Supabase (bucket "scontrini") e tracciate qui. Restano in stato
-- "da_leggere" finché, in una sessione, Claude le legge e ne ricava le
-- spese; poi si segnano "letto".
--
-- PRIMA di applicare: creare il bucket "scontrini" in Supabase
--   Storage -> New bucket -> nome "scontrini", NON pubblico.
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

create table if not exists family_receipts (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,          -- percorso del file nel bucket "scontrini"
  note text,                           -- nota facoltativa (es. "spesa Ania")
  status text not null default 'da_leggere' check (status in ('da_leggere', 'letto')),
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists family_receipts_status_idx on family_receipts (status);

alter table public.family_receipts enable row level security;
drop policy if exists "accesso_utenti_autenticati" on public.family_receipts;
create policy "accesso_utenti_autenticati" on public.family_receipts
  for all to authenticated using (true) with check (true);

-- Accesso al bucket "scontrini" solo agli utenti autenticati (upload, lettura,
-- eliminazione). Se il bucket non esiste ancora, queste policy falliscono:
-- crearlo prima in Storage.
drop policy if exists "scontrini_utenti_autenticati" on storage.objects;
create policy "scontrini_utenti_autenticati" on storage.objects
  for all to authenticated
  using (bucket_id = 'scontrini') with check (bucket_id = 'scontrini');
