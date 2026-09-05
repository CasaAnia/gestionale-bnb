-- BOZZA, NON APPLICATA (05/09/2026) — «Statistiche, numeri corretti», pezzo 3.
--
-- Oggi le notti vendibili si calcolano con il flag rooms.active (camera
-- attiva sì/no, senza date): una camera chiusa per lavori per dieci giorni
-- non riduce il denominatore dell'occupazione. Questa tabella registra i
-- periodi di fuori servizio [da, a) di una camera; lib/statistiche la legge
-- già come struttura FuoriServizio { room_id, da, a, motivo } (oggi vuota).
-- Da applicare a mano nell'editor SQL di Supabase SOLO quando Ania decide
-- che vuole registrare le chiusure; poi collegare la lettura in
-- lib/statisticheDati (leggiCamere → anche room_closures).

create table if not exists public.room_closures (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  da date not null,                       -- prima notte chiusa (inclusa)
  a date not null,                        -- prima notte riaperta (esclusa)
  motivo text,
  created_at timestamptz not null default now(),
  constraint room_closures_intervallo check (a > da)
);

create index if not exists room_closures_room_idx on public.room_closures (room_id, da);

-- Come le altre tabelle del gestionale (un solo utente): RLS disattivata.
alter table public.room_closures disable row level security;
