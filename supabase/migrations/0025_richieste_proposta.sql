-- ============================================================================
-- 0025 — RICHIESTE: BOZZA E SOLUZIONE INVIATE (pezzo 3, 02/09/2026)
-- ============================================================================
-- Quando Ania apre WhatsApp da /richieste/<id>/proposta, la richiesta passa a
-- «proposta_inviata» e qui restano il testo inviato e la soluzione scelta
-- (camere, date, prezzo) per rileggerli e per la conferma del pezzo 5.
-- Il codice tollera l'assenza delle colonne: senza di esse lo stato cambia
-- comunque e la pagina avvisa che la bozza non è stata archiviata.
--
-- Da eseguire nell'editor SQL di Supabase sul progetto di PRODUZIONE
-- (tnsaa…vwv), poi verificare con la select in fondo.

alter table public.richieste add column if not exists proposta_testo text;
alter table public.richieste add column if not exists proposta_soluzione jsonb;

notify pgrst, 'reload schema';

-- Verifica: devono comparire entrambe le colonne.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'richieste'
  and column_name in ('proposta_testo', 'proposta_soluzione')
order by column_name;
