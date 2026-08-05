-- =====================================================================
-- SPESE: AMBITO AZIENDA vs PERSONALE
--
-- "Casa Granata" è la stessa cosa dell'azienda (Casa Ania): le sue spese
-- sono spese dell'attività e devono contare nel profitto del B&B, non tra
-- le spese personali di famiglia.
--
-- Aggiungiamo un "ambito" ai gruppi: 'personale' (famiglia) o 'azienda'
-- (B&B). Il gruppo Casa Granata passa ad 'azienda'. La sezione Spese
-- Famiglia mostra solo i gruppi personali; la sezione Spese B&B mostra i
-- gruppi azienda. Il profitto somma le spese dei gruppi 'azienda'.
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

alter table family_groups add column if not exists ambito text not null default 'personale';

-- Casa Granata = azienda. Gli altri restano personale (default).
update family_groups set ambito = 'azienda' where name = 'Casa Granata';

-- Qualche categoria in più per le spese dell'azienda (oltre a quelle già
-- presenti sul gruppo Casa Granata: Utenze, Riparazioni, Arredo e acquisti,
-- Lavori e ristrutturazione, Prodotti di pulizia, Spesa, Varie).
insert into family_categories (group_id, name, sort)
select g.id, c.name, c.sort from family_groups g
join (values
  ('Luce', 11), ('Gas', 12), ('Acqua', 13), ('Internet', 14), ('Telefono', 15),
  ('Forniture', 16), ('Manutenzione', 17), ('Commissioni', 18), ('Biancheria', 19)
) as c(name, sort) on true
where g.name = 'Casa Granata'
on conflict (group_id, name) do nothing;
