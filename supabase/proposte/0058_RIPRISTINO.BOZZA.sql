-- =====================================================================
-- RIPRISTINO della proposta 0058 «Arrivo e navetta» (21/09/2026)
--
-- Da incollare SOLO se, dopo aver applicato la 0058, si decidesse di
-- tornare indietro. Toglie i vincoli e le undici colonne aggiunte.
--
-- COSA SI PERDE. Le colonne portano i dettagli dell'arrivo scritti DOPO
-- l'applicazione: il luogo, la fascia oraria, la stima in struttura,
-- quale autista e l'ora del prelievo. Quei dati NON si possono ricostruire
-- dalle due colonne di sempre. Prima di eseguire, se in mezzo è stato
-- registrato qualche arrivo, salvarne una copia con la query qui sotto.
--
-- COSA NON SI PERDE. `check_in_time` e `shuttle` non si toccano: l'ora in
-- struttura e il «serve la navetta / non serve» restano dov'erano, e il
-- gestionale torna a leggerli come prima della 0058, senza modifiche al
-- codice (lib/arrivo li rilegge da solo).
--
-- COPIA DI SICUREZZA, da eseguire PRIMA (e da salvare fuori):
--   select id, check_in, check_in_time, shuttle,
--          arrivo_tipo, arrivo_luogo, arrivo_luogo_altro,
--          arrivo_luogo_ora_da, arrivo_luogo_ora_a,
--          arrivo_struttura_ora_da, arrivo_struttura_ora_a,
--          arrivo_stima_da, arrivo_stima_a,
--          navetta, navetta_prelievo
--     from public.bookings
--    where arrivo_tipo is not null or navetta is not null
--    order by check_in;
-- =====================================================================

begin;

-- Prima i vincoli (cadrebbero comunque con le colonne: espliciti per
-- lasciare traccia di cosa si sta togliendo)
alter table public.bookings drop constraint if exists bookings_arrivo_tipo_check;
alter table public.bookings drop constraint if exists bookings_arrivo_luogo_check;
alter table public.bookings drop constraint if exists bookings_navetta_check;
alter table public.bookings drop constraint if exists bookings_arrivo_luogo_ora_da_ora_check;
alter table public.bookings drop constraint if exists bookings_arrivo_luogo_ora_a_ora_check;
alter table public.bookings drop constraint if exists bookings_arrivo_struttura_ora_da_ora_check;
alter table public.bookings drop constraint if exists bookings_arrivo_struttura_ora_a_ora_check;
alter table public.bookings drop constraint if exists bookings_arrivo_stima_da_ora_check;
alter table public.bookings drop constraint if exists bookings_arrivo_stima_a_ora_check;
alter table public.bookings drop constraint if exists bookings_navetta_prelievo_ora_check;
alter table public.bookings drop constraint if exists bookings_arrivo_fascia_luogo_check;
alter table public.bookings drop constraint if exists bookings_arrivo_fascia_struttura_check;
alter table public.bookings drop constraint if exists bookings_arrivo_fascia_stima_check;
alter table public.bookings drop constraint if exists bookings_arrivo_luogo_coerente_check;
alter table public.bookings drop constraint if exists bookings_arrivo_luogo_altro_check;

alter table public.bookings drop column if exists arrivo_tipo;
alter table public.bookings drop column if exists arrivo_luogo;
alter table public.bookings drop column if exists arrivo_luogo_altro;
alter table public.bookings drop column if exists arrivo_luogo_ora_da;
alter table public.bookings drop column if exists arrivo_luogo_ora_a;
alter table public.bookings drop column if exists arrivo_struttura_ora_da;
alter table public.bookings drop column if exists arrivo_struttura_ora_a;
alter table public.bookings drop column if exists arrivo_stima_da;
alter table public.bookings drop column if exists arrivo_stima_a;
alter table public.bookings drop column if exists navetta;
alter table public.bookings drop column if exists navetta_prelievo;

commit;

-- CONTROLLO DOPO IL RIPRISTINO
-- select count(*) from information_schema.columns
--  where table_schema = 'public' and table_name = 'bookings'
--    and (column_name like 'arrivo\_%' or column_name like 'navetta%');
--   -- atteso: 0
-- select count(*) as prenotazioni, count(check_in_time) as con_orario from public.bookings;
--   -- devono combaciare con i numeri di prima: le due colonne di sempre non si toccano
