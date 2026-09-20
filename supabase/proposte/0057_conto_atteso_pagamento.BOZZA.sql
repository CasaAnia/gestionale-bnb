-- =====================================================================
-- IL CONTO ATTESO NEL PAGAMENTO (20/09/2026 sera) — proposta 0057
-- PROPOSTA NON APPLICATA. Richiede la 0049 applicata (registra_acconto_prenotazione).
--
-- IL PROBLEMA. Il foglio «Aggiungi pagamento» mostra «Resta da incassare
-- 800 €» e propone il saldo di 800 €. Se nel frattempo un altro telefono
-- cambia il totale (sconto, notti) o registra un incasso, il foglio rilegge
-- il conto PRIMA di scrivere e si ferma — ma fra quella rilettura e la
-- scrittura resta una finestra: il server accetta l'importo così com'è e
-- il saldo registrato non corrisponde più al conto. La rilettura lato
-- client non basta: il controllo deve stare dentro la transazione, sotto lo
-- stesso blocco del soggiorno (blocca_soggiorno) che protegge già la 0049.
--
-- LA SOLUZIONE. registra_acconto_prenotazione prende due parametri in più,
-- facoltativi: il totale e il ricevuto che il foglio stava mostrando
-- (p_totale_atteso, p_ricevuti_attesi, in euro). Dentro il blocco la
-- funzione ricalcola totale (camere confermate/completate del soggiorno) e
-- ricevuto (movimenti di tutte le righe del soggiorno, annullate comprese:
-- lo stesso conto di contoPrenotazione) e, se uno dei due è diverso da
-- quello atteso, si ferma con CONTO_CAMBIATO senza scrivere niente. Il
-- foglio allora rilegge, aggiorna le cifre e chiede di ricontrollare.
--
-- Senza i due parametri la funzione fa esattamente quello che fa oggi (le
-- pagine vecchie e il wrapper registra_acconto continuano a funzionare).
-- La chiave idempotente viene PRIMA del controllo: un tentativo ripetuto
-- dopo una risposta persa ritrova il suo movimento anche se nel frattempo
-- il conto è cambiato proprio per quel movimento.
--
-- Non si può fare «create or replace» con una firma diversa: nascerebbe
-- una seconda funzione e le chiamate a cinque argomenti diventerebbero
-- ambigue. Perciò si toglie la vecchia firma e si ricrea con i due
-- parametri in più (default null): tutto in una transazione.
-- =====================================================================

begin;

drop function if exists public.registra_acconto_prenotazione(uuid, uuid, numeric, text, date);

create or replace function public.registra_acconto_prenotazione(
  p_booking_id uuid,
  p_chiave uuid,
  p_amount numeric,
  p_metodo text default 'contanti',
  p_paid_on date default current_date,
  p_totale_atteso numeric default null,
  p_ricevuti_attesi numeric default null
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
  v_totale    numeric;
  v_ricevuti  numeric;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if p_chiave is null then raise exception 'CHIAVE_NULLA'; end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount <> round(p_amount,2) then raise exception 'IMPORTO_NON_VALIDO'; end if;
  if public.metodo_pagamento_valido(p_metodo) is not true then raise exception 'METODO_SCONOSCIUTO'; end if;
  if (p_totale_atteso is null) <> (p_ricevuti_attesi is null) then raise exception 'CONTO_ATTESO_INCOMPLETO'; end if;
  if p_totale_atteso is not null and (p_totale_atteso < 0 or p_ricevuti_attesi < 0 or p_totale_atteso::text in ('NaN','Infinity','-Infinity') or p_ricevuti_attesi::text in ('NaN','Infinity','-Infinity')) then raise exception 'CONTO_ATTESO_NON_VALIDO'; end if;
  select status into v_status from public.bookings where id = p_booking_id;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  if v_status not in ('confermata', 'completata') then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;
  v_soggiorno := public.soggiorno_di(p_booking_id);
  perform public.blocca_soggiorno(v_soggiorno);
  if not exists (select 1 from public.bookings where id=p_booking_id and status in ('confermata','completata')) then
    raise exception 'PRENOTAZIONE_NON_MODIFICABILE';
  end if;
  if exists(select 1 from public.bookings b where coalesce(b.prenotazione_id::text,b.group_id::text,b.id::text)=v_soggiorno and b.status not in ('annullata','confermata','completata')) then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;
  -- la chiave già usata torna il suo movimento, PRIMA del controllo del conto
  select id, booking_id, amount, method, paid_on, soggiorno into v_esistente from public.payments where chiave_operazione = p_chiave;
  if found then
    if v_esistente.soggiorno is distinct from v_soggiorno then raise exception 'CHIAVE_RIUSATA'; end if;
    if v_esistente.amount is distinct from p_amount or v_esistente.method is distinct from p_metodo or v_esistente.paid_on is distinct from coalesce(p_paid_on,current_date) then raise exception 'CHIAVE_RIUSATA'; end if;
    return pg_catalog.jsonb_build_object('contratto','prenotazione_v1','movimento_id', v_esistente.id, 'booking_id', v_esistente.booking_id, 'importo', v_esistente.amount, 'soggiorno', v_soggiorno, 'gia_presente', true);
  end if;
  -- il conto com'è ADESSO, sotto il blocco: lo stesso di contoPrenotazione
  if p_totale_atteso is not null then
    select coalesce(sum(b.total_amount), 0) into v_totale
      from public.bookings b
      where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno and b.status in ('confermata', 'completata');
    select coalesce(sum(p.amount), 0) into v_ricevuti
      from public.payments p
      where p.booking_id in (select b.id from public.bookings b where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno);
    if v_totale <> p_totale_atteso or v_ricevuti <> p_ricevuti_attesi then
      raise exception using
        errcode = 'P0001',
        message = 'CONTO_CAMBIATO',
        detail = pg_catalog.jsonb_build_object('totale', v_totale, 'ricevuti', v_ricevuti, 'totale_atteso', p_totale_atteso, 'ricevuti_attesi', p_ricevuti_attesi)::text;
    end if;
  end if;
  insert into public.payments (booking_id, amount, method, paid_on, chiave_operazione, soggiorno, origine)
  values (p_booking_id, p_amount, p_metodo, coalesce(p_paid_on, current_date), p_chiave, v_soggiorno, 'reale')
  returning id into v_id;
  return pg_catalog.jsonb_build_object('contratto','prenotazione_v1','movimento_id', v_id, 'booking_id', p_booking_id, 'importo', p_amount, 'soggiorno', v_soggiorno, 'gia_presente', false);
end;
$$;

-- Permessi come nella 0049: niente anon, solo chi è autenticato (e il
-- wrapper registra_acconto, security definer, continua a chiamarla).
revoke execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric) from public, anon;
grant execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric) to authenticated;

commit;

-- PROVE PRIMA DELL'APPLICAZIONE (lib/contoAttesoSql.test.ts, PGlite, SQL
-- sequenziale): conto uguale → scrive; totale cambiato → CONTO_CAMBIATO e
-- niente scritto; incasso cambiato → CONTO_CAMBIATO; chiave ripetuta dopo
-- il cambiamento → ritrova il movimento; senza i parametri → come oggi;
-- un solo parametro → CONTO_ATTESO_INCOMPLETO; anon senza EXECUTE. Resta
-- da fare, come per la 0049, il collaudo concorrente su PostgreSQL vero
-- (due backend, uno cambia il totale mentre l'altro salda) prima
-- dell'applicazione: la 0057 senza quel collaudo NON chiude il punto 5.
