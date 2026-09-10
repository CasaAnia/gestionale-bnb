-- 0049 CONTO UNICO DELLA PRENOTAZIONE — PROPOSTA NON APPLICATA
-- Richiede 0041 (accordo), 0047 (prenotazione_id) e private.is_app_member().
-- Include il contratto idempotente 0033 e lo estende a TUTTE le camere.
-- Nessun incasso inventato: aggiorna soltanto l'identità tecnica dei movimenti
-- già dotati di soggiorno. Nessuna unione dedotta da cliente o date.
-- Prima dell'applicazione: backup, revisione dati e autorizzazione di Ania.
-- I test PGlite provano il SQL sequenziale; la concorrenza PostgreSQL resta
-- un collaudo distinto, da completare prima di usare la proposta in produzione.
begin;
do $$ begin
  if to_regprocedure('private.is_app_member()') is null then raise exception 'Manca protezione membri'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='prenotazione_id') then raise exception 'Manca 0047'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='caparra_centesimi') then raise exception 'Manca 0041'; end if;
  if exists (select group_id from public.bookings where group_id is not null group by group_id having count(distinct coalesce(prenotazione_id,group_id,id))>1) then raise exception 'Gruppo diviso fra prenotazioni: rivedere i dati'; end if;
  if exists (select coalesce(prenotazione_id,group_id,id) from public.bookings group by coalesce(prenotazione_id,group_id,id) having count(distinct guest_id)>1) then raise exception 'Prenotazione divisa fra clienti: rivedere i dati'; end if;
  if exists (select coalesce(prenotazione_id,group_id,id) from public.bookings where caparra_centesimi is not null group by coalesce(prenotazione_id,group_id,id) having count(*)>1) then raise exception 'Piu caparre nella stessa prenotazione: rivedere gli accordi prima di procedere'; end if;
end $$;
alter table public.payments add column if not exists chiave_operazione uuid;
alter table public.payments add column if not exists soggiorno text;
alter table public.payments add column if not exists origine text not null default 'reale';
alter table public.payments drop constraint if exists payments_origine_valida;
alter table public.payments add constraint payments_origine_valida check (origine in ('reale', 'ricostruito'));
create unique index if not exists payments_chiave_operazione_uq on public.payments (chiave_operazione) where chiave_operazione is not null;
create index if not exists payments_soggiorno_idx on public.payments (soggiorno);

-- Identità canonica del soggiorno di una prenotazione (null se non esiste)
create or replace function public.soggiorno_di(p_booking_id uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) from public.bookings b where b.id = p_booking_id
$$;

-- Blocco del soggiorno: lock consultivo di transazione sull'identità e
-- FOR UPDATE deterministico (ordine di id) su tutti i segmenti
create or replace function public.blocca_soggiorno(p_soggiorno text)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_soggiorno));
  perform b.id from public.bookings b
    where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = p_soggiorno
    order by b.id for update;
end;
$$;

-- Metodi che un CLIENT può dichiarare: il metodo «all'arrivo (ricostruito)» lo
-- scrive solo ricostruisci_incassi (difetto 4 del collaudo: un client non deve
-- etichettare come ricostruito un movimento reale)
create or replace function public.metodo_pagamento_valido(p_metodo text)
returns boolean language sql immutable as $$
  select p_metodo in ('contanti', 'bonifico', 'carta', 'altro')
$$;

-- ----------------------------------------------------------------------------
-- segna_pagato: registra il SALDO MANCANTE (ricalcolato qui) e segna pagati
-- tutti i segmenti del soggiorno. Idempotente per chiave.
-- ----------------------------------------------------------------------------
create or replace function public.segna_pagato_prenotazione(
  p_booking_id uuid,
  p_chiave uuid,
  p_metodo text default 'contanti',
  p_paid_on date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_soggiorno   text;
  v_status      text;
  v_totale      numeric := 0;
  v_registrati  numeric := 0;
  v_mancante    numeric := 0;
  v_id          uuid;
  v_esistente   record;
  v_segmenti    int := 0;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if p_chiave is null then raise exception 'CHIAVE_NULLA'; end if;
  if public.metodo_pagamento_valido(p_metodo) is not true then raise exception 'METODO_SCONOSCIUTO'; end if;

  select status into v_status from public.bookings where id = p_booking_id;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  if v_status not in ('confermata', 'completata') then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;

  v_soggiorno := public.soggiorno_di(p_booking_id);
  perform public.blocca_soggiorno(v_soggiorno);
  if not exists (select 1 from public.bookings where id=p_booking_id and status in ('confermata','completata')) then
    raise exception 'PRENOTAZIONE_NON_MODIFICABILE';
  end if;
  if exists(select 1 from public.bookings b where coalesce(b.prenotazione_id::text,b.group_id::text,b.id::text)=v_soggiorno and b.status not in ('annullata','confermata','completata')) then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;

  -- Chiave già usata: stesso soggiorno → idempotente; altro soggiorno → rifiuto senza effetti
  select id, booking_id, amount, method, paid_on, soggiorno into v_esistente from public.payments where chiave_operazione = p_chiave;
  if found then
    if v_esistente.soggiorno is distinct from v_soggiorno then raise exception 'CHIAVE_RIUSATA'; end if;
    v_id := v_esistente.id;
    v_mancante := v_esistente.amount;
  else
    select coalesce(sum(b.total_amount), 0) into v_totale
      from public.bookings b
     where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno and b.status in ('confermata', 'completata');
    select coalesce(sum(p.amount), 0) into v_registrati
      from public.payments p join public.bookings b on b.id = p.booking_id
     where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno;
    v_mancante := v_totale - v_registrati;
    if v_mancante > 0 then
      insert into public.payments (booking_id, amount, method, paid_on, chiave_operazione, soggiorno, origine)
      values (p_booking_id, v_mancante, p_metodo, coalesce(p_paid_on, current_date), p_chiave, v_soggiorno, 'reale')
      returning id into v_id;
    else
      v_mancante := 0;
    end if;
  end if;

  update public.bookings set pagato = true
   where coalesce(prenotazione_id::text, group_id::text, id::text) = v_soggiorno and status in ('confermata', 'completata');
  get diagnostics v_segmenti = row_count;
  if v_segmenti = 0 then raise exception 'NESSUN_SEGMENTO_AGGIORNATO'; end if;

  return pg_catalog.jsonb_build_object('contratto','prenotazione_v1','movimento_id', v_id, 'booking_id', coalesce(v_esistente.booking_id,p_booking_id), 'importo', coalesce(v_mancante, 0), 'pagato', true, 'soggiorno', v_soggiorno, 'segmenti_aggiornati', v_segmenti);
end;
$$;

-- ----------------------------------------------------------------------------
-- registra_acconto: un acconto con importo scelto da Ania, idempotente per chiave (R10)
-- ----------------------------------------------------------------------------
create or replace function public.registra_acconto_prenotazione(
  p_booking_id uuid,
  p_chiave uuid,
  p_amount numeric,
  p_metodo text default 'contanti',
  p_paid_on date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_soggiorno text;
  v_status    text;
  v_esistente record;
  v_id        uuid;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if p_chiave is null then raise exception 'CHIAVE_NULLA'; end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount <> round(p_amount,2) then raise exception 'IMPORTO_NON_VALIDO'; end if;
  if public.metodo_pagamento_valido(p_metodo) is not true then raise exception 'METODO_SCONOSCIUTO'; end if;
  select status into v_status from public.bookings where id = p_booking_id;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  if v_status not in ('confermata', 'completata') then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;
  v_soggiorno := public.soggiorno_di(p_booking_id);
  perform public.blocca_soggiorno(v_soggiorno);
  if not exists (select 1 from public.bookings where id=p_booking_id and status in ('confermata','completata')) then
    raise exception 'PRENOTAZIONE_NON_MODIFICABILE';
  end if;
  if exists(select 1 from public.bookings b where coalesce(b.prenotazione_id::text,b.group_id::text,b.id::text)=v_soggiorno and b.status not in ('annullata','confermata','completata')) then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;
  select id, booking_id, amount, method, paid_on, soggiorno into v_esistente from public.payments where chiave_operazione = p_chiave;
  if found then
    if v_esistente.soggiorno is distinct from v_soggiorno then raise exception 'CHIAVE_RIUSATA'; end if;
    if v_esistente.amount is distinct from p_amount or v_esistente.method is distinct from p_metodo or v_esistente.paid_on is distinct from coalesce(p_paid_on,current_date) then raise exception 'CHIAVE_RIUSATA'; end if;
    return pg_catalog.jsonb_build_object('contratto','prenotazione_v1','movimento_id', v_esistente.id, 'booking_id', v_esistente.booking_id, 'importo', v_esistente.amount, 'soggiorno', v_soggiorno, 'gia_presente', true);
  end if;
  insert into public.payments (booking_id, amount, method, paid_on, chiave_operazione, soggiorno, origine)
  values (p_booking_id, p_amount, p_metodo, coalesce(p_paid_on, current_date), p_chiave, v_soggiorno, 'reale')
  returning id into v_id;
  return pg_catalog.jsonb_build_object('contratto','prenotazione_v1','movimento_id', v_id, 'booking_id', p_booking_id, 'importo', p_amount, 'soggiorno', v_soggiorno, 'gia_presente', false);
end;
$$;

-- ----------------------------------------------------------------------------
-- ricostruisci_incassi: ricostruzione una tantum degli incassi storici (R6/R9).
-- Regola di Ania: ogni soggiorno svolto è stato pagato all'arrivo. Il client
-- manda SOLO identità e chiavi del piano approvato: [{ soggiorno, chiave }].
-- Il server blocca ogni soggiorno, rilegge segmenti e pagamenti, ricalcola il
-- saldo mancante e scrive soltanto quello; controlla che il soggiorno sia
-- concluso (partenza ≤ oggi) e confermato/completato; tutto-o-niente sul
-- batch (un errore annulla la transazione); segna pagati i segmenti.
-- ----------------------------------------------------------------------------
create or replace function public.ricostruisci_incassi(p_piano jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voce       jsonb;
  v_soggiorno  text;
  v_chiave     uuid;
  v_esistente  record;
  v_segmenti   int;
  v_partenza   date;
  v_arrivo     date;
  v_booking    uuid;
  v_totale     numeric;
  v_registrati numeric;
  v_mancante   numeric;
  v_id         uuid;
  v_scritti    int := 0;
  v_saltati    int := 0;
  v_nulla      int := 0;
  v_esiti      jsonb := '[]'::jsonb;
  v_esito      text;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if p_piano is null or pg_catalog.jsonb_typeof(p_piano) <> 'array' then raise exception 'PIANO_NON_VALIDO'; end if;

  for v_voce in select * from pg_catalog.jsonb_array_elements(p_piano) loop
    v_soggiorno := v_voce->>'soggiorno';
    v_chiave := (v_voce->>'chiave')::uuid;
    if v_soggiorno is null or v_chiave is null then raise exception 'VOCE_NON_VALIDA'; end if;
    -- I piani storici del client possono ancora contenere group_id. Risolvi
    -- quella chiave alla prenotazione intera, senza spezzare o duplicare incassi.
    select public.soggiorno_di(b.id) into v_soggiorno from public.bookings b
      where coalesce(b.prenotazione_id::text,b.group_id::text,b.id::text)=v_soggiorno
         or b.group_id::text=v_soggiorno or b.id::text=v_soggiorno
      order by b.id limit 1;
    if v_soggiorno is null then raise exception 'SOGGIORNO_NON_VALIDO'; end if;
    if v_voce->>'soggiorno' <> v_soggiorno and (select count(distinct coalesce(group_id,id)) from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=v_soggiorno)>1 then raise exception 'PIANO_DA_AGGIORNARE: il piano deve comprendere tutte le camere della prenotazione'; end if;

    perform public.blocca_soggiorno(v_soggiorno);

    select count(*), max(b.check_out), min(b.check_in), coalesce(sum(b.total_amount), 0)
      into v_segmenti, v_partenza, v_arrivo, v_totale
      from public.bookings b
     where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno and b.status in ('confermata', 'completata');
    if v_segmenti = 0 then raise exception 'SOGGIORNO_NON_VALIDO %', v_soggiorno; end if;
    if exists(select 1 from public.bookings b where coalesce(b.prenotazione_id::text,b.group_id::text,b.id::text)=v_soggiorno and b.status not in ('annullata','confermata','completata')) then raise exception 'SOGGIORNO_NON_CONCLUSO %',v_soggiorno; end if;
    if v_partenza > current_date then raise exception 'SOGGIORNO_NON_CONCLUSO %', v_soggiorno; end if;
    select b.id into v_booking from public.bookings b
     where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno and b.status in ('confermata', 'completata')
     order by b.check_in, b.id limit 1;

    select id, booking_id, amount, method, paid_on, soggiorno into v_esistente from public.payments where chiave_operazione = v_chiave;
    if found then
      if v_esistente.soggiorno is distinct from v_soggiorno then raise exception 'CHIAVE_RIUSATA %', v_chiave; end if;
      v_saltati := v_saltati + 1; v_esito := 'gia_presente'; v_id := v_esistente.id; v_mancante := v_esistente.amount;
    else
      select coalesce(sum(p.amount), 0) into v_registrati
        from public.payments p join public.bookings b on b.id = p.booking_id
       where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno;
      v_mancante := v_totale - v_registrati;
      if v_mancante > 0 then
        insert into public.payments (booking_id, amount, method, paid_on, chiave_operazione, soggiorno, origine)
        values (v_booking, v_mancante, 'all''arrivo (ricostruito)', v_arrivo, v_chiave, v_soggiorno, 'ricostruito')
        returning id into v_id;
        v_scritti := v_scritti + 1; v_esito := 'scritto';
      else
        v_nulla := v_nulla + 1; v_esito := 'nulla_da_scrivere'; v_id := null; v_mancante := 0;
      end if;
    end if;

    update public.bookings set pagato = true
     where coalesce(prenotazione_id::text, group_id::text, id::text) = v_soggiorno and status in ('confermata', 'completata');

    v_esiti := v_esiti || pg_catalog.jsonb_build_object('soggiorno', v_soggiorno, 'chiave', v_chiave, 'esito', v_esito, 'importo', coalesce(v_mancante, 0), 'movimento_id', v_id);
  end loop;

  return pg_catalog.jsonb_build_object('scritti', v_scritti, 'saltati', v_saltati, 'nulla', v_nulla, 'esiti', v_esiti);
end;
$$;

-- Compatibilità delle vecchie pagine: se mostrano una sola linea di una
-- prenotazione multicamera, si fermano prima di scrivere qualsiasi incasso.
-- Soggiorni vecchi a camera singola/cambio camera continuano a funzionare.
create or replace function public.segna_pagato(p_booking_id uuid, p_chiave uuid, p_metodo text default 'contanti', p_paid_on date default current_date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.is_app_member() is not true then raise exception using errcode='42501',message='Accesso non consentito'; end if;
 if (select count(distinct coalesce(group_id,id)) from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=public.soggiorno_di(p_booking_id))>1 then
   raise exception 'PAGINA_DA_AGGIORNARE: apri la scheda aggiornata per il conto di tutte le camere';
 end if;
 return public.segna_pagato_prenotazione(p_booking_id,p_chiave,p_metodo,p_paid_on);
end $$;
create or replace function public.registra_acconto(p_booking_id uuid, p_chiave uuid, p_amount numeric, p_metodo text default 'contanti', p_paid_on date default current_date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.is_app_member() is not true then raise exception using errcode='42501',message='Accesso non consentito'; end if;
 if (select count(distinct coalesce(group_id,id)) from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=public.soggiorno_di(p_booking_id))>1 then
   raise exception 'PAGINA_DA_AGGIORNARE: apri la scheda aggiornata per il conto di tutte le camere';
 end if;
 return public.registra_acconto_prenotazione(p_booking_id,p_chiave,p_amount,p_metodo,p_paid_on);
end $$;

create or replace function public.salva_accordo_prenotazione(p_booking_id uuid, p_modo text, p_caparra_centesimi bigint default null, p_entro timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_soggiorno text; v_anchor uuid; v_totale numeric; v_righe int;
begin
 if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
 if p_modo is null or p_modo not in ('contanti','bonifico_arrivo','bonifico_intero','caparra_meta','caparra_libera') then raise exception 'ACCORDO_NON_VALIDO'; end if;
 v_soggiorno := public.soggiorno_di(p_booking_id);
 if v_soggiorno is null then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
 perform public.blocca_soggiorno(v_soggiorno);
 select id into v_anchor from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=v_soggiorno and status<>'annullata' order by check_in,id limit 1;
 if v_anchor is null then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;
 select round(sum(total_amount)*100) into v_totale from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=v_soggiorno and status<>'annullata';
 if p_modo in ('caparra_meta','caparra_libera') then
   if p_modo='caparra_meta' then p_caparra_centesimi := round(v_totale/2); end if;
   if p_caparra_centesimi is null or p_caparra_centesimi<=0 or p_caparra_centesimi>v_totale then raise exception 'CAPARRA_NON_VALIDA'; end if;
 else p_caparra_centesimi:=null; p_entro:=null;
 end if;
 -- Le righe annullate possono custodire la vecchia caparra: viene spostata
 -- sull'unico titolare attivo, senza addebitarla di nuovo.
 update public.bookings set accordo_pagamento=p_modo, bonifico=(p_modo<>'contanti'),
   caparra_centesimi=case when id=v_anchor then p_caparra_centesimi else null end,
   caparra_entro=case when id=v_anchor then p_entro else null end
 where coalesce(prenotazione_id::text,group_id::text,id::text)=v_soggiorno;
 get diagnostics v_righe=row_count;
 return jsonb_build_object('contratto','prenotazione_v1','soggiorno',v_soggiorno,'righe',v_righe);
end $$;

update public.payments p set soggiorno=public.soggiorno_di(p.booking_id)
 where p.soggiorno is not null and p.soggiorno is distinct from public.soggiorno_di(p.booking_id);
revoke execute on function public.segna_pagato_prenotazione(uuid,uuid,text,date) from public,anon;
revoke execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date) from public,anon;
revoke execute on function public.salva_accordo_prenotazione(uuid,text,bigint,timestamptz) from public,anon,service_role;
grant execute on function public.segna_pagato_prenotazione(uuid,uuid,text,date) to authenticated;
grant execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date) to authenticated;
grant execute on function public.salva_accordo_prenotazione(uuid,text,bigint,timestamptz) to authenticated;
-- Permessi: niente EXECUTE implicito a PUBLIC. Su Supabase i privilegi
-- PREDEFINITI dello schema public concedono EXECUTE anche ad anon e
-- authenticated: il solo «revoke from public» NON basta (trovato nel
-- collaudo su PostgreSQL 16 con gli stessi default), quindi si revoca
-- esplicitamente da anon; gli helper si revocano a tutti (li usano solo le
-- funzioni security definer, che girano come proprietario).
revoke execute on function public.soggiorno_di(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.blocca_soggiorno(text) from public, anon, authenticated, service_role;
revoke execute on function public.metodo_pagamento_valido(text) from public, anon, authenticated, service_role;
revoke execute on function public.segna_pagato(uuid, uuid, text, date) from public, anon;
revoke execute on function public.registra_acconto(uuid, uuid, numeric, text, date) from public, anon;
revoke execute on function public.ricostruisci_incassi(jsonb) from public, anon;
grant execute on function public.segna_pagato(uuid, uuid, text, date) to authenticated, service_role;
grant execute on function public.registra_acconto(uuid, uuid, numeric, text, date) to authenticated, service_role;
grant execute on function public.ricostruisci_incassi(jsonb) to authenticated, service_role;


commit;
