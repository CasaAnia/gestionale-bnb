#!/usr/bin/env node
// ORCHESTRATORE Fase 2B: l'intera sequenza dall'azzeramento ai test, in
// ordine, stop al primo errore. Da rilanciare per intero dopo OGNI
// correzione (regola della 2B: niente fix manuali solo nel db di prova).
import { execFileSync } from 'node:child_process'
const passo = (nome, cmd, args = []) => {
  console.log('\n════════ ' + nome + ' ════════')
  execFileSync(cmd, args, { stdio: 'inherit' })
}
passo('0. azzeramento progetto di prova', 'node', ['scripts/fase2b/azzera-prova.mjs'])
passo('1. migrazioni storiche 0001–0019', 'node', ['scripts/fase2b/applica-migrazioni.mjs'])
passo('2a. fixture: controllo pre-upload', 'node', ['scripts/fase2b/controlla-fixture.mjs'])
passo('2b. fixture: caricamento', 'node', ['--input-type=module', '-e', `
import { readFileSync } from 'node:fs'
import { sql } from './scripts/fase2b/api.mjs'
await sql(readFileSync(process.env.HOME + '/.gestionale-2b/fixture/carica-fixture.sql', 'utf8'))
console.log('fixture caricata')`])
passo('3. utente owner fittizio', 'node', ['scripts/fase2b/utenti-e-export.mjs', 'crea-utente', 'owner@prova2b.locale'])
passo('4a. export baseline', 'node', ['scripts/fase2b/utenti-e-export.mjs', 'esporta', 'baseline'])
passo('4b. verifica baseline (manifest sintetico)', 'node', ['scripts/verifica-spese.mjs',
  process.env.HOME + '/.gestionale-2b/export-baseline', '--manifest', process.env.HOME + '/.gestionale-2b/fixture/manifest.json'])
passo('4c. confronto fixture ↔ baseline', 'node', ['scripts/verifica-spese.mjs', '--confronta',
  process.env.HOME + '/.gestionale-2b/fixture', process.env.HOME + '/.gestionale-2b/export-baseline'])
passo('5. 0020 → bootstrap → 0021(no bucket=KO) → bucket → 0021 ×2 → file', 'node', ['scripts/fase2b/applica-nuove.mjs'])
passo('6a. export post-0020', 'node', ['scripts/fase2b/utenti-e-export.mjs', 'esporta', 'post0020'])
passo('6b. storico invariato campo per campo', 'node', ['scripts/verifica-spese.mjs', '--confronta',
  process.env.HOME + '/.gestionale-2b/export-baseline', process.env.HOME + '/.gestionale-2b/export-post0020', '--campi-del-riferimento'])
passo('7. secondo utente + login', 'node', ['scripts/fase2b/utenti-e-export.mjs', 'crea-utente', 'estraneo@prova2b.locale'])
passo('7b. login owner', 'node', ['scripts/fase2b/utenti-e-export.mjs', 'accedi', 'owner@prova2b.locale'])
passo('7c. login estraneo', 'node', ['scripts/fase2b/utenti-e-export.mjs', 'accedi', 'estraneo@prova2b.locale'])
// ============================================================================
// PASSI 8–11 (corretti dopo il collaudo 0022, 30/08/2026): il passo 9
// RIESEGUE la 0020 per la prova multipagina, e la 0020 riconcede il CRUD
// di TABELLA su family_documents/draft/ponte/correzioni — riaprendo i
// permessi che la 0021 aveva ristretto per colonna. La sequenza quindi
// TERMINA SEMPRE (anche su test falliti) ripristinando la 0021 e
// RIVERIFICANDO la sicurezza DOPO l'ultima migrazione rieseguita.
// Le migrazioni non vengono toccate; nessun azzeramento in più.
// ============================================================================
let erroreTest = null
try {
  passo('8. test sicurezza (Auth/RLS/Storage)', 'node', ['scripts/fase2b/test-sicurezza.mjs'])
  passo('9. test integrità e RPC', 'node', ['scripts/fase2b/test-rpc.mjs'])
} catch (e) {
  erroreTest = e
  console.error('\n! test falliti: il ripristino delle protezioni parte COMUNQUE')
}
try {
  passo('10. ripristino 0021 (il passo 9 ha rieseguito la 0020, che riapre i grant di tabella)',
    'node', ['--input-type=module', '-e', `
import { readFileSync } from 'node:fs'
import { sql } from './scripts/fase2b/api.mjs'
await sql(readFileSync('supabase/migrations/0021_protezione_family.sql', 'utf8'))
const g = await sql("select count(*) as n from information_schema.table_privileges where grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE') and table_name in ('family_documents','family_draft_expenses','family_draft_items','family_expense_documents','family_corrections')")
if (g[0].n !== 0) { console.error('grant di tabella ANCORA aperti dopo la 0021:', g[0].n); process.exit(1) }
console.log('protezioni 0021 ripristinate: nessun grant di tabella INSERT/UPDATE/DELETE residuo sulle tabelle ristrette')`])
  passo('11. verifica di sicurezza FINALE (lo stato in cui il progetto viene consegnato)',
    'node', ['scripts/fase2b/test-sicurezza.mjs'])
} catch (e) {
  console.error('\n════════ RIPRISTINO O VERIFICA FINALE FALLITI: il progetto di prova NON è in uno stato protetto verificato ════════')
  process.exit(1)
}
if (erroreTest) {
  console.error('\n════════ SEQUENZA FALLITA nei passi 8–9 (protezioni comunque ripristinate e riverificate) ════════')
  process.exit(1)
}
console.log('\n════════ SEQUENZA 2B COMPLETATA DALL\'INIZIO ALLA FINE (protezioni verificate in coda) ════════')
