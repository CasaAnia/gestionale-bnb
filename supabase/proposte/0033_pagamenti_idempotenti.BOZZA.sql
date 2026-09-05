-- ============================================================================
-- 0033 — PAGAMENTI IDEMPOTENTI: «Segna come pagato» atomico — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (revisione Codex di
-- f4d5474, rilievo R1): NON è nel percorso delle migrazioni operative e va
-- eseguita a mano nell'editor SQL solo dopo l'autorizzazione di Ania, prima
-- in un ambiente isolato. Nessuna modifica alle migrazioni 0001–0032.
--
-- PROBLEMA: il gestionale inserisce il saldo in payments e poi aggiorna
-- bookings.pagato. Se il server esegue l'INSERT ma la risposta si perde,
-- un secondo tocco potrebbe creare un secondo movimento. Il client oggi si
-- protegge rileggendo i pagamenti prima di ogni tentativo
-- (lib/statistiche/pagato.eseguiSegnaPagato); questa RPC rende l'operazione
-- atomica e idempotente anche lato database, con una CHIAVE STABILE per
-- movimento: due chiamate con la stessa chiave scrivono un solo movimento.
--
-- COSA FA
--  1. payments.chiave_operazione uuid UNIQUE (null per i movimenti storici);
--     payments.origine text ('reale' | 'ricostruito', vedi R6) con default 'reale'.
--  2. segna_pagato(p_booking_id, p_chiave, p_metodo, p_paid_on):
--     - blocca i segmenti del soggiorno (group_id o la sola prenotazione);
--     - saldo mancante = totale dei segmenti confermati/completati meno i
--       movimenti già registrati (escluso quello con la stessa chiave);
--     - se un movimento con p_chiave esiste già → non inserisce nulla;
--       altrimenti, se il saldo è > 0, inserisce UN movimento con la chiave;
--     - imposta pagato = true su tutti i segmenti;
--     - torna jsonb { movimento_id, importo, pagato }.
-- ============================================================================

alter table public.payments add column if not exists chiave_operazione uuid;
alter table public.payments add column if not exists origine text not null default 'reale';
alter table public.payments drop constraint if exists payments_origine_valida;
alter table public.payments add constraint payments_origine_valida check (origine in ('reale', 'ricostruito'));
create unique index if not exists payments_chiave_operazione_uq on public.payments (chiave_operazione) where chiave_operazione is not null;

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
  v_group      uuid;
  v_totale     numeric := 0;
  v_registrati numeric := 0;
  v_mancante   numeric := 0;
  v_id         uuid;
begin
  if auth.uid() is null and session_user <> 'postgres' then
    raise exception 'Non autenticato';
  end if;

  select group_id into v_group from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Prenotazione non trovata';
  end if;

  -- Segmenti del soggiorno (cambio camera = stesso group_id), solo confermati/completati
  select coalesce(sum(b.total_amount), 0) into v_totale
    from public.bookings b
   where (b.id = p_booking_id or (v_group is not null and b.group_id = v_group))
     and b.status in ('confermata', 'completata');

  -- Movimenti già registrati, ESCLUSO quello con la stessa chiave (ritentare
  -- con la stessa chiave calcola lo stesso saldo di prima)
  select coalesce(sum(p.amount), 0) into v_registrati
    from public.payments p
    join public.bookings b on b.id = p.booking_id
   where (b.id = p_booking_id or (v_group is not null and b.group_id = v_group))
     and (p.chiave_operazione is null or p.chiave_operazione <> p_chiave);

  select id into v_id from public.payments where chiave_operazione = p_chiave;
  if v_id is null then
    v_mancante := v_totale - v_registrati;
    if v_mancante > 0 then
      insert into public.payments (booking_id, amount, method, paid_on, chiave_operazione, origine)
      values (p_booking_id, v_mancante, coalesce(p_metodo, 'contanti'), coalesce(p_paid_on, current_date), p_chiave, 'reale')
      returning id into v_id;
    end if;
  else
    select amount into v_mancante from public.payments where id = v_id;
  end if;

  update public.bookings set pagato = true
   where (id = p_booking_id or (v_group is not null and group_id = v_group))
     and status in ('confermata', 'completata');

  return pg_catalog.jsonb_build_object('movimento_id', v_id, 'importo', coalesce(v_mancante, 0), 'pagato', true);
end;
$$;

-- grant execute on function public.segna_pagato(uuid, uuid, text, date) to authenticated;

-- ----------------------------------------------------------------------------
-- R6 — RICOSTRUZIONE UNA TANTUM DEGLI INCASSI STORICI (stessa proposta 0033)
-- ----------------------------------------------------------------------------
-- Regola di Casa Ania: si è sempre pagato all'arrivo. Il gestionale prepara
-- il piano (lib/statistiche/ricostruzione.pianoRicostruzione: per ogni
-- soggiorno con pagato = true e movimenti che non coprono il totale, un
-- movimento con data = arrivo, importo = totale − registrati, metodo
-- «all'arrivo (ricostruito)», origine 'ricostruito', chiave stabile). Ania lo
-- vede in Statistiche e lo conferma: questa RPC scrive TUTTO in un'unica
-- transazione; una chiave già presente non viene riscritta (rilanciare non
-- crea doppioni). Torna quante righe ha scritto e quante ha saltato.

create or replace function public.ricostruisci_incassi(p_movimenti jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m        jsonb;
  v_scritti  int := 0;
  v_saltati  int := 0;
  v_id       uuid;
begin
  if auth.uid() is null and session_user <> 'postgres' then
    raise exception 'Non autenticato';
  end if;
  if p_movimenti is null or pg_catalog.jsonb_typeof(p_movimenti) <> 'array' then
    raise exception 'Piano non valido';
  end if;

  for v_m in select * from pg_catalog.jsonb_array_elements(p_movimenti) loop
    if (v_m->>'origine') is distinct from 'ricostruito' then
      raise exception 'Solo movimenti ricostruiti';
    end if;
    if not exists (select 1 from public.bookings where id = (v_m->>'booking_id')::uuid and status in ('confermata', 'completata')) then
      raise exception 'Prenotazione % non valida', v_m->>'booking_id';
    end if;
    insert into public.payments (booking_id, amount, method, paid_on, chiave_operazione, origine)
    values ((v_m->>'booking_id')::uuid, (v_m->>'amount')::numeric, coalesce(v_m->>'method', 'all''arrivo (ricostruito)'), (v_m->>'paid_on')::date, (v_m->>'chiave_operazione')::uuid, 'ricostruito')
    on conflict (chiave_operazione) where chiave_operazione is not null do nothing
    returning id into v_id;
    if v_id is null then v_saltati := v_saltati + 1; else v_scritti := v_scritti + 1; end if;
    v_id := null;
  end loop;

  return pg_catalog.jsonb_build_object('scritti', v_scritti, 'saltati', v_saltati);
end;
$$;

-- grant execute on function public.ricostruisci_incassi(jsonb) to authenticated;
