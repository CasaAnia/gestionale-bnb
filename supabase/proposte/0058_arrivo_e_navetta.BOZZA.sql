-- =====================================================================
-- ARRIVO E NAVETTA: SIGNIFICATI CHE NON SI MESCOLANO — proposta 0058
-- (21/09/2026, dalla proposta visiva approvata da Ania;
--  corretta la sera stessa dopo la verifica indipendente di Codex)
--
-- IL PROBLEMA. Oggi c'è un orario solo, bookings.check_in_time, e vuol
-- dire tutto e niente. «15:00» può essere l'ora in cui la cliente atterra
-- a Linate o l'ora in cui suona il campanello: fra le due cose ci sono
-- un'ora di strada e una navetta da mandare. E la navetta ha una colonna
-- con due soli valori ('si'/'no'): non sa distinguere «non serve» da
-- «non lo so ancora» né da «serve, ma l'autista non l'ho ancora scelto».
--
-- UNDICI COLONNE, UN SIGNIFICATO CIASCUNA. Nessuna colonna cambia senso a
-- seconda del tipo: era proprio quella l'ambiguità da chiudere.
--
--   arrivo_tipo               'struttura' | 'luogo' | 'da_definire'
--   arrivo_luogo              'linate' | 'rogoredo' | 'centrale' |
--                             'malpensa' | 'orio_al_serio' |
--                             'san_donato' | 'altro'
--   arrivo_luogo_altro        il testo libero di «Altro luogo…»
--   arrivo_luogo_ora_da       l'ora NEL LUOGO (mai in struttura)
--   arrivo_luogo_ora_a        la fine, se è una fascia: lunga quanto
--                             serve, mezz'ora o tutto il pomeriggio
--   arrivo_struttura_ora_da   l'ora IN STRUTTURA detta dalla cliente,
--   arrivo_struttura_ora_a    quando arriva direttamente qui
--   arrivo_stima_da           la STIMA di Ania sull'arrivo in struttura,
--   arrivo_stima_a            solo con un luogo esterno. La scrive lei a
--                             mano: il gestionale non calcola tragitti,
--                             traffico, meteo o tempi aeroportuali
--   navetta                   'non_richiesta' | 'da_definire' |
--                             'da_assegnare' | 'massimo' | 'aldo' |
--                             'alberto' | 'matteo'
--   navetta_prelievo          l'ora del prelievo, facoltativa
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
-- SENZA QUESTA PROPOSTA il gestionale legge l'arrivo dalle due colonne di
-- sempre (un check_in_time scritto prima vuol dire «in struttura a
-- quell'ora»). In scrittura NON ripiega di nascosto: salva con le due di
-- sempre soltanto quando non si perde niente, altrimenti non salva nulla,
-- tiene la bozza a schermo e dice ad Ania cosa manca. Vedi lib/arrivo.ts
-- e lib/arrivoDati.ts.
--
-- NESSUN BACKFILL, NESSUNA PERDITA: le colonne nascono vuote e le
-- prenotazioni esistenti non si toccano.
--
-- PIANO DI APPLICAZIONE: supabase/proposte/0058_PIANO_APPLICAZIONE.md
-- RIPRISTINO:            supabase/proposte/0058_RIPRISTINO.BOZZA.sql
-- =====================================================================

begin;

alter table public.bookings add column if not exists arrivo_tipo text;
alter table public.bookings add column if not exists arrivo_luogo text;
alter table public.bookings add column if not exists arrivo_luogo_altro text;
alter table public.bookings add column if not exists arrivo_luogo_ora_da text;
alter table public.bookings add column if not exists arrivo_luogo_ora_a text;
alter table public.bookings add column if not exists arrivo_struttura_ora_da text;
alter table public.bookings add column if not exists arrivo_struttura_ora_a text;
alter table public.bookings add column if not exists arrivo_stima_da text;
alter table public.bookings add column if not exists arrivo_stima_a text;
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

-- Le ore si scrivono «HH:MM» o restano vuote. L'ora arriva al massimo a 23:
-- la regex di prima ([0-2][0-9]) accettava «29:00» (trovato da Codex il
-- 21/09/2026 sera), e un orario impossibile tornerebbe a schermo come vero.
do $$
declare
  c text;
begin
  foreach c in array array['arrivo_luogo_ora_da', 'arrivo_luogo_ora_a',
                           'arrivo_struttura_ora_da', 'arrivo_struttura_ora_a',
                           'arrivo_stima_da', 'arrivo_stima_a', 'navetta_prelievo']
  loop
    if not exists (select 1 from pg_constraint where conname = format('bookings_%s_ora_check', c)) then
      execute format(
        'alter table public.bookings add constraint bookings_%s_ora_check check (%I is null or %I ~ ''^([01][0-9]|2[0-3]):[0-5][0-9]$'')',
        c, c, c);
    end if;
  end loop;
end $$;

-- Una fascia non finisce prima di cominciare, e una fine senza inizio non
-- è una fascia: sono gli stessi controlli che fa lib/arrivo.controllaArrivo,
-- ripetuti qui perché il database non si fida di nessuno.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_arrivo_fascia_luogo_check') then
    alter table public.bookings add constraint bookings_arrivo_fascia_luogo_check
      check (arrivo_luogo_ora_a is null
             or (arrivo_luogo_ora_da is not null and arrivo_luogo_ora_a >= arrivo_luogo_ora_da));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_arrivo_fascia_struttura_check') then
    alter table public.bookings add constraint bookings_arrivo_fascia_struttura_check
      check (arrivo_struttura_ora_a is null
             or (arrivo_struttura_ora_da is not null and arrivo_struttura_ora_a >= arrivo_struttura_ora_da));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_arrivo_fascia_stima_check') then
    alter table public.bookings add constraint bookings_arrivo_fascia_stima_check
      check (arrivo_stima_a is null
             or (arrivo_stima_da is not null and arrivo_stima_a >= arrivo_stima_da));
  end if;
  -- Il luogo si scrive solo quando si arriva a un luogo, e «Altro» vuole
  -- il suo testo: niente righe con un luogo orfano del suo tipo.
  if not exists (select 1 from pg_constraint where conname = 'bookings_arrivo_luogo_coerente_check') then
    alter table public.bookings add constraint bookings_arrivo_luogo_coerente_check
      check (arrivo_luogo is null or arrivo_tipo = 'luogo');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_arrivo_luogo_altro_check') then
    alter table public.bookings add constraint bookings_arrivo_luogo_altro_check
      check (arrivo_luogo_altro is null or arrivo_luogo = 'altro');
  end if;
end $$;

comment on column public.bookings.arrivo_tipo is
  'Dove arriva: struttura | luogo | da_definire (proposta 0058)';
comment on column public.bookings.arrivo_luogo_ora_da is
  'Ora NEL LUOGO scelto. Non è l''ora in struttura di un arrivo esterno.';
comment on column public.bookings.arrivo_struttura_ora_da is
  'Ora IN STRUTTURA detta dalla cliente, quando arriva direttamente qui.';
comment on column public.bookings.arrivo_stima_da is
  'Stima manuale di Ania sull''arrivo in struttura. Nessun calcolo di tragitti.';
comment on column public.bookings.navetta is
  'Navetta: non_richiesta | da_definire | da_assegnare | autista (proposta 0058). shuttle resta lo specchio si/no/NULL.';

commit;

-- --------------------------------------------------------------------
-- CONTROLLO DOPO L'APPLICAZIONE (non cambia nulla)
-- --------------------------------------------------------------------
-- Le undici colonne ci sono tutte?
-- select count(*) as colonne_nuove
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'bookings'
--    and (column_name like 'arrivo\_%' or column_name like 'navetta%');
--   -- atteso: 11
--
-- I vincoli ci sono tutti?
-- select conname from pg_constraint
--  where conrelid = 'public.bookings'::regclass
--    and conname like 'bookings_arrivo%' or conname like 'bookings_navetta%'
--  order by conname;
--   -- attesi: 15 (3 valori + 7 ore + 3 fasce + 2 coerenza)
--
-- Le prenotazioni non sono state toccate:
-- select count(*) as prenotazioni, count(check_in_time) as con_orario from public.bookings;
--   -- devono combaciare con i numeri annotati PRIMA (vedi piano)
--
-- Nessuna riga ha preso valori per conto suo:
-- select count(*) from public.bookings where arrivo_tipo is not null;
--   -- atteso: 0 subito dopo l'applicazione
