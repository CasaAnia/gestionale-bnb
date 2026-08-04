-- =====================================================================
-- SPESE FAMIGLIA
--
-- Sezione separata dalle spese del B&B (tabella `expenses`, che alimenta
-- il calcolo del profitto della struttura). Qui vivono le spese personali
-- e di casa, divise per "gruppo" (di chi è la spesa) e "categoria" (che
-- tipo di spesa è). Un negozio, un prodotto, un flag ricorrente e le
-- regole prodotto->gruppo completano il quadro.
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

-- 1. Gruppi: di chi e' la spesa (Casa, Ania, Matteo, Matteo e Ania, Casa Granata)
create table if not exists family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Categorie: che tipo di spesa (legate a un gruppo)
create table if not exists family_categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references family_groups(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

-- 3. Le spese vere e proprie
create table if not exists family_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  amount numeric(10,2) not null,
  group_id uuid references family_groups(id),
  category_id uuid references family_categories(id),
  store text,                       -- negozio (es. Esselunga, NaturaSi)
  product text,                     -- prodotto specifico da seguire (es. bagnoschiuma)
  description text,
  recurring boolean not null default false,
  receipt_id uuid,                  -- righe dello stesso scontrino diviso tra gruppi
  source text not null default 'manuale',  -- manuale | foto | email
  created_at timestamptz not null default now()
);
create index if not exists family_expenses_date_idx on family_expenses (expense_date);
create index if not exists family_expenses_group_idx on family_expenses (group_id);

-- 4. Regole prodotto -> gruppo (es. vodka, aceto, caffe -> Casa Granata).
--    track_detail = true per i prodotti di cui tenere il conto a parte.
create table if not exists family_product_rules (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  group_id uuid references family_groups(id),
  category_id uuid references family_categories(id),
  track_detail boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DATI INIZIALI
-- ---------------------------------------------------------------------

insert into family_groups (name, emoji, sort) values
  ('Casa',           '🏠', 1),
  ('Ania',           '👩', 2),
  ('Matteo',         '👦', 3),
  ('Matteo e Ania',  '👦👩', 4),
  ('Casa Granata',   '🥂', 5)
on conflict (name) do nothing;

-- Categorie per gruppo. Ogni gruppo ha una voce "Varie" per le spese
-- vecchie di cui non si ricorda il dettaglio (il totale del gruppo resta giusto).
insert into family_categories (group_id, name, sort)
select g.id, c.name, c.sort from family_groups g
join (values
  ('Casa','Spesa alimentare',1),('Casa','Luce',2),('Casa','Gas',3),('Casa','Acqua',4),
  ('Casa','Internet',5),('Casa','Telefono',6),('Casa','Macchina',7),('Casa','Manutenzione casa',8),
  ('Casa','Detersivi e pulizia',9),('Casa','Salute e farmacia',10),('Casa','Assicurazioni',11),
  ('Casa','Tasse',12),('Casa','Abbonamenti',13),('Casa','Varie',99),

  ('Ania','Bar e caffe',1),('Ania','Mangiare fuori',2),('Ania','Abbigliamento',3),('Ania','Scarpe',4),
  ('Ania','Accessori',5),('Ania','Salute ed estetica',6),('Ania','Svago',7),('Ania','Trasporti',8),
  ('Ania','Regali',9),('Ania','Varie',99),

  ('Matteo','Scuola',1),('Matteo','Vestiti',2),('Matteo','Scarpe',3),('Matteo','Bar e amici',4),
  ('Matteo','Mangiare fuori',5),('Matteo','Sport',6),('Matteo','Salute',7),('Matteo','Svago',8),
  ('Matteo','Telefono',9),('Matteo','Parrucchiere',10),('Matteo','Regali',11),('Matteo','Paghetta',12),
  ('Matteo','Varie',99),

  ('Matteo e Ania','Viaggi',1),('Matteo e Ania','Mangiare fuori insieme',2),
  ('Matteo e Ania','Gelato e merenda',3),('Matteo e Ania','Cinema e svago',4),('Matteo e Ania','Varie',99),

  ('Casa Granata','Utenze',1),('Casa Granata','Riparazioni',2),('Casa Granata','Arredo e acquisti',3),
  ('Casa Granata','Lavori e ristrutturazione',4),('Casa Granata','Prodotti di pulizia',5),
  ('Casa Granata','Spesa',6),('Casa Granata','Varie',99)
) as c(gruppo, name, sort) on c.gruppo = g.name
on conflict (group_id, name) do nothing;

-- Regole prodotto -> Casa Granata (valgono anche dentro gli scontrini Esselunga).
insert into family_product_rules (keyword, group_id, track_detail)
select k.keyword, g.id, k.track
from family_groups g
join (values
  ('vodka', false),
  ('aceto', false),
  ('caffe', false),
  ('bagnoschiuma', true),
  ('carta igienica', true)
) as k(keyword, track) on true
where g.name = 'Casa Granata'
on conflict (keyword) do nothing;

-- ---------------------------------------------------------------------
-- PROTEZIONE (RLS): accesso solo agli utenti autenticati, come le altre tabelle.
-- ---------------------------------------------------------------------
alter table public.family_groups        enable row level security;
alter table public.family_categories    enable row level security;
alter table public.family_expenses      enable row level security;
alter table public.family_product_rules enable row level security;

drop policy if exists "accesso_utenti_autenticati" on public.family_groups;
create policy "accesso_utenti_autenticati" on public.family_groups
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.family_categories;
create policy "accesso_utenti_autenticati" on public.family_categories
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.family_expenses;
create policy "accesso_utenti_autenticati" on public.family_expenses
  for all to authenticated using (true) with check (true);

drop policy if exists "accesso_utenti_autenticati" on public.family_product_rules;
create policy "accesso_utenti_autenticati" on public.family_product_rules
  for all to authenticated using (true) with check (true);
