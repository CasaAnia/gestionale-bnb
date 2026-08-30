-- ============================================================================
-- 0022 — CARICAMENTO IDEMPOTENTE (Fase 4, blocco 1) — ***PROPOSTA***
-- ============================================================================
-- STATO: NON APPLICATA. Va eseguita a mano nell'editor SQL di Supabase solo
-- dopo l'autorizzazione, come le precedenti. Non modifica la 0020/0021.
--
-- PROBLEMA CHE RISOLVE (riprodotto dalla revisione): oggi il browser fa tre
-- passi separati (file nel bucket → INSERT documento → INSERT ricevuta).
-- Se la risposta dell'INSERT del documento si perde, non esiste un modo
-- sicuro di riprendere: ritentare crea un secondo documento, ricaricare la
-- pagina e riselezionare il file produce due documenti + un orfano. E un
-- doppione scoperto solo dal vincolo sulla ricevuta lascia un documento
-- vuoto già creato.
--
-- SOLUZIONE: registrazione in UNA transazione, ripetibile con un TOKEN.
--  · family_documents.upload_token uuid UNIQUE (nullable: lo storico resta
--    con token nullo). Il token lo genera il client UNA volta per foto e lo
--    conserva nella "ripresa" tra i tentativi.
--  · RPC registra_documento_caricato(token, kind, ambito, nota, pagine):
--    documento + TUTTE le ricevute nella stessa transazione. Un errore in
--    mezzo (incluso il doppione sull'impronta sha) annulla TUTTO: mai più
--    documenti vuoti. Una chiamata ripetuta con lo stesso token RESTITUISCE
--    il risultato precedente; lo stesso token con contenuto diverso viene
--    RESPINTO (TOKEN_RIUSATO). Chiamate concorrenti sullo stesso token si
--    serializzano con un lock advisory di transazione.
--
-- IL BUCKET RESTA FUORI dalla transazione (lo storage non può entrarci).
-- Contratto lato client (lib/spese/registrazioneIdempotente.ts):
--  · il percorso è NOSTRO e casuale; l'upload usa upsert (ritentarlo sul
--    proprio percorso è idempotente);
--  · il file si carica PRIMA della RPC; se la RPC ha esito sconosciuto il
--    file resta al suo posto e si ritenta CON LO STESSO token (che recupera
--    o registra, mai duplica);
--  · si cancella un file SOLO del proprio percorso e SOLO dopo un esito
--    DEFINITO di non-registrazione (GIA_IN_ARCHIVIO / TOKEN_RIUSATO ⇒ la
--    transazione è annullata ⇒ il nostro percorso non è collegato, perché
--    un token mai registrato non può avere ricevute e il percorso casuale
--    è solo nostro). Mai cancellare su esito incerto.
--
-- PERMESSI (verificati sulla 0021):
--  · l'INSERT per colonna concesso ad authenticated su family_documents
--    (kind, doc_total, supplier, invoice_number, document_date, due_date,
--    note, upload_ambito) NON include upload_token, e QUESTA migrazione
--    NON lo aggiunge: il browser non scrive mai il token direttamente,
--    passa solo dalla RPC (security definer), che resta l'unica via.
--  · la RPC verifica private.is_app_member() come tutte le altre; niente
--    service role nel browser.
--  · lo status del documento prende SOLO il default 'da_elaborare' e le
--    ricevute nascono 'da_leggere' (campi legacy per /scontrini fino al
--    prossimo blocco): la registrazione NON crea né conferma spese o bozze.
-- ============================================================================

-- Precondizioni (stile 0021): schema e protezioni già in posa
do $$
begin
  if to_regclass('public.family_documents') is null
     or to_regclass('public.family_receipts') is null then
    raise exception 'PRECONDIZIONE FALLITA: manca lo schema 0020.';
  end if;
  if to_regprocedure('private.is_app_member()') is null then
    raise exception 'PRECONDIZIONE FALLITA: manca private.is_app_member — applicare prima la 0021.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. Il token di caricamento (nullable + indice unico parziale: lo storico
--    non cambia; nessun grant nuovo sulla colonna)
-- ----------------------------------------------------------------------------
alter table public.family_documents
  add column if not exists upload_token uuid;
create unique index if not exists family_documents_upload_token_uq
  on public.family_documents (upload_token) where upload_token is not null;

-- ----------------------------------------------------------------------------
-- 2. La RPC di registrazione atomica e ripetibile
-- ----------------------------------------------------------------------------
create or replace function public.registra_documento_caricato(
  p_token uuid,
  p_kind text,
  p_ambito text,
  p_nota text,
  p_pagine jsonb    -- [{storage_path, page_order, mime_type, file_sha256}]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc uuid;
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_esistenti jsonb;
  v_richieste jsonb;
  v_pag jsonb;
begin
  -- membri soltanto (stessa porta di tutto il resto)
  if not (select private.is_app_member()) then
    raise exception 'NON_MEMBRO';
  end if;

  -- validazioni: la RPC non accetta stati né campi di sistema dall'esterno
  if p_token is null then raise exception 'TOKEN_MANCANTE'; end if;
  if p_kind is null or p_kind not in ('scontrino', 'fattura', 'altro') then
    raise exception 'KIND_NON_VALIDO';
  end if;
  if p_ambito is null or p_ambito not in ('personale', 'azienda') then
    raise exception 'AMBITO_NON_VALIDO';
  end if;
  if p_pagine is null or jsonb_typeof(p_pagine) <> 'array'
     or jsonb_array_length(p_pagine) = 0 then
    raise exception 'PAGINE_MANCANTI';
  end if;
  for v_pag in select * from jsonb_array_elements(p_pagine) loop
    if coalesce(v_pag->>'storage_path', '') = '' then
      raise exception 'PAGINA_SENZA_PERCORSO';
    end if;
  end loop;

  -- due chiamate CONCORRENTI con lo stesso token si mettono in fila qui
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('registra_documento_' || p_token::text));

  -- IDEMPOTENZA: il token è già registrato? Allora questa è una RIPETIZIONE
  -- (risposta persa, ricaricamento…): si restituisce il risultato di prima.
  select id into v_doc from public.family_documents where upload_token = p_token;
  if v_doc is not null then
    -- ma lo STESSO token con contenuto DIVERSO è un riuso indebito: respinto
    select coalesce(jsonb_agg(jsonb_build_object(
             'storage_path', storage_path,
             'page_order', page_order,
             'file_sha256', file_sha256) order by page_order), '[]'::jsonb)
      into v_esistenti
      from public.family_receipts where document_id = v_doc;
    select jsonb_agg(jsonb_build_object(
             'storage_path', p->>'storage_path',
             'page_order', coalesce((p->>'page_order')::int, 1),
             'file_sha256', p->>'file_sha256')
           order by coalesce((p->>'page_order')::int, 1))
      into v_richieste
      from jsonb_array_elements(p_pagine) p;
    if v_esistenti is distinct from v_richieste then
      raise exception 'TOKEN_RIUSATO';
    end if;
    return jsonb_build_object('document_id', v_doc, 'ripetuta', true);
  end if;

  -- REGISTRAZIONE ATOMICA: documento + tutte le pagine, o niente.
  -- Il doppione (vincolo unico su file_sha256, o pagina doppia) annulla
  -- l'intera transazione: nessun documento vuoto resta in archivio.
  begin
    insert into public.family_documents (kind, upload_ambito, note, upload_token)
    values (p_kind, p_ambito, v_nota, p_token)
    returning id into v_doc;

    for v_pag in select * from jsonb_array_elements(p_pagine) loop
      insert into public.family_receipts
        (storage_path, document_id, page_order, mime_type, file_sha256,
         note, ambito, status)   -- gli ultimi tre: campi legacy per /scontrini
      values (v_pag->>'storage_path', v_doc,
              coalesce((v_pag->>'page_order')::int, 1),
              nullif(v_pag->>'mime_type', ''),
              nullif(v_pag->>'file_sha256', ''),
              v_nota, p_ambito, 'da_leggere');
    end loop;
  exception
    when unique_violation then
      raise exception 'GIA_IN_ARCHIVIO';
  end;

  return jsonb_build_object('document_id', v_doc, 'ripetuta', false);
end $$;

revoke execute on function public.registra_documento_caricato(uuid, text, text, text, jsonb)
  from public, anon;
grant execute on function public.registra_documento_caricato(uuid, text, text, text, jsonb)
  to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICA MANUALE PROPOSTA (da eseguire nell'editor SQL dopo l'applicazione,
-- in un progetto di prova o su produzione previa autorizzazione):
--   1. select registra_documento_caricato(gen_random_uuid(), 'scontrino',
--        'personale', 'prova', '[{"storage_path":"prova/x.jpg","page_order":1,
--        "file_sha256":"prova-sha"}]'::jsonb);       → document_id, ripetuta=false
--   2. ripetere con lo STESSO token e le stesse pagine → stesso id, ripetuta=true
--   3. stesso token, sha diverso → errore TOKEN_RIUSATO
--   4. token NUOVO, stesso sha → errore GIA_IN_ARCHIVIO e NESSUN documento
--      in più (select count(*) prima/dopo)
--   5. pulizia della prova: delete della ricevuta e del documento di prova.
-- ----------------------------------------------------------------------------
