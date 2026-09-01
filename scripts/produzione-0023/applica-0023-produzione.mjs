#!/usr/bin/env node
// ============================================================================
// APPLICAZIONE DELLA 0023 IN PRODUZIONE — canale DEDICATO (token in
// ~/.gestionale-0023): qui la produzione è il bersaglio ESPLICITO,
// autorizzato e verificato. Come per la 0022:
//  · applica SOLO il file COLLAUDATO (identità SHA-256 vincolata), UNA
//    volta, in UN'UNICA transazione con statement/lock timeout limitati;
//  · VERIFICHE STRUTTURALI PRIMA DEL COMMIT (do-block che solleva
//    eccezione: qualunque fallimento = rollback totale, produzione
//    intatta);
//  · risposta del commit INCERTA → verifica dello stato in SOLA LETTURA,
//    MAI ritentativi alla cieca.
// ROLLBACK dopo il commit (se mai servisse): la 0023 aggiunge SOLO una
// funzione — `drop function public.elabora_sostituisci_bozze(uuid, jsonb,
// text);` riporta la produzione esattamente com'era (nessun dato toccato).
// Richiede: CONFERMA_APPLICAZIONE_0023=si (autorizzazione SEPARATA da
// audit e backup, che devono essere già conclusi e verdi).
// ============================================================================
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { refProduzione, maschera } from '../fase2b/guardia.mjs'
import { valutaRispostaCommit } from '../fase4/rispostaCommit.mjs'
import { FUNZIONE_0023, problemiBozza } from '../collaudo-bozze/strumenti0023.mjs'
import { BOZZA_0023, SHA_BOZZA_COLLAUDATA } from './identita0023.mjs'

if (process.env.CONFERMA_APPLICAZIONE_0023 !== 'si') {
  console.error('STOP: manca CONFERMA_APPLICAZIONE_0023=si (autorizzazione separata, dopo audit e backup verdi).')
  process.exit(1)
}
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const testoSql = readFileSync(join(REPO, BOZZA_0023), 'utf8')
const sha = createHash('sha256').update(testoSql).digest('hex')
if (sha !== SHA_BOZZA_COLLAUDATA) {
  console.error('STOP: il file 0023 NON è quello collaudato (sha diverso). Nuova versione = nuovo collaudo.')
  process.exit(1)
}
const staticamente = problemiBozza(testoSql)
if (staticamente.length) { console.error('STOP: bozza non conforme:', staticamente.join('; ')); process.exit(1) }
console.log('identità del file confermata (collaudata):', sha.slice(0, 12) + '…')

const TOKEN = readFileSync(join(homedir(), '.gestionale-0023', 'token.txt'), 'utf8').trim()
const PROD = refProduzione()
const progetti = await (await fetch('https://api.supabase.com/v1/projects', {
  headers: { Authorization: 'Bearer ' + TOKEN },
})).json()
const prod = Array.isArray(progetti) && progetti.find(p => p.id === PROD)
if (!prod) { console.error('STOP: produzione non trovata col token.'); process.exit(1) }
if (prod.name === 'gestionale-bnb-spese-test-2b-20260828') { console.error('STOP: è il progetto di prova.'); process.exit(1) }
console.log(`bersaglio ESPLICITO: PRODUZIONE ${maschera(PROD)} («${prod.name}», ${prod.status})`)

async function sqlProd(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROD}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`SQL fallito (${r.status}): ${testo.slice(0, 400)}`)
  try { return JSON.parse(testo) } catch { return [] }
}

const FIRMA = `public.${FUNZIONE_0023}(uuid, jsonb, text)`
// UN'UNICA transazione: timeout limitati → 0023 → VERIFICHE → commit
const batch = `begin;
set local statement_timeout = '60s';
set local lock_timeout = '10s';
${testoSql}
-- ============ VERIFICHE STRUTTURALI PRE-COMMIT (fallite = rollback) ========
do $$
begin
  if to_regprocedure('${FIRMA}') is null then
    raise exception 'PRE-COMMIT: funzione assente'; end if;
  if not (select prosecdef from pg_proc where oid = to_regprocedure('${FIRMA}')) then
    raise exception 'PRE-COMMIT: non security definer'; end if;
  if not exists (select 1 from pg_proc where oid = to_regprocedure('${FIRMA}')
      and array_to_string(proconfig, ';') like '%search_path=%') then
    raise exception 'PRE-COMMIT: search_path non fissato'; end if;
  if has_function_privilege('anon', '${FIRMA}', 'execute') then
    raise exception 'PRE-COMMIT: anon può eseguire la RPC'; end if;
  if has_function_privilege('authenticated', '${FIRMA}', 'execute') then
    raise exception 'PRE-COMMIT: authenticated può eseguire la RPC'; end if;
  if not has_function_privilege('service_role', '${FIRMA}', 'execute') then
    raise exception 'PRE-COMMIT: service_role NON può eseguire la RPC'; end if;
end $$;
commit;
select 'APPLICATA' as esito, now() as quando`

let applicata = false
let valutazione = null
try {
  const r = await sqlProd(batch)
  valutazione = valutaRispostaCommit(r)
  console.log('risposta del commit:', valutazione.stato, '—', valutazione.dettaglio.slice(0, 120))
} catch (e) {
  const msg = String(e.message)
  if (/fetch|network|timeout|timed out|abort|econn|socket/i.test(msg)) {
    valutazione = { stato: 'incerta', dettaglio: msg.slice(0, 120) }
  } else {
    console.error('APPLICAZIONE FALLITA (rollback automatico della transazione):', msg.slice(0, 300))
    process.exit(1)
  }
}
if (valutazione.stato === 'applicata') {
  applicata = true
} else {
  console.log('esito INCERTO (', valutazione.dettaglio.slice(0, 80), ') → verifica dello stato in sola lettura…')
  const [z] = await sqlProd(`begin transaction read only;
select (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='${FUNZIONE_0023}') as rpc;
rollback;`)
  if (z?.rpc === 1) { console.log('lo stato dice: APPLICATA (il commit era passato)'); applicata = true }
  else if (z?.rpc === 0) { console.error('lo stato dice: NON applicata. STOP senza ritentare — decidere insieme.'); process.exit(2) }
  else { console.error('anche la verifica di stato è ILLEGGIBILE:', JSON.stringify(z).slice(0, 120), '— STOP, decidere insieme.'); process.exit(2) }
}
if (applicata) {
  console.log('\n0023 APPLICATA IN PRODUZIONE (una transazione, verifiche pre-commit superate).')
  console.log('Prossimo: node scripts/produzione-0023/verifica-post-0023.mjs (sola lettura).')
}
