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
  -- nomi e TIPI attesi (0020): un sovraccarico in più o tipi diversi
  -- sono STOP, mai «la prima che capita». Il confronto è sui SOLI TIPI
  -- dal catalogo (oidvectortypes): la 0020 dichiara argomenti NOMINATI
  -- (p_document_id uuid, …) e la firma nominata — conservata a parte in
  -- v_firma — serve solo a generare il DDL (revoke/drop), mai al
  -- confronto.
  v_attesi constant jsonb := jsonb_build_object(
    'conferma_documento',        'uuid, jsonb',
    'scarta_documento',          'uuid, text',
    'approva_fattura_da_pagare', 'uuid, jsonb',
    'paga_fattura',              'uuid, date, text, jsonb',
    'conferma_fattura_pagata',   'uuid, date, text, jsonb'
  );
  v_nome text; v_oid oid; v_def text; v_def_privata text; v_firma text;
  v_tipi text; v_conta int;
begin
  for v_nome in select jsonb_object_keys(v_attesi) order by 1 loop
    -- ESATTAMENTE una funzione con quel nome in public (guardia)
    select count(*) into v_conta
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_nome;
    if v_conta <> 1 then
      raise exception 'FASE_A_STOP: attesa ESATTAMENTE una public.%, trovate %', v_nome, v_conta;
    end if;
    select p.oid, pg_get_function_identity_arguments(p.oid), oidvectortypes(p.proargtypes)
      into v_oid, v_firma, v_tipi
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_nome;
    -- TIPI attesi dal catalogo, non solo il nome
    if v_tipi is distinct from (v_attesi ->> v_nome) then
      raise exception 'FASE_A_STOP: tipi inattesi per public.% — attesi (%), trovati (%)',
        v_nome, v_attesi ->> v_nome, v_tipi;
    end if;
    v_def := pg_get_functiondef(v_oid);
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
