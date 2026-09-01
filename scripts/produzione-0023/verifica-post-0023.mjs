#!/usr/bin/env node
// ============================================================================
// VERIFICA POST-0023 in PRODUZIONE — SOLA LETTURA. Nessun test di
// scrittura in produzione (metodo §3): la struttura si giudica con la
// STESSA logica testata del collaudo (problemiStruttura), i dati si
// confrontano con la fotografia dell'audit preventivo (conteggi
// INVARIATI: la 0023 non tocca alcun dato).
// Richiede: CONFERMA_PRODUZIONE=sola-lettura e RAPPORTO_AUDIT (il file
// scritto da audit-pre-0023.mjs, per il confronto).
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { refProduzione, maschera } from '../fase2b/guardia.mjs'
import { FUNZIONE_0023, problemiStruttura } from '../collaudo-bozze/strumenti0023.mjs'

if (process.env.CONFERMA_PRODUZIONE !== 'sola-lettura') {
  console.error('STOP: manca CONFERMA_PRODUZIONE=sola-lettura.'); process.exit(1)
}
const RAPPORTO = process.env.RAPPORTO_AUDIT
if (!RAPPORTO) { console.error('STOP: RAPPORTO_AUDIT mancante (il file dell\'audit preventivo).'); process.exit(1) }
const audit = JSON.parse(readFileSync(RAPPORTO, 'utf8'))

const TOKEN = readFileSync(join(homedir(), '.gestionale-0023', 'token.txt'), 'utf8').trim()
const PROD = refProduzione()
console.log(`bersaglio: PRODUZIONE ${maschera(PROD)} · VERIFICA POST in sola lettura`)

async function sqlReadOnly(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROD}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `begin transaction read only;\n${query};\nrollback;` }),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`SQL fallito (${r.status}): ${testo.slice(0, 300)}`)
  try { return JSON.parse(testo) } catch { return [] }
}

let falliti = 0
const esigi = (nome, cond, dettaglio = '') => {
  if (cond) console.log(`  ✓ ${nome}`)
  else { falliti++; console.error(`  ✗ ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`) }
}

// struttura: stesso giudizio testato del collaudo
const funzioni = await sqlReadOnly(`select p.proname as nome,
    oidvectortypes(p.proargtypes) as tipi, p.prosecdef as secdef,
    array_to_string(p.proconfig, ';') as config
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='${FUNZIONE_0023}'`)
const esecuzioni = await sqlReadOnly(`select routine_name, grantee
  from information_schema.routine_privileges
  where privilege_type='EXECUTE' and routine_schema='public'
    and routine_name='${FUNZIONE_0023}'`)
const problemi = problemiStruttura({ funzioni, esecuzioni })
esigi('struttura conforme (firma, secdef, search_path, EXECUTE solo service_role)',
  problemi.length === 0, problemi.join('; '))

// dati INVARIATI rispetto all'audit preventivo (la 0023 non tocca dati)
const perStato = await sqlReadOnly(`select status, count(*)::int as n
  from public.family_documents group by status order by status`)
const [conteggi] = await sqlReadOnly(`select
  (select count(*)::int from public.family_documents) as documenti,
  (select count(*)::int from public.family_draft_expenses) as bozze,
  (select count(*)::int from public.family_draft_items) as righe_bozza,
  (select count(*)::int from public.family_expenses) as spese,
  (select count(*)::int from public.family_expense_items) as righe_spesa`)
esigi('conteggi identici all\'audit preventivo',
  JSON.stringify(conteggi) === JSON.stringify(audit.conteggi),
  `ora ${JSON.stringify(conteggi)} · prima ${JSON.stringify(audit.conteggi)}`)
esigi('documenti per stato identici all\'audit preventivo',
  JSON.stringify(perStato) === JSON.stringify(audit.documenti_per_stato),
  `ora ${JSON.stringify(perStato)}`)

if (falliti) { console.error(`\nVERIFICA POST FALLITA (${falliti}): decidere insieme (rollback = drop della funzione).`); process.exit(1) }
console.log('\nVERIFICA POST-0023 SUPERATA (sola lettura): struttura conforme, dati intatti.')
