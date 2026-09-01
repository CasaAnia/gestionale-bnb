#!/usr/bin/env node
// ============================================================================
// AUDIT PRE-0023 in PRODUZIONE — SOLA LETTURA di metadati e conteggi.
// Complementare all'audit generale (scripts/fase4/audit-produzione.mjs,
// da eseguire PRIMA nello stesso giro): qui i controlli SPECIFICI della
// 0023. Ogni batch in transazione READ ONLY chiusa da rollback.
//  1. bersaglio ESPLICITO: la produzione, verificata via Management API
//     (token dedicato in ~/.gestionale-0023/token.txt);
//  2. la funzione elabora_sostituisci_bozze è ASSENTE;
//  3. la bozza nel repository è ANCORA quella collaudata (sha vincolato)
//     e conforme ai vincoli R6 (stesso giudizio del collaudo);
//  4. fotografia dei conteggi (documenti per stato, bozze, righe) salvata
//     nel rapporto locale: servirà al confronto post-applicazione.
// Richiede: CONFERMA_PRODUZIONE=sola-lettura e RAPPORTO_AUDIT (file di
// destinazione, fuori repo).
// ============================================================================
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { refProduzione, maschera } from '../fase2b/guardia.mjs'
import { FIRMA_0023, FUNZIONE_0023, problemiBozza } from '../collaudo-bozze/strumenti0023.mjs'
import { BOZZA_0023, SHA_BOZZA_COLLAUDATA } from './identita0023.mjs'

if (process.env.CONFERMA_PRODUZIONE !== 'sola-lettura') {
  console.error('STOP: manca CONFERMA_PRODUZIONE=sola-lettura (guardia contro le esecuzioni accidentali).')
  process.exit(1)
}
const RAPPORTO = process.env.RAPPORTO_AUDIT
if (!RAPPORTO) { console.error('STOP: RAPPORTO_AUDIT mancante (file di destinazione, fuori repo).'); process.exit(1) }

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
let token
try { token = readFileSync(join(homedir(), '.gestionale-0023', 'token.txt'), 'utf8').trim() } catch {
  console.error('ACCESSO ASSENTE: serve il token dedicato in ~/.gestionale-0023/token.txt — fermarsi e chiederlo.')
  process.exit(3)
}

// ---- identità della bozza: DEVE essere quella collaudata -------------------
const testoBozza = readFileSync(join(REPO, BOZZA_0023), 'utf8')
const sha = createHash('sha256').update(testoBozza).digest('hex')
if (sha !== SHA_BOZZA_COLLAUDATA) {
  console.error(`STOP: la bozza 0023 NON è quella collaudata (sha ${sha.slice(0, 12)}… ≠ atteso).`)
  process.exit(1)
}
const staticamente = problemiBozza(testoBozza)
if (staticamente.length) {
  console.error('STOP: bozza non conforme ai vincoli R6:', staticamente.join('; '))
  process.exit(1)
}
console.log('bozza 0023: identità confermata (sha collaudato) e vincoli R6 rispettati')

// ---- bersaglio ESPLICITO: la produzione, mai il progetto di prova ---------
const PROD = refProduzione()
const progetti = await (await fetch('https://api.supabase.com/v1/projects', {
  headers: { Authorization: 'Bearer ' + token },
})).json()
if (!Array.isArray(progetti)) { console.error('Management API non raggiungibile (token non valido?)'); process.exit(1) }
const prod = progetti.find(p => p.id === PROD)
if (!prod) { console.error('STOP: il progetto di produzione non risulta tra quelli del token.'); process.exit(1) }
if (prod.name === 'gestionale-bnb-spese-test-2b-20260828') {
  console.error('STOP: il ref di produzione coincide col progetto di PROVA.'); process.exit(1)
}
console.log(`Bersaglio ESPLICITO: PRODUZIONE ${maschera(PROD)} («${prod.name}», ${prod.status}) — SOLA LETTURA`)

async function sqlReadOnly(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROD}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `begin transaction read only;\n${query};\nrollback;` }),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`SQL fallito (${r.status}): ${testo.slice(0, 300)}`)
  try { return JSON.parse(testo) } catch { return [] }
}

// ---- 0023 assente + fotografia dei conteggi -------------------------------
const [assenza] = await sqlReadOnly(`select count(*)::int as n from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname='${FUNZIONE_0023}'`)
if (assenza.n !== 0) {
  console.error(`STOP: ${FUNZIONE_0023} risulta GIÀ presente in produzione (${assenza.n}): da capire prima di proseguire.`)
  process.exit(1)
}
console.log(`✓ ${FUNZIONE_0023}(${FIRMA_0023}) ASSENTE in produzione (attesa)`)

const perStato = await sqlReadOnly(`select status, count(*)::int as n
  from public.family_documents group by status order by status`)
const [conteggi] = await sqlReadOnly(`select
  (select count(*)::int from public.family_documents) as documenti,
  (select count(*)::int from public.family_draft_expenses) as bozze,
  (select count(*)::int from public.family_draft_items) as righe_bozza,
  (select count(*)::int from public.family_expenses) as spese,
  (select count(*)::int from public.family_expense_items) as righe_spesa`)
console.log('documenti per stato:', JSON.stringify(perStato))
console.log('conteggi:', JSON.stringify(conteggi))

writeFileSync(RAPPORTO, JSON.stringify({
  generato_il: new Date().toISOString(),
  scopo: 'audit PRE-0023 (sola lettura)',
  produzione_mascherata: maschera(PROD),
  bozza_sha256: sha,
  funzione_assente: true,
  documenti_per_stato: perStato,
  conteggi,
}, null, 2))
console.log('\nAUDIT PRE-0023 CONCLUSO (sola lettura). Rapporto:', RAPPORTO)
