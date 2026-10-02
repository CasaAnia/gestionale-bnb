-- ============================================================================
-- 0064 — BAGAGLI E PARTENZA, «ALTRO» NEGLI SPAZI COMUNI, ORA E «TOGLI» DELLE
--        PULIZIE, PREZZI DELLA LAVANDERIA (proposta 01/10/2026)
-- ============================================================================
-- NON APPLICATA. È una proposta: si applica solo con il sì di Ania.
--
-- COME SI APPLICA (Ania)
--   1. Supabase → progetto del gestionale → SQL Editor → «New query».
--   2. Incolla TUTTO questo file e premi «Run». Gira in una transazione sola:
--      o entra tutto o non entra niente.
--   3. Controllo (incolla e premi «Run»): le righe in fondo al file, sotto
--      «VERIFICA». Devono dire: 2 colonne nuove su bookings, 1 su cleanings,
--      1 su pulizie_fuori_camera, la tabella prezzi_lavanderia con RLS attiva
--      e 1 policy, la funzione ritocca_pulizia, e 0 prenotazioni con un orario
--      nuovo già scritto (le colonne nascono vuote).
--   Prima di applicare: il backup di sempre (come per 0062 e 0026).
--
-- COSA AGGIUNGE, SENZA RISCRIVERE NESSUNA RIGA ESISTENTE
--  · bookings.bagagli_alle   time null — ora in cui l'ospite passa a lasciare
--                            le valigie il giorno dell'arrivo (null = non passa
--                            o non si sa).
--  · bookings.check_out_time time null — ora in cui lascia la camera l'ultimo
--                            giorno (null = da chiedere).
--    Nessun valore predefinito, nessun dato toccato. Permessi e RLS: quelli
--    della tabella bookings (0026), che valgono per tutte le sue colonne;
--    non serve nessun grant o policy nuovo.
--  · pulizie_fuori_camera: l'attività «altro» (oltre ad area_comune,
--    corridoio, piegatura) e la colonna `cosa` (testo facoltativo, al massimo
--    60 caratteri, solo per «altro»). I minuti già salvati non si toccano:
--    area_comune resta com'è e l'app la legge sotto «Corridoio e angolo caffè».
--  · pulizie_timer: la chiave del timer accetta anche «fuori:AAAA-MM-GG:altro».
--  · gestisci_tempo_pulizie: stessa funzione della 0059, in più accetta
--    «altro» e il campo `cosa`. Le richieste di prima funzionano uguali.
--  · cleanings.ora_effettiva time null — l'ora della pulizia scritta a mano
--    nella correzione del Registro. Se è vuota l'app mostra l'ora in cui la
--    pulizia è stata segnata (created_at), solo quando è stata segnata lo
--    stesso giorno; altrimenti «—».
--  · ritocca_pulizia(p_richiesta): due operazioni del Registro che
--    gestisci_pulizia (0059) non ha:
--      'ora'   — scrive ora_effettiva su una pulizia fatta (con la versione);
--      'togli' — «Segnata per sbaglio · togli»: cancella la pulizia, il suo
--                recupero e il suo timer chiuso. Dopo, la pulizia non conta
--                più da nessuna parte e, se era da fare, la pagina Oggi la
--                ripropone. Solo pulizie «fatta», con la versione.
--    È security definer (cancella righe che i membri non possono cancellare
--    da soli) e controlla per prima cosa che chi chiama sia un membro.
--  · prezzi_lavanderia: un prezzo a pezzo per la «Prova lavanderia» delle
--    Statistiche, scritto da Ania. Nessun prezzo inserito qui.
--
-- RIPRISTINO (solo se serve tornare indietro, con l'app di prima):
--   drop function if exists public.ritocca_pulizia(jsonb);
--   drop table if exists public.prezzi_lavanderia;
--   alter table public.cleanings drop column if exists ora_effettiva;
--   delete from public.pulizie_timer where chiave like 'fuori:%:altro';
--   delete from public.pulizie_fuori_camera where attivita='altro';
--   (poi rieseguire dalla 0059 i due vincoli e gestisci_tempo_pulizie)
--   alter table public.pulizie_fuori_camera drop column if exists cosa;
--   alter table public.bookings drop column if exists bagagli_alle, drop column if exists check_out_time;
-- ============================================================================
begin;

-- ── bookings: bagagli e partenza ────────────────────────────────────────────
alter table public.bookings add column if not exists bagagli_alle time;
alter table public.bookings add column if not exists check_out_time time;
comment on column public.bookings.bagagli_alle is 'Ora in cui l''ospite passa a lasciare i bagagli il giorno dell''arrivo; null = non passa o non si sa (0064)';
comment on column public.bookings.check_out_time is 'Ora di partenza dell''ultimo giorno; null = da chiedere (0064)';

-- ── spazi comuni: «altro» e «cosa» ──────────────────────────────────────────
alter table public.pulizie_fuori_camera add column if not exists cosa text;
-- I vincoli della 0059 sono senza nome: si tolgono cercandoli per contenuto,
-- così non resta un vincolo vecchio accanto al nuovo che rifiuterebbe «altro».
do $$ declare v record; begin
  for v in select conname, conrelid::regclass::text as tab from pg_constraint
    where contype='c' and ((conrelid='public.pulizie_fuori_camera'::regclass and pg_get_constraintdef(oid) like '%area_comune%')
      or (conrelid='public.pulizie_timer'::regclass and pg_get_constraintdef(oid) like '%fuori:%'))
  loop execute format('alter table %s drop constraint %I', v.tab, v.conname); end loop;
end $$;
alter table public.pulizie_fuori_camera add constraint pulizie_fuori_camera_attivita_check
  check (attivita in ('area_comune', 'corridoio', 'piegatura', 'altro'));
alter table public.pulizie_fuori_camera drop constraint if exists pulizie_fuori_camera_cosa_check;
alter table public.pulizie_fuori_camera add constraint pulizie_fuori_camera_cosa_check
  check (cosa is null or (attivita = 'altro' and char_length(cosa) between 1 and 60));

alter table public.pulizie_timer add constraint pulizie_timer_chiave_check
  check (chiave ~ '^(pulizia:[0-9a-f-]{36}:(fine_soggiorno|soggiorno|cambio_camera):[0-9]{4}-[0-9]{2}-[0-9]{2}|fuori:[0-9]{4}-[0-9]{2}-[0-9]{2}:(area_comune|corridoio|piegatura|altro))$');

-- ── cleanings: l'ora corretta a mano ────────────────────────────────────────
alter table public.cleanings add column if not exists ora_effettiva time;
alter table public.cleanings drop constraint if exists cleanings_ora_solo_fatta;
alter table public.cleanings add constraint cleanings_ora_solo_fatta check (stato = 'fatta' or ora_effettiva is null);

-- ── prezzi della lavanderia ─────────────────────────────────────────────────
create table if not exists public.prezzi_lavanderia (
  pezzo text primary key check (pezzo in ('lenzuola_matrimoniali','lenzuola_singole','federe','teli_doccia','viso_mani','tappetini')),
  prezzo numeric(8,2) not null check (prezzo >= 0 and prezzo <= 1000),
  aggiornato_at timestamptz not null default now()
);
alter table public.prezzi_lavanderia enable row level security;
revoke all on public.prezzi_lavanderia from public, anon;
grant select, insert, update, delete on public.prezzi_lavanderia to authenticated;
drop policy if exists prezzi_lavanderia_membri on public.prezzi_lavanderia;
create policy prezzi_lavanderia_membri on public.prezzi_lavanderia for all to authenticated
  using ((select private.is_app_member())) with check ((select private.is_app_member()));

-- ── gestisci_tempo_pulizie: come la 0059, con «altro» e «cosa» ──────────────
create or replace function public.gestisci_tempo_pulizie(p_richiesta jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  azione text := p_richiesta->>'azione';
  chiave_t text := p_richiesta->>'chiave';
  t public.pulizie_timer%rowtype;
  altro public.pulizie_timer%rowtype;
  f public.pulizie_fuori_camera%rowtype;
  adesso timestamptz := clock_timestamp();
  oggi date := (now() at time zone 'Europe/Rome')::date;
  giorno date;
  att text;
  mins integer;
  cosa_t text;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if jsonb_typeof(p_richiesta) is distinct from 'object' or azione is null or azione not in ('leggi','avvia','pausa','azzera','salva_fuori') then
    raise exception using errcode='22023', message='Richiesta tempo non valida';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pulizie_timer', 59));
  adesso := clock_timestamp();
  if azione in ('avvia','pausa','azzera') then
    if chiave_t is null or chiave_t !~ '^(pulizia:[0-9a-f-]{36}:(fine_soggiorno|soggiorno|cambio_camera):[0-9]{4}-[0-9]{2}-[0-9]{2}|fuori:[0-9]{4}-[0-9]{2}-[0-9]{2}:(area_comune|corridoio|piegatura|altro))$' then
      raise exception using errcode='22023', message='Timer non valido';
    end if;
    select * into t from public.pulizie_timer where chiave=chiave_t for update;
    if found and t.cleaning_id is not null then raise exception using errcode='22023', message='Pulizia gia confermata: timer chiuso'; end if;
    if azione='avvia' then
      if chiave_t like 'pulizia:%' and exists (select 1 from public.cleanings c where c.stato='fatta'
          and c.booking_id=split_part(chiave_t, ':', 2)::uuid and c.tipo=split_part(chiave_t, ':', 3)
          and c.data_prevista=split_part(chiave_t, ':', 4)::date) then
        raise exception using errcode='22023', message='Pulizia gia confermata: timer chiuso';
      end if;
      select * into altro from public.pulizie_timer where avviato_at is not null and chiave<>chiave_t;
      if found then raise exception using errcode='P0047', message='Un altro timer e in corso', detail=altro.chiave; end if;
      if t.chiave is null then
        insert into public.pulizie_timer(chiave, avviato_at, aggiornato_at) values (chiave_t, adesso, adesso);
      elsif t.avviato_at is null then
        update public.pulizie_timer set avviato_at=adesso, versione=versione+1, aggiornato_at=adesso where chiave=chiave_t;
      end if;
    elsif azione='pausa' then
      if t.avviato_at is not null then
        update public.pulizie_timer set trascorsi=least(86400, trascorsi + greatest(0, floor(extract(epoch from adesso - avviato_at))::int)),
          avviato_at=null, versione=versione+1, aggiornato_at=adesso where chiave=chiave_t;
      end if;
    else
      if t.chiave is not null then
        if t.avviato_at is not null then raise exception using errcode='P0046', message='Metti in pausa il timer prima di azzerarlo'; end if;
        if t.versione is distinct from (p_richiesta->>'versione')::bigint then raise exception using errcode='P0045', message='Il timer e cambiato: ricarica'; end if;
        update public.pulizie_timer set trascorsi=0, versione=versione+1, aggiornato_at=adesso where chiave=chiave_t;
      end if;
    end if;
  elsif azione='salva_fuori' then
    if (p_richiesta->>'data') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_richiesta->>'attivita') not in ('area_comune','corridoio','piegatura','altro')
      or jsonb_typeof(p_richiesta->'minuti') is distinct from 'number' or (p_richiesta->>'minuti') !~ '^[0-9]+$' then
      raise exception using errcode='22023', message='Tempo fuori camera non valido';
    end if;
    giorno := (p_richiesta->>'data')::date; att := p_richiesta->>'attivita'; mins := (p_richiesta->>'minuti')::int;
    if giorno > oggi or giorno < date '2026-01-01' or mins not between 0 and 1440 then raise exception using errcode='22023', message='Tempo fuori camera non valido'; end if;
    -- «cosa»: solo per «altro», facoltativo, al massimo 60 caratteri.
    cosa_t := nullif(btrim(coalesce(p_richiesta->>'cosa', '')), '');
    if cosa_t is not null and (att <> 'altro' or char_length(cosa_t) > 60) then
      raise exception using errcode='22023', message='Tempo fuori camera non valido';
    end if;
    select * into f from public.pulizie_fuori_camera where data=giorno and attivita=att for update;
    if f.versione is distinct from nullif(p_richiesta->>'versione','')::bigint then
      raise exception using errcode='P0045', message='Il tempo e cambiato: ricarica';
    end if;
    select * into t from public.pulizie_timer where chiave='fuori:' || to_char(giorno,'YYYY-MM-DD') || ':' || att for update;
    if found then
      if t.avviato_at is not null then raise exception using errcode='P0046', message='Ferma il timer prima di salvare il tempo'; end if;
      if t.trascorsi is distinct from coalesce((p_richiesta->>'timer_trascorsi')::int, 0) then
        raise exception using errcode='P0045', message='Il timer e cambiato: ricarica';
      end if;
      update public.pulizie_timer set trascorsi=0, versione=versione+1, aggiornato_at=adesso where chiave=t.chiave;
    elsif coalesce((p_richiesta->>'timer_trascorsi')::int, 0) <> 0 then
      raise exception using errcode='P0045', message='Il timer e cambiato: ricarica';
    end if;
    -- Una richiesta di prima (senza la chiave «cosa») non cancella il «cosa» già scritto.
    insert into public.pulizie_fuori_camera(data, attivita, minuti, versione, aggiornato_at, cosa) values (giorno, att, mins, 1, adesso, cosa_t)
      on conflict (data, attivita) do update set minuti=excluded.minuti, versione=public.pulizie_fuori_camera.versione+1, aggiornato_at=adesso,
        cosa=case when p_richiesta ? 'cosa' then excluded.cosa else public.pulizie_fuori_camera.cosa end
      returning * into f;
  end if;
  return jsonb_build_object('adesso', adesso,
    'timer', coalesce((select jsonb_agg(to_jsonb(x) order by x.chiave) from public.pulizie_timer x
      where x.cleaning_id is null and (x.avviato_at is not null or x.trascorsi > 0 or x.chiave=chiave_t)), '[]'::jsonb),
    'fuori', case when f.data is null then null else to_jsonb(f) end);
end;
$$;
revoke execute on function public.gestisci_tempo_pulizie(jsonb) from public,anon;
grant execute on function public.gestisci_tempo_pulizie(jsonb) to authenticated;

-- ── ritocca_pulizia: ora corretta e «togli» ─────────────────────────────────
create or replace function public.ritocca_pulizia(p_richiesta jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  azione text := p_richiesta->>'azione';
  c public.cleanings%rowtype;
  ora_t time;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if jsonb_typeof(p_richiesta) is distinct from 'object' or azione is null or azione not in ('ora','togli')
    or nullif(p_richiesta->>'cleaning_id','') is null then
    raise exception using errcode='22023', message='Richiesta non valida';
  end if;
  select * into c from public.cleanings where id=(p_richiesta->>'cleaning_id')::uuid;
  if not found then raise exception using errcode='P0045', message='Pulizia cambiata: ricarica'; end if;
  -- Stessi lucchetti e stesso ordine di gestisci_pulizia: camera, poi tempi.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.room_id::text, 46));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pulizie_timer', 59));
  select * into c from public.cleanings where id=c.id for update;
  if not found or c.stato <> 'fatta' then raise exception using errcode='P0045', message='Pulizia cambiata: ricarica'; end if;
  if not (p_richiesta ? 'versione') or c.aggiornata_at is distinct from nullif(p_richiesta->>'versione','')::timestamptz then
    raise exception using errcode='P0045', message='La pulizia e cambiata: riapri la scheda';
  end if;
  if azione='ora' then
    if p_richiesta->>'ora' is not null and (p_richiesta->>'ora') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using errcode='22023', message='Ora non valida';
    end if;
    ora_t := (p_richiesta->>'ora')::time;
    update public.cleanings set ora_effettiva=ora_t,
      aggiornata_at=greatest(clock_timestamp(), c.aggiornata_at + interval '1 microsecond')
      where id=c.id returning * into c;
    return jsonb_build_object('pulizia', to_jsonb(c));
  end if;
  -- «togli»: il recupero va via con la pulizia (on delete cascade della 0039);
  -- il timer chiuso su questa pulizia si cancella, così non resta un tempo
  -- orfano che bloccherebbe la nuova conferma.
  delete from public.pulizie_timer where cleaning_id=c.id;
  delete from public.biancheria_recuperata where cleaning_id=c.id;
  delete from public.cleanings where id=c.id;
  return jsonb_build_object('tolta', c.id);
end;
$$;
revoke execute on function public.ritocca_pulizia(jsonb) from public, anon;
grant execute on function public.ritocca_pulizia(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;

-- ── VERIFICA (dopo «Run») ───────────────────────────────────────────────────
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public' and (
  (table_name='bookings' and column_name in ('bagagli_alle','check_out_time'))
  or (table_name='cleanings' and column_name='ora_effettiva')
  or (table_name='pulizie_fuori_camera' and column_name='cosa'))
order by table_name, column_name;
select t.tablename, t.rowsecurity as rls_attiva, count(p.policyname) as policy
from pg_tables t left join pg_policies p on p.schemaname=t.schemaname and p.tablename=t.tablename
where t.schemaname='public' and t.tablename='prezzi_lavanderia'
group by t.tablename, t.rowsecurity;
select proname from pg_proc where proname in ('ritocca_pulizia','gestisci_tempo_pulizie');
select count(*) as orari_gia_scritti from public.bookings where bagagli_alle is not null or check_out_time is not null;
