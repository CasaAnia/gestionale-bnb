-- Aggiunge group_id per collegare prenotazioni con cambio camera
alter table bookings add column if not exists group_id uuid default null;

create index if not exists idx_bookings_group on bookings (group_id) where group_id is not null;
