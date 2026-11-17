-- STATO (17/11/2026): APPLICATA IN PRODUZIONE; ora è una migrazione regolare (era in supabase/proposte/).
-- Verificato contro lo schema vero (scripts/schema/confronta-schema.mjs, lettura): colonne, tipi, NOT NULL e
-- funzioni chiamabili coincidono. NON verificabili senza il catalogo: vincoli CHECK, indici, policy RLS, trigger e
-- corpi delle funzioni (supabase/strumenti/leggi-catalogo.sql). Dove il testo qui sotto dice «proposta», «bozza»
-- o «NON APPLICATA», è il testo d'origine: vale questa riga. Applicarla di nuovo non cambia nulla.
-- ============================================================================
-- 0043 — COLONNE DI bookings GIÀ IN PRODUZIONE SENZA MIGRAZIONE («drift») — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA come file, ma le colonne ESISTONO GIÀ in produzione:
-- furono aggiunte a mano nell'editor SQL (prima del 05/09/2026) senza un file
-- di migrazione. Il collaudo del 06/09/2026 (scripts/collaudo-0033) le ha
-- scoperte perché un database ricostruito dalle sole migrazioni non le ha, e
-- le RPC conferma_richiesta (0027/0031) e segna_pagato (0033) le usano.
-- Questa bozza le REGISTRA con «if not exists»: in produzione non cambia
-- nulla (ogni riga trova la colonna già presente e passa oltre); in locale
-- crea le colonne mancanti. Da applicare a mano da Ania quando vuole,
-- controllando la select in fondo (10 colonne).
--
-- Tipi: dedotti dal codice che le scrive e le legge (app/nuova, scheda
-- prenotazione, Calendario, Arrivi) e dagli stub dei test PGlite.
--
-- 17/11/2026: in produzione `pagato` e `bonifico` sono boolean con default false ma PUÒ essere nullo (aggiunte a mano):
-- la bozza diceva NOT NULL, qui sono allineate alla realtà (lo dice la descrizione di PostgREST). Il codice è già
-- scritto per reggere il nullo.
--
-- ROLLBACK: nessuno consigliato — le colonne contengono dati veri.

alter table public.bookings add column if not exists pagato boolean default false;                         -- «Segna come pagato» (flag; i movimenti stanno in payments)
alter table public.bookings add column if not exists bonifico boolean default false;                       -- paga con bonifico (barra viola nel Calendario)
alter table public.bookings add column if not exists guest_name text;                                    -- nome scritto sulla prenotazione, diverso dal cliente (lib/guestName)
alter table public.bookings add column if not exists extra_bed_dates jsonb;                              -- notti (YYYY-MM-DD) col letto aggiuntivo
alter table public.bookings add column if not exists extra_phone_1 text;                                 -- contatto in più 1 (numero)
alter table public.bookings add column if not exists extra_phone_1_name text;                            -- contatto in più 1 (nome)
alter table public.bookings add column if not exists extra_phone_2 text;                                 -- contatto in più 2 (numero)
alter table public.bookings add column if not exists extra_phone_2_name text;                            -- contatto in più 2 (nome)
alter table public.bookings add column if not exists color text;                                         -- colore scelto a mano per la barra (esadecimale)
alter table public.bookings add column if not exists check_in_time text;                                 -- orario di arrivo «HH:MM» (Arrivi, Home)

notify pgrst, 'reload schema';

-- VERIFICA (da controllare dopo Run): 10 righe
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'bookings'
   and column_name in ('pagato', 'bonifico', 'guest_name', 'extra_bed_dates', 'extra_phone_1', 'extra_phone_1_name', 'extra_phone_2', 'extra_phone_2_name', 'color', 'check_in_time')
 order by column_name;
