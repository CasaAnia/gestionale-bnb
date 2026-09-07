#!/usr/bin/env node
// ============================================================================
// BACKUP LOCALE DEL GESTIONALE (07/09/2026, pezzo 3): esporta TUTTE le tabelle
// dello schema public in un file JSON datato, da tenere fuori dal repository
// (cartella backup/, ignorata da git).
//
// Due sorgenti:
//   · Supabase via API (default): SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) +
//     SUPABASE_SERVICE_ROLE_KEY letti SOLO dall'ambiente del processo; la
//     chiave non viene mai stampata, scritta su file né passata ad altri
//     programmi; la RLS viene scavalcata dalla service key, quindi il file
//     contiene tutto (tenerlo al sicuro come il database).
//   · --postgres: DATABASE_URL (collaudo locale su PostgreSQL 16, oppure la
//     stringa diretta di Supabase); la password resta nella variabile.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-locale.mjs [--cartella backup]
//   DATABASE_URL=postgres://postgres@127.0.0.1:5433/collaudo node scripts/backup-locale.mjs --postgres
// Esce con 0 e stampa il percorso del file; altrimenti spiega e esce con 1.
// Non eseguire per prova sulla produzione: provarlo sul PostgreSQL locale.
// ============================================================================
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { componiEsportazione, nomeFileBackup, serializzaStabile, contieneSegreto } from './backup-comune.mjs'

const argv = process.argv.slice(2)
const usaPostgres = argv.includes('--postgres')
const iCartella = argv.indexOf('--cartella')
const cartella = iCartella >= 0 ? argv[iCartella + 1] : 'backup'
const PAGINA = 1000

// Tabelle tecniche di Supabase o del rifacimento che non sono dati del gestionale
const ESCLUSE = new Set(['schema_migrations', 'supabase_migrations'])

async function daPostgrest() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url) throw new Error('manca SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)')
  if (!chiave) throw new Error('manca SUPABASE_SERVICE_ROLE_KEY nell’ambiente: la chiave non si legge da nessun file')
  const testate = { apikey: chiave, Authorization: `Bearer ${chiave}` }
  const chiama = async (percorso, extra = {}) => {
    const r = await fetch(`${url}/rest/v1${percorso}`, { headers: { ...testate, ...extra } })
    if (!r.ok) throw new Error(`HTTP ${r.status} su ${percorso}: ${(await r.text()).slice(0, 200)}`)
    return r.json()
  }
  // Elenco delle tabelle dall'OpenAPI di PostgREST (nomi in definitions)
  const api = await chiama('/')
  const nomi = Object.keys(api.definitions || {}).filter(n => !ESCLUSE.has(n)).sort()
  if (nomi.length === 0) throw new Error('PostgREST non espone nessuna tabella: controlla URL e chiave')
  const tabelle = {}
  for (const nome of nomi) {
    const righe = []
    for (let offset = 0; ; offset += PAGINA) {
      const pagina = await chiama(`/${nome}?select=*&offset=${offset}&limit=${PAGINA}`, { 'Accept-Profile': 'public' })
      righe.push(...pagina)
      if (pagina.length < PAGINA) break
    }
    tabelle[nome] = righe
    process.stderr.write(`  ${nome}: ${righe.length} righe\n`)
  }
  return { origine: 'postgrest', sorgente: new URL(url).host, tabelle, segreti: [chiave] }
}

async function daPostgres() {
  const urlDb = process.env.DATABASE_URL || ''
  if (!urlDb) throw new Error('manca DATABASE_URL nell’ambiente')
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: urlDb })
  await client.connect()
  try {
    const { rows } = await client.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)
    const tabelle = {}
    for (const { table_name: nome } of rows) {
      if (ESCLUSE.has(nome)) continue
      const r = await client.query(`select * from public."${nome.replace(/"/g, '""')}"`)
      tabelle[nome] = r.rows
      process.stderr.write(`  ${nome}: ${r.rows.length} righe\n`)
    }
    let host = 'postgres'
    try { host = new URL(urlDb).host } catch { /* stringa non URL: resta «postgres» */ }
    const password = (() => { try { return decodeURIComponent(new URL(urlDb).password) } catch { return '' } })()
    return { origine: 'postgres', sorgente: host, tabelle, segreti: [password] }
  } finally {
    await client.end()
  }
}

async function main() {
  const { origine, sorgente, tabelle, segreti } = usaPostgres ? await daPostgres() : await daPostgrest()
  const doc = componiEsportazione({ origine, sorgente, tabelle })
  const testo = serializzaStabile(doc)
  if (contieneSegreto(testo, segreti)) throw new Error('il file conterrebbe un segreto: esportazione annullata')
  if (!existsSync(cartella)) mkdirSync(cartella, { recursive: true })
  const file = path.join(cartella, nomeFileBackup())
  writeFileSync(file, testo)
  const totale = Object.values(doc.tabelle).reduce((s, t) => s + t.righe, 0)
  process.stderr.write(`Esportate ${Object.keys(doc.tabelle).length} tabelle, ${totale} righe, da ${origine} (${sorgente})\n`)
  console.log(file)
}

main().catch(e => { console.error(`Backup non riuscito: ${e.message}`); process.exit(1) })
