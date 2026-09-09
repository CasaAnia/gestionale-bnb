-- =====================================================================
-- ACCORDO DI PAGAMENTO SULLA PRENOTAZIONE (09/09/2026)
--
-- Fino a oggi bookings sapeva soltanto «bonifico sì/no»: la caparra e la
-- sua scadenza vivevano solo sulle richieste. La nuova pagina di
-- inserimento le chiede alla prenotazione, quindi servono qui.
--
--   accordo_pagamento  contanti | bonifico_arrivo | bonifico_intero
--                      | caparra_meta | caparra_libera
--   caparra_centesimi  importo della caparra in CENTESIMI (solo per le
--                      due caparre; per «caparra_meta» è la metà del
--                      totale fotografata al salvataggio)
--   caparra_entro      data e ora entro cui è attesa (fuso di Roma)
--
-- Niente backfill: le prenotazioni esistenti restano con tutto null e
-- continuano a leggersi da `bonifico` come prima. Il codice funziona
-- anche senza questa proposta applicata (i campi vengono semplicemente
-- non salvati e la pagina lo dice).
-- =====================================================================

alter table public.bookings
  add column if not exists accordo_pagamento text,
  add column if not exists caparra_centesimi integer,
  add column if not exists caparra_entro timestamptz;

alter table public.bookings drop constraint if exists bookings_accordo_pagamento_check;
alter table public.bookings add constraint bookings_accordo_pagamento_check
  check (accordo_pagamento is null or accordo_pagamento in
    ('contanti', 'bonifico_arrivo', 'bonifico_intero', 'caparra_meta', 'caparra_libera'));

alter table public.bookings drop constraint if exists bookings_caparra_centesimi_check;
alter table public.bookings add constraint bookings_caparra_centesimi_check
  check (caparra_centesimi is null or caparra_centesimi > 0);

-- La caparra ha senso solo con un accordo che la prevede
alter table public.bookings drop constraint if exists bookings_caparra_coerente;
alter table public.bookings add constraint bookings_caparra_coerente
  check (
    caparra_centesimi is null
    or accordo_pagamento in ('caparra_meta', 'caparra_libera')
  );
