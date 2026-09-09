-- =====================================================================
-- LETTO AGGIUNTIVO: QUANTO E COME, NON SOLO IL RISULTATO (09/09/2026)
--
-- Oggi si salva soltanto extra_bed_total, cioè quanto è venuto. Se Ania
-- ha concordato «20 € in tutto», riaprendo la prenotazione il gestionale
-- non lo sa più: rifà il conto «a notte» dividendo per le notti, e
-- allungando il soggiorno il prezzo cambia da solo. Con due campi in più
-- l'accordo si rilegge come è stato preso.
--
--   extra_bed_importo   quanto ha deciso Ania (per notte, per blocco o
--                       in tutto, secondo il criterio)
--   extra_bed_criterio  'notte' | 'ogni4' | 'totale'
--
-- NESSUN BACKFILL: da extra_bed_total non si può ricavare quale accordo
-- fosse. 20 € su 4 notti possono essere 5 € a notte oppure 20 € in
-- tutto, e le due cose si comportano in modo diverso quando cambiano le
-- notti. Le righe vecchie restano senza accordo: le pagine, finché il
-- campo è vuoto, continuano a fare esattamente il conto di prima.
-- La query in fondo elenca quelle su cui vale la pena guardare.
-- =====================================================================

alter table public.bookings
  add column if not exists extra_bed_importo numeric,
  add column if not exists extra_bed_criterio text;

comment on column public.bookings.extra_bed_importo is
  'Importo concordato per il letto aggiuntivo, da leggere insieme a extra_bed_criterio.';
comment on column public.bookings.extra_bed_criterio is
  'Come si applica l''importo: notte | ogni4 | totale. Vuoto = accordo non registrato (righe precedenti al 09/09/2026).';

alter table public.bookings drop constraint if exists bookings_extra_bed_criterio_check;
alter table public.bookings add constraint bookings_extra_bed_criterio_check
  check (extra_bed_criterio is null or extra_bed_criterio in ('notte', 'ogni4', 'totale'));

-- importo e criterio vanno insieme: o tutti e due, o nessuno dei due
alter table public.bookings drop constraint if exists bookings_extra_bed_accordo_coerente;
alter table public.bookings add constraint bookings_extra_bed_accordo_coerente
  check ((extra_bed_importo is null) = (extra_bed_criterio is null));

-- ── da verificare a mano, non tocca niente ───────────────────────────
-- Prenotazioni future col letto e senza accordo registrato: se una di
-- queste aveva un prezzo concordato, conviene riscriverlo dalla scheda
-- prima di modificarne le notti.
--
--   select id, check_in, check_out, num_guests,
--          extra_bed_total, array_length(extra_bed_dates, 1) as notti_letto
--     from public.bookings
--    where extra_bed = true
--      and coalesce(extra_bed_total, 0) > 0
--      and extra_bed_criterio is null
--      and check_out >= current_date
--      and status <> 'annullata'
--    order by check_in;
