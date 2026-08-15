-- =====================================================================
-- CATEGORIA SU OGNI VOCE DELLO SCONTRINO
--
-- Finora le voci di dettaglio (family_expense_items) avevano solo nome
-- e prezzo: la categoria era quella della spesa madre. Da ora ogni voce
-- può avere la SUA categoria (es. dentro una spesa Esselunga: il Vanish
-- è "Detersivi e pulizia", i kiwi "Spesa alimentare"). Se la colonna è
-- vuota, vale ancora la categoria della spesa madre.
--
-- Da incollare in Supabase -> SQL Editor -> Run.
-- =====================================================================

alter table public.family_expense_items
  add column if not exists category_id uuid references family_categories(id);

create index if not exists family_expense_items_category_idx
  on family_expense_items (category_id);
