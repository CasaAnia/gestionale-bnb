-- ============================================================================
-- 0038 — «VUOLE RICEVUTA» SEPARATA DALLA VALUTAZIONE — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (incarico «Scheda cliente:
-- ricevuta separata dalla valutazione» dell'08/09/2026): da eseguire a mano
-- nell'editor SQL di Supabase con l'autorizzazione di Ania. PRIMA di
-- applicarla la scheda funziona come oggi (il gestionale riconosce entrambe
-- le forme: «Vuole ricevuta» come vecchia voce della valutazione, oppure
-- l'interruttore nuovo).
--
-- COSA FA
--  1. guests.vuole_ricevuta boolean (default false): interruttore a sé.
--  2. Migra chi aveva la valutazione «vuole_ricevuta»: ricevuta = sì e
--     valutazione «normale» (le tre voci restano Ottimo / Normale / Problematico).
--  3. Toglie «vuole_ricevuta» dai valori ammessi della valutazione.
-- ============================================================================

alter table public.guests add column if not exists vuole_ricevuta boolean not null default false;

update public.guests set vuole_ricevuta = true, rating = 'normale' where rating = 'vuole_ricevuta';

alter table public.guests drop constraint if exists guests_rating_check;
alter table public.guests add constraint guests_rating_check
  check (rating is null or rating in ('ottimo', 'problematico', 'normale'));

notify pgrst, 'reload schema';

-- Verifica: nessun cliente con rating = vuole_ricevuta; quanti con la ricevuta
select count(*) filter (where rating = 'vuole_ricevuta') as ancora_vecchi,
       count(*) filter (where vuole_ricevuta) as con_ricevuta
from public.guests;
