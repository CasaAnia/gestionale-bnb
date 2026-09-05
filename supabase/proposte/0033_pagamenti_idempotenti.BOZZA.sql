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
