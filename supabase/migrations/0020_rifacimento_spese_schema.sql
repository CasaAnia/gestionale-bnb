-- ============================================================================
-- 0020 — RIFACIMENTO SPESE: SCHEMA (Fase 2A, rivista in 2A.1 il 28/08/2026)
--
-- ⚠️  NON ANCORA DA APPLICARE. Ordine previsto: 0020 → bootstrap_owner.sql →
--     0021. Prima in Fase 2B (progetto di prova, dati anonimizzati), poi in
--     Fase 2C (database vero) dopo backup aggiornato + seconda copia esterna
--     + prova riuscita + approvazione esplicita. PIANO-RIFACIMENTO-SPESE.md §5.
--
-- SOLO ADDITIVA: nessun rename/drop/update distruttivo sullo storico.
-- Le tabelle NUOVE nascono con RLS ATTIVA e NESSUNA policy (chiuse a tutti
-- tranne il service role) finché la 0021 non installa le policy dei membri.
-- Le policy delle tabelle STORICHE non vengono toccate qui.
--
-- Invarianti (piano §3):
--  - in family_expenses entra SOLO denaro realmente uscito;
--  - la somma delle spese sorelle definitive è SEMPRE identica a doc_total
--    (arrotondamenti conservati come riga esplicita "Arrotondamento");
--  - le fatture approvate ma non pagate restano documenti
--    'approvata_da_pagare' senza alcuna spesa.
-- ============================================================================

-- Schema per gli helper NON esposti (le funzioni di sicurezza arrivano
-- con la 0021; qui serve per l'helper delle RPC).
create schema if not exists private;
-- authenticated deve poter RISOLVERE lo schema (per le policy della 0021),
-- ma riceve execute solo sulle funzioni esplicitamente concesse.
grant usage on schema private to authenticated;

-- ----------------------------------------------------------------------------
-- 1. TASSONOMIA CANONICA (per ID, mai per nome)
-- ----------------------------------------------------------------------------
create table if not exists public.family_canonical_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ambito text not null check (ambito in ('personale', 'azienda', 'condivisa')),
  sort int not null default 0,
  monitorata boolean not null default false,   -- Altro/Varie: uso segnalato nelle analisi
  created_at timestamptz not null default now(),
  unique (name, ambito)
);

create table if not exists public.family_canonical_subcategories (
  id uuid primary key default gen_random_uuid(),
  canonical_category_id uuid not null references public.family_canonical_categories(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (canonical_category_id, name),
  -- chiave d'appoggio per la FK composita di coerenza (la sottocategoria
  -- DEVE appartenere alla categoria scelta) usata dalle altre tabelle
  unique (id, canonical_category_id)
);

alter table public.family_categories
  add column if not exists canonical_category_id uuid references public.family_canonical_categories(id);

create table if not exists public.family_subcategory_map (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,
  subcategory_name text not null,
  canonical_subcategory_id uuid not null references public.family_canonical_subcategories(id),
  created_at timestamptz not null default now(),
  unique (category_name, subcategory_name)
);

-- ----------------------------------------------------------------------------
-- 2. DOCUMENTO LOGICO — separato dai file
-- ----------------------------------------------------------------------------
create table if not exists public.family_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'scontrino' check (kind in ('scontrino', 'fattura', 'altro')),
  doc_total numeric(10,2) check (doc_total is null or doc_total >= 0), -- QUI e solo qui
  supplier text,
  invoice_number text,
  document_date date,                    -- data del documento (per le fatture resta QUESTA)
  due_date date,                         -- scadenza: vive sul documento
  -- transizioni (lib/spese/stati.ts):
  --   da_elaborare → in_revisione → confermato                       (scontrini)
  --   da_elaborare → in_revisione → approvata_da_pagare → confermato (fatture)
  --   da_elaborare|in_revisione → errore → da_elaborare; → scartato
  status text not null default 'da_elaborare' check (status in
    ('da_elaborare', 'in_revisione', 'approvata_da_pagare', 'confermato', 'errore', 'scartato')),
  -- SOLO provenienza del caricamento (da quale sezione è entrata la foto):
  -- l'ambito ECONOMICO deriva sempre dalle spese/righe sorelle. Uno
  -- scontrino misto Casa Mia/Casa Ania è normale: questo campo NON va mai
  -- usato per totali o statistiche.
  upload_ambito text not null default 'personale' check (upload_ambito in ('personale', 'azienda')),
  error_message text,
  note text,
  doc_total_derivato boolean not null default false, -- storici: totale = somma sorelle
  created_at timestamptz not null default now()
);
create index if not exists family_documents_status_idx on public.family_documents (status);
create index if not exists family_documents_due_idx on public.family_documents (due_date)
  where status = 'approvata_da_pagare';

-- ----------------------------------------------------------------------------
-- 3. FAMILY_RECEIPTS diventa SOLO file/pagine
-- ----------------------------------------------------------------------------
-- Eliminare un FILE non tocca documento/bozze/spese (la FK va dal file al
-- documento). Eliminare un documento con file collegati è VIETATO dal
-- database (restrict), non dall'interfaccia: prima si scollega/spostano i
-- file consapevolmente.
alter table public.family_receipts
  add column if not exists document_id uuid references public.family_documents(id) on delete restrict,
  add column if not exists page_order int not null default 1,
  add column if not exists mime_type text,
  add column if not exists file_sha256 text;

alter table public.family_receipts drop constraint if exists family_receipts_page_order_positiva;
alter table public.family_receipts add constraint family_receipts_page_order_positiva
  check (page_order > 0);
create unique index if not exists family_receipts_document_page_uq
  on public.family_receipts (document_id, page_order) where document_id is not null;
create unique index if not exists family_receipts_sha_uq
  on public.family_receipts (file_sha256) where file_sha256 is not null;

-- ----------------------------------------------------------------------------
-- 4. BOZZE (mai dentro family_expenses)
-- ----------------------------------------------------------------------------
-- Lo scarto è LOGICO (status='scartata'), mai cancellazione fisica.
-- document_id OBBLIGATORIO: ogni bozza nasce dal flusso documentale (la
-- spesa manuale senza foto bypassa le bozze e va diretta in family_expenses).
-- on delete RESTRICT: un documento con bozze non si elimina — l'audit
-- (bozza confermata → spesa) è protetto dal database, non dall'interfaccia.
create table if not exists public.family_draft_expenses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.family_documents(id) on delete restrict,
  expense_date date not null,
  group_id uuid references public.family_groups(id),   -- BLOCCANTE alla conferma se nullo
  category_id uuid references public.family_categories(id),      -- compatibilità
  subcategory text,                                               -- compatibilità
  canonical_category_id uuid references public.family_canonical_categories(id),
  canonical_subcategory_id uuid,
  store text,
  description text,
  payment_method text check (payment_method is null or payment_method in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro')),
  room_id uuid references public.rooms(id),
  expense_nature text check (expense_nature is null or expense_nature in
    ('ordinaria', 'ricorrente', 'straordinaria')),
  status text not null default 'da_controllare' check (status in
    ('da_controllare', 'pronta', 'confermata', 'scartata', 'errore')),
  confidence jsonb not null default '{}'::jsonb,  -- PER CAMPO
  -- arrotondamento di cassa (positivo o negativo, in centesimi): SOLO se
  -- letto dal documento o dichiarato dall'utente; alla conferma diventa
  -- una riga esplicita "Arrotondamento" della spesa di QUESTA sorella
  arrotondamento_cent int not null default 0,
  discard_reason text,
  -- restrict (2A.2): l'audit bozza→spesa non deve mai restare orfano
  expense_id uuid unique references public.family_expenses(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (canonical_subcategory_id, canonical_category_id)
    references public.family_canonical_subcategories (id, canonical_category_id)
);
create index if not exists family_draft_expenses_document_idx on public.family_draft_expenses (document_id);
create index if not exists family_draft_expenses_status_idx on public.family_draft_expenses (status);

create table if not exists public.family_draft_items (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.family_draft_expenses(id) on delete cascade,
  raw_name text,
  name text not null,
  qty numeric(10,3) not null default 1 check (qty > 0),
  unit_price numeric(10,3) check (unit_price is null or unit_price >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  amount numeric(10,2) not null check (amount >= 0),  -- le righe normali sono ≥0;
    -- la rettifica "Arrotondamento" (che può essere negativa) NON passa di
    -- qui: viene generata alla conferma nelle righe definitive
  group_id uuid references public.family_groups(id),
  category_id uuid references public.family_categories(id),
  subcategory text,
  canonical_category_id uuid references public.family_canonical_categories(id),
  canonical_subcategory_id uuid,
  necessity text check (necessity is null or necessity in ('necessario', 'discrezionale')),
  planning text check (planning is null or planning in ('previsto', 'impulsivo')),
  confidence jsonb not null default '{}'::jsonb,
  -- (2A.3) esclusione NON distruttiva di una riga OCR inventata o doppia:
  -- resta nell'audit, ma quadratura e spese definitive la ignorano
  excluded boolean not null default false,
  -- riga aggiunta a mano durante la revisione (distinguibile dall'OCR);
  -- imposta anche da trigger per gli insert non-service-role (0021)
  user_added boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (canonical_subcategory_id, canonical_category_id)
    references public.family_canonical_subcategories (id, canonical_category_id)
);
create index if not exists family_draft_items_draft_idx on public.family_draft_items (draft_id);
alter table public.family_draft_items add column if not exists excluded boolean not null default false;
alter table public.family_draft_items add column if not exists user_added boolean not null default false;

-- ----------------------------------------------------------------------------
-- 5. COLONNE NUOVE SULLE TABELLE STORICHE
-- ----------------------------------------------------------------------------
alter table public.family_expenses
  add column if not exists payment_method text check (payment_method is null or payment_method in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro')),
  add column if not exists paid_at date,
  add column if not exists room_id uuid references public.rooms(id),
  add column if not exists expense_nature text check (expense_nature is null or expense_nature in
    ('ordinaria', 'ricorrente', 'straordinaria')),
  add column if not exists canonical_category_id uuid references public.family_canonical_categories(id),
  add column if not exists canonical_subcategory_id uuid,
  add column if not exists notes text;
alter table public.family_expenses drop constraint if exists family_expenses_canoniche_coerenti_fk;
alter table public.family_expenses add constraint family_expenses_canoniche_coerenti_fk
  foreign key (canonical_subcategory_id, canonical_category_id)
  references public.family_canonical_subcategories (id, canonical_category_id);

alter table public.family_expense_items
  add column if not exists raw_name text,
  add column if not exists unit_price numeric(10,3) check (unit_price is null or unit_price >= 0),
  add column if not exists discount numeric(10,2) default 0,
  add column if not exists group_id uuid references public.family_groups(id),
  add column if not exists canonical_category_id uuid references public.family_canonical_categories(id),
  add column if not exists canonical_subcategory_id uuid,
  add column if not exists necessity text check (necessity is null or necessity in ('necessario', 'discrezionale')),
  add column if not exists planning text check (planning is null or planning in ('previsto', 'impulsivo')),
  -- la riga di rettifica generata alla conferma (unico caso con amount
  -- anche negativo): riconoscibile, per vincoli coerenti e per le analisi
  add column if not exists is_adjustment boolean not null default false;
alter table public.family_expense_items drop constraint if exists family_expense_items_canoniche_coerenti_fk;
alter table public.family_expense_items add constraint family_expense_items_canoniche_coerenti_fk
  foreign key (canonical_subcategory_id, canonical_category_id)
  references public.family_canonical_subcategories (id, canonical_category_id);
alter table public.family_expense_items drop constraint if exists family_expense_items_qty_positiva;
alter table public.family_expense_items add constraint family_expense_items_qty_positiva
  check (qty > 0) not valid;  -- storico verificato sul backup; validate a parte
-- (2A.2) una riga NORMALE non può essere negativa: solo la rettifica
-- "Arrotondamento" (is_adjustment=true) può esserlo
alter table public.family_expense_items drop constraint if exists family_expense_items_importo_riga_normale;
alter table public.family_expense_items add constraint family_expense_items_importo_riga_normale
  check (is_adjustment or amount >= 0) not valid;

-- ----------------------------------------------------------------------------
-- 6. PONTE SPESA ↔ DOCUMENTO e LOG CORREZIONI
-- ----------------------------------------------------------------------------
-- document_id RESTRICT: un documento con collegamenti confermati non si
-- elimina (protezione nel database). Eliminare una SPESA (funzione già
-- esistente dell'app) elimina solo il proprio collegamento.
-- expense_id RESTRICT (2A.2): una spesa collegata a un documento non si
-- cancella con la X — sparirebbe il ponte lasciando un documento
-- "confermato" con un totale che non corrisponde più a nulla. Le spese
-- MANUALI senza documento restano eliminabili come oggi. Un eventuale
-- annullamento futuro sarà un'operazione esplicita e tracciata.
create table if not exists public.family_expense_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.family_expenses(id) on delete restrict,
  document_id uuid not null references public.family_documents(id) on delete restrict,
  -- per distinguere il backfill storico dai collegamenti nuovi (verifiche
  -- esatte, §8): mai un semplice count(*) globale
  origine text not null default 'app' check (origine in ('app', 'backfill_0020')),
  created_at timestamptz not null default now(),
  unique (expense_id, document_id)
);
create index if not exists family_expense_documents_document_idx
  on public.family_expense_documents (document_id);

create table if not exists public.family_corrections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.family_documents(id) on delete set null,
  draft_id uuid references public.family_draft_expenses(id) on delete set null,
  draft_item_id uuid references public.family_draft_items(id) on delete set null,
  expense_id uuid references public.family_expenses(id) on delete set null,
  item_id uuid references public.family_expense_items(id) on delete set null,
  field text not null,
  proposed jsonb,
  corrected jsonb,
  rule_applied text,
  source text not null default 'revisione',
  created_at timestamptz not null default now(),
  check (num_nonnulls(document_id, draft_id, draft_item_id, expense_id, item_id) >= 1)
);
-- (2A.3) vincolo NOMINATO e idempotente: include 'scarto' anche se la
-- tabella fosse stata creata da una versione precedente del file
alter table public.family_corrections drop constraint if exists family_corrections_source_valida;
alter table public.family_corrections add constraint family_corrections_source_valida
  check (source in ('revisione', 'duplicato', 'avviso', 'scarto'));

-- ----------------------------------------------------------------------------
-- 7. LISTA UTENTI AUTORIZZATI (schema; funzioni e policy nella 0021)
-- ----------------------------------------------------------------------------
create table if not exists public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

-- RLS attiva su tutte le nuove tabelle, NESSUNA policy: chiuse fino alla 0021.
alter table public.family_canonical_categories    enable row level security;
alter table public.family_canonical_subcategories enable row level security;
alter table public.family_subcategory_map         enable row level security;
alter table public.family_documents               enable row level security;
alter table public.family_draft_expenses          enable row level security;
alter table public.family_draft_items             enable row level security;
alter table public.family_expense_documents       enable row level security;
alter table public.family_corrections             enable row level security;
alter table public.app_members                    enable row level security;

-- PERMESSI ESPLICITI (mai fidarsi dei default del progetto):
--  - anon e public: NIENTE sulle nuove tabelle;
--  - authenticated: CRUD concesso a livello di GRANT ma filtrato dalla RLS
--    (fino alla 0021: nessuna policy ⇒ nessun accesso effettivo);
--  - service role: bypassa la RLS come da piattaforma (elaborazione /scontrini).
revoke all on public.family_canonical_categories, public.family_canonical_subcategories,
  public.family_subcategory_map, public.family_documents, public.family_draft_expenses,
  public.family_draft_items, public.family_expense_documents, public.family_corrections,
  public.app_members from public, anon;
grant select, insert, update, delete on public.family_canonical_categories,
  public.family_canonical_subcategories, public.family_subcategory_map,
  public.family_documents, public.family_draft_expenses, public.family_draft_items,
  public.family_expense_documents, public.family_corrections to authenticated;
grant select on public.app_members to authenticated;  -- gestione: solo owner (policy 0021)

-- ----------------------------------------------------------------------------
-- 8. BACKFILL STORICO (idempotente) + VERIFICA ESATTA COPPIA PER COPPIA
-- ----------------------------------------------------------------------------
do $$
declare
  v_doc_rotti int;
begin
  -- un documento per ogni receipt storico che non ne ha (1:1, deterministico)
  create temp table _map_receipt_doc on commit drop as
    select r.id as receipt_id,
           gen_random_uuid() as document_id,
           case when r.status = 'letto' then 'confermato' else 'da_elaborare' end as status,
           coalesce(r.ambito, 'personale') as upload_ambito,
           r.note,
           (select sum(e.amount) from public.family_expenses e where e.receipt_id = r.id) as doc_total,
           r.uploaded_at
    from public.family_receipts r
    where r.document_id is null;

  insert into public.family_documents (id, kind, status, upload_ambito, note, doc_total, doc_total_derivato, created_at)
  select document_id, 'scontrino', status, upload_ambito, note, doc_total, true, uploaded_at
  from _map_receipt_doc;

  update public.family_receipts r
  set document_id = m.document_id
  from _map_receipt_doc m
  where r.id = m.receipt_id;

  -- ponte storico, marcato come backfill
  insert into public.family_expense_documents (expense_id, document_id, origine)
  select e.id, r.document_id, 'backfill_0020'
  from public.family_expenses e
  join public.family_receipts r on r.id = e.receipt_id
  where r.document_id is not null
  on conflict (expense_id, document_id) do nothing;

  -- ===== VERIFICA ESATTA (mai un count(*) globale) =====
  -- (a) ogni coppia storica attesa expense↔document esiste nel ponte
  if exists (
    select 1
    from public.family_expenses e
    join public.family_receipts r on r.id = e.receipt_id
    left join public.family_expense_documents l
      on l.expense_id = e.id and l.document_id = r.document_id
    where l.id is null
  ) then
    raise exception 'BACKFILL: coppia storica MANCANTE nel ponte';
  end if;
  -- (b) nessuna coppia di BACKFILL errata o eccedente (che non corrisponda
  --     a una coppia storica attesa)
  if exists (
    select 1
    from public.family_expense_documents l
    where l.origine = 'backfill_0020'
      and not exists (
        select 1 from public.family_expenses e
        join public.family_receipts r on r.id = e.receipt_id
        where e.id = l.expense_id and r.document_id = l.document_id
      )
  ) then
    raise exception 'BACKFILL: coppia ERRATA o ECCEDENTE nel ponte';
  end if;
  -- (c) nessuna ricevuta storica senza documento
  if exists (select 1 from public.family_receipts where document_id is null) then
    raise exception 'BACKFILL: ricevuta storica senza documento';
  end if;
  -- (d) due ricevute storiche non possono essere state fuse sullo stesso
  --     documento di backfill (1:1). SOLO sui documenti storici
  --     (doc_total_derivato): un documento NUOVO multipagina ha
  --     legittimamente più file, e rieseguire la 0020 non deve fallire.
  if exists (
    select r.document_id
    from public.family_receipts r
    join public.family_documents d on d.id = r.document_id
    where d.doc_total_derivato
    group by r.document_id having count(*) > 1
  ) then
    raise exception 'BACKFILL: due ricevute storiche fuse sullo stesso documento di backfill';
  end if;
  -- (e) il totale derivato coincide ESATTAMENTE con la somma delle sorelle
  select count(*) into v_doc_rotti
  from public.family_documents d
  where d.doc_total_derivato
    and round(coalesce(d.doc_total, 0) * 100) is distinct from (
      select round(coalesce(sum(e.amount), 0) * 100)
      from public.family_expense_documents l
      join public.family_expenses e on e.id = l.expense_id
      where l.document_id = d.id
    );
  if v_doc_rotti > 0 then
    raise exception 'BACKFILL: % documenti con totale derivato diverso dalla somma delle sorelle', v_doc_rotti;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 9. RPC ECONOMICHE — atomiche, idempotenti, coi permessi giusti (rev. 2A.2)
-- ----------------------------------------------------------------------------
-- Architettura dei permessi:
--  - HELPER in schema private: NON eseguibili da authenticated;
--  - RPC PUBBLICHE: security definer, search_path = '', nomi qualificati,
--    controllo esplicito private.is_app_member(), grant SOLO ad authenticated;
--  - controllo del TIPO sempre PRIMA del ramo idempotente: paga_fattura su
--    uno scontrino (anche già confermato) risponde "tipo non valido";
--  - le correzioni della revisione viaggiano NELLA STESSA transazione:
--    se una correzione fallisce, non nasce nessuna spesa.
-- Firme vecchie eliminate esplicitamente (niente overload residui esposti
-- da PostgREST):
drop function if exists public.conferma_documento(uuid);
drop function if exists public.approva_fattura_da_pagare(uuid);
drop function if exists public.paga_fattura(uuid, date, text);
drop function if exists public.conferma_fattura_pagata(uuid, date, text);
drop function if exists private.spese_crea_da_bozze(uuid, date, date, text);
drop function if exists private.spese_gia_confermate(uuid);

-- Chi può invocare le RPC: un MEMBRO autorizzato oppure il SERVICE ROLE
-- (l'elaboratore /scontrini): per la chiave amministrativa auth.uid() è
-- nullo, quindi is_app_member() da sola lo respingerebbe (bug trovato in
-- Fase 2B e corretto in 2B.1).
-- plpgsql (non sql): il corpo si risolve a RUNTIME, così la 0020 si può
-- applicare su un database pulito dove private.is_app_member() (0021)
-- non esiste ancora — le RPC si usano comunque solo dopo la 0021.
create or replace function private.chiamante_autorizzato()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce((select auth.jwt()->>'role'), '') = 'service_role'
      or private.is_app_member();
end $$;
revoke execute on function private.chiamante_autorizzato() from public, anon, authenticated;

-- Correzioni della revisione: payload jsonb (array, anche vuoto) di
--   { field, proposed, corrected, draft_id?, draft_item_id?, rule_applied? }
-- Verifica che bozze e righe indicate appartengano DAVVERO al documento.
create or replace function private.registra_correzioni(p_document_id uuid, p_correzioni jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c jsonb;
  v_draft uuid;
  v_item uuid;
begin
  if p_correzioni is null or jsonb_typeof(p_correzioni) <> 'array' then
    raise exception 'Correzioni non valide: atteso un array (anche vuoto)';
  end if;
  for c in select * from jsonb_array_elements(p_correzioni) loop
    if coalesce(c->>'field', '') = '' then
      raise exception 'Correzione senza campo';
    end if;
    v_draft := nullif(c->>'draft_id', '')::uuid;
    v_item := nullif(c->>'draft_item_id', '')::uuid;
    if v_draft is not null and not exists (
      select 1 from public.family_draft_expenses
      where id = v_draft and document_id = p_document_id
    ) then
      raise exception 'Correzione respinta: la bozza % non appartiene al documento', v_draft;
    end if;
    if v_item is not null and not exists (
      select 1 from public.family_draft_items i
      join public.family_draft_expenses b on b.id = i.draft_id
      where i.id = v_item and b.document_id = p_document_id
    ) then
      raise exception 'Correzione respinta: la riga % non appartiene al documento', v_item;
    end if;
    insert into public.family_corrections
      (document_id, draft_id, draft_item_id, field, proposed, corrected, rule_applied, source)
    values
      (p_document_id, v_draft, v_item, c->>'field', c->'proposed', c->'corrected',
       c->>'rule_applied', 'revisione');
  end loop;
end $$;

-- Validazione COMUNE delle fatture (approvazione e conferma-già-pagata):
-- totale, data documento, fornitore, bozze attive, gruppi, quadratura.
-- La SCADENZA è obbligatoria solo per una fattura DA PAGARE
-- (p_richiedi_scadenza=true): per una già pagata può mancare e in quel
-- caso viene posta = data di pagamento (scelta esplicita, vedi RPC ④).
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
  -- gruppo BLOCCANTE anche per l'approvazione nello scadenzario
  if exists (
    select 1 from public.family_draft_expenses
    where document_id = p_document_id and status in ('da_controllare', 'pronta')
      and group_id is null
  ) then
    raise exception 'Bozza senza gruppo: assegnare il gruppo prima di approvare';
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

create or replace function private.spese_crea_da_bozze(
  p_document_id uuid,
  p_expense_date date,      -- null = data della bozza (scontrini)
  p_paid_at date,
  p_payment_method text
) returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.family_documents%rowtype;
  v_bozza public.family_draft_expenses%rowtype;
  v_somma_cent bigint;
  v_arrotondamenti_cent bigint;
  v_amount numeric(10,2);
  v_expense_id uuid;
  v_ids uuid[] := '{}';
  v_madri_cent bigint := 0;
  v_check_cent bigint;
begin
  select * into v_doc from public.family_documents where id = p_document_id;

  if v_doc.doc_total is null then
    raise exception 'Totale documento mancante: conferma bloccata';
  end if;
  if not exists (
    select 1 from public.family_draft_expenses
    where document_id = p_document_id and status in ('da_controllare', 'pronta')
  ) then
    raise exception 'Nessuna bozza attiva: documento senza bozze o con bozze scartate/in errore';
  end if;
  -- gruppo mancante = BLOCCANTE
  if exists (
    select 1 from public.family_draft_expenses
    where document_id = p_document_id and status in ('da_controllare', 'pronta')
      and group_id is null
  ) then
    raise exception 'Bozza senza gruppo: assegnare il gruppo prima di confermare';
  end if;
  -- (2A.2) metodo di pagamento OBBLIGATORIO per le bozze di ambito azienda
  -- (Casa Ania), salvo quando la RPC lo fornisce per tutte (fatture pagate):
  if p_payment_method is null and exists (
    select 1 from public.family_draft_expenses b
    join public.family_groups g on g.id = b.group_id
    where b.document_id = p_document_id and b.status in ('da_controllare', 'pronta')
      and coalesce(g.ambito, 'personale') = 'azienda'
      and b.payment_method is null
  ) then
    raise exception 'Metodo di pagamento mancante sulle righe Casa Ania: obbligatorio prima della conferma';
  end if;

  -- quadratura ESATTA su tutte le righe + arrotondamenti dichiarati
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

  for v_bozza in
    select * from public.family_draft_expenses
    where document_id = p_document_id and status in ('da_controllare', 'pronta')
    order by created_at
  loop
    -- importo sorella = somma righe + il SUO arrotondamento
    select coalesce(sum(i.amount), 0) + (v_bozza.arrotondamento_cent::numeric / 100)
      into v_amount
    from public.family_draft_items i where i.draft_id = v_bozza.id and not i.excluded;
    -- (2A.2) una sorella non può diventare negativa per l''arrotondamento
    if v_amount < 0 then
      raise exception 'Importo sorella negativo (%) dopo l''arrotondamento: non valido', v_amount;
    end if;

    insert into public.family_expenses
      (expense_date, amount, group_id, category_id, subcategory, store, description,
       recurring, source, receipt_id, payment_method, paid_at, room_id, expense_nature,
       canonical_category_id, canonical_subcategory_id)
    values
      (coalesce(p_expense_date, v_bozza.expense_date), v_amount,
       v_bozza.group_id, v_bozza.category_id, v_bozza.subcategory, v_bozza.store,
       v_bozza.description, false, 'foto', null,
       coalesce(p_payment_method, v_bozza.payment_method), p_paid_at,
       v_bozza.room_id, v_bozza.expense_nature,
       v_bozza.canonical_category_id, v_bozza.canonical_subcategory_id)
    returning id into v_expense_id;

    insert into public.family_expense_items
      (expense_id, name, amount, qty, category_id, subcategory,
       raw_name, unit_price, discount, group_id,
       canonical_category_id, canonical_subcategory_id, necessity, planning, is_adjustment)
    select v_expense_id, i.name, i.amount, i.qty, i.category_id, i.subcategory,
           i.raw_name, i.unit_price, i.discount, i.group_id,
           i.canonical_category_id, i.canonical_subcategory_id, i.necessity, i.planning, false
    from public.family_draft_items i where i.draft_id = v_bozza.id and not i.excluded;

    if v_bozza.arrotondamento_cent <> 0 then
      insert into public.family_expense_items
        (expense_id, name, amount, qty, category_id, subcategory, is_adjustment)
      values
        (v_expense_id, 'Arrotondamento', v_bozza.arrotondamento_cent::numeric / 100, 1,
         v_bozza.category_id, v_bozza.subcategory, true);
    end if;

    -- (2A.2) VERIFICA EFFETTIVA: somma righe definitive = importo madre
    select coalesce(sum(round(i.amount * 100)::bigint), 0) into v_check_cent
    from public.family_expense_items i where i.expense_id = v_expense_id;
    if v_check_cent <> round(v_amount * 100)::bigint then
      raise exception 'Incoerenza interna: somma righe (%) diversa dall''importo madre (%)', v_check_cent, round(v_amount * 100)::bigint;
    end if;
    v_madri_cent := v_madri_cent + round(v_amount * 100)::bigint;

    insert into public.family_expense_documents (expense_id, document_id, origine)
    values (v_expense_id, p_document_id, 'app')
    on conflict (expense_id, document_id) do nothing;

    update public.family_draft_expenses
    set status = 'confermata', expense_id = v_expense_id
    where id = v_bozza.id;

    v_ids := v_ids || v_expense_id;
  end loop;

  -- (2A.2) VERIFICA EFFETTIVA: somma delle madri = doc_total
  if v_madri_cent <> round(v_doc.doc_total * 100)::bigint then
    raise exception 'Incoerenza interna: somma sorelle (%) diversa dal totale documento (%)', v_madri_cent, round(v_doc.doc_total * 100)::bigint;
  end if;

  update public.family_documents set status = 'confermato' where id = p_document_id;
  return v_ids;
end $$;

create or replace function private.spese_gia_confermate(p_document_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(expense_id), '{}')
  from public.family_draft_expenses
  where document_id = p_document_id and expense_id is not null;
$$;

-- ============ RPC PUBBLICHE (le cinque esposte) ============

-- ① Conferma di uno SCONTRINO. Il tipo si controlla PRIMA dell''idempotenza.
create or replace function public.conferma_documento(p_document_id uuid, p_correzioni jsonb default '[]'::jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.family_documents%rowtype;
begin
  if not private.chiamante_autorizzato() then raise exception 'Accesso negato: utente non autorizzato'; end if;
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then raise exception 'Documento inesistente'; end if;
  if v_doc.kind = 'fattura' then
    raise exception 'Tipo non valido: per le fatture usare approva_fattura_da_pagare / paga_fattura / conferma_fattura_pagata';
  end if;
  if v_doc.status = 'confermato' then
    return private.spese_gia_confermate(p_document_id);  -- idempotente: niente correzioni duplicate
  end if;
  if v_doc.status <> 'in_revisione' then
    raise exception 'Stato non valido per la conferma: % (serve in_revisione)', v_doc.status;
  end if;
  perform private.registra_correzioni(p_document_id, p_correzioni);
  return private.spese_crea_da_bozze(p_document_id, null, null, null);
end $$;

-- ② Approvazione di una FATTURA revisionata ma ANCORA DA PAGARE.
create or replace function public.approva_fattura_da_pagare(p_document_id uuid, p_correzioni jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.family_documents%rowtype;
begin
  if not private.chiamante_autorizzato() then raise exception 'Accesso negato: utente non autorizzato'; end if;
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then raise exception 'Documento inesistente'; end if;
  if v_doc.kind <> 'fattura' then
    raise exception 'Tipo non valido: solo le fatture si approvano da pagare';
  end if;
  if v_doc.status = 'approvata_da_pagare' then return; end if;  -- idempotente
  if v_doc.status <> 'in_revisione' then
    raise exception 'Stato non valido per l''approvazione: % (serve in_revisione)', v_doc.status;
  end if;
  perform private.valida_fattura(p_document_id, true);  -- scadenza OBBLIGATORIA
  perform private.registra_correzioni(p_document_id, p_correzioni);
  -- NESSUNA family_expenses: le bozze restano disponibili allo scadenzario
  update public.family_documents set status = 'approvata_da_pagare'
  where id = p_document_id;
end $$;

-- ③ Pagamento di una fattura APPROVATA: metodo OBBLIGATORIO e valido.
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
  if not private.chiamante_autorizzato() then raise exception 'Accesso negato: utente non autorizzato'; end if;
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
  if p_data_pagamento is null then raise exception 'Data di pagamento obbligatoria'; end if;
  if p_payment_method is null or p_payment_method not in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro') then
    raise exception 'Metodo di pagamento obbligatorio e valido quando la fattura viene pagata';
  end if;
  perform private.registra_correzioni(p_document_id, p_correzioni);
  return private.spese_crea_da_bozze(p_document_id, p_data_pagamento, p_data_pagamento, p_payment_method);
end $$;

-- ④ Fattura GIÀ PAGATA al momento della revisione: metodo obbligatorio;
--    document_date resta la data della fattura; se la SCADENZA manca
--    davvero resta NULL (2A.3): document_date, due_date e paid_at sono
--    informazioni diverse e nessuna va inventata. La scadenza è
--    obbligatoria solo per una fattura ancora da pagare.
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
  if not private.chiamante_autorizzato() then raise exception 'Accesso negato: utente non autorizzato'; end if;
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
  if p_data_pagamento is null then raise exception 'Data di pagamento obbligatoria'; end if;
  if p_payment_method is null or p_payment_method not in
    ('contanti', 'carta_personale', 'carta_attivita', 'bonifico', 'altro') then
    raise exception 'Metodo di pagamento obbligatorio e valido per una fattura già pagata';
  end if;
  perform private.valida_fattura(p_document_id, false);  -- scadenza facoltativa qui: se manca resta NULL
  perform private.registra_correzioni(p_document_id, p_correzioni);
  return private.spese_crea_da_bozze(p_document_id, p_data_pagamento, p_data_pagamento, p_payment_method);
end $$;

-- ⑤ Scarto CONTROLLATO e tracciato (i membri non possono cambiare stato o
--    cancellare fisicamente: questa è l''unica via).
create or replace function public.scarta_documento(p_document_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.family_documents%rowtype;
begin
  if not private.chiamante_autorizzato() then raise exception 'Accesso negato: utente non autorizzato'; end if;
  select * into v_doc from public.family_documents where id = p_document_id for update;
  if not found then raise exception 'Documento inesistente'; end if;
  if v_doc.status = 'scartato' then return; end if;  -- idempotente
  if v_doc.status not in ('da_elaborare', 'in_revisione', 'errore') then
    raise exception 'Stato non valido per lo scarto: %', v_doc.status;
  end if;
  update public.family_draft_expenses
  set status = 'scartata', discard_reason = coalesce(p_motivo, 'scarto documento')
  where document_id = p_document_id and status in ('da_controllare', 'pronta', 'errore');
  update public.family_documents set status = 'scartato' where id = p_document_id;
  insert into public.family_corrections (document_id, field, corrected, source)
  values (p_document_id, 'scarto', to_jsonb(coalesce(p_motivo, '')), 'scarto');
end $$;

-- PERMESSI ESPLICITI delle funzioni:
revoke execute on function private.spese_crea_da_bozze(uuid, date, date, text) from public, anon, authenticated;
revoke execute on function private.spese_gia_confermate(uuid) from public, anon, authenticated;
revoke execute on function private.valida_fattura(uuid, boolean) from public, anon, authenticated;
revoke execute on function private.registra_correzioni(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.conferma_documento(uuid, jsonb) from public, anon;
revoke execute on function public.approva_fattura_da_pagare(uuid, jsonb) from public, anon;
revoke execute on function public.paga_fattura(uuid, date, text, jsonb) from public, anon;
revoke execute on function public.conferma_fattura_pagata(uuid, date, text, jsonb) from public, anon;
revoke execute on function public.scarta_documento(uuid, text) from public, anon;
grant execute on function public.conferma_documento(uuid, jsonb) to authenticated;
grant execute on function public.approva_fattura_da_pagare(uuid, jsonb) to authenticated;
grant execute on function public.paga_fattura(uuid, date, text, jsonb) to authenticated;
grant execute on function public.conferma_fattura_pagata(uuid, date, text, jsonb) to authenticated;
grant execute on function public.scarta_documento(uuid, text) to authenticated;
