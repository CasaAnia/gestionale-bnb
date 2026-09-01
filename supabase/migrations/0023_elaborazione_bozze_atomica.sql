-- ============================================================================
-- 0023 — ELABORAZIONE «SOLO BOZZE»: PRIMITIVO ATOMICO — ***PROPOSTA***
-- ============================================================================
-- STATO: NON APPLICATA. Va eseguita a mano nell'editor SQL solo dopo
-- l'autorizzazione; la PRIMA esecuzione e il collaudo vanno fatti in un
-- ambiente ISOLATO dalla produzione. Non modifica la 0020/0021/0022.
--
-- PROBLEMA (revisione R1 del candidato 108c130): lo strumento di
-- elaborazione realizzava «mai parziali / mai doppioni» con una sequenza
-- di DELETE + INSERT + PATCH REST indipendenti: non è atomica, non è
-- idempotente sotto concorrenza, e le compensazioni client non possono
-- dimostrare la garanzia.
--
-- SOLUZIONE: UN solo primitivo transazionale, elabora_sostituisci_bozze:
--  · lock della riga documento (select … for update) = arbitraggio
--    concorrente: due elaborazioni simultanee si serializzano e la
--    seconda trova lo stato già cambiato → rifiutata, mai bozze doppie;
--  · verifica dello stato DENTRO la transazione (p_stati_ammessi);
--  · sostituzione integrale di bozze+righe del documento + doc_total +
--    stato in_revisione, oppure (p_errore) pulizia totale + stato errore
--    col motivo — TUTTO O NIENTE: qualunque eccezione annulla l'intera
--    chiamata, mai parziali;
--  · tocca SOLO family_documents / family_draft_expenses /
--    family_draft_items: le spese definitive non compaiono qui.
--
-- PERMESSI (contratto 0021): search_path VUOTO e riferimenti qualificati;
-- REVOKE EXECUTE esplicito a public/anon/authenticated — la chiamano solo
-- i privilegi del service role (lo strumento del runbook), mai il browser.
-- ============================================================================

-- Precondizioni (stile 0021/0022): schema bozze già in posa
do $$
begin
  if to_regclass('public.family_documents') is null
     or to_regclass('public.family_draft_expenses') is null
     or to_regclass('public.family_draft_items') is null then
    raise exception 'PRECONDIZIONE FALLITA: manca lo schema 0020.';
  end if;
end $$;

create or replace function public.elabora_sostituisci_bozze(
  p_document_id uuid,
  p_stati_ammessi text[],
  -- { doc_total, bozze: [ { …campi bozza…, righe: [ …campi riga… ] } ] }
  -- oppure NULL quando p_errore è valorizzato (marcatura d'errore)
  p_pacchetto jsonb,
  p_errore text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stato text;
  v_bozze int := 0;
  v_righe int := 0;
  v_b jsonb;
  v_r jsonb;
  v_id uuid;
begin
  if (p_pacchetto is null) = (p_errore is null) then
    return jsonb_build_object('ok', false,
      'errore', 'richiesta malformata: serve il pacchetto O il motivo di errore, mai entrambi o nessuno');
  end if;
  if p_stati_ammessi is null or array_length(p_stati_ammessi, 1) is null then
    return jsonb_build_object('ok', false, 'errore', 'richiesta malformata: p_stati_ammessi vuoto');
  end if;

  -- ARBITRAGGIO: lock sul documento; chi arriva secondo aspetta e poi
  -- trova lo stato già cambiato → rifiutato qui sotto, mai bozze doppie
  select status into v_stato
  from public.family_documents
  where id = p_document_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'errore', 'documento inesistente');
  end if;
  if not (v_stato = any(p_stati_ammessi)) then
    return jsonb_build_object('ok', false, 'stato_attuale', v_stato,
      'errore', format('documento in stato «%s»: non ammesso alla sostituzione', v_stato));
  end if;

  -- SOSTITUZIONE INTEGRALE: le bozze precedenti di QUESTO documento
  -- spariscono (mai accumulate); le righe cadono col cascade della 0020
  delete from public.family_draft_expenses where document_id = p_document_id;

  if p_errore is not null then
    update public.family_documents
    set status = 'errore', error_message = p_errore
    where id = p_document_id;
    return jsonb_build_object('ok', true, 'bozze', 0, 'righe', 0);
  end if;

  for v_b in select * from jsonb_array_elements(coalesce(p_pacchetto->'bozze', '[]'::jsonb)) loop
    insert into public.family_draft_expenses
      (document_id, status, expense_date, group_id, subcategory,
       canonical_category_id, canonical_subcategory_id, store, description,
       payment_method, room_id, expense_nature, arrotondamento_cent, confidence)
    values
      (p_document_id, 'da_controllare', (v_b->>'expense_date')::date,
       (v_b->>'group_id')::uuid, v_b->>'subcategory',
       (v_b->>'canonical_category_id')::uuid, (v_b->>'canonical_subcategory_id')::uuid,
       v_b->>'store', v_b->>'description',
       v_b->>'payment_method', (v_b->>'room_id')::uuid, v_b->>'expense_nature',
       coalesce((v_b->>'arrotondamento_cent')::int, 0),
       coalesce(v_b->'confidence', '{}'::jsonb))
    returning id into v_id;
    v_bozze := v_bozze + 1;
    for v_r in select * from jsonb_array_elements(coalesce(v_b->'righe', '[]'::jsonb)) loop
      insert into public.family_draft_items
        (draft_id, raw_name, name, qty, unit_price, discount, amount,
         group_id, subcategory, canonical_category_id, canonical_subcategory_id,
         excluded, user_added, confidence)
      values
        (v_id, v_r->>'raw_name', v_r->>'name',
         coalesce((v_r->>'qty')::numeric, 1), (v_r->>'unit_price')::numeric,
         coalesce((v_r->>'discount')::numeric, 0), (v_r->>'amount')::numeric,
         (v_r->>'group_id')::uuid, v_r->>'subcategory',
         (v_r->>'canonical_category_id')::uuid, (v_r->>'canonical_subcategory_id')::uuid,
         coalesce((v_r->>'excluded')::boolean, false),
         coalesce((v_r->>'user_added')::boolean, false),
         coalesce(v_r->'confidence', '{}'::jsonb));
      v_righe := v_righe + 1;
    end loop;
  end loop;

  update public.family_documents
  set status = 'in_revisione',
      doc_total = (p_pacchetto->>'doc_total')::numeric,
      error_message = null
  where id = p_document_id;

  return jsonb_build_object('ok', true, 'bozze', v_bozze, 'righe', v_righe);
  -- qualunque eccezione (vincolo violato, cast fallito…) NON viene
  -- catturata: l'intera transazione della chiamata è annullata — è la
  -- garanzia «tutto o niente», il chiamante riceve l'errore PostgREST
end $$;

-- solo il service role (strumento del runbook): mai il browser
revoke execute on function public.elabora_sostituisci_bozze(uuid, text[], jsonb, text)
  from public, anon, authenticated;
grant execute on function public.elabora_sostituisci_bozze(uuid, text[], jsonb, text)
  to service_role;
