-- ============================================================================
-- 0028 — RICHIESTE DAL SITO: colonna origine (pezzo 5A, 02/09/2026)
-- ============================================================================
-- Da eseguire nell'editor SQL di Supabase sul progetto di PRODUZIONE (tnsaa…vwv).
-- · richieste.origine: da dove arriva il cliente secondo il sito ("google",
--   "diretto", …), facoltativa, solo per statistiche.
-- · indice su (canale, created_at) per il controllo anti-doppioni degli ultimi
--   10 minuti fatto dall'endpoint /api/richieste/web.
-- Le notifiche push riusano la tabella push_subscriptions già esistente.

alter table public.richieste add column if not exists origine text;
create index if not exists idx_richieste_canale_created on public.richieste (canale, created_at);

notify pgrst, 'reload schema';

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'richieste' and column_name = 'origine';
