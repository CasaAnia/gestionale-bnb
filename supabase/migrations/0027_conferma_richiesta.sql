-- ============================================================================
-- 0027 — CONFERMA DI UNA RICHIESTA → PRENOTAZIONE (pezzo 4, 02/09/2026)
-- ============================================================================
-- Da eseguire nell'editor SQL di Supabase sul progetto di PRODUZIONE
-- (tnsaa…vwv). Aggiunge:
--  · richieste.motivo_rifiuto (text, facoltativo, solo per statistiche);
--  · la RPC public.conferma_richiesta(p_richiesta_id, p_rifiuta_anche[]):
--    in UNA transazione legge la richiesta con FOR UPDATE, usa SOLO la
--    soluzione inviata (proposta_soluzione: camere, date, prezzo, letto),
--    ricontrolla notte per notte camera libera e pool letti (2 in tutto)
--    contro le sole prenotazioni confermate/completate, crea l'ospite se
--    manca, crea un booking per segmento (group_id comune), chiude la
--    richiesta come confermata e rifiuta in cascata le richieste indicate.
--    Idempotente: una richiesta già confermata restituisce la prenotazione
--    esistente senza creare nulla. Qualunque errore = rollback totale.
-- Il client chiama SOLO la RPC: nessuna scrittura diretta per la conferma.
--
-- ROLLBACK: drop function public.conferma_richiesta(uuid, uuid[]);
--           alter table public.richieste drop column motivo_rifiuto;

alter table public.richieste add column if not exists motivo_rifiuto text;

create or replace function public.conferma_richiesta(
  p_richiesta_id uuid,
  p_rifiuta_anche uuid[] default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r          public.richieste%rowtype;
  v_segmenti   jsonb;
  v_seg        jsonb;
  v_camera     uuid;
  v_nome_cam   text;
  v_arrivo     date;
  v_partenza   date;
  v_notte      date;
  v_persone    int;
  v_letti_seg  int;
  v_letti_presi int;
  v_tel        text;
  v_nome       text;
  v_guest      uuid;
  v_group      uuid;
  v_primo      uuid;
  v_booking    uuid;
  v_source     text;
  v_dates      jsonb;
  v_mesi       text[] := array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
begin
  -- Solo utenti autenticati del gestionale (l'editor SQL, come postgres, può provarla)
  if auth.uid() is null and session_user <> 'postgres' then
    raise exception 'Non autenticato';
  end if;

  select * into v_r from public.richieste where id = p_richiesta_id for update;
  if not found then
    raise exception 'Richiesta non trovata';
  end if;

  -- Idempotenza: già confermata → la prenotazione esistente, senza creare nulla
  if v_r.stato = 'confermata' then
    if v_r.prenotazione_id is null then
      raise exception 'Richiesta già confermata ma senza prenotazione collegata';
    end if;
    return v_r.prenotazione_id;
  end if;
  if v_r.stato <> 'proposta_inviata' or v_r.proposta_soluzione is null then
    raise exception 'Nessuna proposta inviata';
  end if;

  v_segmenti := v_r.proposta_soluzione -> 'segmenti';
  if v_segmenti is null or pg_catalog.jsonb_typeof(v_segmenti) <> 'array' or pg_catalog.jsonb_array_length(v_segmenti) = 0 then
    raise exception 'La proposta inviata non contiene camere (caso «completo»): niente da confermare';
  end if;
  v_persone := greatest(1, coalesce(v_r.persone, 1));

  -- Una conferma alla volta: due tocchi o due telefoni non creano doppioni
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('conferma_richiesta'));

  -- ── Ricontrollo notte per notte sulla soluzione INVIATA ────────────────────
  for v_seg in select * from pg_catalog.jsonb_array_elements(v_segmenti) loop
    v_camera   := (v_seg -> 'camera' ->> 'id')::uuid;
    v_arrivo   := (v_seg ->> 'arrivo')::date;
    v_partenza := (v_seg ->> 'partenza')::date;
    select r.name into v_nome_cam from public.rooms r where r.id = v_camera;
    if v_nome_cam is null then
      raise exception 'Camera della proposta non trovata';
    end if;
    if v_arrivo is null or v_partenza is null or v_partenza <= v_arrivo then
      raise exception 'Date del segmento non valide (%)', v_nome_cam;
    end if;
    -- Letti del pool impegnati da questo segmento: stessa regola di lib/tariffe
    -- (Amelia parte da 1 posto, le altre da 2; Lena a 3 → 1 letto, a 4 → 2)
    v_letti_seg := case
      when v_nome_cam = 'Lena' then (case when v_persone <= 2 then 0 when v_persone = 3 then 1 else 2 end)
      when v_persone > (case when v_nome_cam = 'Amelia' then 1 else 2 end) then 1
      else 0 end;

    v_notte := v_arrivo;
    while v_notte < v_partenza loop
      if exists (
        select 1 from public.bookings b
        where b.room_id = v_camera and b.status in ('confermata', 'completata')
          and b.check_in <= v_notte and b.check_out > v_notte
      ) then
        raise exception 'Camera % non più disponibile la notte del % %', v_nome_cam, extract(day from v_notte)::int, v_mesi[extract(month from v_notte)::int];
      end if;
      if v_letti_seg > 0 then
        -- letti già presi quella notte dalle confermate (extra_bed_dates, o tutte le notti se extra_bed senza date)
        select coalesce(sum(case when r.name = 'Lena' and b.num_guests >= 4 then 2 else 1 end), 0)
          into v_letti_presi
        from public.bookings b join public.rooms r on r.id = b.room_id
        where b.status in ('confermata', 'completata')
          and (coalesce(b.extra_bed, false) or (b.extra_bed_dates is not null and pg_catalog.jsonb_typeof(b.extra_bed_dates) = 'array' and pg_catalog.jsonb_array_length(b.extra_bed_dates) > 0))
          and (
            (b.extra_bed_dates is not null and pg_catalog.jsonb_typeof(b.extra_bed_dates) = 'array' and pg_catalog.jsonb_array_length(b.extra_bed_dates) > 0
              and b.extra_bed_dates ? to_char(v_notte, 'YYYY-MM-DD'))
            or ((b.extra_bed_dates is null or pg_catalog.jsonb_typeof(b.extra_bed_dates) <> 'array' or pg_catalog.jsonb_array_length(b.extra_bed_dates) = 0)
              and b.check_in <= v_notte and b.check_out > v_notte)
          );
        if v_letti_presi + v_letti_seg > 2 then
          raise exception 'Letti aggiuntivi esauriti la notte del % % (camera %)', extract(day from v_notte)::int, v_mesi[extract(month from v_notte)::int], v_nome_cam;
        end if;
      end if;
      v_notte := v_notte + 1;
    end loop;
  end loop;

  -- ── Ospite: per telefono normalizzato (solo cifre), altrimenti per nome ───
  v_nome := pg_catalog.btrim(coalesce(v_r.nome, '') || ' ' || coalesce(v_r.cognome, ''));
  v_tel  := pg_catalog.regexp_replace(coalesce(v_r.telefono, ''), '\D', '', 'g');
  if v_tel <> '' then
    select g.id into v_guest from public.guests g
    where pg_catalog.regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') = v_tel
    order by g.created_at limit 1;
  else
    select g.id into v_guest from public.guests g
    where lower(pg_catalog.btrim(coalesce(g.full_name, ''))) = lower(v_nome)
    order by g.created_at limit 1;
  end if;
  if v_guest is null then
    if v_tel = '' then
      raise exception 'La richiesta non ha un numero di telefono e non esiste un cliente con questo nome: serve il numero per creare il cliente';
    end if;
    insert into public.guests (phone, full_name) values (v_tel, nullif(v_nome, ''))
    returning id into v_guest;
  end if;

  v_source := case v_r.canale when 'web' then 'sito_web' when 'whatsapp' then 'whatsapp' else 'diretta' end;
  v_group  := pg_catalog.gen_random_uuid();

  -- ── Prenotazioni: una per segmento, come le crea «Nuova prenotazione» ─────
  -- (status confermata, bonifico e pagato falsi, group_id comune, letto extra
  --  su tutte le notti del segmento quando la soluzione lo addebita)
  for v_seg in select * from pg_catalog.jsonb_array_elements(v_segmenti) order by (value ->> 'arrivo') loop
    v_camera   := (v_seg -> 'camera' ->> 'id')::uuid;
    v_arrivo   := (v_seg ->> 'arrivo')::date;
    v_partenza := (v_seg ->> 'partenza')::date;
    select r.name into v_nome_cam from public.rooms r where r.id = v_camera;
    v_letti_seg := case
      when v_nome_cam = 'Lena' then (case when v_persone <= 2 then 0 when v_persone = 3 then 1 else 2 end)
      when v_persone > (case when v_nome_cam = 'Amelia' then 1 else 2 end) then 1
      else 0 end;
    if v_letti_seg > 0 then
      select coalesce(pg_catalog.jsonb_agg(to_char(d, 'YYYY-MM-DD')), '[]'::jsonb) into v_dates
      from pg_catalog.generate_series(v_arrivo, v_partenza - 1, interval '1 day') d;
    else
      v_dates := '[]'::jsonb;
    end if;

    insert into public.bookings (
      room_id, guest_id, check_in, check_out, num_guests,
      extra_bed, extra_bed_dates, price_per_night, extra_bed_total, total_amount,
      status, source, notes, bonifico, pagato, group_id, guest_name
    ) values (
      v_camera, v_guest, v_arrivo, v_partenza, v_persone,
      v_letti_seg > 0, v_dates,
      coalesce((v_seg ->> 'prezzoNotte')::numeric, 0),
      coalesce((v_seg ->> 'lettoTotale')::numeric, 0),
      coalesce((v_seg ->> 'totale')::numeric, 0),
      'confermata', v_source, v_r.note, false, false, v_group, nullif(v_nome, '')
    ) returning id into v_booking;
    if v_primo is null then v_primo := v_booking; end if;
  end loop;

  -- ── Chiusura della richiesta e rifiuti in cascata ─────────────────────────
  update public.richieste
     set stato = 'confermata', chiusa_at = now(), prenotazione_id = v_primo
   where id = p_richiesta_id;

  if p_rifiuta_anche is not null then
    update public.richieste
       set stato = 'rifiutata', chiusa_at = now(), motivo_rifiuto = 'date assegnate a altro cliente'
     where id = any(p_rifiuta_anche)
       and id <> p_richiesta_id
       and stato in ('in_attesa', 'proposta_inviata');
  end if;

  return v_primo;
end;
$$;

revoke all on function public.conferma_richiesta(uuid, uuid[]) from public, anon;
grant execute on function public.conferma_richiesta(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- Verifica: colonna e funzione presenti.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'richieste' and column_name = 'motivo_rifiuto') as colonna_motivo,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'conferma_richiesta') as rpc;
