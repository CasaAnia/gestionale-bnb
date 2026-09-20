-- =====================================================================
-- RIPRISTINO DELLA 0057 (20/09/2026) — da usare SOLO se, dopo
-- l'applicazione, si decide di tornare indietro. Rimette la funzione
-- registra_acconto_prenotazione ESATTAMENTE come nella 0049 applicata il
-- 10/09/2026 (corpo copiato da supabase/migrations/0049_conto_prenotazione.sql),
-- con la firma a cinque parametri e gli stessi permessi.
-- Non tocca dati: nessuna riga di bookings o payments viene modificata.
-- L'app, senza la firma a sette parametri, richiama da sola quella a
-- cinque (rpcMancante → PGRST202): nessun aggiornamento del client serve.
-- =====================================================================
begin;

drop function if exists public.registra_acconto_prenotazione(uuid, uuid, numeric, text, date, numeric, numeric);

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

revoke execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date) from public, anon;
grant execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date) to authenticated;

commit;

-- Dopo il ripristino, come dopo l'applicazione: `notify pgrst, 'reload schema';`
-- e la verifica: select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc where proname = 'registra_acconto_prenotazione';
--   → una riga sola, «p_booking_id uuid, p_chiave uuid, p_amount numeric, p_metodo text, p_paid_on date».
