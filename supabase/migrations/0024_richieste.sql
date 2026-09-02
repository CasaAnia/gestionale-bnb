-- ============================================================================
-- 0024 — RICHIESTE DI PRENOTAZIONE (pezzo 1 di 8, 02/09/2026)
-- ============================================================================
-- La numerazione salta la 0023: quel numero è già della funzione
-- `elabora_sostituisci_bozze` (supabase/proposte/0023_…BOZZA.sql), applicata
-- in produzione il 01/09/2026 e non ancora promossa fra le migrazioni.
--
-- Una richiesta è ciò che arriva PRIMA di una prenotazione: dal sito, per
-- telefono o su WhatsApp. Resta separata da `bookings` finché Ania non la
-- conferma (pezzo 5), quando `prenotazione_id` punta alla prenotazione nata
-- da lei. Nessun dato esistente viene toccato.
--
-- Da eseguire nell'editor SQL di Supabase (stesso metodo delle precedenti),
-- poi verificare che `public.richieste` esista davvero: una migrazione non
-- applicata fa fallire i salvataggi in silenzio.

create table if not exists public.richieste (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),           -- ora di arrivo della richiesta
  nome text not null,
  cognome text not null,
  arrivo date not null,
  partenza date not null,
  persone smallint not null default 1,
  camera_id uuid references public.rooms(id),               -- null = qualsiasi camera
  canale text not null check (canale in ('web', 'telefono', 'whatsapp')),
  telefono text,                                            -- numero per rispondere su WhatsApp
  note text,
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'proposta_inviata', 'confermata', 'rifiutata')),
  proposta_inviata_at timestamptz,
  chiusa_at timestamptz,
  prenotazione_id uuid references public.bookings(id),      -- si valorizza alla conferma (pezzo 5)
  constraint richieste_partenza_dopo_arrivo check (partenza > arrivo),
  constraint richieste_persone_positive check (persone >= 1)
);

create index if not exists idx_richieste_stato_arrivo on public.richieste (stato, arrivo);

-- Stessa protezione delle altre tabelle del gestionale (vedi supabase/rls.sql):
-- accesso completo solo al ruolo authenticated, anon escluso.
alter table public.richieste enable row level security;

drop policy if exists "accesso_utenti_autenticati" on public.richieste;
create policy "accesso_utenti_autenticati" on public.richieste
  for all to authenticated using (true) with check (true);

-- Verifica: deve restituire una riga con rls_attiva = true e policy = 1.
select t.tablename, t.rowsecurity as rls_attiva, count(p.policyname) as policy
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.tablename = 'richieste'
group by t.tablename, t.rowsecurity;
