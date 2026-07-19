-- Acconti: pagamenti parziali ricevuti su una prenotazione (conto del soggiorno).
-- Il residuo si calcola come total_amount - somma degli acconti.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount numeric not null,
  method text not null default 'contanti', -- 'contanti' | 'bonifico'
  paid_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_booking on payments (booking_id);

-- Come per le altre tabelle del gestionale: RLS disattivata (l'editor SQL
-- Supabase la attiva di default sulle tabelle nuove e blocca le scritture)
alter table payments disable row level security;
