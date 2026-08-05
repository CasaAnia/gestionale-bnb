-- =====================================================================
-- Scontrini legati alla sezione (ambito) dove vengono caricati, così la
-- lista "da leggere" non compare in entrambe le sezioni.
--   'personale' → Spese Famiglia   |   'azienda' → Spese B&B
-- Gli scontrini già caricati restano 'personale' (default): quello di
-- stamattina era stato messo in Spese Famiglia.
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

alter table family_receipts add column if not exists ambito text not null default 'personale';
