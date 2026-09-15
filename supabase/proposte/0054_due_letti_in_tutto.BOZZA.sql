-- =====================================================================
-- DUE LETTI IN TUTTA LA CASA (15/09/2026) — proposta 0054
--
-- IL PROBLEMA. I letti aggiuntivi sono due, e sono di tutta la casa: non
-- uno per camera. Il gestionale li conta prima di salvare, e la RPC della
-- conferma richiesta (migrazione 0027) li ricontrolla; ma per le altre
-- strade — una prenotazione scritta a mano, una notte spostata dalla
-- striscia — il controllo sta solo nel browser. E due scritture nello
-- stesso istante su CAMERE DIVERSE non violano nessun vincolo: quello
-- della 0051 guarda la camera, non i letti. Risultato possibile: tre
-- letti promessi per la stessa notte, quando ne esistono due.
--
-- LA SOLUZIONE. Un controllo dentro il database, uguale per chi inserisce
-- e per chi sposta, che prima di contare si mette in fila: pg_advisory_
-- xact_lock su ciascuna notte toccata. Due transazioni sulla stessa notte
-- non contano più insieme: la seconda aspetta la prima e poi vede la
-- riga che l'altra ha appena scritto. Il lucchetto si scioglie da solo
-- alla fine della transazione, in ogni caso, anche se qualcosa va storto.
--
-- LE REGOLE DI CASA, le stesse della 0027:
--  · una riga col letto occupa un letto per ciascuna notte indicata in
--    extra_bed_dates; se extra_bed è acceso senza date, tutte le sue notti;
--  · Lena con 4 ospiti occupa DUE letti (il terzo posto è compreso, il
--    quarto è un letto in più, e ne serve un altro per il terzo ospite);
--  · le righe annullate non occupano niente.
--
-- UNA DIFFERENZA DA DECIDERE CON ANIA: qui contano anche le prenotazioni
-- «in attesa» (l'opzione di tre ore), perché il letto in casa è occupato
-- comunque; la 0027 conta solo confermate e completate. Questo controllo
-- è quindi un filo più severo: se è troppo, basta cambiare la condizione
-- in `b.status in ('confermata','completata')`.
--
-- PRIMA DI APPLICARE — guarda se una notte ha già più di due letti:
--
--   with notti as (
--     select b.id, r.name,
--            case when r.name = 'Lena' and b.num_guests >= 4 then 2 else 1 end as quanti,
--            case when b.extra_bed_dates is not null
--                   and jsonb_typeof(b.extra_bed_dates) = 'array'
--                   and jsonb_array_length(b.extra_bed_dates) > 0
--                 then (select array_agg(d::date) from jsonb_array_elements_text(b.extra_bed_dates) t(d))
--                 else (select array_agg(g::date) from generate_series(b.check_in, b.check_out - 1, interval '1 day') g)
--            end as notti
--       from public.bookings b join public.rooms r on r.id = b.room_id
--      where b.status <> 'annullata'
--        and (coalesce(b.extra_bed, false)
--             or (b.extra_bed_dates is not null and jsonb_typeof(b.extra_bed_dates) = 'array'
--                 and jsonb_array_length(b.extra_bed_dates) > 0)))
--   select notte, sum(quanti) as letti
--     from notti, unnest(notti.notti) as notte
--    group by notte having sum(quanti) > 2 order by notte;
--
-- Se ne trova, vanno sistemate a mano PRIMA: il controllo rifiuterebbe
-- poi qualunque ritocco a quelle righe.
-- =====================================================================

create or replace function public.letti_non_oltre_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notti  date[];
  v_notte  date;
  v_miei   integer;
  v_presi  integer;
  v_nome   text;
  v_mesi   text[] := array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
begin
  if new.status = 'annullata' then
    return new;
  end if;

  -- Le notti col letto di QUESTA riga: quelle indicate, o tutte se il letto
  -- è acceso senza date. Nessuna notte col letto: non c'è niente da contare.
  if new.extra_bed_dates is not null
     and pg_catalog.jsonb_typeof(new.extra_bed_dates) = 'array'
     and pg_catalog.jsonb_array_length(new.extra_bed_dates) > 0 then
    select pg_catalog.array_agg(d::date order by d::date)
      into v_notti
      from pg_catalog.jsonb_array_elements_text(new.extra_bed_dates) t(d);
  elsif coalesce(new.extra_bed, false) then
    select pg_catalog.array_agg(g::date order by g::date)
      into v_notti
      from pg_catalog.generate_series(new.check_in, new.check_out - 1, interval '1 day') g;
  else
    return new;
  end if;
  if v_notti is null or pg_catalog.array_length(v_notti, 1) is null then
    return new;
  end if;

  select r.name into v_nome from public.rooms r where r.id = new.room_id;
  v_miei := case when v_nome = 'Lena' and coalesce(new.num_guests, 1) >= 4 then 2 else 1 end;

  -- Ci si mette in fila, notte per notte e in ordine di data (sempre lo
  -- stesso ordine: due transazioni non possono bloccarsi a vicenda).
  foreach v_notte in array v_notti loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('letto:' || pg_catalog.to_char(v_notte, 'YYYY-MM-DD')));
  end loop;

  -- Solo adesso si conta: chi è arrivato prima ha già scritto e si vede.
  foreach v_notte in array v_notti loop
    select coalesce(pg_catalog.sum(case when r.name = 'Lena' and b.num_guests >= 4 then 2 else 1 end), 0)
      into v_presi
      from public.bookings b
      join public.rooms r on r.id = b.room_id
     where b.id <> new.id
       and b.status <> 'annullata'
       and (coalesce(b.extra_bed, false)
            or (b.extra_bed_dates is not null
                and pg_catalog.jsonb_typeof(b.extra_bed_dates) = 'array'
                and pg_catalog.jsonb_array_length(b.extra_bed_dates) > 0))
       and (
         (b.extra_bed_dates is not null
           and pg_catalog.jsonb_typeof(b.extra_bed_dates) = 'array'
           and pg_catalog.jsonb_array_length(b.extra_bed_dates) > 0
           and b.extra_bed_dates ? pg_catalog.to_char(v_notte, 'YYYY-MM-DD'))
         or ((b.extra_bed_dates is null
               or pg_catalog.jsonb_typeof(b.extra_bed_dates) <> 'array'
               or pg_catalog.jsonb_array_length(b.extra_bed_dates) = 0)
             and b.check_in <= v_notte and b.check_out > v_notte)
       );

    if v_presi + v_miei > 2 then
      raise exception 'LETTI_FINITI: la notte del % % i letti in più sono già presi (ce ne sono due in tutta la casa)',
        pg_catalog.date_part('day', v_notte)::int,
        v_mesi[pg_catalog.date_part('month', v_notte)::int];
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.letti_non_oltre_due is
  'I letti aggiuntivi sono due in tutta la casa: questo controllo li conta notte per notte, mettendosi in fila (advisory lock) perché due salvataggi insieme non possano superarli.';

drop trigger if exists bookings_letti_non_oltre_due on public.bookings;
create trigger bookings_letti_non_oltre_due
  before insert or update on public.bookings
  for each row
  execute function public.letti_non_oltre_due();

-- DOPO AVER APPLICATO: il gestionale riconosce il messaggio LETTI_FINITI e
-- lo traduce in «i letti in più di quella notte sono appena stati presi».
--
-- PROVA DI CONCORRENZA (su un database di prova, non in produzione):
-- scripts/collaudo-0051/concorrenza.mjs — due sessioni che chiedono
-- l'ultimo letto della stessa notte in camere diverse: una passa, l'altra
-- si ferma con LETTI_FINITI.
--
-- PER TORNARE INDIETRO:
--   drop trigger if exists bookings_letti_non_oltre_due on public.bookings;
--   drop function if exists public.letti_non_oltre_due();
