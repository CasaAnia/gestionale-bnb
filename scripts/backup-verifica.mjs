#!/usr/bin/env node
// ============================================================================
// VERIFICA DI UN BACKUP LOCALE (07/09/2026, pezzo 3): rilegge il file JSON
// scritto da backup-locale.mjs e controlla che sia integro — struttura,
// conteggi per tabella, impronta SHA-256 del contenuto. Con --confronta
// ricalcola i conteggi dalla stessa sorgente e segnala le differenze (utile
// subito dopo l'esportazione). Non scrive mai nulla sul database.
//
// Uso:
//   node scripts/backup-verifica.mjs backup/gestionale-backup-2026-09-07-1432.json
//   DATABASE_URL=… node scripts/backup-verifica.mjs <file> --confronta --postgres
//   SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-verifica.mjs <file> --confronta
// Esce con 0 se tutto torna, con 1 se c'è anche un solo problema.
// ============================================================================
import { readFileSync } from 'node:fs'
import { verificaEsportazione, confrontaConteggi } from './backup-comune.mjs'

const argv = process.argv.slice(2)
const file = argv.find(a => !a.startsWith('--'))
const confronta = argv.includes('--confronta')
const usaPostgres = argv.includes('--postgres')
if (!file) { console.error('Uso: backup-verifica.mjs <file.json> [--confronta] [--postgres]'); process.exit(2) }

async function conteggiPostgrest(nomi) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !chiave) throw new Error('per --confronta servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nell’ambiente')
  const out = {}
  for (const nome of nomi) {
    const r = await fetch(`${url}/rest/v1/${nome}?select=id`, { method: 'HEAD', headers: { apikey: chiave, Authorization: `Bearer ${chiave}`, Prefer: 'count=exact' } })
    if (!r.ok) throw new Error(`HTTP ${r.status} su ${nome}`)
    const range = r.headers.get('content-range') || ''
    out[nome] = Number(range.split('/')[1] ?? 0)
  }
  return out
}

async function conteggiPostgres() {
  const urlDb = process.env.DATABASE_URL || ''
  if (!urlDb) throw new Error('per --confronta --postgres serve DATABASE_URL nell’ambiente')
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: urlDb })
  await client.connect()
  try {
    const { rows } = await client.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)
    const out = {}
    for (const { table_name: nome } of rows) {
      const r = await client.query(`select count(*)::int as n from public."${nome.replace(/"/g, '""')}"`)
      out[nome] = r.rows[0].n
    }
    return out
  } finally {
    await client.end()
  }
}

async function main() {
  let doc
  try { doc = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { throw new Error(`non riesco a leggere il file: ${e.message}`) }
  const esito = verificaEsportazione(doc)
  for (const p of esito.problemi) console.error(`PROBLEMA — ${p}`)
  if (esito.riepilogo) {
    const totale = Object.values(esito.riepilogo).reduce((s, n) => s + n, 0)
    console.error(`File del ${doc.creato_il} da ${doc.origine} (${doc.sorgente}): ${Object.keys(esito.riepilogo).length} tabelle, ${totale} righe`)
    for (const [nome, n] of Object.entries(esito.riepilogo)) console.error(`  ${nome}: ${n}`)
  }
  let differenze = []
  if (confronta && esito.riepilogo) {
    const vivi = usaPostgres ? await conteggiPostgres() : await conteggiPostgrest(Object.keys(esito.riepilogo))
    differenze = confrontaConteggi(esito.riepilogo, vivi)
    for (const d of differenze) console.error(`DIFFERENZA — ${d}`)
    if (differenze.length === 0) console.error('Conteggi identici alla sorgente.')
  }
  const ok = esito.ok && differenze.length === 0
  console.log(ok ? 'OK — esportazione integra' : 'NON OK — vedi sopra')
  process.exit(ok ? 0 : 1)
}

main().catch(e => { console.error(`Verifica non riuscita: ${e.message}`); process.exit(1) })
