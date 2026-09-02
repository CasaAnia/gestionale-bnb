-- ============================================================================
-- 0026 — ACCESSO A richieste E bookings RISTRETTO AGLI UTENTI AUTORIZZATI
-- ***PROPOSTA*** (pezzo 3b, punto 5, 02/09/2026) — NON APPLICATA
-- ============================================================================
-- STATO DI FATTO (supabase/rls.sql e migrazione 0024): bookings, guests,
-- payments, rooms e richieste hanno la policy «accesso_utenti_autenticati»:
-- qualunque utente AUTENTICATO su questo progetto Supabase legge e scrive.
-- Oggi gli utenti registrati sono solo quelli di casa (Ania e Ivan), quindi
-- l'effetto pratico è lo stesso; ma se un giorno si registrasse un altro
-- account, avrebbe accesso a tutto.
--
-- Il modulo Spese (0020/0021) usa già una lista esplicita: public.app_members
-- con la funzione private.is_app_member(). Questa proposta porta richieste e
-- prenotazioni sulla STESSA lista, senza cambiare nulla per chi è già dentro.
--
-- PRIMA DI APPLICARE (nell'editor SQL, progetto tnsaa…vwv):
--   1. controllare che ENTRAMBI gli utenti siano in app_members:
--        select u.email, m.role from auth.users u
--        left join public.app_members m on m.user_id = u.id;
--      chi ha role NULL va aggiunto (come 'member'), altrimenti dopo la
--      migrazione resta chiuso fuori:
--        insert into public.app_members (user_id, role)
--        select id, 'member' from auth.users where email = '<email di Ivan>'
--        on conflict (user_id) do nothing;
--   2. le route push usano la service key e non passano da qui: nessun effetto.
--
-- ROLLBACK: ricreare la policy aperta, es.
--   create policy "accesso_utenti_autenticati" on public.richieste
--     for all to authenticated using (true) with check (true);

do $$
begin
  if to_regprocedure('private.is_app_member()') is null then
    raise exception 'PRECONDIZIONE FALLITA: manca private.is_app_member() (migrazione 0021).';
  end if;
  if (select count(*) from public.app_members) < 2 then
    raise exception 'PRECONDIZIONE FALLITA: app_members ha meno di 2 utenti: aggiungere Ania e Ivan prima di restringere.';
  end if;
end $$;

-- richieste
drop policy if exists "accesso_utenti_autenticati" on public.richieste;
drop policy if exists richieste_membri on public.richieste;
create policy richieste_membri on public.richieste
  for all to authenticated
  using ((select private.is_app_member())) with check ((select private.is_app_member()));

-- prenotazioni e tabelle collegate (stesso perimetro della scheda prenotazione)
drop policy if exists "accesso_utenti_autenticati" on public.bookings;
drop policy if exists bookings_membri on public.bookings;
create policy bookings_membri on public.bookings
  for all to authenticated
  using ((select private.is_app_member())) with check ((select private.is_app_member()));

drop policy if exists "accesso_utenti_autenticati" on public.guests;
drop policy if exists guests_membri on public.guests;
create policy guests_membri on public.guests
  for all to authenticated
  using ((select private.is_app_member())) with check ((select private.is_app_member()));

drop policy if exists "accesso_utenti_autenticati" on public.payments;
drop policy if exists payments_membri on public.payments;
create policy payments_membri on public.payments
  for all to authenticated
  using ((select private.is_app_member())) with check ((select private.is_app_member()));
alter table public.payments enable row level security;

-- Verifica: ogni tabella con rls_attiva = true e la sola policy *_membri.
select t.tablename, t.rowsecurity as rls_attiva, string_agg(p.policyname, ', ') as policy
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.tablename in ('richieste', 'bookings', 'guests', 'payments')
group by t.tablename, t.rowsecurity
order by t.tablename;
