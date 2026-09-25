-- ============================================================================
-- 0059 — PULIZIE: DOTAZIONE, RECUPERI PER MISURA, TEMPI (proposta 25/09/2026)
-- ============================================================================
-- NON APPLICATA. Da applicare a mano solo con l'autorizzazione di Ania, dopo
-- il piano 0059_PIANO_APPLICAZIONE.md (ordine: migrazione → app).
--
-- Cosa aggiunge, senza riscrivere nessuna riga esistente:
--  · cleanings: fotografia della dotazione (letti preparati, ospiti serviti,
--    federe sul matrimoniale) e minuti effettivi, facoltativi, per intervento;
--    aggiornata_at = versione per le correzioni.
--  · biancheria_recuperata: lenzuola sotto/sopra per MISURA (matrimoniale e
--    singolo). Le vecchie colonne lenzuolo_sotto/lenzuolo_sopra restano come
--    «senza misura» dello storico: non si distribuiscono, non si cancellano.
--    tappetino_doccia resta la colonna dello scendidoccia.
--  · pulizie_timer: cronometri per camera e per lavoro fuori camera, con
--    istanti del server; uno solo in corso alla volta.
--  · pulizie_fuori_camera: minuti per giornata e attività (Area comune,
--    Corridoio, Piegatura biancheria), un totale per coppia.
--  · gestisci_pulizia: stessa firma e stesso comportamento per le richieste
--    di prima (l'app già pubblicata continua a funzionare); in più dotazione,
--    minuti, recuperi per misura, correzione («dettagli») e timer consumato
--    nella stessa transazione della conferma.
--  · gestisci_tempo_pulizie: avvia/pausa/azzera timer e salva i tempi fuori
--    camera, con controllo di versione.
begin;

-- ── cleanings ───────────────────────────────────────────────────────────────
alter table public.cleanings add column if not exists assetto jsonb;
alter table public.cleanings add column if not exists dotazione jsonb;
alter table public.cleanings add column if not exists minuti integer;
alter table public.cleanings add column if not exists aggiornata_at timestamptz;
alter table public.cleanings drop constraint if exists cleanings_minuti_check;
alter table public.cleanings add constraint cleanings_minuti_check check (minuti between 1 and 1440);
alter table public.cleanings drop constraint if exists cleanings_dotazione_solo_fatta;
alter table public.cleanings add constraint cleanings_dotazione_solo_fatta
  check (stato = 'fatta' or (assetto is null and dotazione is null and minuti is null));
alter table public.cleanings drop constraint if exists cleanings_assetto_con_dotazione;
alter table public.cleanings add constraint cleanings_assetto_con_dotazione check ((assetto is null) = (dotazione is null));

-- ── biancheria_recuperata ───────────────────────────────────────────────────
alter table public.biancheria_recuperata add column if not exists sotto_matrimoniale integer not null default 0;
alter table public.biancheria_recuperata add column if not exists sopra_matrimoniale integer not null default 0;
alter table public.biancheria_recuperata add column if not exists sotto_singolo integer not null default 0;
alter table public.biancheria_recuperata add column if not exists sopra_singolo integer not null default 0;
alter table public.biancheria_recuperata drop constraint if exists biancheria_recuperata_misure_check;
alter table public.biancheria_recuperata add constraint biancheria_recuperata_misure_check check (
  sotto_matrimoniale between 0 and 1 and sopra_matrimoniale between 0 and 1
  and sotto_singolo between 0 and 2 and sopra_singolo between 0 and 2);
-- Lena in quattro: un matrimoniale (4 federe) e due singoli (2 + 2) = 8.
alter table public.biancheria_recuperata drop constraint if exists biancheria_recuperata_federe_check;
alter table public.biancheria_recuperata add constraint biancheria_recuperata_federe_check check (federe between 0 and 8);

-- ── tempi ───────────────────────────────────────────────────────────────────
create table if not exists public.pulizie_timer (
  chiave text primary key,
  trascorsi integer not null default 0 check (trascorsi between 0 and 86400),
  avviato_at timestamptz,
  cleaning_id uuid references public.cleanings(id) on delete set null,
  versione bigint not null default 1,
  aggiornato_at timestamptz not null default now(),
  check (chiave ~ '^(pulizia:[0-9a-f-]{36}:(fine_soggiorno|soggiorno|cambio_camera):[0-9]{4}-[0-9]{2}-[0-9]{2}|fuori:[0-9]{4}-[0-9]{2}-[0-9]{2}:(area_comune|corridoio|piegatura))$')
);
-- Un solo cronometro in corso: il lavoro di Ania non si conta due volte.
create unique index if not exists pulizie_timer_un_solo_attivo on public.pulizie_timer ((true)) where avviato_at is not null;

create table if not exists public.pulizie_fuori_camera (
  data date not null,
  attivita text not null check (attivita in ('area_comune', 'corridoio', 'piegatura')),
  minuti integer not null check (minuti between 0 and 1440),
  versione bigint not null default 1,
  aggiornato_at timestamptz not null default now(),
  primary key (data, attivita)
);

do $$ declare t text; begin
  foreach t in array array['pulizie_timer', 'pulizie_fuori_camera'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    -- Le funzioni sono «security invoker» come gestisci_pulizia: scrivono coi
    -- permessi di chi chiama, dentro le policy dei soli membri.
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_membri', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select private.is_app_member())) with check ((select private.is_app_member()))', t || '_membri', t);
  end loop;
end $$;

-- ── regole della dotazione (stesse di lib/dotazionePulizie) ────────────────
create or replace function private.dotazione_da_assetto(a jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare m integer; s integer; o integer; f integer; k text;
begin
  if a is null or jsonb_typeof(a) <> 'object' then raise exception using errcode='22023', message='Letti preparati non validi'; end if;
  foreach k in array array['matrimoniali','singoli','ospiti','federe_matrimoniale'] loop
    if jsonb_typeof(a->k) is distinct from 'number' or (a->>k) !~ '^[0-9]+$' then
      raise exception using errcode='22023', message='Letti preparati non validi';
    end if;
  end loop;
  m := (a->>'matrimoniali')::int; s := (a->>'singoli')::int; o := (a->>'ospiti')::int; f := (a->>'federe_matrimoniale')::int;
  if m not between 0 and 1 or s not between 0 and 2 or m + s = 0 then raise exception using errcode='22023', message='Controlla i letti preparati'; end if;
  if o not between 1 and 4 or o > m * 2 + s then raise exception using errcode='22023', message='Gli ospiti superano i posti dei letti preparati'; end if;
  if f not in (2, 4) then raise exception using errcode='22023', message='Scegli due o quattro federe per il matrimoniale'; end if;
  return jsonb_build_object('sotto_matrimoniale', m, 'sopra_matrimoniale', m, 'sotto_singolo', s, 'sopra_singolo', s,
    'federe', m * f + s * 2, 'telo_doccia', o, 'asciugamano_viso', o, 'asciugamano_mani', o,
    'tappeto_bagno', 1, 'scendidoccia', 1);
end $$;

create or replace function private.assetto_pulito(a jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('matrimoniali', (a->>'matrimoniali')::int, 'singoli', (a->>'singoli')::int,
    'ospiti', (a->>'ospiti')::int, 'federe_matrimoniale', (a->>'federe_matrimoniale')::int)
$$;

-- ── gestisci_pulizia ────────────────────────────────────────────────────────
create or replace function public.gestisci_pulizia(p_operazione uuid, p_richiesta jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.cleanings%rowtype;
  b public.bookings%rowtype;
  recupero public.biancheria_recuperata%rowtype;
  precedente public.pulizie_operazioni%rowtype;
  t public.pulizie_timer%rowtype;
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
  nuovo_assetto jsonb;
  nuova_dotazione jsonb;
  nuovi_minuti integer;
  per_misura boolean;
  chiave_timer text;
  nuova_data date;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if p_operazione is null or jsonb_typeof(p_richiesta) is distinct from 'object' or azione is null or azione not in ('registra','recupero','dettagli') then
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

  -- Dotazione e minuti, se la richiesta li porta (le richieste di prima no).
  if azione in ('registra','dettagli') then
    nuovo_assetto := case when azione='registra' then richiesta_pulizia->'assetto' else p_richiesta->'assetto' end;
    if nuovo_assetto is not null and nuovo_assetto <> 'null'::jsonb then
      nuova_dotazione := private.dotazione_da_assetto(nuovo_assetto);
      nuovo_assetto := private.assetto_pulito(nuovo_assetto);
    else
      nuovo_assetto := null;
    end if;
    k := case when azione='registra' then richiesta_pulizia->>'minuti' else p_richiesta->>'minuti' end;
    if k is not null then
      if k !~ '^[0-9]+$' or k::integer not between 1 and 1440 then raise exception using errcode='22023', message='Minuti non validi'; end if;
      nuovi_minuti := k::integer;
    end if;
  end if;

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
    else
      -- Rinvio e salto non sono lavoro: niente dotazione, minuti o recuperi.
      if nuovo_assetto is not null or nuovi_minuti is not null then
        raise exception using errcode='22023', message='Rinvio e salto non hanno dotazione ne minuti';
      end if;
      if richiesta_pulizia->>'stato'='rimandata' or richiesta_pulizia->>'tipo'='soggiorno' then
        if nullif(richiesta_pulizia->>'prossima_data','') is null
          or (richiesta_pulizia->>'prossima_data')::date <= (richiesta_pulizia->>'data_prevista')::date then
          raise exception using errcode='22023', message='Prossima data non valida';
        end if;
      end if;
    end if;
    persone := b.num_guests;
    if persone is null or persone not between 1 and 16 then raise exception using errcode='22023', message='Numero ospiti da correggere nel soggiorno'; end if;
    -- Il cronometro di questa pulizia: in corso blocca; alla conferma si consuma.
    chiave_timer := 'pulizia:' || b.id::text || ':' || (richiesta_pulizia->>'tipo') || ':' || to_char((richiesta_pulizia->>'data_prevista')::date, 'YYYY-MM-DD');
    select * into t from public.pulizie_timer where chiave=chiave_timer for update;
    if found and t.cleaning_id is null and (t.avviato_at is not null or (richiesta_pulizia->>'stato' <> 'fatta' and t.trascorsi > 0)) then
      raise exception using errcode='P0046', message='Timer della pulizia da risolvere';
    end if;
    insert into public.cleanings(id,room_id,booking_id,tipo,stato,data_prevista,data_effettiva,prossima_data,cambio_biancheria,note,persone_servite,created_at,assetto,dotazione,minuti)
    values(p_operazione,camera,b.id,richiesta_pulizia->>'tipo',richiesta_pulizia->>'stato',
      (richiesta_pulizia->>'data_prevista')::date,(richiesta_pulizia->>'data_effettiva')::date,
      (richiesta_pulizia->>'prossima_data')::date,richiesta_pulizia->>'stato'='fatta',richiesta_pulizia->>'note',persone,creato,
      nuovo_assetto,nuova_dotazione,nuovi_minuti)
    returning * into c;
    if t.chiave is not null and c.stato='fatta' then
      update public.pulizie_timer set cleaning_id=c.id, versione=versione+1, aggiornato_at=now() where chiave=t.chiave;
    end if;
  else
    select * into c from public.cleanings where id=c.id for update;
    if not found or c.stato <> 'fatta' then raise exception using errcode='P0045', message='Pulizia cambiata'; end if;
    select * into recupero from public.biancheria_recuperata where cleaning_id=c.id for update;
    if azione='recupero' then
      if not (p_richiesta ? 'versione') or recupero.updated_at is distinct from (p_richiesta->>'versione')::timestamptz then
        raise exception using errcode='P0045', message='Il recupero e cambiato: riapri la scheda';
      end if;
    else
      if not (p_richiesta ? 'versione') or c.aggiornata_at is distinct from (p_richiesta->>'versione')::timestamptz
        or not (p_richiesta ? 'versione_recupero') or recupero.updated_at is distinct from (p_richiesta->>'versione_recupero')::timestamptz then
        raise exception using errcode='P0045', message='La pulizia e cambiata: riapri la scheda';
      end if;
      select * into b from public.bookings where id=c.booking_id;
      nuova_data := coalesce(nullif(p_richiesta->>'data_effettiva','')::date, c.data_effettiva);
      if nuova_data > oggi or (b.id is not null and nuova_data < b.check_in::date) then
        raise exception using errcode='22023', message='Data effettiva non valida';
      end if;
      -- Correzione della fotografia: stesso intervento, mai uno nuovo.
      update public.cleanings set assetto=nuovo_assetto, dotazione=nuova_dotazione, minuti=nuovi_minuti,
        data_effettiva=nuova_data,
        aggiornata_at=greatest(clock_timestamp(), c.aggiornata_at + interval '1 microsecond')
        where id=c.id returning * into c;
      if recupero.id is not null and recupero.data is distinct from c.data_effettiva then
        update public.biancheria_recuperata set data=c.data_effettiva where id=recupero.id returning * into recupero;
      end if;
    end if;
    select * into b from public.bookings where id=c.booking_id;
    persone := coalesce(c.persone_servite,b.num_guests);
    if persone is null or persone not between 1 and 16 then
      if valori is not null and valori <> 'null'::jsonb and not (valori ? 'sotto_matrimoniale') then
        raise exception using errcode='22023', message='Dotazione del soggiorno non disponibile';
      end if;
    end if;
  end if;

  if valori is not null and valori <> 'null'::jsonb then
    if c.stato <> 'fatta' or jsonb_typeof(valori) <> 'object' then raise exception using errcode='22023', message='Recupero non valido'; end if;
    per_misura := valori ? 'sotto_matrimoniale';
    if per_misura then
      -- Recuperi per misura: solo con la dotazione fotografata, articolo per articolo.
      if c.dotazione is null then raise exception using errcode='22023', message='Conferma i letti preparati prima dei recuperi'; end if;
      foreach k in array array['sotto_matrimoniale','sopra_matrimoniale','sotto_singolo','sopra_singolo','federe','telo_doccia','asciugamano_viso','asciugamano_mani','tappeto_bagno','scendidoccia','lenzuolo_sotto','lenzuolo_sopra'] loop
        if not (valori ? k) or jsonb_typeof(valori->k) is distinct from 'number' or (valori->>k) !~ '^[0-9]+$' then raise exception using errcode='22023', message='Quantita non valida'; end if;
        n := (valori->>k)::integer;
        if k in ('lenzuolo_sotto','lenzuolo_sopra') then
          -- Lo storico senza misura si può solo togliere, mai aumentare.
          if n > coalesce((to_jsonb(recupero)->>k)::integer, 0) then raise exception using errcode='22023', message='Quantita oltre la dotazione'; end if;
        elsif n > (c.dotazione->>k)::integer then
          raise exception using errcode='22023', message='Quantita oltre la dotazione';
        end if;
      end loop;
      if (valori->>'sotto_matrimoniale')::int + (valori->>'sotto_singolo')::int + (valori->>'lenzuolo_sotto')::int
           > (c.dotazione->>'sotto_matrimoniale')::int + (c.dotazione->>'sotto_singolo')::int
        or (valori->>'sopra_matrimoniale')::int + (valori->>'sopra_singolo')::int + (valori->>'lenzuolo_sopra')::int
           > (c.dotazione->>'sopra_matrimoniale')::int + (c.dotazione->>'sopra_singolo')::int then
        raise exception using errcode='22023', message='Lenzuola senza misura da riportare';
      end if;
      insert into public.biancheria_recuperata(cleaning_id,room_id,booking_id,data,federe,lenzuolo_sotto,lenzuolo_sopra,telo_doccia,asciugamano_viso,asciugamano_mani,tappetino_doccia,tappeto_bagno,
        sotto_matrimoniale,sopra_matrimoniale,sotto_singolo,sopra_singolo,updated_at)
      values(c.id,c.room_id,c.booking_id,coalesce(c.data_effettiva,c.data_prevista),
        (valori->>'federe')::int,(valori->>'lenzuolo_sotto')::int,(valori->>'lenzuolo_sopra')::int,
        (valori->>'telo_doccia')::int,(valori->>'asciugamano_viso')::int,(valori->>'asciugamano_mani')::int,
        (valori->>'scendidoccia')::int,(valori->>'tappeto_bagno')::int,
        (valori->>'sotto_matrimoniale')::int,(valori->>'sopra_matrimoniale')::int,(valori->>'sotto_singolo')::int,(valori->>'sopra_singolo')::int,
        greatest(clock_timestamp(), recupero.updated_at + interval '1 microsecond'))
      on conflict(cleaning_id) do update set federe=excluded.federe,lenzuolo_sotto=excluded.lenzuolo_sotto,lenzuolo_sopra=excluded.lenzuolo_sopra,
        telo_doccia=excluded.telo_doccia,asciugamano_viso=excluded.asciugamano_viso,asciugamano_mani=excluded.asciugamano_mani,
        tappetino_doccia=excluded.tappetino_doccia,tappeto_bagno=excluded.tappeto_bagno,
        sotto_matrimoniale=excluded.sotto_matrimoniale,sopra_matrimoniale=excluded.sopra_matrimoniale,
        sotto_singolo=excluded.sotto_singolo,sopra_singolo=excluded.sopra_singolo,
        data=excluded.data,updated_at=excluded.updated_at
      returning * into recupero;
    else
      -- Formato di prima (app già pubblicata): stessi controlli della 0045.
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
    if azione='recupero' then
      update public.cleanings set aggiornata_at=greatest(clock_timestamp(), c.aggiornata_at + interval '1 microsecond') where id=c.id returning * into c;
    end if;
  elsif azione='dettagli' and recupero.id is not null and c.dotazione is not null then
    -- Dotazione corretta al ribasso: un recupero oltre la nuova dotazione non
    -- si tronca in silenzio, si chiede di correggerlo.
    foreach k in array array['sotto_matrimoniale','sopra_matrimoniale','sotto_singolo','sopra_singolo','federe','telo_doccia','asciugamano_viso','asciugamano_mani','tappeto_bagno'] loop
      if (to_jsonb(recupero)->>k)::integer > (c.dotazione->>k)::integer then raise exception using errcode='22023', message='Recupero oltre la nuova dotazione: correggi i recuperi'; end if;
    end loop;
    if recupero.tappetino_doccia > (c.dotazione->>'scendidoccia')::integer then raise exception using errcode='22023', message='Recupero oltre la nuova dotazione: correggi i recuperi'; end if;
  end if;
  risultato := jsonb_build_object('pulizia',to_jsonb(c),'recupero',case when recupero.id is null then null else to_jsonb(recupero) end);
  insert into public.pulizie_operazioni(id,richiesta,risposta) values(p_operazione,p_richiesta,risultato);
  return risultato;
end;
$$;
revoke execute on function public.gestisci_pulizia(uuid,jsonb) from public,anon;
grant execute on function public.gestisci_pulizia(uuid,jsonb) to authenticated;

-- ── gestisci_tempo_pulizie ──────────────────────────────────────────────────
-- Il tempo si misura con gli istanti del server: chiudere la scheda,
-- ricaricare o sospendere l'app non ferma e non raddoppia nulla.
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
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if jsonb_typeof(p_richiesta) is distinct from 'object' or azione is null or azione not in ('leggi','avvia','pausa','azzera','salva_fuori') then
    raise exception using errcode='22023', message='Richiesta tempo non valida';
  end if;
  -- Tutte le operazioni sui tempi in fila: niente due timer avviati insieme.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pulizie_timer', 59));
  if azione in ('avvia','pausa','azzera') then
    if chiave_t is null or chiave_t !~ '^(pulizia:[0-9a-f-]{36}:(fine_soggiorno|soggiorno|cambio_camera):[0-9]{4}-[0-9]{2}-[0-9]{2}|fuori:[0-9]{4}-[0-9]{2}-[0-9]{2}:(area_comune|corridoio|piegatura))$' then
      raise exception using errcode='22023', message='Timer non valido';
    end if;
    select * into t from public.pulizie_timer where chiave=chiave_t for update;
    if found and t.cleaning_id is not null then raise exception using errcode='22023', message='Pulizia gia confermata: timer chiuso'; end if;
    if azione='avvia' then
      select * into altro from public.pulizie_timer where avviato_at is not null and chiave<>chiave_t;
      if found then raise exception using errcode='P0047', message='Un altro timer e in corso', detail=altro.chiave; end if;
      if t.chiave is null then
        insert into public.pulizie_timer(chiave, avviato_at, aggiornato_at) values (chiave_t, adesso, adesso);
      elsif t.avviato_at is null then
        update public.pulizie_timer set avviato_at=adesso, versione=versione+1, aggiornato_at=adesso where chiave=chiave_t;
      end if;
    elsif azione='pausa' then
      -- Pausa e «ferma» ripetuti non aggiungono tempo.
      if t.avviato_at is not null then
        update public.pulizie_timer set trascorsi=least(86400, trascorsi + floor(extract(epoch from adesso - avviato_at))::int),
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
    if (p_richiesta->>'data') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_richiesta->>'attivita') not in ('area_comune','corridoio','piegatura')
      or jsonb_typeof(p_richiesta->'minuti') is distinct from 'number' or (p_richiesta->>'minuti') !~ '^[0-9]+$' then
      raise exception using errcode='22023', message='Tempo fuori camera non valido';
    end if;
    giorno := (p_richiesta->>'data')::date; att := p_richiesta->>'attivita'; mins := (p_richiesta->>'minuti')::int;
    if giorno > oggi or giorno < date '2026-01-01' or mins not between 0 and 1440 then raise exception using errcode='22023', message='Tempo fuori camera non valido'; end if;
    select * into f from public.pulizie_fuori_camera where data=giorno and attivita=att for update;
    if f.versione is distinct from nullif(p_richiesta->>'versione','')::bigint then
      raise exception using errcode='P0045', message='Il tempo e cambiato: ricarica';
    end if;
    -- Il timer di quell'attività confluisce nel totale confermato e riparte da zero.
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
    insert into public.pulizie_fuori_camera(data, attivita, minuti, versione, aggiornato_at) values (giorno, att, mins, 1, adesso)
      on conflict (data, attivita) do update set minuti=excluded.minuti, versione=public.pulizie_fuori_camera.versione+1, aggiornato_at=adesso
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
revoke execute on function private.dotazione_da_assetto(jsonb) from public, anon;
revoke execute on function private.assetto_pulito(jsonb) from public, anon;
grant execute on function private.dotazione_da_assetto(jsonb) to authenticated;
grant execute on function private.assetto_pulito(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Verifica: 2 tabelle con RLS e policy; colonne nuove presenti.
select t.tablename, t.rowsecurity as rls_attiva, count(p.policyname) as policy
from pg_tables t left join pg_policies p on p.schemaname=t.schemaname and p.tablename=t.tablename
where t.schemaname='public' and t.tablename in ('pulizie_timer','pulizie_fuori_camera')
group by t.tablename, t.rowsecurity;
