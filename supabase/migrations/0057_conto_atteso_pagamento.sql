-- =====================================================================
-- IL CONTO ATTESO NEL PAGAMENTO (20/09/2026 sera) — migrazione 0057
-- APPLICATA sul database di produzione il 21/09/2026, in una transazione
-- unica, con backup verificato e autorizzazione di Ania. Richiede la 0049
-- (registra_acconto_prenotazione). Per tornare indietro:
-- supabase/proposte/0057_RIPRISTINO.BOZZA.sql. Riscontro dell'applicazione:
-- RISCONTRO-PRODUZIONE-0057.md nella cartella della consegna.
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
-- COSA PUÒ CAMBIARE TOTALE E RICEVUTO, E COME SI INCASTRA COL BLOCCO
-- (rivisto il 20/09/2026 sera):
--   totale  ← UPDATE bookings.total_amount (sconto, notti, letto: PATCH
--             riga per riga dalle schede), UPDATE status='annullata'
--             (annullamento), INSERT bookings con prenotazione_id (camera
--             aggiunta), sposta_notti (proposta 0053, non applicata).
--   ricevuto ← registra_acconto[_prenotazione], segna_pagato[_prenotazione],
--             ricostruisci_incassi (tutte sotto blocca_soggiorno),
--             DELETE payments diretto («togli pagamento»), INSERT payments
--             diretto (solo il ripiego delle pagine senza la 0033/0049).
-- blocca_soggiorno = lock consultivo di transazione + FOR UPDATE su tutte
-- le righe bookings del soggiorno. Un UPDATE/annullamento su quelle righe
-- o finisce PRIMA (e il conto qui lo vede) o ASPETTA la nostra transazione
-- (e allora è una modifica successiva al pagamento, legittima). Le funzioni
-- dei pagamenti si mettono in fila sul lock consultivo. Un INSERT di una
-- camera nuova non è bloccabile da un lock di riga: se arriva dopo il
-- nostro conto è, di nuovo, una modifica successiva. Resta il DELETE
-- diretto di «togli pagamento», che non prende il lock consultivo: per
-- questo qui si bloccano anche le righe payments del soggiorno (FOR
-- UPDATE): un DELETE in corso ci fa aspettare, un DELETE che arriva dopo
-- aspetta noi. Attenzione: «togli» cancella il movimento e POI aggiorna
-- bookings.pagato (ordine inverso al nostro): nel caso limite Postgres
-- rileva lo stallo e annulla una delle due transazioni (40P01) — niente
-- scritto a metà, l'app dice «riprova». Chiudere anche questo vuol dire
-- portare «togli pagamento» dentro una funzione col blocco (proposta a parte).
--
-- IN PIÙ, DALLA VERIFICA DEL 20/09/2026 NOTTE (rilievi 1 e 2):
--   a) anche il wrapper registra_acconto (prenotazioni senza prenotazione_id:
--      singole o legate da group_id) prende e passa le due cifre attese;
--   b) «Aggiungi camera» su una prenotazione vecchia prima scrive
--      prenotazione_id su tutte le righe (l'identità del soggiorno CAMBIA,
--      e con lei la chiave del blocco): dopo il blocco si rilegge l'identità
--      e, se è cambiata, ci si blocca di nuovo su quella nuova; una chiave
--      già usata si riconosce anche se il suo movimento porta l'identità
--      vecchia (la riga sta comunque in questo soggiorno);
--   c) segna_pagato_prenotazione ricalcola il mancante sul server e lo
--      SCRIVE come incasso: una camera aggiunta fra l'acconto e il bollino
--      farebbe nascere un movimento inventato. Prende p_mancante_atteso
--      (l'app passa 0: chiama il bollino solo quando il conto è coperto) e
--      con un mancante diverso si ferma con CONTO_CAMBIATO, senza movimento
--      e senza bollino; il wrapper segna_pagato lo passa;
--   d) un trigger BEFORE INSERT su bookings prende il lock consultivo del
--      soggiorno della riga nuova: una camera in arrivo aspetta il pagamento
--      in corso (o viceversa), così il conto sotto blocco la vede o non la
--      vede per intero, mai a metà. Vale per ogni inserimento (nuova
--      prenotazione compresa: lì il lock è sulla sua sola identità).
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

-- Le firme vecchie: via, altrimenti le chiamate a 4/5 argomenti diventano ambigue
drop function if exists public.registra_acconto_prenotazione(uuid, uuid, numeric, text, date);
drop function if exists public.registra_acconto(uuid, uuid, numeric, text, date);
drop function if exists public.segna_pagato_prenotazione(uuid, uuid, text, date);
drop function if exists public.segna_pagato(uuid, uuid, text, date);

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
  v_identita  text;
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
  -- l'identità può essere cambiata mentre aspettavamo (Aggiungi camera su
  -- una prenotazione vecchia scrive prenotazione_id): si rilegge sotto lock
  v_identita := public.soggiorno_di(p_booking_id);
  if v_identita is distinct from v_soggiorno then
    v_soggiorno := v_identita;
    perform public.blocca_soggiorno(v_soggiorno);
  end if;
  -- con le cifre attese si bloccano anche i MOVIMENTI del soggiorno: un
  -- «togli pagamento» (DELETE diretto, senza lock consultivo) in corso deve
  -- finire prima del nostro conto, o aspettare dopo
  if p_totale_atteso is not null then
    perform p.id from public.payments p
      where p.booking_id in (select b.id from public.bookings b where coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno)
      order by p.id for update;
  end if;
  if not exists (select 1 from public.bookings where id=p_booking_id and status in ('confermata','completata')) then
    raise exception 'PRENOTAZIONE_NON_MODIFICABILE';
  end if;
  if exists(select 1 from public.bookings b where coalesce(b.prenotazione_id::text,b.group_id::text,b.id::text)=v_soggiorno and b.status not in ('annullata','confermata','completata')) then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;
  select id, booking_id, amount, method, paid_on, soggiorno into v_esistente from public.payments where chiave_operazione = p_chiave;
  if found then
    -- stesso soggiorno, anche se il movimento porta ancora l'identità vecchia
    if v_esistente.soggiorno is distinct from v_soggiorno
       and not exists (select 1 from public.bookings b where b.id = v_esistente.booking_id and coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno)
    then raise exception 'CHIAVE_RIUSATA'; end if;
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

create or replace function public.segna_pagato_prenotazione(
  p_booking_id uuid,
  p_chiave uuid,
  p_metodo text default 'contanti',
  p_paid_on date default current_date,
  p_mancante_atteso numeric default null
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
  v_identita    text;
begin
  if private.is_app_member() is not true then raise exception using errcode='42501', message='Accesso non consentito'; end if;
  if p_chiave is null then raise exception 'CHIAVE_NULLA'; end if;
  if public.metodo_pagamento_valido(p_metodo) is not true then raise exception 'METODO_SCONOSCIUTO'; end if;
  if p_mancante_atteso is not null and (p_mancante_atteso < 0 or p_mancante_atteso::text in ('NaN','Infinity','-Infinity')) then raise exception 'CONTO_ATTESO_NON_VALIDO'; end if;

  select status into v_status from public.bookings where id = p_booking_id;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  if v_status not in ('confermata', 'completata') then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;

  v_soggiorno := public.soggiorno_di(p_booking_id);
  perform public.blocca_soggiorno(v_soggiorno);
  -- l'identità può essere cambiata mentre aspettavamo (Aggiungi camera su
  -- una prenotazione vecchia scrive prenotazione_id): si rilegge sotto lock
  v_identita := public.soggiorno_di(p_booking_id);
  if v_identita is distinct from v_soggiorno then
    v_soggiorno := v_identita;
    perform public.blocca_soggiorno(v_soggiorno);
  end if;
  if not exists (select 1 from public.bookings where id=p_booking_id and status in ('confermata','completata')) then
    raise exception 'PRENOTAZIONE_NON_MODIFICABILE';
  end if;
  if exists(select 1 from public.bookings b where coalesce(b.prenotazione_id::text,b.group_id::text,b.id::text)=v_soggiorno and b.status not in ('annullata','confermata','completata')) then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;

  -- Chiave già usata: stesso soggiorno → idempotente; altro soggiorno → rifiuto senza effetti
  select id, booking_id, amount, method, paid_on, soggiorno into v_esistente from public.payments where chiave_operazione = p_chiave;
  if found then
    -- stesso soggiorno, anche se il movimento porta ancora l'identità vecchia
    if v_esistente.soggiorno is distinct from v_soggiorno
       and not exists (select 1 from public.bookings b where b.id = v_esistente.booking_id and coalesce(b.prenotazione_id::text, b.group_id::text, b.id::text) = v_soggiorno)
    then raise exception 'CHIAVE_RIUSATA'; end if;
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
    -- il mancante che l'app si aspettava (0: il conto era coperto): se nel
    -- frattempo è cambiato (camera aggiunta, movimento tolto) niente
    -- movimento inventato e niente bollino
    if p_mancante_atteso is not null and greatest(v_mancante, 0) <> p_mancante_atteso then
      raise exception using
        errcode = 'P0001',
        message = 'CONTO_CAMBIATO',
        detail = pg_catalog.jsonb_build_object('totale', v_totale, 'ricevuti', v_registrati, 'mancante', greatest(v_mancante, 0), 'mancante_atteso', p_mancante_atteso)::text;
    end if;
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

create or replace function public.registra_acconto(p_booking_id uuid, p_chiave uuid, p_amount numeric, p_metodo text default 'contanti', p_paid_on date default current_date, p_totale_atteso numeric default null, p_ricevuti_attesi numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.is_app_member() is not true then raise exception using errcode='42501',message='Accesso non consentito'; end if;
 if (select count(distinct coalesce(group_id,id)) from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=public.soggiorno_di(p_booking_id))>1 then
   raise exception 'PAGINA_DA_AGGIORNARE: apri la scheda aggiornata per il conto di tutte le camere';
 end if;
 return public.registra_acconto_prenotazione(p_booking_id,p_chiave,p_amount,p_metodo,p_paid_on,p_totale_atteso,p_ricevuti_attesi);
end $$;

create or replace function public.segna_pagato(p_booking_id uuid, p_chiave uuid, p_metodo text default 'contanti', p_paid_on date default current_date, p_mancante_atteso numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.is_app_member() is not true then raise exception using errcode='42501',message='Accesso non consentito'; end if;
 if (select count(distinct coalesce(group_id,id)) from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=public.soggiorno_di(p_booking_id))>1 then
   raise exception 'PAGINA_DA_AGGIORNARE: apri la scheda aggiornata per il conto di tutte le camere';
 end if;
 return public.segna_pagato_prenotazione(p_booking_id,p_chiave,p_metodo,p_paid_on,p_mancante_atteso);
end $$;

-- Una camera in arrivo si mette in fila col pagamento in corso (e viceversa)
create or replace function public.bookings_blocca_soggiorno()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(coalesce(new.prenotazione_id::text, new.group_id::text, new.id::text)));
  return new;
end;
$$;
drop trigger if exists bookings_blocca_soggiorno on public.bookings;
create trigger bookings_blocca_soggiorno before insert on public.bookings
  for each row execute function public.bookings_blocca_soggiorno();

-- Permessi come nella 0049: niente anon; i wrapper anche a service_role
revoke execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric) from public, anon;
grant execute on function public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric) to authenticated;
revoke execute on function public.segna_pagato_prenotazione(uuid,uuid,text,date,numeric) from public, anon;
grant execute on function public.segna_pagato_prenotazione(uuid,uuid,text,date,numeric) to authenticated;
revoke execute on function public.registra_acconto(uuid,uuid,numeric,text,date,numeric,numeric) from public, anon;
grant execute on function public.registra_acconto(uuid,uuid,numeric,text,date,numeric,numeric) to authenticated, service_role;
revoke execute on function public.segna_pagato(uuid,uuid,text,date,numeric) from public, anon;
grant execute on function public.segna_pagato(uuid,uuid,text,date,numeric) to authenticated, service_role;
revoke execute on function public.bookings_blocca_soggiorno() from public, anon, authenticated, service_role;

commit;

-- PROVE PRIMA DELL'APPLICAZIONE: lib/contoAttesoSql.test.ts (PGlite, SQL
-- sequenziale) e scripts/revisioni/collaudo-0057-concorrenza.mjs (due
-- connessioni su PostgreSQL vero: eseguito in LOCALE su 16.15). Resta da
-- fare lo stesso collaudo sul PostgreSQL di Supabase (progetto di prova) e
-- l'applicazione con backup: la 0057 senza quel collaudo NON chiude il punto 5.
