-- ============================================================================
-- BOZZA (NON APPLICARE) — contratto di revisione: giornale, versione,
-- salva_revisione / esito_revisione / conferma_revisione / scarta_revisione.
-- Stato: SVILUPPO LOCALE approvato; questa SQL è ANCORA DA DIMOSTRARE nel
-- collaudo isolato (autorizzazione separata). NON è nella cartella delle
-- migrazioni apposta: nessuno strumento deve applicarla per sbaglio.
-- La TRANSIZIONE (fase A respingenti + fase B barriera, revoke dei
-- percorsi legacy) NON è qui: resta proposta, non approvata
-- (PROPOSTA-RECUPERO-REVISIONE.md §5). In questa bozza gli involucri di
-- conferma/scarto chiamano ancora le RPC pubbliche 0020: la transizione
-- li ripunterà alle copie in private.
-- Vettori dell'impronta canonica: lib/spese/contrattoVettori.ts — la
-- canonicalizzazione qui sotto DEVE produrre le stesse impronte.
-- ============================================================================

begin;

-- 1) GIORNALE append-only ----------------------------------------------------
create table if not exists public.family_revision_ops (
  op_key uuid primary key,
  document_id uuid not null references public.family_documents(id),
  kind text not null check (kind in ('salva', 'conferma', 'scarto')),
  base_rev bigint not null,
  manifesto_sha256 text not null,
  esito jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);
alter table public.family_revision_ops enable row level security;
-- nessuna policy: dal browser NON si legge né si scrive direttamente
revoke all on public.family_revision_ops from anon, authenticated;

create or replace function private.proteggi_giornale_revisione()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'GIORNALE_IMMUTABILE: family_revision_ops è append-only';
end $$;
drop trigger if exists family_revision_ops_immutabile on public.family_revision_ops;
create trigger family_revision_ops_immutabile
  before update or delete on public.family_revision_ops
  for each row execute function private.proteggi_giornale_revisione();

-- 2) VERSIONE di revisione ---------------------------------------------------
alter table public.family_documents
  add column if not exists revisione_rev bigint not null default 0;

-- 3) forma CANONICA e impronta (stessa dei vettori client) -------------------
-- chiavi in ordine lessicografico, niente spazi, numeri minimi, null
-- espliciti. NB: jsonb NON conserva l'ordine né la forma dei numeri: la
-- canonicalizzazione va fatta ricostruendo il testo — questa funzione è
-- il punto più delicato del collaudo (vettori comuni obbligatori).
create or replace function private.canonico(v jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare
  t text; k text; primo boolean := true; e jsonb;
begin
  case jsonb_typeof(v)
    when 'object' then
      t := '{';
      for k in select key from jsonb_each(v) order by key collate "C" loop
        if not primo then t := t || ','; end if;
        primo := false;
        t := t || to_json(k)::text || ':' || private.canonico(v -> k);
      end loop;
      return t || '}';
    when 'array' then
      t := '[';
      for e in select value from jsonb_array_elements(v) loop
        if not primo then t := t || ','; end if;
        primo := false;
        t := t || private.canonico(e);
      end loop;
      return t || ']';
    when 'number' then
      -- forma minima: come la produce JavaScript (da inchiodare coi
      -- vettori: numeric di Postgres può differire, es. 0.50 vs 0.5)
      return (v #>> '{}')::numeric::text;
    else
      return v::text;  -- string (già quotata), boolean, null
  end case;
end $$;

create or replace function private.impronta_canonica(v jsonb)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(private.canonico(v), 'UTF8'), 'sha256'), 'hex')
$$;

-- 4) SALVA_REVISIONE: il batch atomico ---------------------------------------
create or replace function public.salva_revisione(
  p_op_key uuid, p_document_id uuid, p_base_rev bigint, p_modifiche jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_doc record; v_reg record; v_impronta text;
  v_id text; v_campi jsonb; v_voce jsonb;
  v_bozza record; v_riga record;
  v_mappa jsonb := '[]'::jsonb; v_nuovo_id uuid;
  v_refs text[] := '{}'; v_vincolo text;
  c_campi_bozza constant text[] := array['expense_date','group_id','category_id','subcategory','canonical_category_id','canonical_subcategory_id','store','description','payment_method','room_id','expense_nature','arrotondamento_cent'];
  c_campi_riga constant text[] := array['name','qty','unit_price','discount','amount','group_id','category_id','subcategory','canonical_category_id','canonical_subcategory_id','necessity','planning','excluded'];
  c_campi_nuova constant text[] := array['client_ref','draft_id','name','qty','unit_price','discount','amount','group_id','category_id','subcategory','canonical_category_id','canonical_subcategory_id','necessity','planning'];
  k text;
begin
  if not private.is_app_member() then raise exception 'NON_MEMBRO'; end if;
  -- impronta RICALCOLATA dal server sui parametri ricevuti
  v_impronta := private.impronta_canonica(
    p_modifiche || jsonb_build_object('kind', 'salva', 'document_id', p_document_id, 'base_rev', p_base_rev));
  -- REPLAY veloce (pre-lock, solo scorciatoia: la verifica che CONTA è
  -- quella DOPO il lock)
  select * into v_reg from public.family_revision_ops where op_key = p_op_key;
  if found then
    if v_reg.document_id = p_document_id and v_reg.kind = 'salva'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end if;
  -- LOCK della riga documento: lo stesso primitivo delle chiusure
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then return jsonb_build_object('esito', 'IDENTIFICATIVO_MANCANTE'); end if;
  -- RICONTROLLO del giornale DOPO l'attesa del lock: sotto Read
  -- Committed la seconda di due richieste identiche concorrenti esce
  -- dall'attesa DOPO che la prima ha committato — senza questo
  -- ricontrollo vedrebbe la rev avanzata e risponderebbe SUPERATA
  -- invece di RIPETUTA
  select * into v_reg from public.family_revision_ops where op_key = p_op_key;
  if found then
    if v_reg.document_id = p_document_id and v_reg.kind = 'salva'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end if;
  -- lista POSITIVA degli stati modificabili
  if v_doc.status <> 'in_revisione' then
    return jsonb_build_object('esito', 'DOCUMENTO_NON_MODIFICABILE', 'dettaglio', v_doc.status);
  end if;
  if p_base_rev <> v_doc.revisione_rev then return jsonb_build_object('esito', 'SUPERATA'); end if;
  -- «is distinct from», MAI «<>»: su una chiave ASSENTE jsonb_typeof dà
  -- NULL e il confronto a tre valori non farebbe scattare la guardia
  -- (trovato al collaudo, giro 1 passo 3: batch senza «nuove» applicato)
  if jsonb_typeof(p_modifiche -> 'bozze') is distinct from 'object'
     or jsonb_typeof(p_modifiche -> 'righe') is distinct from 'object'
     or jsonb_typeof(p_modifiche -> 'nuove') is distinct from 'array' then
    return jsonb_build_object('esito', 'MODIFICHE_MALFORMATE');
  end if;
  -- PERIMETRO, stati delle bozze e whitelist: TUTTO prima di scrivere
  for v_id, v_campi in select key, value from jsonb_each(p_modifiche -> 'bozze') loop
    select * into v_bozza from public.family_draft_expenses where id = v_id::uuid;
    if not found then return jsonb_build_object('esito', 'IDENTIFICATIVO_MANCANTE', 'dettaglio', v_id); end if;
    if v_bozza.document_id <> p_document_id then return jsonb_build_object('esito', 'RIFERIMENTO_ESTRANEO', 'dettaglio', v_id); end if;
    if v_bozza.status not in ('da_controllare', 'pronta') then return jsonb_build_object('esito', 'BOZZA_NON_MODIFICABILE', 'dettaglio', v_id); end if;
    for k in select jsonb_object_keys(v_campi) loop
      if k <> all (c_campi_bozza) then return jsonb_build_object('esito', 'CAMPO_NON_CONSENTITO', 'dettaglio', k); end if;
    end loop;
  end loop;
  for v_id, v_campi in select key, value from jsonb_each(p_modifiche -> 'righe') loop
    select * into v_riga from public.family_draft_items where id = v_id::uuid;
    if not found then return jsonb_build_object('esito', 'IDENTIFICATIVO_MANCANTE', 'dettaglio', v_id); end if;
    select * into v_bozza from public.family_draft_expenses where id = v_riga.draft_id;
    if v_bozza.document_id <> p_document_id then return jsonb_build_object('esito', 'RIFERIMENTO_ESTRANEO', 'dettaglio', v_id); end if;
    if v_bozza.status not in ('da_controllare', 'pronta') then return jsonb_build_object('esito', 'BOZZA_NON_MODIFICABILE', 'dettaglio', v_id); end if;
    for k in select jsonb_object_keys(v_campi) loop
      if k <> all (c_campi_riga) then return jsonb_build_object('esito', 'CAMPO_NON_CONSENTITO', 'dettaglio', k); end if;
    end loop;
  end loop;
  for v_voce in select value from jsonb_array_elements(p_modifiche -> 'nuove') loop
    if v_voce ->> 'client_ref' is null then return jsonb_build_object('esito', 'MODIFICHE_MALFORMATE'); end if;
    if (v_voce ->> 'client_ref') = any (v_refs) then return jsonb_build_object('esito', 'CLIENT_REF_DUPLICATO'); end if;
    v_refs := v_refs || (v_voce ->> 'client_ref');
    select * into v_bozza from public.family_draft_expenses where id = (v_voce ->> 'draft_id')::uuid;
    if not found then return jsonb_build_object('esito', 'IDENTIFICATIVO_MANCANTE'); end if;
    if v_bozza.document_id <> p_document_id then return jsonb_build_object('esito', 'RIFERIMENTO_ESTRANEO'); end if;
    if v_bozza.status not in ('da_controllare', 'pronta') then return jsonb_build_object('esito', 'BOZZA_NON_MODIFICABILE'); end if;
    for k in select jsonb_object_keys(v_voce) loop
      if k <> all (c_campi_nuova) then return jsonb_build_object('esito', 'CAMPO_NON_CONSENTITO', 'dettaglio', k); end if;
    end loop;
  end loop;
  -- APPLICAZIONE: TUTTE le scritture (documento, bozze, righe, voci
  -- nuove, revisione E giornale) vivono dentro UN SOLO blocco protetto:
  -- PostgreSQL annulla le modifiche INTERNE al blocco che intercetta
  -- l'eccezione, quindi il perimetro atomico deve contenerle tutte —
  -- il ramo perdente di una collisione non lascia NULLA applicato.
  -- I vincoli 0020 restano la rete di sicurezza: un loro errore (non
  -- intercettato) fa fallire l'intera funzione.
  begin
  if p_modifiche ? 'doc_total' then
    update public.family_documents
      set doc_total = (p_modifiche ->> 'doc_total')::numeric
      where id = p_document_id;
  end if;
  for v_id, v_campi in select key, value from jsonb_each(p_modifiche -> 'bozze') loop
    update public.family_draft_expenses b set
      expense_date = coalesce((v_campi ->> 'expense_date')::date, b.expense_date),
      group_id = case when v_campi ? 'group_id' then (v_campi ->> 'group_id')::uuid else b.group_id end,
      category_id = case when v_campi ? 'category_id' then (v_campi ->> 'category_id')::uuid else b.category_id end,
      subcategory = case when v_campi ? 'subcategory' then v_campi ->> 'subcategory' else b.subcategory end,
      canonical_category_id = case when v_campi ? 'canonical_category_id' then (v_campi ->> 'canonical_category_id')::uuid else b.canonical_category_id end,
      canonical_subcategory_id = case when v_campi ? 'canonical_subcategory_id' then (v_campi ->> 'canonical_subcategory_id')::uuid else b.canonical_subcategory_id end,
      store = case when v_campi ? 'store' then v_campi ->> 'store' else b.store end,
      description = case when v_campi ? 'description' then v_campi ->> 'description' else b.description end,
      payment_method = case when v_campi ? 'payment_method' then v_campi ->> 'payment_method' else b.payment_method end,
      room_id = case when v_campi ? 'room_id' then (v_campi ->> 'room_id')::uuid else b.room_id end,
      expense_nature = case when v_campi ? 'expense_nature' then v_campi ->> 'expense_nature' else b.expense_nature end,
      arrotondamento_cent = coalesce((v_campi ->> 'arrotondamento_cent')::int, b.arrotondamento_cent)
      where b.id = v_id::uuid;
  end loop;
  for v_id, v_campi in select key, value from jsonb_each(p_modifiche -> 'righe') loop
    update public.family_draft_items r set
      name = coalesce(v_campi ->> 'name', r.name),
      qty = coalesce((v_campi ->> 'qty')::numeric, r.qty),
      unit_price = case when v_campi ? 'unit_price' then (v_campi ->> 'unit_price')::numeric else r.unit_price end,
      discount = coalesce((v_campi ->> 'discount')::numeric, r.discount),
      amount = coalesce((v_campi ->> 'amount')::numeric, r.amount),
      group_id = case when v_campi ? 'group_id' then (v_campi ->> 'group_id')::uuid else r.group_id end,
      category_id = case when v_campi ? 'category_id' then (v_campi ->> 'category_id')::uuid else r.category_id end,
      subcategory = case when v_campi ? 'subcategory' then v_campi ->> 'subcategory' else r.subcategory end,
      canonical_category_id = case when v_campi ? 'canonical_category_id' then (v_campi ->> 'canonical_category_id')::uuid else r.canonical_category_id end,
      canonical_subcategory_id = case when v_campi ? 'canonical_subcategory_id' then (v_campi ->> 'canonical_subcategory_id')::uuid else r.canonical_subcategory_id end,
      necessity = case when v_campi ? 'necessity' then v_campi ->> 'necessity' else r.necessity end,
      planning = case when v_campi ? 'planning' then v_campi ->> 'planning' else r.planning end,
      excluded = coalesce((v_campi ->> 'excluded')::boolean, r.excluded)
      where r.id = v_id::uuid;
  end loop;
  for v_voce in select value from jsonb_array_elements(p_modifiche -> 'nuove') loop
    insert into public.family_draft_items
      (draft_id, name, qty, unit_price, discount, amount, group_id, category_id,
       subcategory, canonical_category_id, canonical_subcategory_id, necessity, planning)
    values ((v_voce ->> 'draft_id')::uuid, v_voce ->> 'name',
       coalesce((v_voce ->> 'qty')::numeric, 1), (v_voce ->> 'unit_price')::numeric,
       coalesce((v_voce ->> 'discount')::numeric, 0), (v_voce ->> 'amount')::numeric,
       (v_voce ->> 'group_id')::uuid, (v_voce ->> 'category_id')::uuid,
       v_voce ->> 'subcategory', (v_voce ->> 'canonical_category_id')::uuid,
       (v_voce ->> 'canonical_subcategory_id')::uuid,
       v_voce ->> 'necessity', v_voce ->> 'planning')
    returning id into v_nuovo_id;
    v_mappa := v_mappa || jsonb_build_object('client_ref', v_voce ->> 'client_ref', 'id', v_nuovo_id);
  end loop;
  update public.family_documents set revisione_rev = revisione_rev + 1
    where id = p_document_id returning revisione_rev into v_doc.revisione_rev;
  insert into public.family_revision_ops (op_key, document_id, kind, base_rev, manifesto_sha256, esito)
    values (p_op_key, p_document_id, 'salva', p_base_rev, v_impronta,
      jsonb_build_object('rev_dopo', v_doc.revisione_rev, 'righe_nuove', v_mappa));
  exception when unique_violation then
    -- COLLISIONE GLOBALE della chiave (stessa op_key su DOCUMENTI
    -- diversi, in parallelo: i lock di riga non si incontrano). SOLO la
    -- collisione del giornale si gestisce qui: qualunque ALTRA
    -- violazione unica risale intatta (mai mascherata)
    get stacked diagnostics v_vincolo = CONSTRAINT_NAME;
    if v_vincolo is distinct from 'family_revision_ops_pkey' then raise; end if;
    -- le scritture del blocco sono state ANNULLATE dal savepoint del
    -- blocco stesso: si risponde guardando cosa c'è davvero a giornale
    select * into v_reg from public.family_revision_ops where op_key = p_op_key;
    if v_reg.document_id = p_document_id and v_reg.kind = 'salva'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end;
  return jsonb_build_object('esito', 'APPLICATA', 'rev_dopo', v_doc.revisione_rev, 'righe_nuove', v_mappa);
end $$;

-- 5) ESITO_REVISIONE: l'esito riferibile all'operazione ----------------------
create or replace function public.esito_revisione(p_op_key uuid)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare v_reg record;
begin
  if not private.is_app_member() then raise exception 'NON_MEMBRO'; end if;
  select * into v_reg from public.family_revision_ops where op_key = p_op_key;
  if not found then return jsonb_build_object('stato', 'assente'); end if;
  return jsonb_build_object('stato', 'applicata',
    'document_id', v_reg.document_id, 'kind', v_reg.kind,
    'base_rev', v_reg.base_rev, 'manifesto_sha256', v_reg.manifesto_sha256,
    'esito', v_reg.esito);
end $$;

-- 6) CHIUSURE VERSIONATE (pre-transizione chiamano ancora le RPC 0020) -------
create or replace function public.conferma_revisione(
  p_op_key uuid, p_document_id uuid, p_base_rev bigint, p_correzioni jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_doc record; v_reg record; v_impronta text; v_spese uuid[]; v_ordinate jsonb; v_vincolo text;
begin
  if not private.is_app_member() then raise exception 'NON_MEMBRO'; end if;
  -- le CORREZIONI si ORDINANO come fa il client (draft_id,
  -- draft_item_id, field) PRIMA della canonicalizzazione: vettore
  -- «correzioni da riordinare» nei vettori comuni
  select coalesce(jsonb_agg(c order by
      coalesce(c ->> 'draft_id', ''), coalesce(c ->> 'draft_item_id', ''), coalesce(c ->> 'field', '')),
    '[]'::jsonb)
    into v_ordinate from jsonb_array_elements(p_correzioni) as c;
  v_impronta := private.impronta_canonica(jsonb_build_object(
    'kind', 'conferma', 'document_id', p_document_id, 'base_rev', p_base_rev,
    'correzioni', v_ordinate));
  select * into v_reg from public.family_revision_ops where op_key = p_op_key;
  if found then
    if v_reg.document_id = p_document_id and v_reg.kind = 'conferma'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end if;
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then return jsonb_build_object('esito', 'IDENTIFICATIVO_MANCANTE'); end if;
  -- ricontrollo del giornale DOPO l'attesa del lock (Read Committed)
  select * into v_reg from public.family_revision_ops where op_key = p_op_key;
  if found then
    if v_reg.document_id = p_document_id and v_reg.kind = 'conferma'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end if;
  if v_doc.status <> 'in_revisione' then
    return jsonb_build_object('esito', 'DOCUMENTO_NON_MODIFICABILE', 'dettaglio', v_doc.status);
  end if;
  if p_base_rev <> v_doc.revisione_rev then return jsonb_build_object('esito', 'SUPERATA'); end if;
  -- il perimetro atomico contiene TUTTO: anche la chiamata documentale
  -- (logica 0020, mai duplicata; la transizione la ripunterà a
  -- private.*) viene annullata se il giornale rifiuta la chiave
  begin
    select array_agg(id) into v_spese from unnest(public.conferma_documento(p_document_id, p_correzioni)) as id;
    update public.family_documents set revisione_rev = revisione_rev + 1
      where id = p_document_id returning revisione_rev into v_doc.revisione_rev;
    insert into public.family_revision_ops (op_key, document_id, kind, base_rev, manifesto_sha256, esito)
      values (p_op_key, p_document_id, 'conferma', p_base_rev, v_impronta,
        jsonb_build_object('rev_dopo', v_doc.revisione_rev, 'spese', to_jsonb(coalesce(v_spese, '{}'))));
  exception when unique_violation then
    get stacked diagnostics v_vincolo = CONSTRAINT_NAME;
    if v_vincolo is distinct from 'family_revision_ops_pkey' then raise; end if;
    select * into v_reg from public.family_revision_ops where op_key = p_op_key;
    if v_reg.document_id = p_document_id and v_reg.kind = 'conferma'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end;
  return jsonb_build_object('esito', 'APPLICATA', 'rev_dopo', v_doc.revisione_rev, 'spese', to_jsonb(coalesce(v_spese, '{}')));
end $$;

create or replace function public.scarta_revisione(
  p_op_key uuid, p_document_id uuid, p_base_rev bigint, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_doc record; v_reg record; v_impronta text; v_vincolo text;
begin
  if not private.is_app_member() then raise exception 'NON_MEMBRO'; end if;
  v_impronta := private.impronta_canonica(jsonb_build_object(
    'kind', 'scarto', 'document_id', p_document_id, 'base_rev', p_base_rev, 'motivo', p_motivo));
  select * into v_reg from public.family_revision_ops where op_key = p_op_key;
  if found then
    if v_reg.document_id = p_document_id and v_reg.kind = 'scarto'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end if;
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then return jsonb_build_object('esito', 'IDENTIFICATIVO_MANCANTE'); end if;
  -- ricontrollo del giornale DOPO l'attesa del lock (Read Committed)
  select * into v_reg from public.family_revision_ops where op_key = p_op_key;
  if found then
    if v_reg.document_id = p_document_id and v_reg.kind = 'scarto'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end if;
  if v_doc.status <> 'in_revisione' then
    return jsonb_build_object('esito', 'DOCUMENTO_NON_MODIFICABILE', 'dettaglio', v_doc.status);
  end if;
  if p_base_rev <> v_doc.revisione_rev then return jsonb_build_object('esito', 'SUPERATA'); end if;
  -- perimetro atomico: anche lo scarto documentale dentro il blocco
  begin
    perform public.scarta_documento(p_document_id, p_motivo);
    update public.family_documents set revisione_rev = revisione_rev + 1
      where id = p_document_id returning revisione_rev into v_doc.revisione_rev;
    insert into public.family_revision_ops (op_key, document_id, kind, base_rev, manifesto_sha256, esito)
      values (p_op_key, p_document_id, 'scarto', p_base_rev, v_impronta,
        jsonb_build_object('rev_dopo', v_doc.revisione_rev));
  exception when unique_violation then
    get stacked diagnostics v_vincolo = CONSTRAINT_NAME;
    if v_vincolo is distinct from 'family_revision_ops_pkey' then raise; end if;
    select * into v_reg from public.family_revision_ops where op_key = p_op_key;
    if v_reg.document_id = p_document_id and v_reg.kind = 'scarto'
       and v_reg.base_rev = p_base_rev and v_reg.manifesto_sha256 = v_impronta then
      return jsonb_build_object('esito', 'RIPETUTA') || v_reg.esito;
    end if;
    return jsonb_build_object('esito', 'CHIAVE_RIUSATA');
  end;
  return jsonb_build_object('esito', 'APPLICATA', 'rev_dopo', v_doc.revisione_rev);
end $$;

-- 7) PERMESSI minimi sulle funzioni nuove ------------------------------------
revoke all on function public.salva_revisione(uuid, uuid, bigint, jsonb) from public, anon, service_role;
revoke all on function public.esito_revisione(uuid) from public, anon, service_role;
revoke all on function public.conferma_revisione(uuid, uuid, bigint, jsonb) from public, anon, service_role;
revoke all on function public.scarta_revisione(uuid, uuid, bigint, text) from public, anon, service_role;
grant execute on function public.salva_revisione(uuid, uuid, bigint, jsonb) to authenticated;
grant execute on function public.esito_revisione(uuid) to authenticated;
grant execute on function public.conferma_revisione(uuid, uuid, bigint, jsonb) to authenticated;
grant execute on function public.scarta_revisione(uuid, uuid, bigint, text) to authenticated;
revoke all on function private.canonico(jsonb) from public, anon, authenticated;
revoke all on function private.impronta_canonica(jsonb) from public, anon, authenticated;

commit;

-- NOTE DI COLLAUDO (da eseguire nell'ambiente isolato, mai qui):
--  · vettori comuni: private.impronta_canonica sui valori di
--    contrattoVettori.ts deve dare le stesse impronte (attenzione a
--    numeric: 12.50 ≠ "12.5" — normalizzare, o il replay non combacia);
--  · firma esatta di conferma_documento/scarta_documento in 0020 da
--    verificare prima del collaudo (tipo di ritorno e argomenti);
--  · pgcrypto/digest: su Supabase vive nello schema extensions;
--  · CONCORRENZA da verificare davvero (diagnosi statica, Read
--    Committed): due identiche → APPLICATA+RIPETUTA (ricontrollo
--    post-lock); stessa chiave su documenti DIVERSI → una registrata,
--    l'altra CHIAVE_RIUSATA; per il ramo PERDENTE verificare che
--    documento, bozze, righe, spese e revisione_rev restino IDENTICI
--    allo stato iniziale (il blocco d'eccezione contiene ORA tutte le
--    scritture: l'annullamento riguarda solo l'interno del blocco,
--    come da documentazione plpgsql) e che il giornale non abbia la sua
--    voce; una violazione unica DIVERSA dal vincolo del giornale deve
--    risalire intatta (get stacked diagnostics sul CONSTRAINT_NAME).
