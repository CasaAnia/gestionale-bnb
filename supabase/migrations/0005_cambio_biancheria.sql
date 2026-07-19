-- Cambio biancheria: data del prossimo cambio previsto per la prenotazione (pagina Pulizie).
-- Se null vale la regola "ogni 4 notti" dal check-in; si aggiorna quando il cambio
-- viene segnato fatto o spostato a mano.
alter table bookings add column if not exists linen_next_date date default null;
