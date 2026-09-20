-- =====================================================================
-- RIPRISTINO DELLA 0057 (20/09/2026) — da usare SOLO se, dopo
-- l'applicazione, si decide di tornare indietro. Rimette le quattro
-- funzioni ESATTAMENTE come nella 0049 applicata il 10/09/2026 (corpi
-- copiati da supabase/migrations/0049_conto_prenotazione.sql), con le
-- firme di allora e gli stessi permessi, e toglie il trigger.
-- Non tocca dati: nessuna riga di bookings o payments viene modificata.
-- L'app, senza le firme nuove, richiama da sola quelle vecchie
-- (rpcMancante → PGRST202): nessun aggiornamento del client serve.
-- =====================================================================
begin;

drop trigger if exists bookings_blocca_soggiorno on public.bookings;
drop function if exists public.bookings_blocca_soggiorno();
drop function if exists public.registra_acconto_prenotazione(uuid, uuid, numeric, text, date, numeric, numeric);
drop function if exists public.registra_acconto(uuid, uuid, numeric, text, date, numeric, numeric);
drop function if exists public.segna_pagato_prenotazione(uuid, uuid, text, date, numeric);
drop function if exists public.segna_pagato(uuid, uuid, text, date, numeric);

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

revoke execute on function public.segna_pagato_prenotazione(uuid,uuid,text,date) from public, anon;
grant execute on function public.segna_pagato_prenotazione(uuid,uuid,text,date) to authenticated;
revoke execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date) from public, anon;
grant execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date) to authenticated;
revoke execute on function public.segna_pagato(uuid, uuid, text, date) from public, anon;
revoke execute on function public.registra_acconto(uuid, uuid, numeric, text, date) from public, anon;
grant execute on function public.segna_pagato(uuid, uuid, text, date) to authenticated, service_role;
grant execute on function public.registra_acconto(uuid, uuid, numeric, text, date) to authenticated, service_role;

commit;

-- Dopo il ripristino, come dopo l'applicazione: `notify pgrst, 'reload schema';`
-- Verifica: select proname, pg_get_function_identity_arguments(oid) from pg_proc
--   where proname in ('registra_acconto_prenotazione','registra_acconto','segna_pagato_prenotazione','segna_pagato')
--   → quattro righe, le firme della 0049; nessun trigger bookings_blocca_soggiorno.
