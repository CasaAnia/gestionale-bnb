-- =====================================================================
-- RIORDINO CATEGORIE E SOTTOCATEGORIE (approvato da Ania il 15/08/2026)
--
-- 1. Tutti i gruppi famiglia condividono lo stesso elenco di categorie
--    pulito (niente più doppioni: Telefono/Internet, Bar vs Bar e amici…).
-- 2. Nasce la tabella delle sottocategorie (es. Utenze → Luce, Gas…).
-- 3. Spese, voci di scontrino e regole vengono RIMAPPATE dai vecchi nomi
--    ai nuovi; dove possibile la vecchia categoria diventa sottocategoria
--    (es. "Luce" → Utenze / Luce).
-- 4. Le categorie del B&B (Casa Ania) NON vengono toccate.
--
-- Da incollare in Supabase -> SQL Editor -> Run (DOPO la 0014).
-- =====================================================================

-- Sottocategoria come testo sulla spesa e sulla singola voce
alter table public.family_expenses      add column if not exists subcategory text;
alter table public.family_expense_items add column if not exists subcategory text;

-- Tabella sottocategorie (per nome categoria: vale per tutti i gruppi)
create table if not exists family_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_name, name)
);
alter table public.family_subcategories enable row level security;
drop policy if exists "accesso_utenti_autenticati" on public.family_subcategories;
create policy "accesso_utenti_autenticati" on public.family_subcategories
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 1. Le nuove categorie, uguali per ogni gruppo famiglia
-- ---------------------------------------------------------------------
insert into family_categories (group_id, name, sort)
select g.id, c.name, c.sort
from family_groups g
cross join (values
  ('Spesa alimentare',1),('Detersivi',2),('Sacchetti',3),('Cura corpo',4),
  ('Medico',5),('Utenze',6),('Colazione/Bar',7),('Mangiare fuori',8),
  ('Merenda',9),('Divertimento',10),('Viaggi',11),('Abbigliamento',12),
  ('Cucina utensili',13),('Elettrodomestici',14),('Arredo casa',15),
  ('Riparazioni e manutenzione',16),('Auto',17),('Scuola',18),
  ('Cancelleria casa',19),('Tecnologia',20),('Sport',21),('Regali',22),
  ('Paghetta',23),('Assicurazioni e tasse',24),('Varie',99)
) as c(name, sort)
where coalesce(g.ambito, 'personale') = 'personale'
on conflict (group_id, name) do nothing;

-- ---------------------------------------------------------------------
-- 2. Rimappa i vecchi nomi sui nuovi (stesso gruppo). Dove il vecchio
--    nome era più preciso, finisce nella sottocategoria.
-- ---------------------------------------------------------------------
-- Spese
with mapping(old, new, sott) as (values
  ('Detersivi e pulizia','Detersivi',null),
  ('Cura persona','Cura corpo',null),
  ('Salute ed estetica','Cura corpo',null),
  ('Parrucchiere','Cura corpo','Parrucchiere ed estetica'),
  ('Salute e farmacia','Medico','Farmacia'),
  ('Salute','Medico',null),
  ('Luce','Utenze','Luce'),('Gas','Utenze','Gas'),('Acqua','Utenze','Acqua'),
  ('Internet','Utenze','Internet'),('Telefono','Utenze','Telefono'),
  ('Telefono/Internet','Utenze',null),
  ('Bar','Colazione/Bar',null),('Bar e caffe','Colazione/Bar',null),('Bar e amici','Colazione/Bar',null),
  ('Gelato e merenda','Merenda',null),
  ('Svago','Divertimento',null),('Cinema e svago','Divertimento',null),
  ('Abbonamenti','Divertimento','Abbonamenti'),
  ('Scarpe','Abbigliamento','Scarpe'),
  ('Accessori','Abbigliamento','Accessori e borse'),
  ('Vestiti','Abbigliamento','Vestiti'),
  ('Utensili cucina','Cucina utensili',null),
  ('Arredo e acquisti','Arredo casa',null),
  ('Manutenzione','Riparazioni e manutenzione',null),
  ('Manutenzione casa','Riparazioni e manutenzione',null),
  ('Macchina','Auto',null),
  ('Trasporti','Auto','Mezzi pubblici'),
  ('Cancelleria','Cancelleria casa',null),
  ('Assicurazioni','Assicurazioni e tasse',null),
  ('Tasse','Assicurazioni e tasse',null),
  ('Mangiare fuori insieme','Mangiare fuori',null)
)
update family_expenses e
set category_id = nc.id,
    subcategory = coalesce(m.sott, e.subcategory)
from family_categories oc
join family_groups g on g.id = oc.group_id and coalesce(g.ambito,'personale') = 'personale'
join mapping m on m.old = oc.name
join family_categories nc on nc.group_id = oc.group_id and nc.name = m.new
where e.category_id = oc.id;

-- Voci di scontrino (colonna della 0014)
with mapping(old, new, sott) as (values
  ('Detersivi e pulizia','Detersivi',null),('Cura persona','Cura corpo',null),
  ('Salute ed estetica','Cura corpo',null),('Parrucchiere','Cura corpo','Parrucchiere ed estetica'),
  ('Salute e farmacia','Medico','Farmacia'),('Salute','Medico',null),
  ('Luce','Utenze','Luce'),('Gas','Utenze','Gas'),('Acqua','Utenze','Acqua'),
  ('Internet','Utenze','Internet'),('Telefono','Utenze','Telefono'),('Telefono/Internet','Utenze',null),
  ('Bar','Colazione/Bar',null),('Bar e caffe','Colazione/Bar',null),('Bar e amici','Colazione/Bar',null),
  ('Gelato e merenda','Merenda',null),('Svago','Divertimento',null),('Cinema e svago','Divertimento',null),
  ('Abbonamenti','Divertimento','Abbonamenti'),('Scarpe','Abbigliamento','Scarpe'),
  ('Accessori','Abbigliamento','Accessori e borse'),('Vestiti','Abbigliamento','Vestiti'),
  ('Utensili cucina','Cucina utensili',null),('Arredo e acquisti','Arredo casa',null),
  ('Manutenzione','Riparazioni e manutenzione',null),('Manutenzione casa','Riparazioni e manutenzione',null),
  ('Macchina','Auto',null),('Trasporti','Auto','Mezzi pubblici'),
  ('Cancelleria','Cancelleria casa',null),('Assicurazioni','Assicurazioni e tasse',null),
  ('Tasse','Assicurazioni e tasse',null),('Mangiare fuori insieme','Mangiare fuori',null)
)
update family_expense_items i
set category_id = nc.id,
    subcategory = coalesce(m.sott, i.subcategory)
from family_categories oc
join family_groups g on g.id = oc.group_id and coalesce(g.ambito,'personale') = 'personale'
join mapping m on m.old = oc.name
join family_categories nc on nc.group_id = oc.group_id and nc.name = m.new
where i.category_id = oc.id;

-- Regole prodotto → categoria
with mapping(old, new) as (values
  ('Detersivi e pulizia','Detersivi'),('Cura persona','Cura corpo'),
  ('Salute ed estetica','Cura corpo'),('Salute e farmacia','Medico'),('Salute','Medico'),
  ('Bar','Colazione/Bar'),('Bar e caffe','Colazione/Bar'),('Bar e amici','Colazione/Bar'),
  ('Gelato e merenda','Merenda'),('Utensili cucina','Cucina utensili'),
  ('Arredo e acquisti','Arredo casa'),('Macchina','Auto'),('Cancelleria','Cancelleria casa')
)
update family_product_rules r
set category_id = nc.id
from family_categories oc
join family_groups g on g.id = oc.group_id and coalesce(g.ambito,'personale') = 'personale'
join mapping m on m.old = oc.name
join family_categories nc on nc.group_id = oc.group_id and nc.name = m.new
where r.category_id = oc.id;

-- Budget: seguono il nome della categoria (solo se il nuovo nome è libero)
update family_budgets b
set category_name = m.new
from (values
  ('Detersivi e pulizia','Detersivi'),('Cura persona','Cura corpo'),
  ('Bar','Colazione/Bar'),('Gelato e merenda','Merenda'),
  ('Utensili cucina','Cucina utensili'),('Arredo e acquisti','Arredo casa'),
  ('Macchina','Auto'),('Cancelleria','Cancelleria casa')
) as m(old, new)
where b.category_name = m.old
  and coalesce(b.ambito,'personale') = 'personale'
  and not exists (select 1 from family_budgets b2
                  where b2.ambito = b.ambito and b2.category_name = m.new);

-- ---------------------------------------------------------------------
-- 3. Via le vecchie categorie famiglia rimaste vuote e fuori elenco
-- ---------------------------------------------------------------------
delete from family_categories c
using family_groups g
where c.group_id = g.id
  and coalesce(g.ambito,'personale') = 'personale'
  and c.name not in ('Spesa alimentare','Detersivi','Sacchetti','Cura corpo','Medico',
    'Utenze','Colazione/Bar','Mangiare fuori','Merenda','Divertimento','Viaggi',
    'Abbigliamento','Cucina utensili','Elettrodomestici','Arredo casa',
    'Riparazioni e manutenzione','Auto','Scuola','Cancelleria casa','Tecnologia',
    'Sport','Regali','Paghetta','Assicurazioni e tasse','Varie')
  and not exists (select 1 from family_expenses e where e.category_id = c.id)
  and not exists (select 1 from family_expense_items i where i.category_id = c.id)
  and not exists (select 1 from family_product_rules r where r.category_id = c.id);

-- ---------------------------------------------------------------------
-- 4. Le sottocategorie approvate
-- ---------------------------------------------------------------------
insert into family_subcategories (category_name, name, sort) values
  ('Spesa alimentare','Frutta e verdura',1),('Spesa alimentare','Dispensa',2),
  ('Spesa alimentare','Surgelati',3),('Spesa alimentare','Bevande',4),
  ('Spesa alimentare','Dolci e snack',5),('Spesa alimentare','Pane',6),
  ('Detersivi','Bucato',1),('Detersivi','Superfici e pavimenti',2),
  ('Detersivi','Piatti',3),('Detersivi','Panni e spugne',4),
  ('Cura corpo','Igiene',1),('Cura corpo','Trucchi',2),
  ('Cura corpo','Profumeria',3),('Cura corpo','Parrucchiere ed estetica',4),
  ('Medico','Farmacia',1),('Medico','Visite e analisi',2),('Medico','Occhiali',3),
  ('Utenze','Luce',1),('Utenze','Gas',2),('Utenze','Acqua',3),
  ('Utenze','Internet',4),('Utenze','Telefono',5),('Utenze','Rifiuti',6),
  ('Utenze','Affitto',7),
  ('Colazione/Bar','Caffè',1),('Colazione/Bar','Cappuccino',2),
  ('Colazione/Bar','Brioche',3),('Colazione/Bar','Tè freddo',4),
  ('Mangiare fuori','Ristorante e pizzeria',1),('Mangiare fuori','Pranzo veloce',2),
  ('Mangiare fuori','Asporto',3),
  ('Merenda','Gelato',1),('Merenda','Yogurteria',2),('Merenda','Snack fuori casa',3),
  ('Divertimento','Cinema e spettacoli',1),('Divertimento','Uscite',2),
  ('Divertimento','Abbonamenti',3),('Divertimento','Hobby',4),
  ('Viaggi','Trasporti',1),('Viaggi','Alloggio',2),
  ('Viaggi','Mangiare in viaggio',3),('Viaggi','Extra',4),
  ('Abbigliamento','Vestiti',1),('Abbigliamento','Scarpe',2),
  ('Abbigliamento','Intimo',3),('Abbigliamento','Accessori e borse',4),
  ('Cucina utensili','Pentole e stoviglie',1),('Cucina utensili','Piccoli utensili',2),
  ('Elettrodomestici','Grandi',1),('Elettrodomestici','Piccoli',2),
  ('Arredo casa','Mobili',1),('Arredo casa','Tessili',2),('Arredo casa','Decorazioni',3),
  ('Riparazioni e manutenzione','Riparazioni',1),
  ('Riparazioni e manutenzione','Ferramenta',2),
  ('Riparazioni e manutenzione','Piante e giardino',3),
  ('Auto','Benzina',1),('Auto','Assicurazione e bollo',2),('Auto','Officina',3),
  ('Auto','Parcheggi',4),('Auto','Mezzi pubblici',5),
  ('Scuola','Materiale e libri',1),('Scuola','Gite',2),('Scuola','Mensa',3),
  ('Tecnologia','Telefoni e accessori',1),('Tecnologia','App e abbonamenti',2),
  ('Sport','Iscrizioni',1),('Sport','Attrezzatura',2),
  ('Regali','Compleanni',1),('Regali','Ricorrenze',2)
on conflict (category_name, name) do nothing;
