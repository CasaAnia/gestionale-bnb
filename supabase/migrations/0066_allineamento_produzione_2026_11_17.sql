-- ============================================================================
-- 0066 — ALLINEAMENTO DEL REPO AL DATABASE VERO (17/11/2026)
-- ============================================================================
-- STATO: DESCRIVE COSA C'È GIÀ IN PRODUZIONE. Su produzione NON cambia nulla:
-- ogni istruzione è «if not exists», quindi rilanciarla non fa niente. Serve
-- a un database vuoto + tutte le migrazioni = lo stesso schema di produzione
-- (scripts/schema/confronta-schema.mjs).
--
-- Cosa descrive (esisteva in produzione, in nessun file SQL del repo):
--   - public.push_subscriptions  (i telefoni che ricevono le notifiche push)
--   - public.site_events         (le visite e le richieste del sito: la scrive il sito)
--   - bookings.pushover_notified_at
--   - rooms.matrimoniale_price, rooms.double_price
--   - richieste.provenienza, richieste.struttura_nome e public.strutture: la parte della
--     bozza 0036 che in produzione c'è (la parte su bookings NON c'è: la provenienza di
--     una prenotazione vive su guests, 0037; la bozza 0036 resta in proposte/)
--
-- Tipi, NOT NULL, default e chiavi primarie sono quelli letti dalla descrizione di
-- PostgREST di produzione il 17/11/2026. NON verificabili da lì, e quindi non scritti qui:
-- vincoli CHECK, indici, policy RLS, trigger. Vedi supabase/strumenti/leggi-catalogo.sql.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  subscription text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  pagina text,
  created_at timestamptz not null default now(),
  fonte text,
  campagna text
);

alter table public.bookings add column if not exists pushover_notified_at timestamptz;

alter table public.rooms add column if not exists matrimoniale_price numeric;
alter table public.rooms add column if not exists double_price numeric;

alter table public.richieste add column if not exists provenienza text not null default 'non_so';
alter table public.richieste add column if not exists struttura_nome text;

create table if not exists public.strutture (
  nome text primary key,
  created_at timestamptz not null default now()
);
