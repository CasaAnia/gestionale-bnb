-- =====================================================================
-- MOTIVO DEL CLIENTE PROBLEMATICO, SEPARATO DALLA NOTA (09/09/2026) — proposta 0046
--
-- Oggi guests.notes tiene insieme due cose diverse:
--   · la nota utile che si ritrova a ogni soggiorno («camera sul
--     cortile, non sulla strada»), che può anche essere letta accanto
--     al cliente;
--   · il motivo per cui Ania non vuole più accoglierlo («ha fumato in
--     camera»), che è INTERNO e non deve finire in nessun messaggio.
-- Scrivendo l'uno si cancellava l'altro.
--
-- Questa proposta aggiunge SOLO il campo interno. Nessun backfill: dai
-- dati non si può sapere quale nota esistente sia un motivo e quale una
-- preferenza, e indovinare vorrebbe dire spostare in un campo interno
-- una frase che magari serve a leggere la scheda. Le note dei clienti
-- già segnati come problematici vanno riviste a mano: la query in fondo
-- le elenca.
-- =====================================================================

alter table public.guests
  add column if not exists motivo_problematico text;

comment on column public.guests.motivo_problematico is
  'Perché non accogliere più questo cliente. Uso interno: non entra mai nei messaggi agli ospiti.';

-- ── da verificare a mano, non tocca niente ───────────────────────────
-- Clienti segnati problematici con una nota già scritta: decidere caso
-- per caso se quel testo è il motivo (da spostare qui) o una preferenza
-- (da lasciare in notes).
--
--   select id, full_name, phone, notes
--     from public.guests
--    where (rating = 'problematico' or rating = 'vuole_ricevuta_problematico')
--      and notes is not null and btrim(notes) <> ''
--    order by full_name;
