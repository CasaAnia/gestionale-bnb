-- ============================================================================
-- 0034 — CAMERE: ENTRATA/USCITA DAL SERVIZIO E PERIODI DI FUORI SERVIZIO — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (revisioni Codex di
-- f4d5474 R7 e di 3248064 R12): fuori dalle migrazioni operative, da eseguire
-- a mano nell'editor SQL solo dopo collaudo isolato e nuova autorizzazione di
-- Ania. Nessuna schermata per gestire i periodi in questo giro: sarà un
-- incarico separato con mockup approvato da Ania.
--
-- COSA FA
--  1. rooms.in_servizio_dal (date, null = da sempre) e rooms.fuori_servizio_dal
--     (date, null = ancora in servizio): l'ARCHIVIO di una camera è una data,
--     non un interruttore. rooms.active resta per l'interfaccia di oggi, ma
--     le statistiche contano una camera come vendibile SOLO nei giorni fra le
--     due date: archiviare una camera non riscrive più il passato.
--  2. room_closures: periodi di fuori servizio [da, a) per camera con motivo;
--     le notti chiuse si contano una volta anche se i periodi si
--     sovrappongono (lib/statistiche/fuoriServizio).
--  3. RLS ATTIVA con politiche per il solo utente autenticato del gestionale
--     (lettura e scrittura); nessun privilegio ad anon/PUBLIC: nessuna
--     scrittura anonima.
-- LETTURA: lib/statisticheDati.leggiFuoriServizio (a pagine, errori visibili;
-- tabella assente = «periodi non registrati», non un errore) → passata a
-- Home, intervalli, mesi e ricavi per camera.
-- ============================================================================

alter table public.rooms add column if not exists in_servizio_dal date;
alter table public.rooms add column if not exists fuori_servizio_dal date;
alter table public.rooms drop constraint if exists rooms_servizio_intervallo;
alter table public.rooms add constraint rooms_servizio_intervallo
  check (in_servizio_dal is null or fuori_servizio_dal is null or fuori_servizio_dal > in_servizio_dal);

create table if not exists public.room_closures (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  da date not null,                       -- prima notte chiusa (inclusa)
  a date not null,                        -- prima notte riaperta (esclusa)
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_closures_intervallo check (a > da)
);
create index if not exists room_closures_room_idx on public.room_closures (room_id, da);

-- Permessi: RLS attiva, solo l'utente autenticato del gestionale
alter table public.room_closures enable row level security;
revoke all on table public.room_closures from public;
revoke all on table public.room_closures from anon;
grant select, insert, update, delete on table public.room_closures to authenticated;
grant select, insert, update, delete on table public.room_closures to service_role;
drop policy if exists room_closures_lettura on public.room_closures;
create policy room_closures_lettura on public.room_closures for select to authenticated using (auth.uid() is not null);
drop policy if exists room_closures_scrittura on public.room_closures;
create policy room_closures_scrittura on public.room_closures for insert to authenticated with check (auth.uid() is not null);
drop policy if exists room_closures_modifica on public.room_closures;
create policy room_closures_modifica on public.room_closures for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists room_closures_cancellazione on public.room_closures;
create policy room_closures_cancellazione on public.room_closures for delete to authenticated using (auth.uid() is not null);
