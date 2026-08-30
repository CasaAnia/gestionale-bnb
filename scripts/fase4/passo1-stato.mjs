#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 1: fotografia in SOLA LETTURA dello stato
// del progetto di prova (schema e dati della 2B), senza azzerare nulla.
// Verifica anche che la 0022 NON sia già applicata.
// ============================================================================
import { sql, maschera, progetto } from '../fase2b/api.mjs'

console.log('Progetto bersaglio:', maschera(progetto().ref), '(guardia anti-produzione superata)')

const conta = async (t) => (await sql(`select count(*) as n from public.${t}`))[0].n
const righe = {}
for (const t of ['family_expenses', 'family_expense_items', 'family_receipts',
  'family_documents', 'family_expense_documents', 'family_draft_expenses',
  'app_members']) righe[t] = await conta(t)
console.log('Dati presenti (fixture 2B):', JSON.stringify(righe))

const policy = await sql(`select count(*) as n from pg_policies where schemaname='public' and policyname like '%_solo_membri'`)
console.log('Policy _solo_membri:', policy[0].n)

const colonne = await sql(`select column_name from information_schema.columns
  where table_schema='public' and table_name='family_documents'
  and column_name in ('upload_token','upload_manifest')`)
console.log('Colonne 0022 già presenti:', colonne.length ? colonne.map(c => c.column_name).join(', ') : 'NESSUNA (0022 mai applicata qui)')

const rpc = await sql(`select count(*) as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='registra_documento_caricato'`)
console.log('RPC registra_documento_caricato presente:', rpc[0].n > 0 ? 'SÌ' : 'no (attesa: no)')

const bucket = await sql(`select id, public from storage.buckets`)
console.log('Bucket:', JSON.stringify(bucket))
const oggetti = await sql(`select count(*) as n from storage.objects`)
console.log('Oggetti nello storage:', oggetti[0].n)
const owner = await sql(`select count(*) as n from public.app_members where role='owner'`)
console.log('Owner in app_members:', owner[0].n)

// ---------------------------------------------------------------------------
// FOTOGRAFIA AUTOMATICA (per il confronto finale del passo 5): conteggi +
// impronte md5 riga per riga, salvata nella cartella dei registri.
// ---------------------------------------------------------------------------
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { cartellaRegistri, IMPRONTA_INIZIALE, tuttiIRegistri } from './registro.mjs'
import { improntaStato, colonne0022Presenti } from './impronta.mjs'

// mai sovrascrivere la fotografia di un GIRO ANCORA APERTO
const fotoFile = join(cartellaRegistri(), IMPRONTA_INIZIALE)
const aperti = tuttiIRegistri().filter(r => !r.dati.pulito)
if (existsSync(fotoFile) && aperti.length > 0) {
  console.error(`STOP: esiste già una fotografia e ci sono ${aperti.length} registri APERTI: completare la pulizia (passo 5) prima di scattarne una nuova.`)
  process.exit(1)
}
const con0022 = await colonne0022Presenti()
// esclusione delle colonne 0022 SOLO se oggi assenti (fotografia pre-0022)
const iniziale = await improntaStato({ escludi0022: !con0022 })
iniziale._meta = { colonne_0022_presenti: con0022, scattata: new Date().toISOString() }
writeFileSync(fotoFile, JSON.stringify(iniziale, null, 2))
console.log('fotografia iniziale (conteggi + impronte md5 riga per riga, incl. auth.users) salvata:',
  Object.entries(iniziale).filter(([k]) => k !== '_meta').map(([t, v]) => `${t}=${v.n}`).join(' '))
