-- Mancato arrivo: prezzo originale intatto, credito del 50%, notti libere.
-- Nessun dato storico convertito. Applicare solo dopo backup e autorizzazione.
begin;
alter table public.bookings add column if not exists mancato_arrivo_centesimi bigint;
alter table public.bookings add constraint mancato_arrivo_importo_valido check
  (mancato_arrivo_centesimi is null or (status='annullata' and mancato_arrivo_centesimi >= 0));
create table public.mancato_arrivo_operazioni (
  id uuid primary key, richiesta jsonb not null, risposta jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.mancato_arrivo_operazioni enable row level security;
revoke all on public.mancato_arrivo_operazioni from public, anon, authenticated;
create policy membri_lettura on public.mancato_arrivo_operazioni for select to authenticated using (private.is_app_member());
grant select on public.mancato_arrivo_operazioni to authenticated;

create or replace function public.gestisci_mancato_arrivo(p_operazione uuid,p_richiesta jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  b public.bookings%rowtype; k text; ids uuid[]; foto jsonb; totale bigint; dovuto bigint; ricevuto bigint;
  risposta jsonb; precedente public.mancato_arrivo_operazioni%rowtype; movimento uuid; importo bigint;
  azione text := p_richiesta->>'azione'; adesso timestamptz := clock_timestamp(); giorno date := (now() at time zone 'Europe/Rome')::date;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501',message='Accesso non consentito'; end if;
  if p_operazione is null then raise exception 'Operazione mancante'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_operazione::text));
  select * into precedente from public.mancato_arrivo_operazioni where id=p_operazione;
  if found then
    if precedente.richiesta is distinct from p_richiesta then raise exception 'Chiave operazione riutilizzata'; end if;
    return precedente.risposta;
  end if;
  select * into b from public.bookings where id=(p_richiesta->>'booking_id')::uuid;
  if not found then raise exception 'Prenotazione non trovata'; end if;
  k := public.soggiorno_di(b.id);
  perform public.blocca_soggiorno(k);
  select array_agg(id order by id) into ids from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=k;
  select coalesce(round(sum(amount)*100),0)::bigint into ricevuto from public.payments where booking_id=any(ids);
  if ricevuto is distinct from (p_richiesta->>'ricevuto')::bigint then raise exception using errcode='P0060',message='Gli incassi sono cambiati: ricarica e controlla'; end if;
  if azione='segna' then
    select jsonb_agg(jsonb_build_object('id',id,'status',status,'room_id',room_id,'guest_id',guest_id,'check_in',check_in,'check_out',check_out,'totale',round(total_amount*100)::bigint) order by id),round(sum(total_amount)*100)::bigint
      into foto,totale from public.bookings where id=any(ids) and status<>'annullata';
    if foto is null or foto is distinct from p_richiesta->'righe' then raise exception using errcode='P0060',message='La prenotazione è cambiata: ricarica e controlla'; end if;
    if exists(select 1 from public.bookings where id=any(ids) and status<>'annullata' and (status<>'confermata' or total_amount is null or total_amount<0))
      or (select min(check_in) from public.bookings where id=any(ids) and status<>'annullata')>giorno then raise exception 'Il mancato arrivo si registra dal giorno previsto, per una prenotazione confermata'; end if;
    if exists(select 1 from public.cleanings where booking_id=any(ids) and stato='fatta') then raise exception 'Sono presenti pulizie registrate per questo soggiorno: controllare prima di segnare il mancato arrivo'; end if;
    if exists(select 1 from public.pulizie_timer where split_part(chiave,':',2)=any(ids::text[]) and (avviato_at is not null or trascorsi>0)) then raise exception 'Sono presenti tempi di pulizia per questo soggiorno: controllare prima'; end if;
    dovuto := round(totale::numeric/2)::bigint;
    -- Differenze fra cumulati arrotondati: la somma è esattamente metà del conto.
    with quote as (
      select id, round(total_amount*100)::bigint c, sum(round(total_amount*100)::bigint) over(order by id) cumulato
      from public.bookings where id=any(ids) and status<>'annullata'
    ) update public.bookings r set status='annullata', cancelled_at=adesso,
      cancelled_reason='Non si è presentata',
      mancato_arrivo_centesimi=round(q.cumulato/2)-round((q.cumulato-q.c)/2), pagato=(ricevuto>=dovuto)
      from quote q where r.id=q.id;
  elsif azione='incassa' then
    if exists(select 1 from public.bookings where id=any(ids) and status<>'annullata') or not exists(select 1 from public.bookings where id=any(ids) and mancato_arrivo_centesimi is not null) then raise exception 'Non è un mancato arrivo'; end if;
    select sum(mancato_arrivo_centesimi) into dovuto from public.bookings where id=any(ids);
    if dovuto is distinct from (p_richiesta->>'dovuto')::bigint then raise exception using errcode='P0060',message='Il dovuto è cambiato: ricarica e controlla'; end if;
    importo := (p_richiesta->>'importo')::bigint;
    if importo is null or importo<=0 or importo>dovuto-ricevuto then raise exception 'Importo non valido o superiore al residuo'; end if;
    if coalesce(p_richiesta->>'metodo','') not in ('contanti','bonifico') or nullif(p_richiesta->>'data','') is null or (p_richiesta->>'data')::date>giorno then raise exception 'Metodo o data non validi'; end if;
    insert into public.payments(booking_id,amount,method,paid_on,chiave_operazione,soggiorno,origine,note)
      values(b.id,importo::numeric/100,p_richiesta->>'metodo',(p_richiesta->>'data')::date,p_operazione,k,'reale','Mancato arrivo') returning id into movimento;
    ricevuto:=ricevuto+importo;
    update public.bookings set pagato=(ricevuto>=dovuto) where id=any(ids) and mancato_arrivo_centesimi is not null;
  else raise exception 'Azione non valida'; end if;
  select jsonb_build_object('righe',(select jsonb_agg(to_jsonb(r) order by id) from public.bookings r where id=any(ids)),
    'dovuto',dovuto,'ricevuto',ricevuto,'movimento_id',movimento) into risposta;
  insert into public.mancato_arrivo_operazioni(id,richiesta,risposta) values(p_operazione,p_richiesta,risposta);
  return risposta;
end $$;
revoke all on function public.gestisci_mancato_arrivo(uuid,jsonb) from public,anon;
grant execute on function public.gestisci_mancato_arrivo(uuid,jsonb) to authenticated;
commit;
