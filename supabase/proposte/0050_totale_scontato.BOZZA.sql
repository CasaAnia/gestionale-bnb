-- =====================================================================
-- IL TOTALE SALVATO DELLE PRENOTAZIONI SCONTATE (14/09/2026) — proposta 0050
--
-- Il difetto (trovato provando la pagina nuova di inserimento): quando una
-- prenotazione ha uno sconto, in `total_amount` finiva il prezzo PIENO e lo
-- sconto viveva solo in `discount_type` / `discount_value`. La lettura riga
-- per riga (lib/conto) rifà il conto e mostra il numero giusto, ma il conto
-- della PRENOTAZIONE (lib/prenotazioneUnica, che somma i total_amount)
-- mostrava il pieno: 280 € dove la cliente ne paga 252.
--
-- Il codice è già stato corretto (14/09/2026): da adesso tutte e due le
-- pagine di inserimento scrivono il totale già scontato. Restano le righe
-- salvate PRIMA. Questa proposta le sistema.
--
-- NON tocca i prezzi concordati: `price_per_night`, `extra_bed_total`,
-- `discount_type` e `discount_value` restano esattamente come sono. Cambia
-- solo `total_amount`, portandolo a quello che il gestionale già mostra
-- nella riga del conto.
--
-- PRIMA di applicare, guarda quante e quali sono:
--
--   select id, check_in, check_out, total_amount as totale_salvato,
--          discount_type, discount_value,
--          round((price_per_night * (check_out - check_in) + coalesce(extra_bed_total, 0))::numeric, 2) as pieno,
--          case
--            when discount_type = 'percentage'
--              then round(((price_per_night * (check_out - check_in) + coalesce(extra_bed_total, 0)) * (1 - discount_value / 100))::numeric, 2)
--            when discount_type = 'target_total' then round(discount_value::numeric, 2)
--          end as totale_giusto
--     from public.bookings
--    where discount_type is not null
--      and status <> 'annullata'
--    order by check_in desc;
--
-- Se la colonna «totale_salvato» è già uguale a «totale_giusto», non c'è
-- niente da fare: l'aggiornamento qui sotto non tocca quelle righe.
-- =====================================================================

update public.bookings
   set total_amount = case
         when discount_type = 'percentage'
           then round(((price_per_night * (check_out - check_in) + coalesce(extra_bed_total, 0)) * (1 - discount_value / 100))::numeric, 2)
         when discount_type = 'target_total'
           then round(discount_value::numeric, 2)
       end,
       updated_at = now()
 where discount_type in ('percentage', 'target_total')
   and discount_value is not null
   and status <> 'annullata'
   -- solo le righe dove il totale salvato NON è già quello scontato
   and total_amount is distinct from case
         when discount_type = 'percentage'
           then round(((price_per_night * (check_out - check_in) + coalesce(extra_bed_total, 0)) * (1 - discount_value / 100))::numeric, 2)
         when discount_type = 'target_total'
           then round(discount_value::numeric, 2)
       end
   -- e solo dove lo sconto è davvero uno sconto (un «totale concordato» più
   -- alto del pieno non è uno sconto: quelle righe restano come sono)
   and (discount_type = 'percentage'
        or discount_value < price_per_night * (check_out - check_in) + coalesce(extra_bed_total, 0));
