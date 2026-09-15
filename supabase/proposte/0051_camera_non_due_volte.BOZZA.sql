-- =====================================================================
-- UNA CAMERA, UNA PRENOTAZIONE PER NOTTE (15/09/2026) — proposta 0051
--
-- IL PROBLEMA. Il gestionale legge chi occupa le camere, spegne quelle
-- prese e ricontrolla prima di scrivere. Ma fra il controllo e la
-- scrittura passa un istante: se in quell'istante arriva un'altra
-- prenotazione — un'altra scheda aperta, il telefono e il Mac insieme,
-- una richiesta confermata dal sito — tutti e due i controlli dicono
-- «libera» e finiscono due prenotazioni sulla stessa camera. Nessun
-- controllo fatto nel browser può chiudere quella finestra: la può
-- chiudere solo il database, che è l'unico a vedere tutte le scritture.
--
-- LA SOLUZIONE. Un vincolo di esclusione: PostgreSQL rifiuta la seconda
-- riga che si sovrappone alla prima sulla stessa camera. Serve
-- l'estensione btree_gist perché il vincolo mette insieme un'uguaglianza
-- (la camera) e una sovrapposizione (le date).
--
-- Le notti si contano come [arrivo, partenza): chi parte il 12 e chi
-- arriva il 12 NON si sovrappongono, ed è giusto così.
--
-- Le righe annullate non occupano: il vincolo le esclude.
--
-- PRIMA DI APPLICARE — guarda se ci sono già sovrapposizioni, altrimenti
-- il vincolo non si crea e l'errore non dice quali sono:
--
--   select a.id, b.id, a.room_id, a.check_in, a.check_out, b.check_in, b.check_out
--     from public.bookings a
--     join public.bookings b
--       on a.room_id = b.room_id
--      and a.id < b.id
--      and a.status <> 'annullata' and b.status <> 'annullata'
--      and daterange(a.check_in, a.check_out, '[)') && daterange(b.check_in, b.check_out, '[)')
--    order by a.check_in;
--
-- Se ne trova, vanno sistemate a mano PRIMA: il vincolo non può
-- decidere quale delle due prenotazioni è quella buona.
-- =====================================================================

create extension if not exists btree_gist;

alter table public.bookings
  drop constraint if exists bookings_camera_non_due_volte;

alter table public.bookings
  add constraint bookings_camera_non_due_volte
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status <> 'annullata');

comment on constraint bookings_camera_non_due_volte on public.bookings is
  'Una camera non può avere due prenotazioni attive sulle stesse notti. Chi arriva il giorno in cui un altro parte non si sovrappone.';

-- DOPO AVER APPLICATO: il gestionale riconosce il rifiuto dal codice
-- 23P01 (exclusion_violation) e lo traduce in «quella camera è appena
-- stata presa». Vedi lib/erroreSovrapposizione.ts.
--
-- PER TORNARE INDIETRO:
--   alter table public.bookings drop constraint bookings_camera_non_due_volte;
