-- ============================================================================
-- 0035 — HOME «DA CONTROLLARE»: RINVII DELLE RICHIESTE — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (incarico «Da controllare»
-- del 06/09/2026): da eseguire a mano nell'editor SQL di Supabase solo dopo
-- l'autorizzazione di Ania. Il gestionale funziona anche SENZA questa
-- tabella: la sezione «Da controllare» compare lo stesso e il solo bottone
-- «Rimanda» delle richieste dice «Rimanda non disponibile: va applicata la
-- proposta 0035».
--
-- COSA FA
--  Una riga per voce rimandata: `chiave` è la chiave stabile della voce
--  («richiesta:<uuid>», lib/daControllare), `fino_a` il giorno fino al quale
--  resta nascosta (la Home la nasconde finché oggi < fino_a: un «Rimanda»
--  fatto oggi la fa riapparire domani). Memoria LATO SERVER, così vale su
--  telefono e Mac; niente localStorage. Nessuna modifica ad altre tabelle.
--  Le righe scadute restano (sono poche e non contano più): si possono
--  pulire quando si vuole con l'ultima istruzione, commentata.
--
-- LETTURA/SCRITTURA: lib/daControllareDati (select chiave, fino_a con
-- fino_a > oggi; upsert su chiave). RLS attiva, solo authenticated.
-- ============================================================================

create table if not exists public.da_controllare_rinvii (
  chiave text primary key,
  fino_a date not null,
  created_at timestamptz not null default now()
);

alter table public.da_controllare_rinvii enable row level security;

drop policy if exists "accesso_utenti_autenticati" on public.da_controllare_rinvii;
create policy "accesso_utenti_autenticati" on public.da_controllare_rinvii
  for all to authenticated using (true) with check (true);

revoke all on public.da_controllare_rinvii from public, anon;
grant select, insert, update, delete on public.da_controllare_rinvii to authenticated, service_role;

-- Verifica: una riga con rls_attiva = true e policy = 1.
select t.tablename, t.rowsecurity as rls_attiva, count(p.policyname) as policy
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.tablename = 'da_controllare_rinvii'
group by t.tablename, t.rowsecurity;

-- Pulizia facoltativa dei rinvii ormai scaduti (quando si vuole):
-- delete from public.da_controllare_rinvii where fino_a < current_date;
