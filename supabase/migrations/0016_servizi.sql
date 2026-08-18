-- =====================================================================
-- CATEGORIA "SERVIZI" (18/08/2026)
-- Lavanderia e sartoria, Poste e spedizioni, Commissioni banca,
-- Parrucchiere ed estetica (spostato qui da Cura corpo).
-- NOTA: GIÀ APPLICATA da Claude via API il 18/8 — non serve incollarla.
-- Resta qui solo come storia delle modifiche al database.
-- =====================================================================
insert into family_categories (group_id, name, sort)
select g.id, 'Servizi', 25 from family_groups g
where coalesce(g.ambito,'personale') = 'personale'
on conflict (group_id, name) do nothing;

insert into family_subcategories (category_name, name, sort) values
  ('Servizi','Lavanderia e sartoria',1),
  ('Servizi','Poste e spedizioni',2),
  ('Servizi','Commissioni banca',3),
  ('Servizi','Parrucchiere ed estetica',4)
on conflict (category_name, name) do nothing;

delete from family_subcategories
where category_name = 'Cura corpo' and name = 'Parrucchiere ed estetica';
