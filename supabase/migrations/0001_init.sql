-- ============================================================
-- Gestionale B&B - Casa Ania Rozzano
-- ============================================================

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bathroom_type text not null check (bathroom_type in ('privato_interno', 'privato_esterno')),
  bathroom_note text,
  base_price numeric(10,2) not null default 0,
  has_extra_bed boolean not null default true,
  extra_bed_price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  full_name text,
  email text,
  document_type text,
  document_number text,
  nationality text,
  birth_date date,
  birth_place text,
  rating text check (rating in ('ottimo', 'problematico', 'vuole_ricevuta', 'normale')) default 'normale',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guests_phone on guests (phone);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  guest_id uuid not null references guests(id),
  check_in date not null,
  check_out date not null,
  num_guests integer not null default 1,
  extra_bed boolean not null default false,
  price_per_night numeric(10,2) not null,
  extra_bed_total numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  status text not null check (status in ('confermata', 'in_attesa', 'annullata', 'completata')) default 'confermata',
  source text default 'diretta',
  notes text,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_guest on bookings (guest_id);
create index idx_bookings_room_dates on bookings (room_id, check_in, check_out);

create table booking_whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  message_type text not null check (message_type in ('conferma', 'modifica', 'annullamento')),
  message_text text not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references expense_categories(id),
  expense_date date not null,
  amount numeric(10,2) not null,
  description text,
  source text not null check (source in ('manuale', 'email')) default 'manuale',
  created_at timestamptz not null default now()
);

-- Dati iniziali
insert into expense_categories (name) values
  ('Utenze'), ('Pulizie'), ('Manutenzione'), ('Commissioni'), ('Forniture'), ('Altro');

insert into rooms (name, bathroom_type, bathroom_note, base_price, extra_bed_price) values
  ('Camera 1', 'privato_interno', null, 0, 0),
  ('Camera 2', 'privato_esterno', 'Bagno privato a circa 1 metro fuori dalla camera', 0, 0),
  ('Camera 3', 'privato_interno', null, 0, 0),
  ('Camera 4', 'privato_interno', null, 0, 0);
