-- ============================================================================
-- BOZZA (NON APPLICARE) — TRANSIZIONE, FASE A: si chiudono TUTTI gli
-- ingressi legacy. Riferimento: PROPOSTA-RECUPERO-REVISIONE.md §5.
-- Stato: DA COLLAUDARE in ambiente isolato con autorizzazione separata;
-- la produzione richiederà un'ulteriore autorizzazione.
--
-- Cosa fa, in UNA transazione:
--  1. fotografa nel backup le definizioni ORIGINALI delle cinque
--     funzioni legacy (per il rollback del runbook);
--  2. le SPOSTA VERBATIM in private.* usando pg_get_functiondef —
--     nessuna copia manuale: si riscrive SOLO l'intestazione
--     («FUNCTION public.nome» → «FUNCTION private.nome»), il corpo
--     resta byte per byte quello deployato;
--  3. revoca ogni permesso sulle copie private (public/anon/
--     authenticated/service_role: le chiama solo il codice definer del
--     contratto, e per le fatture i futuri involucri della Fase 5);
--  4. ridefinisce i CINQUE nomi pubblici come PURI RESPINGENTI
--     (P0001 «PERCORSO_DISMESSO», nessun accesso alle tabelle).
-- Dal commit: nessuna NUOVA invocazione legacy entra nella logica vera.
-- Le invocazioni già entrate le conclude la fase B.
-- ============================================================================

begin;

-- 0) tabella di backup per il ROLLBACK (runbook): conserva le
--    definizioni originali; append-only per prudenza (niente trigger:
--    è uno strumento di transizione, si elimina a transizione conclusa)
create table if not exists private.transizione_backup (
  nome text primary key,
  definizione text not null,
  salvata_il timestamptz not null default now()
);

do $$
declare
  v_nomi constant text[] := array[
    'conferma_documento', 'scarta_documento',
    'approva_fattura_da_pagare', 'paga_fattura', 'conferma_fattura_pagata'
  ];
  v_nome text; v_oid oid; v_def text; v_def_privata text; v_firma text;
begin
  foreach v_nome in array v_nomi loop
    -- ESATTAMENTE una funzione con quel nome in public (guardia)
    select p.oid into v_oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_nome;
    if not found then
      raise exception 'FASE_A_STOP: funzione public.% non trovata', v_nome;
    end if;
    v_def := pg_get_functiondef(v_oid);
    v_firma := pg_get_function_identity_arguments(v_oid);
    -- 1) backup dell'originale (se già presente da un giro precedente
    --    interrotto: STOP — prima si risolve col runbook, mai sovrascritto)
    begin
      insert into private.transizione_backup (nome, definizione) values (v_nome, v_def);
    exception when unique_violation then
      raise exception 'FASE_A_STOP: backup già presente per % — transizione precedente non conclusa, usare il runbook', v_nome;
    end;
    -- 2) copia VERBATIM in private: si riscrive SOLO l'intestazione
    if position('FUNCTION public.' || v_nome in v_def) = 0 then
      raise exception 'FASE_A_STOP: intestazione inattesa in pg_get_functiondef(%)', v_nome;
    end if;
    v_def_privata := overlay(v_def
      placing 'FUNCTION private.' || v_nome
      from position('FUNCTION public.' || v_nome in v_def)
      for length('FUNCTION public.' || v_nome));
    execute v_def_privata;
    -- 3) permessi ESPLICITI sulla copia privata: nessun percorso alternativo
    execute format('revoke all on function private.%I(%s) from public, anon, authenticated, service_role', v_nome, v_firma);
    -- 4) il nome pubblico diventa un PURO RESPINGENTE (stessa firma e
    --    stesso tipo di ritorno: i client vecchi ricevono l'errore, non
    --    un cambiamento di interfaccia)
    execute format(
      'create or replace function public.%I(%s) returns %s language plpgsql security definer set search_path = '''' as %L',
      v_nome, pg_get_function_arguments(v_oid), pg_get_function_result(v_oid),
      'begin raise exception ''PERCORSO_DISMESSO: usare il contratto di revisione'' using errcode = ''P0001''; end');
  end loop;
end $$;

commit;

-- ============================================================================
-- ROLLBACK del runbook (SOLO se la fase B non riuscisse e si decidesse
-- di tornare indietro; da eseguire come statement separati):
--   do $$
--   declare r record;
--   begin
--     for r in select nome, definizione from private.transizione_backup loop
--       execute r.definizione;                       -- ripristina public.*
--     end loop;
--   end $$;
--   -- poi eliminare le copie private e il backup:
--   -- drop function private.conferma_documento(...); … (firme esatte)
--   -- drop table private.transizione_backup;
-- ============================================================================
