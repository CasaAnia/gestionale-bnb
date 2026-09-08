-- BOZZA NON APPLICATA. Pulizia + recupero atomici, quantità per ospite,
-- ritentativi idempotenti e conflitti espliciti. Nessuna ricostruzione storica.
begin;
alter table public.cleanings add column if not exists persone_servite integer;
alter table public.cleanings drop constraint if exists cleanings_persone_servite_check;
alter table public.cleanings add constraint cleanings_persone_servite_check check (persone_servite between 1 and 16);
alter table public.biancheria_recuperata drop constraint if exists biancheria_recuperata_telo_doccia_check;
alter table public.biancheria_recuperata drop constraint if exists biancheria_recuperata_asciugamano_viso_check;
alter table public.biancheria_recuperata drop constraint if exists biancheria_recuperata_asciugamano_mani_check;
alter table public.biancheria_recuperata add constraint biancheria_recuperata_telo_doccia_check check (telo_doccia between 0 and 16);
alter table public.biancheria_recuperata add constraint biancheria_recuperata_asciugamano_viso_check check (asciugamano_viso between 0 and 16);
alter table public.biancheria_recuperata add constraint biancheria_recuperata_asciugamano_mani_check check (asciugamano_mani between 0 and 16);

create table if not exists public.pulizie_operazioni (
  id uuid primary key,
  richiesta jsonb not null,
  risposta jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.pulizie_operazioni enable row level security;
revoke all on public.pulizie_operazioni from public, anon;
grant select, insert on public.pulizie_operazioni to authenticated;
drop policy if exists pulizie_operazioni_membri on public.pulizie_operazioni;
create policy pulizie_operazioni_membri on public.pulizie_operazioni for all to authenticated
  using ((select private.is_app_member())) with check ((select private.is_app_member()));

create or replace function public.gestisci_pulizia(p_operazione uuid, p_richiesta jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.cleanings%rowtype;
  b public.bookings%rowtype;
  recupero public.biancheria_recuperata%rowtype;
  precedente public.pulizie_operazioni%rowtype;
  richiesta_pulizia jsonb := p_richiesta->'pulizia';
  valori jsonb := p_richiesta->'recupero';
  azione text := p_richiesta->>'azione';
  camera uuid;
  ultimo uuid;
  creato timestamptz;
  persone integer;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  k text;
  n integer;
  risultato jsonb;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if p_operazione is null or jsonb_typeof(p_richiesta) is distinct from 'object' or azione is null or azione not in ('registra','recupero') then
    raise exception using errcode='22023', message='Richiesta pulizia non valida';
  end if;
  -- Stessa chiave: serializza anche riusi contemporanei con payload diversi.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operazione::text, 45));
  select * into precedente from public.pulizie_operazioni where id=p_operazione;
  if found then
    if precedente.richiesta <> p_richiesta then raise exception using errcode='22023', message='Operazione gia usata con altri valori'; end if;
    return precedente.risposta;
  end if;
  if azione='registra' then
    select * into b from public.bookings where id=(richiesta_pulizia->>'booking_id')::uuid;
    if not found or b.status not in ('confermata','completata') or b.room_id is distinct from (richiesta_pulizia->>'room_id')::uuid then
      raise exception using errcode='22023', message='Soggiorno della pulizia non valido';
    end if;
    camera := b.room_id;
  else
    select * into c from public.cleanings where id=(p_richiesta->>'cleaning_id')::uuid;
    if not found or c.stato <> 'fatta' then raise exception using errcode='22023', message='Pulizia non disponibile'; end if;
    camera := c.room_id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(camera::text, 46));
  if azione='registra' then
    -- Rilettura dopo il lock, comprese modifiche del soggiorno durante l'attesa.
    select * into b from public.bookings where id=b.id for share;
    if not found or b.room_id is distinct from camera or b.status not in ('confermata','completata')
      or b.num_guests is distinct from (richiesta_pulizia->>'persone_servite')::integer then
      raise exception using errcode='P0045', message='Il soggiorno e cambiato: ricarica';
    end if;
    select id into ultimo from public.cleanings where room_id=camera order by created_at desc, id desc limit 1;
    -- Anche con risoluzione del clock limitata o orologio corretto indietro,
    -- l'ordine delle decisioni della camera resta quello del salvataggio.
    select greatest(clock_timestamp(), max(created_at) + interval '1 microsecond') into creato
      from public.cleanings where room_id=camera;
    if not (p_richiesta ? 'ultima_id') or ultimo is distinct from (p_richiesta->>'ultima_id')::uuid then
      raise exception using errcode='P0045', message='Le pulizie sono cambiate: ricarica prima di salvare';
    end if;
    if richiesta_pulizia->>'tipo' is null or richiesta_pulizia->>'stato' is null or richiesta_pulizia->>'tipo' not in ('fine_soggiorno','soggiorno','cambio_camera')
      or richiesta_pulizia->>'stato' not in ('fatta','rimandata','saltata')
      or nullif(richiesta_pulizia->>'data_prevista','') is null then
      raise exception using errcode='22023', message='Decisione non valida';
    end if;
    if richiesta_pulizia->>'stato'='fatta' then
      if nullif(richiesta_pulizia->>'data_effettiva','') is null
        or (richiesta_pulizia->>'data_effettiva')::date > oggi
        or (richiesta_pulizia->>'data_effettiva')::date < b.check_in::date then
        raise exception using errcode='22023', message='Data effettiva non valida';
      end if;
    elsif richiesta_pulizia->>'stato'='rimandata' or richiesta_pulizia->>'tipo'='soggiorno' then
      if nullif(richiesta_pulizia->>'prossima_data','') is null
        or (richiesta_pulizia->>'prossima_data')::date <= (richiesta_pulizia->>'data_prevista')::date then
        raise exception using errcode='22023', message='Prossima data non valida';
      end if;
    end if;
    persone := b.num_guests;
    if persone is null or persone not between 1 and 16 then raise exception using errcode='22023', message='Numero ospiti da correggere nel soggiorno'; end if;
    insert into public.cleanings(id,room_id,booking_id,tipo,stato,data_prevista,data_effettiva,prossima_data,cambio_biancheria,note,persone_servite,created_at)
    values(p_operazione,camera,b.id,richiesta_pulizia->>'tipo',richiesta_pulizia->>'stato',
      (richiesta_pulizia->>'data_prevista')::date,(richiesta_pulizia->>'data_effettiva')::date,
      (richiesta_pulizia->>'prossima_data')::date,richiesta_pulizia->>'stato'='fatta',richiesta_pulizia->>'note',persone,creato)
    returning * into c;
  else
    select * into c from public.cleanings where id=c.id for update;
    if not found or c.stato <> 'fatta' then raise exception using errcode='P0045', message='Pulizia cambiata'; end if;
    select * into recupero from public.biancheria_recuperata where cleaning_id=c.id for update;
    if not (p_richiesta ? 'versione') or recupero.updated_at is distinct from (p_richiesta->>'versione')::timestamptz then
      raise exception using errcode='P0045', message='Il recupero e cambiato: riapri la scheda';
    end if;
    select * into b from public.bookings where id=c.booking_id;
    persone := coalesce(c.persone_servite,b.num_guests);
    if persone is null or persone not between 1 and 16 then raise exception using errcode='22023', message='Dotazione del soggiorno non disponibile'; end if;
  end if;
  if valori is not null and valori <> 'null'::jsonb then
    if c.stato <> 'fatta' or jsonb_typeof(valori) <> 'object' then raise exception using errcode='22023', message='Recupero non valido'; end if;
    foreach k in array array['federe','lenzuolo_sotto','lenzuolo_sopra','telo_doccia','asciugamano_viso','asciugamano_mani','tappetino_doccia','tappeto_bagno'] loop
      if not (valori ? k) or valori->>k is null or (valori->>k) !~ '^[0-9]+$' then raise exception using errcode='22023', message='Quantita non valida'; end if;
      n := (valori->>k)::integer;
      if n > (case when k in ('telo_doccia','asciugamano_viso','asciugamano_mani') then greatest(persone,coalesce((to_jsonb(recupero)->>k)::integer,0)) when k='federe' then 4 else 1 end) then
        raise exception using errcode='22023', message='Quantita oltre la dotazione';
      end if;
    end loop;
    insert into public.biancheria_recuperata(cleaning_id,room_id,booking_id,data,federe,lenzuolo_sotto,lenzuolo_sopra,telo_doccia,asciugamano_viso,asciugamano_mani,tappetino_doccia,tappeto_bagno,updated_at)
    values(c.id,c.room_id,c.booking_id,coalesce(c.data_effettiva,c.data_prevista),
      (valori->>'federe')::int,(valori->>'lenzuolo_sotto')::int,(valori->>'lenzuolo_sopra')::int,
      (valori->>'telo_doccia')::int,(valori->>'asciugamano_viso')::int,(valori->>'asciugamano_mani')::int,
      (valori->>'tappetino_doccia')::int,(valori->>'tappeto_bagno')::int,
      greatest(clock_timestamp(), recupero.updated_at + interval '1 microsecond'))
    on conflict(cleaning_id) do update set federe=excluded.federe,lenzuolo_sotto=excluded.lenzuolo_sotto,lenzuolo_sopra=excluded.lenzuolo_sopra,
      telo_doccia=excluded.telo_doccia,asciugamano_viso=excluded.asciugamano_viso,asciugamano_mani=excluded.asciugamano_mani,
      tappetino_doccia=excluded.tappetino_doccia,tappeto_bagno=excluded.tappeto_bagno,data=excluded.data,updated_at=excluded.updated_at
    returning * into recupero;
  end if;
  risultato := jsonb_build_object('pulizia',to_jsonb(c),'recupero',case when recupero.id is null then null else to_jsonb(recupero) end);
  insert into public.pulizie_operazioni(id,richiesta,risposta) values(p_operazione,p_richiesta,risultato);
  return risultato;
end;
$$;
revoke execute on function public.gestisci_pulizia(uuid,jsonb) from public,anon;
grant execute on function public.gestisci_pulizia(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
