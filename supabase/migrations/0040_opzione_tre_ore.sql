-- ============================================================================
-- 0040 — OPZIONE DI 3 ORE SULLE PROPOSTE (06/09/2026)
-- ============================================================================
-- Una proposta inviata tiene «in opzione» per 3 ore le camere e le notti
-- proposte: nel frattempo il gestionale non le propone ad altri. Alla
-- scadenza parte una notifica Pushover; 24 ore dopo la richiesta si chiude
-- da sola. Le richieste rifiutate da Ania passano in «chiusa» con motivo.
--
-- Da applicare A MANO: Supabase -> SQL Editor -> Run (progetto di
-- PRODUZIONE tnsaa…vwv). PRIMA di premere Run: sostituire INCOLLA_QUI_IL_CRON_SECRET
-- (riga in fondo) con il valore della variabile CRON_SECRET del progetto Vercel
-- (Settings -> Environment Variables). Poi controllare le due select in fondo.

-- 1. Stato «chiusa» con motivo e data; notifica di scadenza inviata una sola volta
alter table public.richieste drop constraint if exists richieste_stato_check;
alter table public.richieste add constraint richieste_stato_check
  check (stato in ('in_attesa', 'proposta_inviata', 'confermata', 'rifiutata', 'chiusa'));
alter table public.richieste add column if not exists chiusura_motivo text
  check (chiusura_motivo is null or chiusura_motivo in ('scaduta', 'rifiutata'));
alter table public.richieste add column if not exists scadenza_notificata_at timestamptz;

create index if not exists idx_richieste_proposta_inviata_at on public.richieste (stato, proposta_inviata_at);

-- 2. Controllo ogni 5 minuti dal database (pg_cron + pg_net): chiama la route
--    del gestionale che manda la notifica Pushover e chiude le scadute da 24 h.
--    Funziona anche col gestionale chiuso. Il segreto è lo stesso dei cron Vercel.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('richieste-scadenze') where exists (select 1 from cron.job where jobname = 'richieste-scadenze');
select cron.schedule(
  'richieste-scadenze',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://gestionale-bnb-tau.vercel.app/api/richieste/scadenze',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer INCOLLA_QUI_IL_CRON_SECRET"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);

notify pgrst, 'reload schema';

-- Verifica 1: le due colonne nuove
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'richieste' and column_name in ('chiusura_motivo', 'scadenza_notificata_at');
-- Verifica 2: il cron attivo ogni 5 minuti (una riga, active = true)
select jobname, schedule, active from cron.job where jobname = 'richieste-scadenze';
