-- ============================================================================
-- TEST della RPC conferma_richiesta — da eseguire nell'editor SQL DOPO la 0027.
-- Tutto dentro una transazione che finisce con ROLLBACK: non lascia nulla.
-- Se una verifica fallisce, l'errore ferma lo script (e annulla comunque tutto).
-- Usa date nel 2031 per non toccare soggiorni veri.
-- ============================================================================
begin;

do $$
declare
  v_amelia uuid := (select id from public.rooms where name = 'Amelia');
  v_allegra uuid := (select id from public.rooms where name = 'Allegra');
  v_lena uuid := (select id from public.rooms where name = 'Lena');
  v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid;
  v_b1 uuid; v_b1bis uuid; v_n int; v_stato text; v_motivo text; v_pren uuid; v_msg text;
  v_sol jsonb;
begin
  -- R1: proposta inviata, Amelia 10–12 gen 2031, 1 persona
  v_sol := jsonb_build_object('caso', 'completa', 'nottiTotali', 2, 'nottiCoperte', 2, 'nottiMancanti', '[]'::jsonb, 'prezzoTotale', 140,
    'segmenti', jsonb_build_array(jsonb_build_object('camera', jsonb_build_object('id', v_amelia, 'name', 'Amelia'), 'arrivo', '2031-01-10', 'partenza', '2031-01-12', 'notti', 2, 'prezzoNotte', 70, 'lettoTotale', 0, 'totale', 140)));
  insert into public.richieste (nome, cognome, arrivo, partenza, persone, camera_id, canale, telefono, stato, proposta_inviata_at, proposta_testo, proposta_soluzione)
  values ('Test', 'Conferma', '2031-01-10', '2031-01-12', 1, v_amelia, 'telefono', '+39 333 000 9999', 'proposta_inviata', now(), 'bozza', v_sol) returning id into v_r1;
  -- R2: altra richiesta aperta sulle stesse date (da rifiutare in cascata)
  insert into public.richieste (nome, cognome, arrivo, partenza, persone, canale, stato)
  values ('Altro', 'Cliente', '2031-01-11', '2031-01-13', 2, 'web', 'in_attesa') returning id into v_r2;

  -- 1) conferma: crea la prenotazione, chiude R1, rifiuta R2 con motivo
  v_b1 := public.conferma_richiesta(v_r1, array[v_r2]);
  select count(*) into v_n from public.bookings where id = v_b1 and room_id = v_amelia and check_in = '2031-01-10' and check_out = '2031-01-12' and status = 'confermata' and total_amount = 140;
  if v_n <> 1 then raise exception 'TEST 1 FALLITO: prenotazione non creata come atteso'; end if;
  select stato, prenotazione_id into v_stato, v_pren from public.richieste where id = v_r1;
  if v_stato <> 'confermata' or v_pren <> v_b1 then raise exception 'TEST 1 FALLITO: richiesta non chiusa (% %)', v_stato, v_pren; end if;
  select stato, motivo_rifiuto into v_stato, v_motivo from public.richieste where id = v_r2;
  if v_stato <> 'rifiutata' or v_motivo <> 'date assegnate a altro cliente' then raise exception 'TEST 1 FALLITO: cascata (% %)', v_stato, v_motivo; end if;
  if not exists (select 1 from public.guests where regexp_replace(phone, '\D', '', 'g') = '393330009999') then raise exception 'TEST 1 FALLITO: ospite non creato'; end if;

  -- 2) idempotenza: seconda chiamata → stessa prenotazione, nessun doppione
  v_b1bis := public.conferma_richiesta(v_r1, null);
  if v_b1bis <> v_b1 then raise exception 'TEST 2 FALLITO: id diverso alla seconda chiamata'; end if;
  select count(*) into v_n from public.bookings where guest_id = (select guest_id from public.bookings where id = v_b1) and check_in = '2031-01-10';
  if v_n <> 1 then raise exception 'TEST 2 FALLITO: % prenotazioni invece di 1', v_n; end if;

  -- 3) disponibilità persa: R3 su Amelia 11–13 gen (la notte dell'11 è ora occupata da B1) → errore chiaro, nulla scritto
  v_sol := jsonb_build_object('caso', 'completa', 'segmenti', jsonb_build_array(jsonb_build_object('camera', jsonb_build_object('id', v_amelia, 'name', 'Amelia'), 'arrivo', '2031-01-11', 'partenza', '2031-01-13', 'notti', 2, 'prezzoNotte', 70, 'lettoTotale', 0, 'totale', 140)));
  insert into public.richieste (nome, cognome, arrivo, partenza, persone, canale, telefono, stato, proposta_inviata_at, proposta_testo, proposta_soluzione)
  values ('Tardi', 'Arrivato', '2031-01-11', '2031-01-13', 1, 'telefono', '+39 333 000 8888', 'proposta_inviata', now(), 'bozza', v_sol) returning id into v_r3;
  begin
    perform public.conferma_richiesta(v_r3, null);
    raise exception 'TEST 3 FALLITO: la conferma doveva fallire';
  exception when others then
    v_msg := sqlerrm;
    if v_msg not like 'Camera Amelia non più disponibile la notte del 11 gennaio%' then raise exception 'TEST 3 FALLITO: messaggio inatteso: %', v_msg; end if;
  end;
  select stato into v_stato from public.richieste where id = v_r3;
  if v_stato <> 'proposta_inviata' then raise exception 'TEST 3 FALLITO: stato cambiato a %', v_stato; end if;

  -- 4) letti: quadrupla in Lena 20–22 gen (2 letti) → Allegra per 3 persone il 20–21 deve fallire
  insert into public.bookings (room_id, guest_id, check_in, check_out, num_guests, extra_bed, extra_bed_dates, price_per_night, extra_bed_total, total_amount, status, source, group_id)
  values (v_lena, (select guest_id from public.bookings where id = v_b1), '2031-01-20', '2031-01-22', 4, true, '["2031-01-20","2031-01-21"]'::jsonb, 90, 20, 200, 'confermata', 'diretta', gen_random_uuid());
  v_sol := jsonb_build_object('caso', 'completa', 'segmenti', jsonb_build_array(jsonb_build_object('camera', jsonb_build_object('id', v_allegra, 'name', 'Allegra'), 'arrivo', '2031-01-20', 'partenza', '2031-01-21', 'notti', 1, 'prezzoNotte', 80, 'lettoTotale', 10, 'totale', 90)));
  insert into public.richieste (nome, cognome, arrivo, partenza, persone, canale, telefono, stato, proposta_inviata_at, proposta_testo, proposta_soluzione)
  values ('Tre', 'Persone', '2031-01-20', '2031-01-21', 3, 'telefono', '+39 333 000 7777', 'proposta_inviata', now(), 'bozza', v_sol) returning id into v_r4;
  begin
    perform public.conferma_richiesta(v_r4, null);
    raise exception 'TEST 4 FALLITO: doveva fallire per i letti';
  exception when others then
    v_msg := sqlerrm;
    if v_msg not like 'Letti aggiuntivi esauriti%' then raise exception 'TEST 4 FALLITO: messaggio inatteso: %', v_msg; end if;
  end;

  -- 5) senza proposta: richiesta in attesa → «Nessuna proposta inviata»
  begin
    perform public.conferma_richiesta(v_r2, null);
    raise exception 'TEST 5 FALLITO: doveva fallire';
  exception when others then
    if sqlerrm <> 'Nessuna proposta inviata' then raise exception 'TEST 5 FALLITO: messaggio inatteso: %', sqlerrm; end if;
  end;

  raise notice 'TUTTI I TEST SUPERATI (1 conferma+cascata, 2 idempotenza, 3 camera occupata, 4 letti esauriti, 5 senza proposta)';
end $$;

rollback;
