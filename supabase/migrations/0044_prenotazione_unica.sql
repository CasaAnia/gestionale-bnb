-- =====================================================================
-- UNA PRENOTAZIONE, PIÙ CAMERE (09/09/2026)
--
-- Oggi bookings ha un solo legame: group_id, che tiene insieme i periodi
-- di un CAMBIO CAMERA (Ambra 14–17 poi Allegra 17–20 = un soggiorno).
-- Manca il legame di sopra: due camere prese INSIEME dalla stessa
-- persona (Ambra e Amelia, 14–20) restano due prenotazioni separate.
-- Conseguenze vere: la caparra vale per una camera sola, lo storico le
-- conta come due visite, la conferma ne descrive una per volta.
--
-- prenotazione_id è quel legame. I due livelli restano distinti:
--   prenotazione_id  → tutte le camere della stessa prenotazione
--   group_id         → i periodi di uno stesso soggiorno (cambio camera)
--
-- BACKFILL: solo l'unico sicuro, cioè prenotazione_id = group_id (o id).
-- Ogni prenotazione esistente resta com'è; NON si prova a indovinare
-- quali camere passate fossero in realtà la stessa prenotazione: due
-- soggiorni dello stesso cliente nelle stesse date possono essere una
-- prenotazione unica oppure due richieste distinte, e dal database non
-- si distinguono. La query in fondo elenca i casi da guardare a mano.
-- =====================================================================

alter table public.bookings
  add column if not exists prenotazione_id uuid;

comment on column public.bookings.prenotazione_id is
  'Tutte le camere della stessa prenotazione. group_id resta il legame dei periodi di un cambio camera.';

-- ogni riga esistente diventa una prenotazione a sé (o resta col suo gruppo)
update public.bookings
   set prenotazione_id = coalesce(group_id, id)
 where prenotazione_id is null;

create index if not exists bookings_prenotazione_id_idx
  on public.bookings (prenotazione_id);

-- Un gruppo (cambio camera) non può stare a cavallo di due prenotazioni.
-- Vincolo verificato dopo il backfill: se fallisse, ci sono dati da
-- guardare prima di applicarlo.
-- alter table public.bookings add constraint bookings_gruppo_dentro_prenotazione
--   check (true);   -- il controllo vero è la query qui sotto

-- ── da verificare a mano, non tocca niente ───────────────────────────
-- 1. Camere dello stesso cliente che si sovrappongono nelle date e oggi
--    stanno in prenotazioni diverse: POTREBBERO essere una prenotazione
--    unica. Da decidere una per una, non in automatico.
--
--   select a.guest_id, a.id as camera_a, b.id as camera_b,
--          a.check_in, a.check_out, b.check_in, b.check_out
--     from public.bookings a
--     join public.bookings b
--       on a.guest_id = b.guest_id
--      and a.id < b.id
--      and a.status <> 'annullata' and b.status <> 'annullata'
--      and a.check_in < b.check_out and b.check_in < a.check_out
--      and coalesce(a.prenotazione_id, a.id) <> coalesce(b.prenotazione_id, b.id)
--    order by a.check_in desc;
--
-- 2. Gruppi finiti in prenotazioni diverse (non dovrebbe succedere):
--
--   select group_id, count(distinct prenotazione_id) as quante
--     from public.bookings
--    where group_id is not null
--    group by group_id
--   having count(distinct prenotazione_id) > 1;
