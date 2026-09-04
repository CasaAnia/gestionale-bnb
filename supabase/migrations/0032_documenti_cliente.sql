-- ============================================================================
-- 0032 — DOCUMENTI DEI CLIENTI (05/09/2026)
-- ============================================================================
-- Foto dei documenti d'identità allegate alla SCHEDA CLIENTE (non alla
-- prenotazione): appartengono alla persona e ogni prenotazione è già
-- collegata al cliente, così dalla scheda prenotazione compare solo una riga
-- discreta «Documenti · N». Nessuna cancellazione automatica: i documenti
-- restano finché Ania non li toglie a mano (sua scelta, 05/09/2026).
--
-- PRIMA di applicare: creare il bucket "documenti" in Supabase
--   Storage -> New bucket -> nome "documenti", NON pubblico.
-- Poi incollare questo file in Supabase -> SQL Editor -> Run (progetto di
-- PRODUZIONE tnsaa…vwv) e controllare la select in fondo.

create table if not exists public.documenti_cliente (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  percorso text not null,                 -- percorso del file nel bucket "documenti"
  etichetta text not null default 'documento'
    check (etichetta in ('documento', 'carta_identita', 'passaporto', 'patente', 'altro')),
  lato text check (lato is null or lato in ('fronte', 'retro')),
  nome_file text,
  dimensione integer,                     -- byte del file caricato (già ridotto)
  created_at timestamptz not null default now()
);

create index if not exists documenti_cliente_guest_idx on public.documenti_cliente (guest_id, created_at);

-- Stessa protezione delle altre tabelle: solo il ruolo authenticated, anon escluso.
alter table public.documenti_cliente enable row level security;
drop policy if exists "accesso_utenti_autenticati" on public.documenti_cliente;
create policy "accesso_utenti_autenticati" on public.documenti_cliente
  for all to authenticated using (true) with check (true);

-- Bucket privato "documenti": upload, lettura (URL firmati), eliminazione solo
-- agli utenti autenticati. Se il bucket non esiste ancora, queste policy
-- falliscono: crearlo prima in Storage.
drop policy if exists "documenti_utenti_autenticati" on storage.objects;
create policy "documenti_utenti_autenticati" on storage.objects
  for all to authenticated
  using (bucket_id = 'documenti') with check (bucket_id = 'documenti');

notify pgrst, 'reload schema';

-- Verifica: una riga con rls_attiva = true e policy = 1, e il bucket NON pubblico.
select t.tablename, t.rowsecurity as rls_attiva, count(p.policyname) as policy
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.tablename = 'documenti_cliente'
group by t.tablename, t.rowsecurity;
select id, public from storage.buckets where id = 'documenti';
