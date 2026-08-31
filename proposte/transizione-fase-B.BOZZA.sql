-- ============================================================================
-- BOZZA (NON APPLICARE) — TRANSIZIONE, FASE B: si dimostra la
-- CONCLUSIONE di ciò che era entrato prima della fase A, poi si chiude
-- la porta. Riferimento: PROPOSTA-RECUPERO-REVISIONE.md §5.
-- Stato: DA COLLAUDARE in ambiente isolato con autorizzazione separata.
--
-- La fase B è GUIDATA DA UNO SCRIPT (scripts/collaudo-contratto/
-- passo6-transizione.mjs per il collaudo; il runner di produzione avrà
-- la sua autorizzazione): la CONDIZIONE DI COMPLETAMENTO è un poll
-- FUORI transazione, la parte transazionale è il blocco più sotto.
--
-- (B.0) subito DOPO il commit della fase A, lo script registra:
--         t_A  = now() del server (select now())
--         xid_A = pg_current_xact_id_if_assigned()/pg_current_xact_id()
-- (B.1) CONDIZIONE DI COMPLETAMENTO (poll dello script, con timeout e
--       STOP): entrambe le query devono dare zero/vero —
--   select count(*) as pregresse from pg_stat_activity
--     where pid <> pg_backend_pid()
--       and xact_start is not null and xact_start < $T_A$;
--   select pg_snapshot_xmin(pg_current_snapshot())::text::bigint
--            > $XID_A$ as orizzonte_superato;
--       Ogni invocazione legacy vive in una transazione aperta PRIMA di
--       entrare nella funzione: anche sospesa in is_app_member() o
--       prima del primo accesso alle tabelle viene CONTATA finché non
--       conclude. Timeout scaduto → STOP: nulla è cambiato (la fase A
--       resta), si riprova più tardi.
-- (B.2) SOLO a condizione soddisfatta, la TRANSAZIONE qui sotto.
-- ============================================================================

begin;

-- timeout con STOP: mai attese indefinite, mai stati a metà
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- BARRIERA (difesa in profondità contro le scritture dirette residue):
-- con la condizione B.1 già soddisfatta si acquisisce subito
lock table public.family_documents,
           public.family_draft_expenses,
           public.family_draft_items in access exclusive mode;

-- CHIUSURA della porta alle scritture dirette (statement NUOVI: le
-- migrazioni storiche non si toccano)
revoke update, insert on public.family_draft_expenses from authenticated;
revoke update, insert on public.family_draft_items from authenticated;
revoke update on public.family_documents from authenticated;

-- niente EXECUTE diretto sui cinque nomi legacy (già respingenti dalla
-- fase A: doppia porta) — firme esatte da confermare sul progetto
-- bersaglio prima dell'esecuzione (passo6 le legge da pg_proc)
revoke execute on function public.conferma_documento(uuid, jsonb) from authenticated;
revoke execute on function public.scarta_documento(uuid, text) from authenticated;
revoke execute on function public.approva_fattura_da_pagare(uuid) from authenticated;
revoke execute on function public.paga_fattura(uuid, text, date) from authenticated;
revoke execute on function public.conferma_fattura_pagata(uuid) from authenticated;

-- RIPUNTAMENTO degli involucri del contratto alle copie private (la
-- bozza del contratto, applicata prima, chiamava ancora i nomi pubblici;
-- da qui in poi i pubblici sono respingenti):
--   create or replace function public.conferma_revisione(...)  → chiama
--     private.conferma_documento(...)
--   create or replace function public.scarta_revisione(...)    → chiama
--     private.scarta_documento(...)
-- (i due CREATE OR REPLACE completi, identici alla bozza del contratto
-- salvo la riga della chiamata, vengono generati dal runner leggendo la
-- bozza — un'unica fonte, niente copie divergenti.)

commit;

-- (B.3) VERIFICHE POST-COMMIT dello script (tutte, con STOP al primo
--       scostamento): scritture dirette respinte per authenticated
--       (update bozze/righe/documenti, insert bozze/righe); i cinque
--       nomi legacy → P0001 PERCORSO_DISMESSO; chiamata diretta a
--       private.* → permesso negato; flusso 0022 intatto; RPC del
--       contratto funzionanti (giro completo su un documento di prova).
-- ============================================================================
