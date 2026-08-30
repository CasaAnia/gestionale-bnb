-- ============================================================================
-- 0022 — CARICAMENTO IDEMPOTENTE (Fase 4, blocco 1, rivisto) — ***PROPOSTA***
-- ============================================================================
-- STATO: NON APPLICATA. Va eseguita a mano nell'editor SQL solo dopo
-- l'autorizzazione; la PRIMA esecuzione va fatta in un ambiente ISOLATO
-- dalla produzione. Non modifica la 0020/0021.
--
-- PROBLEMA: il flusso a tre passi del browser (file → documento → ricevuta)
-- non è recuperabile in sicurezza: risposte perse producono documenti
-- doppi/orfani, e i doppioni lasciano documenti vuoti.
--
-- SOLUZIONE: registrazione in UNA transazione, ripetibile con un TOKEN.
--  · family_documents.upload_token uuid UNIQUE parziale (storico a token
--    nullo) + family_documents.upload_manifest jsonb: il MANIFESTO
--    NORMALIZZATO E IMMUTABILE della richiesta originale (kind, ambito,
--    nota, pagine con percorso/ordine/mime/impronta). Il replay confronta
--    IL MANIFESTO, mai i campi del documento (kind/nota/… si potranno
--    modificare legittimamente in revisione senza rompere l'idempotenza).
--  · RPC registra_documento_caricato: documento + tutte le ricevute o
--    niente. Stesso token e stesso manifesto → risultato precedente
--    (ripetuta=true). Stesso token con manifesto diverso → TOKEN_RIUSATO,
--    senza effetti. Doppione sull'impronta → GIA_IN_ARCHIVIO con rollback
--    totale (mai documenti vuoti). Richiesta malformata → errore SUO, mai
--    spacciato per doppione. Token concorrenti serializzati con lock
--    advisory di transazione.
--
-- CONTRATTO SUL BUCKET (lato client, lib/spese/registrazioneIdempotente.ts):
--  · il percorso ha un FORMATO PRECISO derivato dal token e dalla pagina:
--    <AAAA-MM-GG>/<token>-p<pagina>.<ext> — validato dal client PRIMA
--    dell'upload e di nuovo dalla RPC ("contiene il token" non basta);
--    concorrenza sullo stesso token = stesso percorso;
--  · l'impronta SHA-256 è OBBLIGATORIA e fissata prima di ogni effetto:
--    la RPC rifiuta pagine senza impronta valida (lo storico con hash
--    nullo NON viene toccato: qui passano solo caricamenti nuovi);
--  · l'upload NON sovrascrive mai (niente upsert): i byte di un oggetto
--    presente sono immutabili; il client verifica il token PRIMA di
--    caricare e riconfronta il blob con l'impronta fissata;
--  · la cancellazione di una copia avviene SOLO dopo la verifica esplicita
--    che il percorso non è collegato ad alcuna ricevuta; esito incerto →
--    si conserva e si segnala.
--
-- PERMESSI (contratto 0021): search_path VUOTO e riferimenti qualificati;
-- guardia private.is_app_member() dentro la funzione; REVOKE EXECUTE
-- esplicito anche a service_role, GRANT solo ad authenticated (il service
-- role di /scontrini scrive già con i suoi privilegi di tabella e non deve
-- passare da qui). Il browser non scrive mai upload_token/upload_manifest:
-- l'INSERT per colonna della 0021 resta invariato, nessun grant nuovo.
-- La registrazione NON crea né conferma spese o bozze; status solo default.
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
-- 1. Token e manifesto (nullable: lo storico non cambia; nessun grant nuovo)
-- ----------------------------------------------------------------------------
alter table public.family_documents
  add column if not exists upload_token uuid,
  add column if not exists upload_manifest jsonb;
create unique index if not exists family_documents_upload_token_uq
  on public.family_documents (upload_token) where upload_token is not null;

-- il manifesto è IMMUTABILE anche per i ruoli con UPDATE di tabella:
-- nessun grant di colonna lo espone al browser, e il trigger blocca chiunque
-- (service role compreso) dal riscriverlo una volta valorizzato
create or replace function private.proteggi_manifesto_caricamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.upload_token is not null and (
       new.upload_token is distinct from old.upload_token
       or new.upload_manifest is distinct from old.upload_manifest) then
    raise exception 'MANIFESTO_IMMUTABILE: token e manifesto di caricamento non si modificano';
  end if;
  return new;
end $$;
revoke execute on function private.proteggi_manifesto_caricamento()
  from public, anon, authenticated, service_role;
drop trigger if exists family_documents_manifesto_immutabile on public.family_documents;
create trigger family_documents_manifesto_immutabile
  before update on public.family_documents
  for each row execute function private.proteggi_manifesto_caricamento();

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
set search_path = ''
as $$
declare
  v_doc uuid;
  v_nota text := nullif(pg_catalog.btrim(coalesce(p_nota, '')), '');
  v_manifesto jsonb;
  v_registrato jsonb;
  v_pag jsonb;
  v_n int;
  v_vincolo text;
begin
  -- membri soltanto (stessa porta di tutto il resto); il controllo interno
  -- vale QUALUNQUE siano i privilegi di esecuzione
  if not (select private.is_app_member()) then
    raise exception 'NON_MEMBRO';
  end if;

  -- validazioni della RICHIESTA (mai spacciate per doppioni)
  if p_token is null then raise exception 'TOKEN_MANCANTE'; end if;
  if p_kind is null or p_kind not in ('scontrino', 'fattura', 'altro') then
    raise exception 'KIND_NON_VALIDO';
  end if;
  if p_ambito is null or p_ambito not in ('personale', 'azienda') then
    raise exception 'AMBITO_NON_VALIDO';
  end if;
  if p_pagine is null or pg_catalog.jsonb_typeof(p_pagine) <> 'array'
     or pg_catalog.jsonb_array_length(p_pagine) = 0 then
    raise exception 'PAGINE_MANCANTI';
  end if;
  begin
    for v_pag in select * from pg_catalog.jsonb_array_elements(p_pagine) loop
      if coalesce(v_pag->>'storage_path', '') = '' then
        raise exception 'PAGINE_MALFORMATE';
      end if;
      if (v_pag->>'page_order') is not null and (v_pag->>'page_order')::int < 1 then
        raise exception 'PAGINE_MALFORMATE';
      end if;
      -- proprietà verificabile: FORMATO PRECISO del percorso, legato al
      -- token E alla pagina (<AAAA-MM-GG>/<token>-p<pagina>.<ext>)
      if (v_pag->>'storage_path') !~ ('^[0-9]{4}-[0-9]{2}-[0-9]{2}/'
           || p_token::text || '-p'
           || coalesce((v_pag->>'page_order')::int, 1)::text
           || '\.[a-z0-9]{1,8}$') then
        raise exception 'PERCORSO_NON_COERENTE';
      end if;
      -- impronta OBBLIGATORIA e valida per i caricamenti nuovi (lo storico
      -- con hash nullo non passa da qui e non viene toccato)
      if coalesce(v_pag->>'file_sha256', '') = '' then
        raise exception 'IMPRONTA_MANCANTE';
      end if;
      if (v_pag->>'file_sha256') !~ '^[0-9a-f]{64}$' then
        raise exception 'IMPRONTA_NON_VALIDA';
      end if;
    end loop;
  exception
    when invalid_text_representation then
      raise exception 'PAGINE_MALFORMATE';
  end;
  -- ordini e percorsi unici DENTRO la richiesta; impronte interne non doppie
  select pg_catalog.count(*) into v_n from (
    select 1 from pg_catalog.jsonb_array_elements(p_pagine) p
    group by coalesce((p->>'page_order')::int, 1)
    having pg_catalog.count(*) > 1
    union all
    select 1 from pg_catalog.jsonb_array_elements(p_pagine) p
    group by p->>'storage_path' having pg_catalog.count(*) > 1
    union all
    select 1 from pg_catalog.jsonb_array_elements(p_pagine) p
    group by p->>'file_sha256' having pg_catalog.count(*) > 1
  ) doppi;
  if v_n > 0 then raise exception 'PAGINE_MALFORMATE'; end if;

  -- MANIFESTO normalizzato della richiesta: È il metro dell'idempotenza
  select pg_catalog.jsonb_build_object(
           'kind', p_kind, 'ambito', p_ambito, 'nota', v_nota,
           'pagine', pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'storage_path', p->>'storage_path',
             'page_order', coalesce((p->>'page_order')::int, 1),
             'mime_type', nullif(p->>'mime_type', ''),
             'file_sha256', p->>'file_sha256')
             order by coalesce((p->>'page_order')::int, 1)))
    into v_manifesto
    from pg_catalog.jsonb_array_elements(p_pagine) p;

  -- due chiamate CONCORRENTI con lo stesso token si mettono in fila qui
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('registra_documento_' || p_token::text));

  -- IDEMPOTENZA: token già registrato → si confronta il manifesto INTERO
  -- (immutabile), MAI i campi del documento che la revisione può cambiare
  select id, upload_manifest into v_doc, v_registrato
    from public.family_documents where upload_token = p_token;
  if v_doc is not null then
    if v_registrato is distinct from v_manifesto then
      raise exception 'TOKEN_RIUSATO';
    end if;
    return pg_catalog.jsonb_build_object('document_id', v_doc, 'ripetuta', true);
  end if;

  -- REGISTRAZIONE ATOMICA: documento + tutte le pagine, o niente.
  begin
    insert into public.family_documents
      (kind, upload_ambito, note, upload_token, upload_manifest)
    values (p_kind, p_ambito, v_nota, p_token, v_manifesto)
    returning id into v_doc;

    for v_pag in select * from pg_catalog.jsonb_array_elements(p_pagine) loop
      insert into public.family_receipts
        (storage_path, document_id, page_order, mime_type, file_sha256,
         note, ambito, status)   -- gli ultimi tre: campi legacy per /scontrini
      values (v_pag->>'storage_path', v_doc,
              coalesce((v_pag->>'page_order')::int, 1),
              nullif(v_pag->>'mime_type', ''),
              v_pag->>'file_sha256',
              v_nota, p_ambito, 'da_leggere');
    end loop;
  exception
    when unique_violation then
      -- SOLO il vincolo sull'impronta è un doppione; ogni altro vincolo è
      -- una richiesta non valida e va detto per quello che è
      get stacked diagnostics v_vincolo = CONSTRAINT_NAME;
      if v_vincolo = 'family_receipts_sha_uq' then
        raise exception 'GIA_IN_ARCHIVIO';
      end if;
      raise exception 'RICHIESTA_NON_VALIDA (vincolo %)', v_vincolo;
  end;

  return pg_catalog.jsonb_build_object('document_id', v_doc, 'ripetuta', false);
end $$;

-- privilegi: SOLO authenticated; esplicito anche verso service_role
revoke execute on function public.registra_documento_caricato(uuid, text, text, text, jsonb)
  from public, anon, service_role;
grant execute on function public.registra_documento_caricato(uuid, text, text, text, jsonb)
  to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICA MANUALE PROPOSTA — ***NON ESEGUIRE senza autorizzazione; prima
-- esecuzione in un ambiente ISOLATO dalla produzione.***
-- L'editor SQL gira come postgres (auth.uid() nullo): il percorso reale va
-- provato in un CONTESTO AUTENTICATO. Prima, dal pannello Storage, caricare
-- due file sintetici nel bucket 'scontrini' con percorsi nel formato esatto
-- (es. 2026-09-01/<TOKEN>-p1.jpg). Usare lo STESSO token in tutti i passi;
-- ogni errore ATTESO va isolato in un savepoint (o in una transazione a sé),
-- altrimenti abortisce tutto il resto della prova.
--
-- A. PRIVILEGI (ogni prova nella SUA transazione, chiusa con rollback):
--    begin; set local role anon;
--      select public.registra_documento_caricato('<TOKEN>'::uuid, 'scontrino',
--        'personale', null, '[]'::jsonb);   → permission denied
--    rollback;
--    begin; set local role service_role;
--      select public.registra_documento_caricato(...);  → permission denied
--    rollback;
-- B. CONTROLLO INTERNO (autenticato ma NON membro):
--    begin;
--    select set_config('request.jwt.claims',
--      pg_catalog.jsonb_build_object('sub', pg_catalog.gen_random_uuid(),
--                                    'role', 'authenticated')::text, true);
--    set local role authenticated;
--      select public.registra_documento_caricato(...);  → NON_MEMBRO
--    rollback;
-- C. PERCORSO DELL'OWNER (una transazione; sub = user_id dell'owner):
--    begin;
--    select set_config('request.jwt.claims',
--      pg_catalog.jsonb_build_object('sub',
--        (select user_id from public.app_members where role = 'owner' limit 1),
--        'role', 'authenticated')::text, true);
--    set local role authenticated;
--    1. registrazione con pagina {storage_path:'2026-09-01/<TOKEN>-p1.jpg',
--       page_order:1, mime_type:'image/jpeg', file_sha256:'<64 hex reali>'}
--       → document_id, ripetuta=false
--    2. STESSA chiamata identica → stesso id, ripetuta=true
--    3. savepoint s3; stesso token, nota diversa → TOKEN_RIUSATO;
--       rollback to savepoint s3;
--    4. savepoint s4; token nuovo, percorso '2026-09-01/<TOKEN2>-p2.jpg' con
--       page_order 1 (pagina non combaciante) → PERCORSO_NON_COERENTE;
--       rollback to savepoint s4;
--    5. savepoint s5; token nuovo, percorso corretto, STESSA impronta del
--       passo 1 → GIA_IN_ARCHIVIO; rollback to savepoint s5;
--       poi: select count(*) from public.family_documents → INVARIATO
--       rispetto a dopo il passo 1 (niente documenti vuoti);
--    commit (o rollback per non lasciare tracce).
-- D. TRIGGER DI IMMUTABILITÀ — da distinguere dal rifiuto dei permessi:
--    l'authenticated NON ha il grant di colonna su upload_manifest, quindi
--    il suo update fallirebbe per PERMESSI, non per trigger. La prova vera
--    si fa con un ruolo che PUÒ aggiornare le colonne (postgres stesso,
--    fuori dai set role):
--    begin;
--      update public.family_documents set note = 'nota nuova'
--        where upload_token = '<TOKEN>';          → passa (campo di revisione)
--      savepoint d1;
--      update public.family_documents set upload_manifest = '{}'::jsonb
--        where upload_token = '<TOKEN>';          → MANIFESTO_IMMUTABILE
--      rollback to savepoint d1;
--    rollback;
-- E. PULIZIA: eliminare ricevute e documento di prova (o avere chiuso tutto
--    con rollback) e togliere i file sintetici dal bucket.
-- ----------------------------------------------------------------------------
