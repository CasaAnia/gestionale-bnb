-- Storico reale delle pulizie (audit 24 agosto 2026).
--
-- Ogni riga è una DECISIONE presa da Ania nella pagina Pulizie:
--   fatta     = pulizia realmente eseguita; il ciclo delle 4 notti riparte
--               da data_effettiva (regola fissata da Ania il 24/08/2026)
--   saltata   = quella specifica pulizia non verrà effettuata (concordato
--               con l'ospite); prossima_data è la successiva proposta
--               (prevista + 4, modificabile prima della conferma)
--   rimandata = la stessa pulizia resta aperta ma si sposta a prossima_data
--
-- Le pulizie PREVISTE non stanno in tabella: si ricalcolano sempre dalle
-- prenotazioni (lib/pulizie.ts), così non esistono code vecchie da pulire
-- quando una prenotazione cambia. La tabella registra solo ciò che è
-- realmente accaduto: è lo storico, la base delle statistiche e del
-- pannello "perché questa pulizia".
create table if not exists cleanings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  booking_id uuid references bookings(id) on delete set null,
  -- fine_soggiorno = l'ospite parte; soggiorno = pulizia ogni 4 notti con
  -- ospite presente; cambio_camera = l'ospite si sposta in un'altra camera
  tipo text not null check (tipo in ('fine_soggiorno', 'soggiorno', 'cambio_camera')),
  stato text not null check (stato in ('fatta', 'saltata', 'rimandata')),
  data_prevista date not null,
  data_effettiva date,          -- solo per stato = fatta
  prossima_data date,           -- solo per saltata (prossima proposta) e rimandata (nuova data)
  cambio_biancheria boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cleanings_room_idx on cleanings (room_id, created_at);
create index if not exists cleanings_booking_idx on cleanings (booking_id);

-- Registro delle notifiche push inviate: ogni pop-up strano deve potersi
-- spiegare a posteriori guardando cosa è partito, quando e perché.
create table if not exists push_log (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,           -- pulizie | arrivi | orario | ringraziamento | ...
  titolo text not null,
  corpo text,
  dettaglio jsonb,              -- dati usati per il calcolo (camere, motivi, date)
  inviate int not null default 0,
  created_at timestamptz not null default now()
);
