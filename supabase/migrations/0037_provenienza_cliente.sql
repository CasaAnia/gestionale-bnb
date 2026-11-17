-- ============================================================================
-- 0037 — PROVENIENZA SUL CLIENTE (retroattiva) — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (incarico «Provenienza del
-- cliente» dell'08/09/2026): da eseguire a mano nell'editor SQL di Supabase
-- DOPO la 0036 (già applicata), solo con l'autorizzazione di Ania. PRIMA di
-- applicarla il gestionale funziona lo stesso: il campo «Come ci ha trovato»
-- resta nascosto con l'avviso «serve la migrazione 0037» e nessun
-- salvataggio si blocca.
--
-- REGOLA: la provenienza appartiene al CLIENTE, non alla prenotazione. Un
-- cliente arrivato da Nida resta di Nida per sempre, ritorni compresi, e vale
-- anche per il passato: cambiare la provenienza del cliente vale per tutte le
-- sue prenotazioni, passate e future (le statistiche leggono dal cliente).
--
-- COSA FA
--  1. guests.provenienza (google | passaparola | altra_struttura | non_so,
--     default non_so) e guests.struttura_nome (solo con altra_struttura).
--  2. Migra i dati già inseriti con la 0036: per ogni cliente la provenienza
--     della sua prenotazione PIÙ VECCHIA (check_in, poi created_at) che ne ha
--     una (diversa da non_so).
--  3. Toglie provenienza e struttura_nome da bookings: le prenotazioni non
--     hanno più una provenienza propria (la leggono dal cliente).
--  4. richieste.provenienza/struttura_nome RESTANO: sono il valore
--     «provvisorio» di chi non è ancora cliente; alla conferma passano al
--     cliente creato (o restano quelle del cliente esistente). Dal modulo del
--     sito: cliente nuovo → google, cliente esistente → resta la sua.
-- ============================================================================

alter table public.guests add column if not exists provenienza text not null default 'non_so';
alter table public.guests add column if not exists struttura_nome text;
alter table public.guests drop constraint if exists guests_provenienza_valida;
alter table public.guests add constraint guests_provenienza_valida
  check (provenienza in ('google', 'passaparola', 'altra_struttura', 'non_so'));

-- 2. Migrazione dei dati della 0036 (solo se bookings ha ancora le colonne)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'provenienza') then
    update public.guests g
    set provenienza = p.provenienza,
        struttura_nome = case when p.provenienza = 'altra_struttura' then p.struttura_nome else null end
    from (
      select distinct on (b.guest_id) b.guest_id, b.provenienza, b.struttura_nome
      from public.bookings b
      where b.guest_id is not null and b.provenienza is not null and b.provenienza <> 'non_so'
      order by b.guest_id, b.check_in, b.created_at
    ) p
    where g.id = p.guest_id and g.provenienza = 'non_so';

    -- 3. Le prenotazioni non hanno più una provenienza propria
    alter table public.bookings drop constraint if exists bookings_provenienza_valida;
    alter table public.bookings drop column if exists struttura_nome;
    alter table public.bookings drop column if exists provenienza;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Verifica: 2 righe (guests.provenienza, guests.struttura_nome), 0 righe su bookings,
-- e quanti clienti hanno una provenienza diversa da non_so
select table_name, column_name from information_schema.columns
where table_schema = 'public' and table_name in ('guests', 'bookings') and column_name in ('provenienza', 'struttura_nome')
order by table_name, column_name;
select provenienza, count(*) from public.guests group by provenienza order by provenienza;
