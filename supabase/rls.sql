-- =====================================================================
-- PROTEZIONE DEL DATABASE (Row Level Security)
--
-- Fino a oggi le tabelle erano leggibili da chiunque conoscesse la chiave
-- anon, che è pubblica perché viaggia dentro il codice della pagina. Queste
-- policy chiudono il database a tutti tranne agli utenti autenticati.
--
-- ATTENZIONE ALL'ORDINE. Applicare questo file SOLO DOPO che:
--   1. l'utente è stato creato in Supabase (Authentication → Users)
--   2. SUPABASE_SERVICE_ROLE_KEY è su Vercel
--   3. il login sul gestionale funziona davvero
--
-- Applicarlo prima significa vedere il gestionale vuoto.
--
-- Da incollare in Supabase → SQL Editor → Run.
-- =====================================================================

-- 1. Attiva RLS su tutte le tabelle.
--    Con RLS attiva e nessuna policy, l'accesso è negato a tutti: sono le
--    policy del punto 2 a riaprire l'accesso a chi è loggato.
alter table public.rooms                enable row level security;
alter table public.guests               enable row level security;
alter table public.bookings             enable row level security;
alter table public.payments             enable row level security;
alter table public.expenses             enable row level security;
alter table public.expense_categories   enable row level security;
alter table public.push_subscriptions   enable row level security;
alter table public.booking_whatsapp_log enable row level security;

-- 2. Una policy per tabella: accesso completo solo al ruolo "authenticated".
--    Il ruolo "anon" (chiave pubblica senza login) resta escluso.
--
--    La service role key usata dai cron non passa da qui: scavalca RLS per
--    definizione, ed è il motivo per cui le route push sono state spostate
--    su quella chiave.

drop policy if exists "accesso_utenti_autenticati" on public.rooms;
create policy "accesso_utenti_autenticati" on public.rooms
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.guests;
create policy "accesso_utenti_autenticati" on public.guests
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.bookings;
create policy "accesso_utenti_autenticati" on public.bookings
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.payments;
create policy "accesso_utenti_autenticati" on public.payments
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.expenses;
create policy "accesso_utenti_autenticati" on public.expenses
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.expense_categories;
create policy "accesso_utenti_autenticati" on public.expense_categories
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.push_subscriptions;
create policy "accesso_utenti_autenticati" on public.push_subscriptions
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.booking_whatsapp_log;
create policy "accesso_utenti_autenticati" on public.booking_whatsapp_log
  for all to authenticated using (true) with check (true);

-- 3. Verifica.
--    rowsecurity deve essere true su tutte le righe, e ogni tabella deve
--    avere esattamente una policy.
select
  t.tablename,
  t.rowsecurity as rls_attiva,
  count(p.policyname) as policy
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, t.rowsecurity
order by t.tablename;

-- Pulizie e registro notifiche (migrazione 0018): stessa regola delle altre
-- tabelle — solo utenti loggati; il cron usa la service role e non è toccato.
alter table public.cleanings enable row level security;
alter table public.push_log  enable row level security;

drop policy if exists "accesso_utenti_autenticati" on public.cleanings;
create policy "accesso_utenti_autenticati" on public.cleanings
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.push_log;
create policy "accesso_utenti_autenticati" on public.push_log
  for all to authenticated using (true) with check (true);
