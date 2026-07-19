-- Pulizie: quando la camera viene segnata pulita dopo il check-out di questa prenotazione
alter table bookings add column if not exists cleaned_at timestamptz default null;
