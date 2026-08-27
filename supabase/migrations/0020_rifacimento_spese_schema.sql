-- ============================================================================
-- 0020 — RIFACIMENTO SPESE: SCHEMA (Fase 2A, 28/08/2026)
--
-- ⚠️  NON ANCORA DA APPLICARE. Si applica solo in Fase 2B (progetto di
--     prova, dati anonimizzati) e poi in Fase 2C (database vero) dopo:
--     backup aggiornato + seconda copia esterna + prova riuscita +
--     approvazione esplicita di Ania. Vedi PIANO-RIFACIMENTO-SPESE.md §5.
--
-- Contenuto: tabelle nuove (documenti, bozze, ponte, correzioni, canoniche,
-- app_members), colonne nuove sulle tabelle storiche, vincoli, indici,
-- backfill con conteggi verificati a RUNTIME, RPC economiche atomiche e
-- idempotenti. SOLO ADDITIVA: nessun rename/drop/update distruttivo.
--
-- Le tabelle NUOVE nascono con RLS ATTIVA e NESSUNA policy (chiuse a tutti
-- tranne il service role) finché la 0021 non installa le policy vere.
-- Le policy delle tabelle STORICHE non vengono toccate qui (anti-lockout:
-- prima bootstrap_owner.sql, poi 0021_protezione_family.sql).
--
-- Invariante economica (piano §3): in family_expenses entra SOLO denaro
-- realmente uscito. Le fatture approvate ma non pagate restano documenti
-- in stato 'approvata_da_pagare' con le righe nelle bozze.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TASSONOMIA CANONICA (per ID, mai per nome)
-- ----------------------------------------------------------------------------
create table if not exists family_canonical_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ambito text not null check (ambito in ('personale', 'azienda', 'condivisa')),
  sort int not null default 0,
  monitorata boolean not null default false,   -- Altro/Varie: uso segnalato nelle analisi
  created_at timestamptz not null default now(),
  unique (name, ambito)
);

create table if not exists family_canonical_subcategories (
  id uuid primary key default gen_random_uuid(),
  canonical_category_id uuid not null references family_canonical_categories(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (canonical_category_id, name),
  -- chiave d'appoggio per la FK composita di coerenza (sottocategoria
  -- che DEVE appartenere alla categoria scelta) usata dalle altre tabelle
  unique (id, canonical_category_id)
);

-- mappatura storico → canonico (si popola in fase 6, solo a corrispondenza sicura)
alter table family_categories
  add column if not exists canonical_category_id uuid references family_canonical_categories(id);

create table if not exists family_subcategory_map (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,          -- come family_subcategories.category_name
  subcategory_name text not null,
  canonical_subcategory_id uuid not null references family_canonical_subcategories(id),
  created_at timestamptz not null default now(),
  unique (category_name, subcategory_name)
);

-- ----------------------------------------------------------------------------
-- 2. DOCUMENTO LOGICO (scontrino/fattura) — separato dai file
-- ----------------------------------------------------------------------------
create table if not exists family_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'scontrino' check (kind in ('scontrino', 'fattura', 'altro')),
  doc_total numeric(10,2) check (doc_total is null or doc_total >= 0), -- QUI e solo qui
  supplier text,
  invoice_number text,
  document_date date,                    -- data del documento (fattura)
  due_date date,                         -- scadenza: vive sul documento
  -- ciclo di vita (transizioni documentate in lib/spese/stati.ts):
  --   da_elaborare → in_revisione → confermato            (scontrini)
  --   da_elaborare → in_revisione → approvata_da_pagare → confermato (fatture)
  --   da_elaborare|in_revisione → errore → da_elaborare   (nuovo tentativo)
  --   da_elaborare|in_revisione|errore → scartato
  status text not null default 'da_elaborare' check (status in
    ('da_elaborare', 'in_revisione', 'approvata_da_pagare', 'confermato', 'errore', 'scartato')),
  ambito text not null default 'personale' check (ambito in ('personale', 'azienda')),
  error_message text,
  note text,                             -- la nota di Ania per l'elaborazione
  doc_total_derivato boolean not null default false, -- true per gli 81 storici (totale = somma sorelle)
  created_at timestamptz not null default now()
);
create index if not exists family_documents_status_idx on family_documents (status);
create index if not exists family_documents_due_idx on family_documents (due_date)
  where status = 'approvata_da_pagare';

-- ----------------------------------------------------------------------------
-- 3. FAMILY_RECEIPTS diventa SOLO file/pagine
-- ----------------------------------------------------------------------------
-- Eliminare un documento NON cancella la riga-file (set null): i file nello
-- storage non si toccano mai automaticamente.
alter table family_receipts
  add column if not exists document_id uuid references family_documents(id) on delete set null,
  add column if not exists page_order int not null default 1,
  add column if not exists mime_type text,
  add column if not exists file_sha256 text;

alter table family_receipts drop constraint if exists family_receipts_page_order_positiva;
alter table family_receipts add constraint family_receipts_page_order_positiva
  check (page_order > 0);
-- ordine pagina unico dentro lo stesso documento
create unique index if not exists family_receipts_document_page_uq
  on family_receipts (document_id, page_order) where document_id is not null;
-- stesso file due volte = duplicato certo
create unique index if not exists family_receipts_sha_uq
  on family_receipts (file_sha256) where file_sha256 is not null;

-- ----------------------------------------------------------------------------
-- 4. BOZZE (mai dentro family_expenses: Home/Statistiche non le vedono MAI)
-- ----------------------------------------------------------------------------
create table if not exists family_draft_expenses (
  id uuid primary key default gen_random_uuid(),
  -- bozze non confermate cadono col documento; quelle confermate vengono
  -- preservate come audit dal trigger-meno: on delete cascade è accettato
  -- SOLO perché la conferma valorizza expense_id e il documento confermato
  -- non si elimina dall'app (vincolo di interfaccia, fase 3+).
  document_id uuid references family_documents(id) on delete cascade,
  expense_date date not null,
  group_id uuid references family_groups(id),
  category_id uuid references family_categories(id),      -- compatibilità
  subcategory text,                                        -- compatibilità
  canonical_category_id uuid references family_canonical_categories(id),
  canonical_subcategory_id uuid,
  store text,
  description text,
  payment_method text check (payment_method is null or payment_method in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro')),
  room_id uuid references rooms(id),
  expense_nature text check (expense_nature is null or expense_nature in
    ('ordinaria', 'ricorrente', 'straordinaria')),
  status text not null default 'da_controllare' check (status in
    ('da_controllare', 'pronta', 'confermata', 'scartata', 'errore')),
  -- affidabilità PER CAMPO: { campo: { proposto, confidence, doubt_reason } }
  confidence jsonb not null default '{}'::jsonb,
  arrotondamento_cent int not null default 0,  -- SOLO se letto dal documento o dichiarato dall'utente
  discard_reason text,
  -- collegamento certo bozza → spesa definitiva; UNIQUE = una bozza non può
  -- produrre due spese (idempotenza della conferma)
  expense_id uuid unique references family_expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  -- coerenza canonica: la sottocategoria appartiene alla categoria scelta
  foreign key (canonical_subcategory_id, canonical_category_id)
    references family_canonical_subcategories (id, canonical_category_id)
);
create index if not exists family_draft_expenses_document_idx on family_draft_expenses (document_id);
create index if not exists family_draft_expenses_status_idx on family_draft_expenses (status);

create table if not exists family_draft_items (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references family_draft_expenses(id) on delete cascade,
  raw_name text,                      -- descrizione originale stampata sullo scontrino
  name text not null,                 -- descrizione normalizzata
  qty numeric(10,3) not null default 1 check (qty > 0),
  unit_price numeric(10,3) check (unit_price is null or unit_price >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  amount numeric(10,2) not null check (amount >= 0),
  group_id uuid references family_groups(id),   -- destinatario della singola riga
  category_id uuid references family_categories(id),      -- compatibilità
  subcategory text,                                        -- compatibilità
  canonical_category_id uuid references family_canonical_categories(id),
  canonical_subcategory_id uuid,
  -- facoltative, VUOTE per default: Claude non le compila mai
  necessity text check (necessity is null or necessity in ('necessario', 'discrezionale')),
  planning text check (planning is null or planning in ('previsto', 'impulsivo')),
  confidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (canonical_subcategory_id, canonical_category_id)
    references family_canonical_subcategories (id, canonical_category_id)
);
create index if not exists family_draft_items_draft_idx on family_draft_items (draft_id);

-- ----------------------------------------------------------------------------
-- 5. COLONNE NUOVE SULLE TABELLE STORICHE (solo confermate = denaro uscito)
-- ----------------------------------------------------------------------------
alter table family_expenses
  add column if not exists payment_method text check (payment_method is null or payment_method in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro')),
  add column if not exists paid_at date,
  add column if not exists room_id uuid references rooms(id),
  add column if not exists expense_nature text check (expense_nature is null or expense_nature in
    ('ordinaria', 'ricorrente', 'straordinaria')),
  add column if not exists canonical_category_id uuid references family_canonical_categories(id),
  add column if not exists canonical_subcategory_id uuid,
  add column if not exists notes text;
-- coerenza canonica anche qui (vincolo nominato, aggiunto a parte perché
-- "add column if not exists" non accetta FK composite)
alter table family_expenses drop constraint if exists family_expenses_canoniche_coerenti_fk;
alter table family_expenses add constraint family_expenses_canoniche_coerenti_fk
  foreign key (canonical_subcategory_id, canonical_category_id)
  references family_canonical_subcategories (id, canonical_category_id);

alter table family_expense_items
  add column if not exists raw_name text,
  add column if not exists unit_price numeric(10,3) check (unit_price is null or unit_price >= 0),
  add column if not exists discount numeric(10,2) default 0,
  add column if not exists group_id uuid references family_groups(id),
  add column if not exists canonical_category_id uuid references family_canonical_categories(id),
  add column if not exists canonical_subcategory_id uuid,
  add column if not exists necessity text check (necessity is null or necessity in ('necessario', 'discrezionale')),
  add column if not exists planning text check (planning is null or planning in ('previsto', 'impulsivo'));
alter table family_expense_items drop constraint if exists family_expense_items_canoniche_coerenti_fk;
alter table family_expense_items add constraint family_expense_items_canoniche_coerenti_fk
  foreign key (canonical_subcategory_id, canonical_category_id)
  references family_canonical_subcategories (id, canonical_category_id);
-- qty>0 sui dati storici: verificato sul backup del 27/08 (tutte positive);
-- NOT VALID per non bloccare la migrazione se nel frattempo fosse entrato
-- un dato anomalo — si valida con: alter table .. validate constraint ..
alter table family_expense_items drop constraint if exists family_expense_items_qty_positiva;
alter table family_expense_items add constraint family_expense_items_qty_positiva
  check (qty > 0) not valid;

-- ----------------------------------------------------------------------------
-- 6. PONTE SPESA ↔ DOCUMENTO e LOG CORREZIONI
-- ----------------------------------------------------------------------------
-- Eliminare un documento elimina SOLO il collegamento, MAI la spesa
-- (nessuna FK da family_expenses verso i documenti).
create table if not exists family_expense_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references family_expenses(id) on delete cascade,
  document_id uuid not null references family_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (expense_id, document_id)
);
create index if not exists family_expense_documents_document_idx
  on family_expense_documents (document_id);

create table if not exists family_corrections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references family_documents(id) on delete set null,
  draft_id uuid references family_draft_expenses(id) on delete set null,
  draft_item_id uuid references family_draft_items(id) on delete set null,
  expense_id uuid references family_expenses(id) on delete set null,
  item_id uuid references family_expense_items(id) on delete set null,
  field text not null,
  proposed jsonb,                      -- valori strutturati, non solo testo
  corrected jsonb,
  rule_applied text,
  source text not null default 'revisione' check (source in ('revisione', 'duplicato', 'avviso')),
  created_at timestamptz not null default now(),
  -- almeno un riferimento valorizzato
  check (num_nonnulls(document_id, draft_id, draft_item_id, expense_id, item_id) >= 1)
);

-- ----------------------------------------------------------------------------
-- 7. LISTA UTENTI AUTORIZZATI (schema qui; policy e funzioni nella 0021)
-- ----------------------------------------------------------------------------
create table if not exists app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

-- Le tabelle nuove nascono CHIUSE: RLS attiva, nessuna policy permissiva.
-- Il service role le bypassa; gli utenti autenticati NON vi accedono finché
-- la 0021 (dopo il bootstrap dell'owner) non installa le policy is_app_member().
alter table family_canonical_categories    enable row level security;
alter table family_canonical_subcategories enable row level security;
alter table family_subcategory_map         enable row level security;
alter table family_documents               enable row level security;
alter table family_draft_expenses          enable row level security;
alter table family_draft_items             enable row level security;
alter table family_expense_documents       enable row level security;
alter table family_corrections             enable row level security;
alter table app_members                    enable row level security;

-- ----------------------------------------------------------------------------
-- 8. BACKFILL STORICO (idempotente, conteggi verificati a RUNTIME)
-- ----------------------------------------------------------------------------
-- ① un documento per ogni receipt storico senza documento (1:1), collegato
--    in modo deterministico via tabella temporanea; rieseguibile perché al
--    secondo giro "document_id is null" non seleziona più nulla.
do $$
declare
  v_links_attesi int;
  v_links_creati int;
begin
  create temp table if not exists _map_receipt_doc on commit drop as
    select r.id as receipt_id,
           gen_random_uuid() as document_id,
           case when r.status = 'letto' then 'confermato' else 'da_elaborare' end as status,
           coalesce(r.ambito, 'personale') as ambito,
           r.note,
           (select sum(e.amount) from family_expenses e where e.receipt_id = r.id) as doc_total,
           r.uploaded_at
    from family_receipts r
    where r.document_id is null;

  insert into family_documents (id, kind, status, ambito, note, doc_total, doc_total_derivato, created_at)
  select document_id, 'scontrino', status, ambito, note, doc_total, true, uploaded_at
  from _map_receipt_doc;

  update family_receipts r
  set document_id = m.document_id
  from _map_receipt_doc m
  where r.id = m.receipt_id;

  -- ② ponte spesa↔documento per tutte le spese con receipt_id
  insert into family_expense_documents (expense_id, document_id)
  select e.id, r.document_id
  from family_expenses e
  join family_receipts r on r.id = e.receipt_id
  where r.document_id is not null
  on conflict (expense_id, document_id) do nothing;

  -- ③ VERIFICA A RUNTIME (mai numeri scritti a mano: al 27/08 erano 215
  --    collegamenti su 81 documenti, ma fa fede il conteggio di adesso)
  select count(*) into v_links_attesi from family_expenses where receipt_id is not null;
  select count(*) into v_links_creati from family_expense_documents;
  if v_links_creati < v_links_attesi then
    raise exception 'Backfill incompleto: % collegamenti creati, % attesi', v_links_creati, v_links_attesi;
  end if;
  if exists (select 1 from family_receipts where document_id is null) then
    raise exception 'Backfill incompleto: esistono receipts senza documento';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 9. RPC ECONOMICHE — atomiche e idempotenti
-- ----------------------------------------------------------------------------
-- Helper interno: crea le spese sorelle definitive dalle bozze attive di un
-- documento. Presuppone il lock già preso dal chiamante. Ritorna gli id.
create or replace function _spese_crea_da_bozze(
  p_document_id uuid,
  p_expense_date date,      -- null = usa la data della bozza (scontrini)
  p_paid_at date,
  p_payment_method text
) returns uuid[]
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_doc family_documents%rowtype;
  v_bozza family_draft_expenses%rowtype;
  v_somma_cent bigint := 0;
  v_arrotondamento_cent bigint := 0;
  v_expense_id uuid;
  v_ids uuid[] := '{}';
begin
  select * into v_doc from family_documents where id = p_document_id;

  -- quadratura ESATTA su TUTTE le righe di TUTTE le bozze attive
  if v_doc.doc_total is null then
    raise exception 'Totale documento mancante: conferma bloccata';
  end if;
  select coalesce(sum(b.arrotondamento_cent), 0) into v_arrotondamento_cent
  from family_draft_expenses b
  where b.document_id = p_document_id and b.status in ('da_controllare', 'pronta');
  select coalesce(sum(round(i.amount * 100)::bigint), 0) into v_somma_cent
  from family_draft_expenses b
  join family_draft_items i on i.draft_id = b.id
  where b.document_id = p_document_id and b.status in ('da_controllare', 'pronta');

  if v_somma_cent + v_arrotondamento_cent <> round(v_doc.doc_total * 100)::bigint then
    raise exception 'Quadratura non esatta: righe+arrotondamento=% cent, documento=% cent',
      v_somma_cent + v_arrotondamento_cent, round(v_doc.doc_total * 100)::bigint;
  end if;

  for v_bozza in
    select * from family_draft_expenses
    where document_id = p_document_id and status in ('da_controllare', 'pronta')
    order by created_at
  loop
    insert into family_expenses
      (expense_date, amount, group_id, category_id, subcategory, store, description,
       recurring, source, receipt_id, payment_method, paid_at, room_id, expense_nature,
       canonical_category_id, canonical_subcategory_id)
    select coalesce(p_expense_date, v_bozza.expense_date),
           (select coalesce(sum(i.amount), 0) from family_draft_items i where i.draft_id = v_bozza.id),
           v_bozza.group_id, v_bozza.category_id, v_bozza.subcategory, v_bozza.store,
           v_bozza.description, false, 'foto', null,
           coalesce(p_payment_method, v_bozza.payment_method), p_paid_at,
           v_bozza.room_id, v_bozza.expense_nature,
           v_bozza.canonical_category_id, v_bozza.canonical_subcategory_id
    returning id into v_expense_id;

    insert into family_expense_items
      (expense_id, name, amount, qty, category_id, subcategory,
       raw_name, unit_price, discount, group_id,
       canonical_category_id, canonical_subcategory_id, necessity, planning)
    select v_expense_id, i.name, i.amount, i.qty, i.category_id, i.subcategory,
           i.raw_name, i.unit_price, i.discount, i.group_id,
           i.canonical_category_id, i.canonical_subcategory_id, i.necessity, i.planning
    from family_draft_items i where i.draft_id = v_bozza.id;

    insert into family_expense_documents (expense_id, document_id)
    values (v_expense_id, p_document_id)
    on conflict (expense_id, document_id) do nothing;

    -- collegamento certo bozza → spesa (unique: mai due volte)
    update family_draft_expenses
    set status = 'confermata', expense_id = v_expense_id
    where id = v_bozza.id;

    v_ids := v_ids || v_expense_id;
  end loop;

  if array_length(v_ids, 1) is null then
    raise exception 'Nessuna bozza attiva da confermare per questo documento';
  end if;

  update family_documents set status = 'confermato' where id = p_document_id;
  return v_ids;
end $$;

-- Conferma di uno SCONTRINO (o fattura già pagata al momento della revisione):
-- documento in_revisione → confermato, spese con la data della bozza.
create or replace function conferma_documento(p_document_id uuid)
returns uuid[]
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_gia uuid[];
begin
  -- lock del documento per tutta l'operazione
  select status into v_status from family_documents
  where id = p_document_id for update;
  if not found then
    raise exception 'Documento inesistente';
  end if;

  -- idempotenza: già confermato ⇒ restituisce le spese esistenti, zero doppioni
  if v_status = 'confermato' then
    select coalesce(array_agg(expense_id), '{}') into v_gia
    from family_draft_expenses
    where document_id = p_document_id and expense_id is not null;
    return v_gia;
  end if;

  if v_status <> 'in_revisione' then
    raise exception 'Stato non valido per la conferma: % (serve in_revisione)', v_status;
  end if;

  return _spese_crea_da_bozze(p_document_id, null, null, null);
end $$;

-- Pagamento di una FATTURA approvata da pagare: RPC separata e idempotente.
-- Crea le spese sorelle con expense_date = paid_at = data reale di pagamento.
create or replace function paga_fattura(
  p_document_id uuid,
  p_data_pagamento date,
  p_payment_method text default null
) returns uuid[]
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_gia uuid[];
begin
  select status into v_status from family_documents
  where id = p_document_id for update;
  if not found then
    raise exception 'Documento inesistente';
  end if;

  -- idempotenza: secondo tentativo ⇒ nessun duplicato
  if v_status = 'confermato' then
    select coalesce(array_agg(expense_id), '{}') into v_gia
    from family_draft_expenses
    where document_id = p_document_id and expense_id is not null;
    return v_gia;
  end if;

  if v_status <> 'approvata_da_pagare' then
    raise exception 'Stato non valido per il pagamento: % (serve approvata_da_pagare)', v_status;
  end if;
  if p_data_pagamento is null then
    raise exception 'Data di pagamento obbligatoria';
  end if;

  return _spese_crea_da_bozze(p_document_id, p_data_pagamento, p_data_pagamento, p_payment_method);
end $$;

-- Le RPC girano con i permessi del chiamante (security INVOKER, il default):
-- rispettano la RLS. Niente accesso anonimo:
revoke execute on function _spese_crea_da_bozze(uuid, date, date, text) from public, anon;
revoke execute on function conferma_documento(uuid) from public, anon;
revoke execute on function paga_fattura(uuid, date, text) from public, anon;
