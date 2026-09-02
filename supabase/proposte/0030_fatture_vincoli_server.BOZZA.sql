-- ============================================================================
-- 0030 (PROPOSTA, NON APPLICATA) — FATTURE: due regole che oggi vivono solo
-- nel client (Fase 5, revisione avversaria del 02/09/2026)
-- ============================================================================
-- Da NON eseguire senza autorizzazione esplicita di Ania. Sostituisce le
-- funzioni della 0020 con la stessa firma: nessun cambio per il client.
--
-- D1 · private.valida_fattura: una parte (bozza) il cui importo, dopo
--     l'arrotondamento, è NEGATIVO oggi passa l'approvazione «da pagare» e
--     poi fa fallire per sempre il pagamento («Importo sorella negativo» in
--     spese_crea_da_bozze). La regola va anticipata all'approvazione.
-- D5 · paga_fattura e conferma_fattura_pagata: la data di pagamento nel
--     FUTURO è vietata solo dal client. Il server la rifiuta qui (fuso di
--     Roma: current_date del server è UTC, si usa la data a Europe/Rome).
--
-- ROLLBACK: rieseguire le definizioni della 0020 delle tre funzioni.

create or replace function private.valida_fattura(p_document_id uuid, p_richiedi_scadenza boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.family_documents%rowtype;
  v_somma_cent bigint;
  v_arrotondamenti_cent bigint;
  v_negativa record;
begin
  select * into v_doc from public.family_documents where id = p_document_id;
  if v_doc.doc_total is null then raise exception 'Totale documento mancante'; end if;
  if v_doc.document_date is null then raise exception 'Data documento mancante'; end if;
  if p_richiedi_scadenza and v_doc.due_date is null then raise exception 'Scadenza mancante'; end if;
  if v_doc.supplier is null or v_doc.supplier = '' then raise exception 'Fornitore mancante'; end if;
  if not exists (
    select 1 from public.family_draft_expenses
    where document_id = p_document_id and status in ('da_controllare', 'pronta')
  ) then
    raise exception 'Nessuna bozza attiva: documento senza bozze o con bozze scartate/in errore';
  end if;
  if exists (
    select 1 from public.family_draft_expenses
    where document_id = p_document_id and status in ('da_controllare', 'pronta')
      and group_id is null
  ) then
    raise exception 'Bozza senza gruppo: assegnare il gruppo prima di approvare';
  end if;
  -- (0030) nessuna parte negativa dopo l'arrotondamento: la stessa regola di
  -- spese_crea_da_bozze, anticipata all'approvazione
  select b.id, coalesce(sum(round(i.amount * 100)::bigint), 0) + b.arrotondamento_cent as cent
    into v_negativa
  from public.family_draft_expenses b
  left join public.family_draft_items i on i.draft_id = b.id and not i.excluded
  where b.document_id = p_document_id and b.status in ('da_controllare', 'pronta')
  group by b.id, b.arrotondamento_cent
  having coalesce(sum(round(i.amount * 100)::bigint), 0) + b.arrotondamento_cent < 0
  limit 1;
  if found then
    raise exception 'Importo sorella negativo (%) dopo l''arrotondamento: non valido', v_negativa.cent::numeric / 100;
  end if;
  select coalesce(sum(round(i.amount * 100)::bigint), 0) into v_somma_cent
  from public.family_draft_expenses b
  join public.family_draft_items i on i.draft_id = b.id
  where b.document_id = p_document_id and b.status in ('da_controllare', 'pronta')
    and not i.excluded;
  select coalesce(sum(b.arrotondamento_cent), 0) into v_arrotondamenti_cent
  from public.family_draft_expenses b
  where b.document_id = p_document_id and b.status in ('da_controllare', 'pronta');
  if v_somma_cent + v_arrotondamenti_cent <> round(v_doc.doc_total * 100)::bigint then
    raise exception 'Quadratura non esatta: righe+arrotondamento=% cent, documento=% cent',
      v_somma_cent + v_arrotondamenti_cent, round(v_doc.doc_total * 100)::bigint;
  end if;
end $$;

-- Data di pagamento non futura (giorno di Roma) — usata dalle due RPC sotto
create or replace function private.data_pagamento_valida(p_data date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_data is null then raise exception 'Data di pagamento obbligatoria'; end if;
  if p_data > (now() at time zone 'Europe/Rome')::date then
    raise exception 'Data di pagamento nel futuro (%): si segna pagata quando il denaro è uscito', p_data;
  end if;
end $$;
revoke execute on function private.data_pagamento_valida(date) from public, anon, authenticated, service_role;

create or replace function public.paga_fattura(
  p_document_id uuid,
  p_data_pagamento date,
  p_payment_method text,
  p_correzioni jsonb default '[]'::jsonb
) returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.family_documents%rowtype;
begin
  if not private.is_app_member() then raise exception 'Accesso negato: utente non autorizzato'; end if;
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then raise exception 'Documento inesistente'; end if;
  if v_doc.kind <> 'fattura' then
    raise exception 'Tipo non valido: paga_fattura accetta solo fatture';
  end if;
  if v_doc.status = 'confermato' then
    return private.spese_gia_confermate(p_document_id);  -- idempotente
  end if;
  if v_doc.status <> 'approvata_da_pagare' then
    raise exception 'Stato non valido per il pagamento: % (serve approvata_da_pagare)', v_doc.status;
  end if;
  perform private.data_pagamento_valida(p_data_pagamento);   -- (0030)
  if p_payment_method is null or p_payment_method not in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro') then
    raise exception 'Metodo di pagamento obbligatorio e valido quando la fattura viene pagata';
  end if;
  perform private.registra_correzioni(p_document_id, p_correzioni);
  return private.spese_crea_da_bozze(p_document_id, p_data_pagamento, p_data_pagamento, p_payment_method);
end $$;

create or replace function public.conferma_fattura_pagata(
  p_document_id uuid,
  p_data_pagamento date,
  p_payment_method text,
  p_correzioni jsonb default '[]'::jsonb
) returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.family_documents%rowtype;
begin
  if not private.is_app_member() then raise exception 'Accesso negato: utente non autorizzato'; end if;
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then raise exception 'Documento inesistente'; end if;
  if v_doc.kind <> 'fattura' then
    raise exception 'Tipo non valido: conferma_fattura_pagata accetta solo fatture';
  end if;
  if v_doc.status = 'confermato' then
    return private.spese_gia_confermate(p_document_id);  -- idempotente
  end if;
  if v_doc.status <> 'in_revisione' then
    raise exception 'Stato non valido: % (serve in_revisione)', v_doc.status;
  end if;
  perform private.data_pagamento_valida(p_data_pagamento);   -- (0030)
  if p_payment_method is null or p_payment_method not in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro') then
    raise exception 'Metodo di pagamento obbligatorio e valido per una fattura già pagata';
  end if;
  perform private.valida_fattura(p_document_id, false);
  perform private.registra_correzioni(p_document_id, p_correzioni);
  return private.spese_crea_da_bozze(p_document_id, p_data_pagamento, p_data_pagamento, p_payment_method);
end $$;

-- I permessi delle due RPC pubbliche restano quelli della 0020 (grant a
-- authenticated, revoke a public/anon/service_role): il replace non li tocca.
-- Verifica dopo l'applicazione (in una transazione con ROLLBACK):
--   select public.paga_fattura('<id di una fattura approvata>', current_date + 1, 'bonifico');
--   → deve fallire con «Data di pagamento nel futuro».
