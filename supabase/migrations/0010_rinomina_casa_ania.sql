-- =====================================================================
-- Rinomina del gruppo azienda: "Casa Granata" -> "Casa Ania"
-- (la struttura sta cambiando nome). Le regole prodotto puntano al gruppo
-- per ID, quindi non si rompe nulla.
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

update family_groups set name = 'Casa Ania' where name = 'Casa Granata';
