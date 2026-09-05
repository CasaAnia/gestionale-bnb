-- ============================================================================
-- 0036 — PROVENIENZA DELL'OSPITE (richieste, prenotazioni, strutture) — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (incarico «Provenienza
-- dell'ospite» dell'08/09/2026): da eseguire a mano nell'editor SQL di
-- Supabase solo dopo l'autorizzazione di Ania. PRIMA di applicarla il
-- gestionale funziona lo stesso: il campo «Come ci ha trovato» resta nascosto
-- con l'avviso «serve la migrazione 0036» e nessun salvataggio si blocca.
--
-- COSA FA
--  1. richieste.provenienza e bookings.provenienza: google | passaparola |
--     altra_struttura | non_so (default non_so); richieste.struttura_nome e
--     bookings.struttura_nome: il nome della struttura, SOLO con altra_struttura.
--  2. public.strutture: l'elenco dei nomi noti, precaricato (Umana, Nida,
--     RB (Rosa Bianca), Elyse, BM (Borgo Manzoni)); un nome nuovo scritto da
--     Ania si aggiunge da solo (upsert dal gestionale).
--  3. RLS attiva su strutture, solo authenticated (come le altre tabelle).
-- Alla conferma di una richiesta la provenienza passa alla prenotazione dal
-- gestionale (UPDATE dopo la RPC conferma_richiesta, che resta com'è).
-- Le richieste dal modulo del sito entrano con provenienza = google.
-- ============================================================================

alter table public.richieste add column if not exists provenienza text not null default 'non_so';
alter table public.richieste add column if not exists struttura_nome text;
alter table public.richieste drop constraint if exists richieste_provenienza_valida;
alter table public.richieste add constraint richieste_provenienza_valida
  check (provenienza in ('google', 'passaparola', 'altra_struttura', 'non_so'));

alter table public.bookings add column if not exists provenienza text not null default 'non_so';
alter table public.bookings add column if not exists struttura_nome text;
alter table public.bookings drop constraint if exists bookings_provenienza_valida;
alter table public.bookings add constraint bookings_provenienza_valida
  check (provenienza in ('google', 'passaparola', 'altra_struttura', 'non_so'));

create table if not exists public.strutture (
  nome text primary key,
  created_at timestamptz not null default now()
);
insert into public.strutture (nome) values
  ('Umana'), ('Nida'), ('RB (Rosa Bianca)'), ('Elyse'), ('BM (Borgo Manzoni)')
on conflict (nome) do nothing;

alter table public.strutture enable row level security;
drop policy if exists "accesso_utenti_autenticati" on public.strutture;
create policy "accesso_utenti_autenticati" on public.strutture
  for all to authenticated using (true) with check (true);
revoke all on public.strutture from public, anon;
grant select, insert, update, delete on public.strutture to authenticated, service_role;

notify pgrst, 'reload schema';

-- Verifica: 4 righe (provenienza e struttura_nome su richieste e bookings) e 5 strutture
select table_name, column_name from information_schema.columns
where table_schema = 'public' and table_name in ('richieste', 'bookings') and column_name in ('provenienza', 'struttura_nome')
order by table_name, column_name;
select count(*) as strutture from public.strutture;
