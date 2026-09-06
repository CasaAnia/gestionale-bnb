-- ============================================================================
-- 0039 — RECUPERO BIANCHERIA (06/09/2026)
-- ============================================================================
-- Quando Ania segna una camera come pulita può annotare, SOLO se serve, i
-- pezzi di biancheria che l'ospite NON ha usato e che ha recuperato puliti.
-- Si segna solo il non usato, mai il set completo. Una riga per pulizia
-- (cleaning_id unico: riaprendo la scheda si corregge la stessa riga).
--
-- Da applicare A MANO: incollare in Supabase -> SQL Editor -> Run (progetto di
-- PRODUZIONE tnsaa…vwv) e controllare la select in fondo. Finché non è
-- applicata il gestionale funziona lo stesso: la pulizia si segna, il
-- recupero risponde «Non salvato, riprova».

create table if not exists public.biancheria_recuperata (
  id uuid primary key default gen_random_uuid(),
  cleaning_id uuid not null unique references public.cleanings(id) on delete cascade,
  room_id uuid not null references public.rooms(id),
  booking_id uuid references public.bookings(id) on delete set null,
  data date not null,                     -- giorno della pulizia (data effettiva)
  federe integer not null default 0 check (federe between 0 and 4),
  lenzuolo_sotto integer not null default 0 check (lenzuolo_sotto between 0 and 1),
  lenzuolo_sopra integer not null default 0 check (lenzuolo_sopra between 0 and 1),
  telo_doccia integer not null default 0 check (telo_doccia between 0 and 2),
  asciugamano_viso integer not null default 0 check (asciugamano_viso between 0 and 2),
  asciugamano_mani integer not null default 0 check (asciugamano_mani between 0 and 2),
  tappetino_doccia integer not null default 0 check (tappetino_doccia between 0 and 1),
  tappeto_bagno integer not null default 0 check (tappeto_bagno between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists biancheria_recuperata_data_idx on public.biancheria_recuperata (data);
create index if not exists biancheria_recuperata_room_idx on public.biancheria_recuperata (room_id, data);

-- Stessa protezione delle tabelle della 0021: RLS attiva, niente per anon e
-- public, solo i membri dell'app (private.is_app_member) leggono e scrivono.
alter table public.biancheria_recuperata enable row level security;
revoke all on public.biancheria_recuperata from public, anon;
grant select, insert, update, delete on public.biancheria_recuperata to authenticated;
drop policy if exists biancheria_recuperata_membri on public.biancheria_recuperata;
create policy biancheria_recuperata_membri on public.biancheria_recuperata
  for all to authenticated
  using ((select private.is_app_member()))
  with check ((select private.is_app_member()));

notify pgrst, 'reload schema';

-- Verifica: una riga con rls_attiva = true e policy = 1.
select t.tablename, t.rowsecurity as rls_attiva, count(p.policyname) as policy
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.tablename = 'biancheria_recuperata'
group by t.tablename, t.rowsecurity;
