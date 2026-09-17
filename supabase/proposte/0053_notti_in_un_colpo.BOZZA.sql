-- =====================================================================
-- SPOSTARE LE NOTTI IN UN COLPO SOLO (15/09/2026) — proposta 0053
--
-- IL PROBLEMA. Cambiare le notti dalla striscia sono tre cose insieme:
-- accorciare i tratti che restano, crearne di nuovi, annullare quelli
-- rimasti senza notti. Oggi sono tre richieste separate. Se la seconda
-- non arriva, il soggiorno resta a metà: il primo tratto già accorciato
-- e la camera nuova mai creata, cioè notti sparite dal calendario.
-- Il messaggio lo dice, ma non rimette niente a posto.
--
-- LA SOLUZIONE. Una funzione che fa tutto dentro UNA transazione, e che
-- prima di scrivere ricontrolla la disponibilità sul database: fra il
-- momento in cui la pagina ha guardato e adesso può essere arrivata
-- un'altra prenotazione, e solo il database vede tutte le scritture.
--
-- Va insieme alla 0051 (il vincolo che impedisce due prenotazioni sulla
-- stessa camera): con la 0051 applicata il controllo qui dentro è una
-- cortesia — dice quale camera, invece di lasciare parlare il vincolo.
-- =====================================================================

create or replace function public.sposta_notti(
  p_aggiorna jsonb,   -- [{ id, campi: {...} }, ...]
  p_crea jsonb,       -- [{...campi}, ...]
  p_annulla uuid[],   -- id dei tratti rimasti senza notti
  p_motivo text
) returns jsonb       -- { aggiornate, create: [{id, check_in}], annullate }
language plpgsql
security invoker
as $$
declare
  voce jsonb;
  campi jsonb;
  id_riga uuid;
  toccate integer;
  aggiornate integer := 0;
  annullate integer := 0;
  create_righe jsonb := '[]'::jsonb;
  nuova record;
  adesso timestamptz := now();
  -- le righe toccate (aggiornate e create): il controllo finale guarda solo loro
  toccate_ids uuid[] := '{}';
begin
  -- 0. il vincolo della 0051 si controlla alla FINE della transazione.
  --    Le tre cose insieme passano per stati intermedi che sono impossibili
  --    da evitare: spostare una notte in una camera che sarà liberata un
  --    istante dopo, scambiare due camere fra loro. Alla fine il vincolo
  --    guarda com'è rimasto tutto, e se due prenotazioni si sovrappongono
  --    davvero il commit non passa (secondo controllo del 15/09/2026).
  --    Se il vincolo non c'è (0051 non applicata) o è stato creato senza
  --    DEFERRABLE (prima versione della 0051) non è un errore: si tira
  --    dritto e resta il controllo del punto 4.
  begin
    set constraints public.bookings_camera_non_due_volte deferred;
  exception
    when undefined_object then null;    -- il vincolo non c'è
    when wrong_object_type then null;   -- c'è, ma non è differibile
  end;

  -- 1. i tratti che restano, aggiornati
  for voce in select * from jsonb_array_elements(coalesce(p_aggiorna, '[]'::jsonb)) loop
    id_riga := (voce->>'id')::uuid;
    campi := voce->'campi';
    update public.bookings b
       set room_id        = coalesce((campi->>'room_id')::uuid, b.room_id),
           check_in       = coalesce((campi->>'check_in')::date, b.check_in),
           check_out      = coalesce((campi->>'check_out')::date, b.check_out),
           num_guests     = coalesce((campi->>'num_guests')::int, b.num_guests),
           extra_bed      = coalesce((campi->>'extra_bed')::boolean, b.extra_bed),
           extra_bed_dates = coalesce(campi->'extra_bed_dates', b.extra_bed_dates),
           price_per_night = coalesce((campi->>'price_per_night')::numeric, b.price_per_night),
           extra_bed_total = coalesce((campi->>'extra_bed_total')::numeric, b.extra_bed_total),
           total_amount   = coalesce((campi->>'total_amount')::numeric, b.total_amount),
           discount_type  = case when campi ? 'discount_type' then campi->>'discount_type' else b.discount_type end,
           discount_value = case when campi ? 'discount_value' then (campi->>'discount_value')::numeric else b.discount_value end,
           extra_bed_importo  = case when campi ? 'extra_bed_importo' then (campi->>'extra_bed_importo')::numeric else b.extra_bed_importo end,
           extra_bed_criterio = case when campi ? 'extra_bed_criterio' then campi->>'extra_bed_criterio' else b.extra_bed_criterio end,
           group_id       = coalesce((campi->>'group_id')::uuid, b.group_id),
           updated_at     = adesso
     where b.id = id_riga;
    get diagnostics toccate = row_count;
    if toccate <> 1 then
      raise exception 'il tratto % non c''è più: ricarica la scheda', id_riga;
    end if;
    aggiornate := aggiornate + 1;
    toccate_ids := toccate_ids || id_riga;
  end loop;

  -- 2. i tratti nuovi
  for voce in select * from jsonb_array_elements(coalesce(p_crea, '[]'::jsonb)) loop
    insert into public.bookings (
      guest_id, guest_name, prenotazione_id, group_id, status, bonifico, pagato,
      room_id, check_in, check_out, num_guests, extra_bed, extra_bed_dates,
      price_per_night, extra_bed_total, total_amount, discount_type, discount_value,
      extra_bed_importo, extra_bed_criterio, check_in_time, shuttle, created_at, updated_at
    )
    select
      (voce->>'guest_id')::uuid, voce->>'guest_name', (voce->>'prenotazione_id')::uuid,
      (voce->>'group_id')::uuid, coalesce(voce->>'status', 'confermata'),
      coalesce((voce->>'bonifico')::boolean, false), false,
      (voce->>'room_id')::uuid, (voce->>'check_in')::date, (voce->>'check_out')::date,
      (voce->>'num_guests')::int, coalesce((voce->>'extra_bed')::boolean, false),
      voce->'extra_bed_dates',
      (voce->>'price_per_night')::numeric, (voce->>'extra_bed_total')::numeric,
      (voce->>'total_amount')::numeric, voce->>'discount_type', (voce->>'discount_value')::numeric,
      (voce->>'extra_bed_importo')::numeric, voce->>'extra_bed_criterio',
      voce->>'check_in_time', voce->>'shuttle', adesso, adesso
    returning id, check_in into nuova;
    create_righe := create_righe || jsonb_build_object('id', nuova.id, 'check_in', nuova.check_in);
    toccate_ids := toccate_ids || nuova.id;
  end loop;

  -- 3. i tratti rimasti senza notti: annullati, non cancellati
  if p_annulla is not null and array_length(p_annulla, 1) is not null then
    update public.bookings
       set status = 'annullata', cancelled_at = adesso,
           cancelled_reason = coalesce(p_motivo, 'Camera non più necessaria'),
           updated_at = adesso
     where id = any(p_annulla);
    get diagnostics annullate = row_count;
    if annullate <> array_length(p_annulla, 1) then
      raise exception 'annullati % tratti su %: ricarica la scheda',
        annullate, array_length(p_annulla, 1);
    end if;
  end if;

  -- 4. nessuna delle righe TOCCATE deve risultare sovrapposta a un'altra
  --    prenotazione nella stessa camera. Si guardano solo le righe toccate
  --    (17/09/2026): un archivio con una sovrapposizione vecchia, segnalata in
  --    «Da controllare» e mai sistemata, non deve bloccare tutti gli
  --    spostamenti di notti di tutte le altre prenotazioni.
  --    Con la 0051 applicata questo controllo non scatta mai: serve a dire
  --    QUALE camera, invece di lasciare parlare il vincolo.
  if exists (
    select 1
      from public.bookings a
      join public.bookings b
        on a.room_id = b.room_id and a.id <> b.id
       and a.status <> 'annullata' and b.status <> 'annullata'
       and daterange(a.check_in, a.check_out, '[)') && daterange(b.check_in, b.check_out, '[)')
     where a.id = any(toccate_ids)
  ) then
    raise exception 'quelle notti sono appena state prese da un''altra prenotazione: ricarica la scheda';
  end if;

  return jsonb_build_object('aggiornate', aggiornate, 'create', create_righe, 'annullate', annullate);
end;
$$;

comment on function public.sposta_notti is
  'Sposta le notti di un soggiorno (aggiorna, crea, annulla) in una sola transazione, controllando che nessuna camera resti occupata due volte.';

revoke all on function public.sposta_notti(jsonb, jsonb, uuid[], text) from public;
grant execute on function public.sposta_notti(jsonb, jsonb, uuid[], text) to authenticated;

-- PROVA DI CONCORRENZA, su un progetto di prova (non in produzione):
--
--   sessione A                      sessione B
--   ----------                      ----------
--   begin;
--   select public.sposta_notti(...);   -- sposta una notte in Ambra
--                                   select public.sposta_notti(...); -- la stessa notte in Ambra
--                                   -- resta in attesa sul lock delle righe
--   commit;
--                                   -- si sveglia, trova la camera presa e
--                                   -- fallisce: nessuno stato a metà
--
-- PROVA DEL GUASTO A METÀ: aggiungere un `raise exception` fra il punto 1 e
-- il punto 2 e verificare che i tratti accorciati tornino come prima.
--
-- PER TORNARE INDIETRO:
--   drop function if exists public.sposta_notti(jsonb, jsonb, uuid[], text);
