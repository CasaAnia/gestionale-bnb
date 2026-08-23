-- =====================================================================
-- SISTEMA SCONTI V4 (23/08/2026)
-- Un solo sconto per prenotazione, in una di due modalità:
--   percentage    → discount_value = percentuale (es. 10)
--   target_total  → discount_value = totale concordato (es. 1700)
-- price_per_night resta SEMPRE la tariffa ufficiale fotografata:
-- lo sconto non la sovrascrive mai. Righe esistenti: tutte null/null,
-- nessun backfill, nessun dato storico toccato.
--
-- NOTA sul CHECK: in PostgreSQL un CHECK passa anche quando l'espressione
-- vale NULL (logica a tre valori). I rami sconto stanno quindi dietro una
-- guardia "is not null" su ENTRAMBI i campi, così l'espressione non può
-- mai valere NULL e ogni mezzo-stato viene respinto davvero
-- (verificato sui 10 casi: null/null ok, percentage/10 ok,
-- target_total/1700 ok; respinti percentage/null, target_total/null,
-- null/10, percentage/0, percentage/100, target_total/0, tipo ignoto).
-- =====================================================================

alter table bookings
  add column if not exists discount_type  text,
  add column if not exists discount_value numeric;

alter table bookings
  add constraint bookings_sconto_coerente
  check (
    (discount_type is null and discount_value is null)
    or (
      discount_type is not null
      and discount_value is not null
      and (
        (discount_type = 'percentage'
          and discount_value > 0
          and discount_value < 100)
        or
        (discount_type = 'target_total'
          and discount_value > 0)
      )
    )
  );
