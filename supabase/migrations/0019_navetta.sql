-- Navetta: come arriva l'ospite (richiesta di Ania, 24/08/2026).
-- Un solo dato sulla prenotazione, condiviso da modulo prenotazione e
-- pagina Arrivi. Vuoto = "Da definire": le prenotazioni esistenti restano
-- valide senza toccarle.
alter table bookings add column if not exists shuttle text default null
  check (shuttle in ('si', 'no'));
