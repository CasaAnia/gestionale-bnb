-- ============================================================================
-- 0041 — MOTIVO DEL RIFIUTO A CODICI — ***PROPOSTA/BOZZA***
-- ============================================================================
-- STATO: NON APPLICATA. Vive in supabase/proposte/ (incarico «Rifiuta con
-- motivo» del 07/09/2026): da eseguire a mano nell'editor SQL di Supabase
-- (progetto di PRODUZIONE tnsaa…vwv) con l'autorizzazione di Ania.
-- PRIMA di applicarla il gestionale funziona già: la finestra «Perché la
-- rifiuti?» salva il codice nella colonna motivo_rifiuto (che esiste dalla
-- 0027) e i valori vecchi («Completo», «Prezzo», «Non ha più risposto»,
-- «Altro», «date assegnate a altro cliente») vengono letti lo stesso e
-- riportati a un codice da lib/motivoRifiuto. Questa bozza rende la cosa
-- stabile anche sul database.
--
-- COSA FA
--  1. Riporta i valori vecchi ai quattro codici: non_risposto, detto_no,
--     data_ad_altro, altro.
--  2. Trigger che normalizza ogni scrittura futura di motivo_rifiuto (così la
--     RPC conferma_richiesta, che nel rifiuto in cascata scrive ancora
--     «date assegnate a altro cliente», continua a funzionare senza toccarla).
--  3. Vincolo: motivo_rifiuto è NULL oppure uno dei quattro codici.
--  La chiusura automatica per scadenza NON cambia (chiusura_motivo = 'scaduta',
--  motivo_rifiuto NULL).
--
-- ROLLBACK: alter table public.richieste drop constraint if exists richieste_motivo_rifiuto_check;
--           drop trigger if exists richieste_normalizza_motivo_rifiuto on public.richieste;
--           drop function if exists public.normalizza_motivo_rifiuto();
--           (i valori già riportati a codice restano: sono leggibili dal gestionale)

create or replace function public.normalizza_motivo_rifiuto_testo(p_testo text)
returns text
language sql
immutable
as $$
  select case
    when p_testo is null or btrim(p_testo) = '' then null
    when btrim(p_testo) in ('non_risposto', 'detto_no', 'data_ad_altro', 'altro') then btrim(p_testo)
    when lower(p_testo) ~ 'non ha (più |piu )?risposto' then 'non_risposto'
    when lower(p_testo) ~ 'altro cliente|qualcun altro|a un altro' then 'data_ad_altro'
    else 'altro'
  end
$$;

-- 1. Valori vecchi → codici (stessa regola di lib/motivoRifiuto)
update public.richieste
   set motivo_rifiuto = public.normalizza_motivo_rifiuto_testo(motivo_rifiuto)
 where motivo_rifiuto is distinct from public.normalizza_motivo_rifiuto_testo(motivo_rifiuto);

-- 2. Ogni scrittura futura passa dalla stessa regola
create or replace function public.normalizza_motivo_rifiuto()
returns trigger
language plpgsql
as $$
begin
  new.motivo_rifiuto := public.normalizza_motivo_rifiuto_testo(new.motivo_rifiuto);
  return new;
end;
$$;

drop trigger if exists richieste_normalizza_motivo_rifiuto on public.richieste;
create trigger richieste_normalizza_motivo_rifiuto
  before insert or update of motivo_rifiuto on public.richieste
  for each row execute function public.normalizza_motivo_rifiuto();

-- 3. Vincolo sui quattro codici
alter table public.richieste drop constraint if exists richieste_motivo_rifiuto_check;
alter table public.richieste add constraint richieste_motivo_rifiuto_check
  check (motivo_rifiuto is null or motivo_rifiuto in ('non_risposto', 'detto_no', 'data_ad_altro', 'altro'));

-- VERIFICA (da controllare dopo Run): nessuna riga fuori dai codici; conteggio per motivo
select motivo_rifiuto, count(*) as richieste
  from public.richieste
 where motivo_rifiuto is not null
 group by motivo_rifiuto
 order by motivo_rifiuto;
select count(*) as fuori_dai_codici
  from public.richieste
 where motivo_rifiuto is not null
   and motivo_rifiuto not in ('non_risposto', 'detto_no', 'data_ad_altro', 'altro');
