-- =====================================================================
-- ARRIVO E NAVETTA: TRE SIGNIFICATI CHE NON SI MESCOLANO — proposta 0058
-- (21/09/2026, dalla proposta visiva approvata da Ania)
--
-- IL PROBLEMA. Oggi c'è un orario solo, bookings.check_in_time, e vuol
-- dire tutto e niente. «15:00» può essere l'ora in cui la cliente atterra
-- a Linate o l'ora in cui suona il campanello: fra le due cose ci sono
-- un'ora di strada e una navetta da mandare. E la navetta ha una colonna
-- con due soli valori ('si'/'no'): non sa distinguere «non serve» da
-- «non lo so ancora» né da «serve, ma l'autista non l'ho ancora scelto».
--
-- COSA AGGIUNGE.
--   arrivo_tipo          'struttura' | 'luogo' | 'da_definire'
--   arrivo_luogo         'linate' | 'rogoredo' | 'centrale' | 'malpensa'
--                        | 'orio_al_serio' | 'san_donato' | 'altro'
--   arrivo_luogo_altro   il testo libero di «Altro luogo…»
--   arrivo_ora_da        l'ora IN QUEL LUOGO (o in struttura, col tipo
--   arrivo_ora_a         'struttura'); insieme sono una fascia libera:
--                        mezz'ora, un'ora, due ore, quello che serve
--   arrivo_struttura_da  la STIMA di Ania sull'arrivo in struttura,
--   arrivo_struttura_a   facoltativa, solo con un luogo esterno. La
--                        scrive lei a mano: il gestionale non calcola
--                        tragitti, traffico, meteo o tempi aeroportuali
--   navetta              'non_richiesta' | 'da_definire' | 'da_assegnare'
--                        | 'massimo' | 'aldo' | 'alberto' | 'matteo'
--   navetta_prelievo     l'ora del prelievo, facoltativa
--
-- LE DUE COLONNE DI SEMPRE RESTANO, e restano vere. Il gestionale scrive
-- sempre anche loro:
--   check_in_time = l'ora IN STRUTTURA (l'inizio, se è una fascia), vuota
--                   quando non si sa. MAI l'ora di Linate: è proprio la
--                   confusione che questa proposta chiude.
--   shuttle       = 'no' per «non richiesta», 'si' quando la navetta
--                   serve (autista scelto o ancora da assegnare), NULL
--                   quando è ancora da definire.
-- Così Home, Arrivi, pulizie, notifiche e storico continuano a funzionare
-- senza toccarli, e nessuna riga vecchia va convertita.
--
-- SENZA QUESTA PROPOSTA il gestionale funziona lo stesso: legge l'arrivo
-- dalle due colonne di sempre (un check_in_time scritto prima vuol dire
-- «in struttura a quell'ora») e, se il salvataggio con le colonne nuove
-- viene rifiutato, riscrive solo quelle vecchie e lo dice a schermo.
-- Vedi lib/arrivo.ts e lib/arrivoOrario.ts.
--
-- NESSUN BACKFILL, NESSUNA PERDITA: le colonne nascono vuote e le
-- prenotazioni esistenti non si toccano.
-- =====================================================================

alter table public.bookings add column if not exists arrivo_tipo text;
alter table public.bookings add column if not exists arrivo_luogo text;
alter table public.bookings add column if not exists arrivo_luogo_altro text;
alter table public.bookings add column if not exists arrivo_ora_da text;
alter table public.bookings add column if not exists arrivo_ora_a text;
alter table public.bookings add column if not exists arrivo_struttura_da text;
alter table public.bookings add column if not exists arrivo_struttura_a text;
alter table public.bookings add column if not exists navetta text;
alter table public.bookings add column if not exists navetta_prelievo text;

-- I valori ammessi. NULL resta sempre ammesso: una prenotazione vecchia
-- non ha nulla di scritto e non deve diventare invalida.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_arrivo_tipo_check') then
    alter table public.bookings add constraint bookings_arrivo_tipo_check
      check (arrivo_tipo is null or arrivo_tipo in ('struttura', 'luogo', 'da_definire'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_arrivo_luogo_check') then
    alter table public.bookings add constraint bookings_arrivo_luogo_check
      check (arrivo_luogo is null or arrivo_luogo in
        ('linate', 'rogoredo', 'centrale', 'malpensa', 'orio_al_serio', 'san_donato', 'altro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_navetta_check') then
    alter table public.bookings add constraint bookings_navetta_check
      check (navetta is null or navetta in
        ('non_richiesta', 'da_definire', 'da_assegnare', 'massimo', 'aldo', 'alberto', 'matteo'));
  end if;
end $$;

-- Le ore si scrivono «HH:MM» o restano vuote: un testo storto qui dentro
-- tornerebbe a schermo come un orario finto.
do $$
declare
  c text;
begin
  foreach c in array array['arrivo_ora_da', 'arrivo_ora_a', 'arrivo_struttura_da', 'arrivo_struttura_a', 'navetta_prelievo']
  loop
    if not exists (select 1 from pg_constraint where conname = format('bookings_%s_ora_check', c)) then
      execute format(
        'alter table public.bookings add constraint bookings_%s_ora_check check (%I is null or %I ~ ''^[0-2][0-9]:[0-5][0-9]$'')',
        c, c, c);
    end if;
  end loop;
end $$;

comment on column public.bookings.arrivo_tipo is
  'Dove arriva: struttura | luogo | da_definire (proposta 0058)';
comment on column public.bookings.arrivo_ora_da is
  'Ora nel LUOGO scelto (o in struttura col tipo struttura). Non è l''ora in struttura di un arrivo esterno.';
comment on column public.bookings.arrivo_struttura_da is
  'Stima manuale di Ania sull''arrivo in struttura. Nessun calcolo di tragitti.';
comment on column public.bookings.navetta is
  'Navetta: non_richiesta | da_definire | da_assegnare | autista (proposta 0058). shuttle resta lo specchio si/no/NULL.';

-- --------------------------------------------------------------------
-- CONTROLLO DOPO L'APPLICAZIONE (non cambia nulla)
-- --------------------------------------------------------------------
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'bookings'
--    and column_name like 'arrivo%' or column_name like 'navetta%'
--  order by column_name;
--
-- Le prenotazioni con un arrivo già scritto alla vecchia maniera:
-- select count(*) from public.bookings where check_in_time is not null;
