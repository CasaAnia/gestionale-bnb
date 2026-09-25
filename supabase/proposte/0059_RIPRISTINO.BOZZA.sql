-- =====================================================================
-- RIPRISTINO della proposta 0059 «Pulizie: dotazione, recuperi, tempi»
-- Da usare SOLO se, dopo averla applicata, si decide di tornare indietro,
-- e solo DOPO aver rimesso l'app precedente (l'app nuova chiama
-- gestisci_tempo_pulizie e scrive le colonne nuove).
--
-- COSA SI PERDE: letti preparati, minuti, lenzuola per misura, timer e
-- tempi fuori camera registrati dopo l'applicazione. Prima di eseguire
-- salvarne una copia fuori:
--   select id, assetto, dotazione, minuti, aggiornata_at from public.cleanings where assetto is not null or minuti is not null;
--   select cleaning_id, sotto_matrimoniale, sopra_matrimoniale, sotto_singolo, sopra_singolo, federe from public.biancheria_recuperata
--    where sotto_matrimoniale + sopra_matrimoniale + sotto_singolo + sopra_singolo > 0 or federe > 4;
--   select * from public.pulizie_fuori_camera; select * from public.pulizie_timer;
-- COSA NON SI PERDE: pulizie, rinvii, salti e i recuperi delle colonne di
-- prima (federe fino a 4, lenzuolo_sotto/sopra, asciugamani, tappeti).
-- ATTENZIONE: il vincolo federe torna 0..4; se una riga ha più di 4 federe
-- (Lena con singoli) il ripristino si ferma: correggerla prima, a mano.
-- =====================================================================
begin;
drop function if exists public.gestisci_tempo_pulizie(jsonb);
drop table if exists public.pulizie_timer;
drop table if exists public.pulizie_fuori_camera;
alter table public.biancheria_recuperata drop constraint if exists biancheria_recuperata_misure_check;
alter table public.biancheria_recuperata drop constraint if exists biancheria_recuperata_federe_check;
alter table public.biancheria_recuperata add constraint biancheria_recuperata_federe_check check (federe between 0 and 4);
alter table public.biancheria_recuperata drop column if exists sotto_matrimoniale, drop column if exists sopra_matrimoniale,
  drop column if exists sotto_singolo, drop column if exists sopra_singolo;
alter table public.cleanings drop constraint if exists cleanings_minuti_check;
alter table public.cleanings drop constraint if exists cleanings_dotazione_solo_fatta;
alter table public.cleanings drop constraint if exists cleanings_assetto_con_dotazione;
alter table public.cleanings drop column if exists assetto, drop column if exists dotazione, drop column if exists minuti, drop column if exists aggiornata_at;
drop function if exists private.dotazione_da_assetto(jsonb);
drop function if exists private.assetto_pulito(jsonb);
commit;
-- Poi rieseguire per intero supabase/proposte/0045_pulizie_manuali.BOZZA.sql
-- (ripristina gestisci_pulizia della 0045; è idempotente).
