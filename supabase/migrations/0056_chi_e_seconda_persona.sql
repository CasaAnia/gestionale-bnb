-- STATO (17/11/2026): APPLICATA IN PRODUZIONE; ora è una migrazione regolare (era in supabase/proposte/).
-- Verificato contro lo schema vero (scripts/schema/confronta-schema.mjs, lettura): colonne, tipi, NOT NULL e
-- funzioni chiamabili coincidono. NON verificabili senza il catalogo: vincoli CHECK, indici, policy RLS, trigger e
-- corpi delle funzioni (supabase/strumenti/leggi-catalogo.sql). Dove il testo qui sotto dice «proposta», «bozza»
-- o «NON APPLICATA», è il testo d'origine: vale questa riga. Applicarla di nuovo non cambia nulla.
-- =====================================================================
-- CHI È LA SECONDA PERSONA CHE DORME CON LEI (16/09/2026) — proposta 0056
--
-- «Con lei» della nuova prenotazione salva due persone nelle colonne di
-- sempre (extra_phone_1/2, extra_phone_1/2_name) e la relazione della
-- prima in chi_e. Per la seconda non c'era nessuna colonna: la relazione
-- si perdeva in silenzio. Questa aggiunge chi_e_2.
--
-- Senza questa proposta il gestionale salva il resto e avvisa che «chi è
-- la seconda persona» non è stato registrato (lib/nuovaPrenotazione,
-- colonne rinunciabili). Niente si blocca.
-- =====================================================================

alter table public.bookings add column if not exists chi_e_2 text;
