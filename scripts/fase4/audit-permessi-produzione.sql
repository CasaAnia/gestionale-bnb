-- ============================================================================
-- AUDIT DEI PERMESSI IN PRODUZIONE — ***NON ESEGUITO: richiede
-- un'autorizzazione SEPARATA.*** Sola LETTURA di metadati (nessuna tabella
-- dati, nessuna modifica). Non riapplicare automaticamente la 0021 e non
-- applicare la 0022 in base a questo audit: prima si leggono i risultati,
-- poi si decide insieme.
--
-- CONTESTO: il collaudo sul progetto di prova ha mostrato che rieseguire la
-- 0020 DOPO la 0021 riapre i grant di tabella (blocco righe 305–313 della
-- 0020) — è successo lì per colpa della sequenza di test (test-rpc riesegue
-- la 0020 per la prova multipagina). In PRODUZIONE la 2C-B ha applicato
-- 0020 → bootstrap → 0021 in quest'ordine e la 0020 non risulta mai
-- rieseguita dopo: l'atteso è quindi lo stato RISTRETTO. Questo audit lo
-- VERIFICA invece di presumerlo.
-- ============================================================================

-- 1. Grant di TABELLA per authenticated/anon/service_role sulle tabelle
--    ristrette dal §4-bis della 0021.
--    ATTESO: authenticated SENZA INSERT/UPDATE/DELETE di tabella su
--    family_documents, family_draft_expenses, family_draft_items;
--    NESSUN privilegio su family_expense_documents e family_corrections
--    (sola lettura via SELECT); anon: niente.
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privilegi
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('family_documents', 'family_draft_expenses',
                     'family_draft_items', 'family_expense_documents',
                     'family_corrections', 'app_members')
  and grantee in ('authenticated', 'anon', 'service_role')
group by table_name, grantee
order by table_name, grantee;

-- 2. Grant per COLONNA (update e insert) di authenticated sulle stesse
--    tabelle. ATTESO per family_documents (update): kind, doc_total,
--    supplier, invoice_number, document_date, due_date, note — e NIENTE
--    altro (in particolare NIENTE status, error_message, upload_*).
select table_name, privilege_type,
       string_agg(column_name, ',' order by column_name) as colonne
from information_schema.column_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('family_documents', 'family_draft_expenses', 'family_draft_items')
group by table_name, privilege_type
order by table_name, privilege_type;

-- 3. ACL grezza con grantor (per distinguere un GRANT ALL "da creazione"
--    da quelli espliciti della 0021: TRUNCATE/REFERENCES/TRIGGER presenti
--    per authenticated = impronta del default di piattaforma).
select c.relname, a.grantor::regrole::text as grantor,
       a.grantee::regrole::text as grantee, a.privilege_type
from pg_class c, aclexplode(c.relacl) a
where c.relname in ('family_documents', 'family_draft_expenses',
                    'family_draft_items', 'family_expense_documents',
                    'family_corrections')
  and a.grantee::regrole::text in ('authenticated', 'anon')
order by c.relname, a.grantee::regrole::text, a.privilege_type;

-- 4. Policy: ATTESO 16 policy *_solo_membri e ZERO policy vecchie.
select
  (select count(*) from pg_policies where schemaname = 'public'
     and policyname like '%_solo_membri') as policy_nuove,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename like 'family_%'
     and policyname not like '%_solo_membri') as policy_vecchie;

-- 5. Privilegi di esecuzione delle 5 RPC della 0020 (contratto 2B.1):
--    ATTESO authenticated = true, anon/service_role = false.
select proname,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
  has_function_privilege('anon', p.oid, 'execute') as anon,
  has_function_privilege('service_role', p.oid, 'execute') as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('conferma_documento', 'approva_fattura_da_pagare',
                    'paga_fattura', 'conferma_fattura_pagata', 'scarta_documento')
order by proname;

-- 6. Presenza della 0022 (ATTESO in produzione: ASSENTE finché non
--    autorizzata): colonne, RPC, trigger, indice.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'family_documents'
       and column_name in ('upload_token', 'upload_manifest')) as colonne_0022,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'registra_documento_caricato') as rpc_0022,
  (select count(*) from pg_trigger
     where tgname = 'family_documents_manifesto_immutabile') as trigger_0022;
