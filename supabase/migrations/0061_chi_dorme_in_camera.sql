-- ✅ APPLICATA in produzione il 29/09/2026 (backup verificato prima e dopo, dati invariati).
-- 0061 · «Chi dorme in camera»: la spunta «Non è lei a dormire qui»
-- (Nuova prenotazione «Maison», Ania, 28/09/2026, punto 12c).
--
-- Di norma dorme chi ha prenotato (l'intestataria). Quando prenota un figlio
-- per la mamma, Ania tocca «Non è lei a dormire qui»: la prenotazione lo deve
-- ricordare, perché la scheda dovrà mostrarlo in evidenza. Chi dorme davvero
-- resta nelle colonne di sempre (extra_phone_1/2, extra_phone_1/2_name,
-- chi_e, chi_e_2).
--
-- Solo una colonna nuova, falsa per tutte le righe che ci sono già: nessun
-- dato cambia di significato. Finché non è applicata la pagina non mostra la
-- spunta (se ne accorge da sola leggendo la colonna).
--
-- Da applicare A MANO nell'editor SQL di Supabase, dopo il backup.
begin;
alter table public.bookings
  add column if not exists intestataria_non_dorme boolean not null default false;
comment on column public.bookings.intestataria_non_dorme is
  'Vero quando chi ha prenotato NON dorme in camera (es. un figlio prenota per la mamma): chi dorme è nelle colonne extra_phone_*/chi_e*. Dalla Nuova prenotazione, spunta «Non è lei a dormire qui» (28/09/2026).';
commit;

-- Per tornare indietro (solo se serve davvero):
--   alter table public.bookings drop column if exists intestataria_non_dorme;
