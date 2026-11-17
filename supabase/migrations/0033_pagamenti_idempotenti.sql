-- ============================================================================
-- 0033 — PAGAMENTI IDEMPOTENTI: un solo contratto per tutti i movimenti — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (revisioni Codex di
-- f4d5474 R1/R6 e di 3248064 R8/R9/R10): fuori dalle migrazioni operative,
-- da eseguire a mano nell'editor SQL solo dopo collaudo isolato su un
-- PostgreSQL vero (sessioni concorrenti: scripts/collaudo-0033) e nuova
-- autorizzazione di Ania. Nessuna modifica alle migrazioni 0001–0032.
--
-- CONTRATTO (uguale per saldo, acconto e ricostruzione):
--  - ogni movimento porta una CHIAVE STABILE (chiave_operazione, unica) e
--    l'identità canonica del SOGGIORNO (soggiorno = group_id, altrimenti id
--    della prenotazione): la stessa chiave rifatta sullo stesso soggiorno non
--    scrive nulla e torna il movimento esistente; la stessa chiave su un
--    ALTRO soggiorno → CHIAVE_RIUSATA, zero effetti (R8);
--  - ogni funzione blocca il soggiorno: pg_advisory_xact_lock sull'identità
--    + FOR UPDATE su tutti i segmenti in ordine di id (R8): due chiamate
--    contemporanee da segmenti diversi si mettono in fila e la seconda
--    ricalcola il saldo sui dati già scritti (zero → nulla da scrivere);
--  - il server NON si fida di importi, date o appartenenze del browser:
--    ricalcola dal database (R9); chiave nulla, metodo sconosciuto,
--    prenotazione non confermata/completata → errore, nessun effetto (R8);
--  - EXECUTE revocato a PUBLIC/anon e concesso solo ad authenticated e
--    service_role (R8).
-- ============================================================================

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
  select coalesce(b.group_id::text, b.id::text) from public.bookings b where b.id = p_booking_id
$$;

-- Blocco del soggiorno: lock consultivo di transazione sull'identità e
-- FOR UPDATE deterministico (ordine di id) su tutti i segmenti
create or replace function public.blocca_soggiorno(p_soggiorno text)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_soggiorno));
  perform b.id from public.bookings b
    where coalesce(b.group_id::text, b.id::text) = p_soggiorno
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
create or replace function public.segna_pagato(
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
  if auth.uid() is null and session_user <> 'postgres' then raise exception 'NON_AUTENTICATO'; end if;
  if p_chiave is null then raise exception 'CHIAVE_NULLA'; end if;
  if not public.metodo_pagamento_valido(p_metodo) then raise exception 'METODO_SCONOSCIUTO'; end if;

  select status into v_status from public.bookings where id = p_booking_id;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  if v_status not in ('confermata', 'completata') then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;

  v_soggiorno := public.soggiorno_di(p_booking_id);
  perform public.blocca_soggiorno(v_soggiorno);

  -- Chiave già usata: stesso soggiorno → idempotente; altro soggiorno → rifiuto senza effetti
  select id, amount, soggiorno into v_esistente from public.payments where chiave_operazione = p_chiave;
  if found then
    if v_esistente.soggiorno is distinct from v_soggiorno then raise exception 'CHIAVE_RIUSATA'; end if;
    v_id := v_esistente.id;
    v_mancante := v_esistente.amount;
  else
    select coalesce(sum(b.total_amount), 0) into v_totale
      from public.bookings b
     where coalesce(b.group_id::text, b.id::text) = v_soggiorno and b.status in ('confermata', 'completata');
    select coalesce(sum(p.amount), 0) into v_registrati
      from public.payments p join public.bookings b on b.id = p.booking_id
     where coalesce(b.group_id::text, b.id::text) = v_soggiorno;
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
   where coalesce(group_id::text, id::text) = v_soggiorno and status in ('confermata', 'completata');
  get diagnostics v_segmenti = row_count;
  if v_segmenti = 0 then raise exception 'NESSUN_SEGMENTO_AGGIORNATO'; end if;

  return pg_catalog.jsonb_build_object('movimento_id', v_id, 'importo', coalesce(v_mancante, 0), 'pagato', true, 'soggiorno', v_soggiorno, 'segmenti_aggiornati', v_segmenti);
end;
$$;

-- ----------------------------------------------------------------------------
-- registra_acconto: un acconto con importo scelto da Ania, idempotente per chiave (R10)
-- ----------------------------------------------------------------------------
create or replace function public.registra_acconto(
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
  if auth.uid() is null and session_user <> 'postgres' then raise exception 'NON_AUTENTICATO'; end if;
  if p_chiave is null then raise exception 'CHIAVE_NULLA'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'IMPORTO_NON_VALIDO'; end if;
  if not public.metodo_pagamento_valido(p_metodo) then raise exception 'METODO_SCONOSCIUTO'; end if;
  select status into v_status from public.bookings where id = p_booking_id;
  if not found then raise exception 'PRENOTAZIONE_NON_TROVATA'; end if;
  if v_status not in ('confermata', 'completata') then raise exception 'PRENOTAZIONE_NON_MODIFICABILE'; end if;
  v_soggiorno := public.soggiorno_di(p_booking_id);
  perform public.blocca_soggiorno(v_soggiorno);
  select id, amount, soggiorno into v_esistente from public.payments where chiave_operazione = p_chiave;
  if found then
    if v_esistente.soggiorno is distinct from v_soggiorno then raise exception 'CHIAVE_RIUSATA'; end if;
    return pg_catalog.jsonb_build_object('movimento_id', v_esistente.id, 'importo', v_esistente.amount, 'soggiorno', v_soggiorno, 'gia_presente', true);
  end if;
  insert into public.payments (booking_id, amount, method, paid_on, chiave_operazione, soggiorno, origine)
  values (p_booking_id, p_amount, p_metodo, coalesce(p_paid_on, current_date), p_chiave, v_soggiorno, 'reale')
  returning id into v_id;
  return pg_catalog.jsonb_build_object('movimento_id', v_id, 'importo', p_amount, 'soggiorno', v_soggiorno, 'gia_presente', false);
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
  if auth.uid() is null and session_user <> 'postgres' then raise exception 'NON_AUTENTICATO'; end if;
  if p_piano is null or pg_catalog.jsonb_typeof(p_piano) <> 'array' then raise exception 'PIANO_NON_VALIDO'; end if;

  for v_voce in select * from pg_catalog.jsonb_array_elements(p_piano) loop
    v_soggiorno := v_voce->>'soggiorno';
    v_chiave := (v_voce->>'chiave')::uuid;
    if v_soggiorno is null or v_chiave is null then raise exception 'VOCE_NON_VALIDA'; end if;

    perform public.blocca_soggiorno(v_soggiorno);

    select count(*), max(b.check_out), min(b.check_in), coalesce(sum(b.total_amount), 0)
      into v_segmenti, v_partenza, v_arrivo, v_totale
      from public.bookings b
     where coalesce(b.group_id::text, b.id::text) = v_soggiorno and b.status in ('confermata', 'completata');
    if v_segmenti = 0 then raise exception 'SOGGIORNO_NON_VALIDO %', v_soggiorno; end if;
    if v_partenza > current_date then raise exception 'SOGGIORNO_NON_CONCLUSO %', v_soggiorno; end if;
    select b.id into v_booking from public.bookings b
     where coalesce(b.group_id::text, b.id::text) = v_soggiorno and b.status in ('confermata', 'completata')
     order by b.check_in, b.id limit 1;

    select id, amount, soggiorno into v_esistente from public.payments where chiave_operazione = v_chiave;
    if found then
      if v_esistente.soggiorno is distinct from v_soggiorno then raise exception 'CHIAVE_RIUSATA %', v_chiave; end if;
      v_saltati := v_saltati + 1; v_esito := 'gia_presente'; v_id := v_esistente.id; v_mancante := v_esistente.amount;
    else
      select coalesce(sum(p.amount), 0) into v_registrati
        from public.payments p join public.bookings b on b.id = p.booking_id
       where coalesce(b.group_id::text, b.id::text) = v_soggiorno;
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
     where coalesce(group_id::text, id::text) = v_soggiorno and status in ('confermata', 'completata');

    v_esiti := v_esiti || pg_catalog.jsonb_build_object('soggiorno', v_soggiorno, 'chiave', v_chiave, 'esito', v_esito, 'importo', coalesce(v_mancante, 0), 'movimento_id', v_id);
  end loop;

  return pg_catalog.jsonb_build_object('scritti', v_scritti, 'saltati', v_saltati, 'nulla', v_nulla, 'esiti', v_esiti);
end;
$$;

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
