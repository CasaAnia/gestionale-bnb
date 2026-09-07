#!/usr/bin/env node
// ============================================================================
// RIPRISTINO DI UN BACKUP LOCALE IN UN DATABASE ISOLATO (revisione del
// 07/09/2026): rimette le righe del file JSON dentro le tabelle di un
// database PostgreSQL che ha GIÀ lo schema (migrazioni applicate, per esempio
// con scripts/collaudo-0033/applica-migrazioni.mjs). Serve a dimostrare cosa
// il JSON permette di recuperare: le RIGHE dello schema public. Non ricrea
// schema, funzioni, policy, utenti auth né file dello Storage.
//
// Per prudenza scrive SOLO con --conferma e SOLO su un database il cui nome
// contiene «collaudo» (o con --anche-fuori-collaudo, esplicito). Tutto in una
// transazione: se una tabella non entra, non resta niente a metà. I trigger
// e i vincoli fra tabelle sono sospesi durante l'inserimento
// (session_replication_role = replica, serve un superutente locale), così
// l'ordine delle tabelle non conta e la cronologia non si riscrive.
//
// Uso:
//   DATABASE_URL=postgres://postgres@127.0.0.1:5433/collaudo_ripristino node scripts/backup-ripristino.mjs <file.json> --conferma [--svuota]
//   --svuota: prima svuota le tabelle presenti nel file (altrimenti le righe si aggiungono: chiavi doppie = errore)
// ============================================================================
import { readFileSync } from 'node:fs'
import { verificaEsportazione } from './backup-comune.mjs'


export async function ripristina(client, doc, { svuota: svuotaTabelle = false, log = () => {} } = {}) {
  const q = nome => `public."${nome.replace(/"/g, '""')}"`
  const esistenti = new Set((await client.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`)).rows.map(r => r.table_name))
  const saltate = Object.keys(doc.tabelle).filter(n => !esistenti.has(n))
  const inserite = {}
  await client.query('begin')
  try {
    await client.query(`set local session_replication_role = 'replica'`)
    for (const [nome, t] of Object.entries(doc.tabelle)) {
      if (!esistenti.has(nome)) continue
      if (svuotaTabelle) await client.query(`delete from ${q(nome)}`)
      if (t.dati.length === 0) { inserite[nome] = 0; continue }
      // Le colonne che il database non ha più (o non ha ancora) si scartano dicendolo
      const colonne = (await client.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`, [nome])).rows.map(r => r.column_name)
      const sconosciute = [...new Set(t.dati.flatMap(r => Object.keys(r)))].filter(c => !colonne.includes(c))
      if (sconosciute.length) log(`  ${nome}: colonne del file assenti nel database, scartate: ${sconosciute.join(', ')}`)
      const righe = t.dati.map(r => Object.fromEntries(Object.entries(r).filter(([c]) => colonne.includes(c))))
      const r = await client.query(`insert into ${q(nome)} select * from json_populate_recordset(null::${q(nome)}, $1::json)`, [JSON.stringify(righe)])
      inserite[nome] = r.rowCount
      log(`  ${nome}: ${r.rowCount} righe`)
    }
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  }
  return { inserite, saltate }
}

async function main() {
  const argv = process.argv.slice(2)
  const file = argv.find(a => !a.startsWith('--'))
  const conferma = argv.includes('--conferma')
  const svuota = argv.includes('--svuota')
  const fuoriCollaudo = argv.includes('--anche-fuori-collaudo')
  if (!file) { console.error('Uso: backup-ripristino.mjs <file.json> --conferma [--svuota] [--anche-fuori-collaudo]'); process.exit(2) }
  const urlDb = process.env.DATABASE_URL || ''
  if (!urlDb) throw new Error('manca DATABASE_URL nell’ambiente')
  const nomeDb = (() => { try { return new URL(urlDb).pathname.slice(1) } catch { return '' } })()
  if (!conferma) throw new Error('senza --conferma non scrivo niente')
  if (!/collaudo/i.test(nomeDb) && !fuoriCollaudo) throw new Error(`il database «${nomeDb}» non è di collaudo: serve --anche-fuori-collaudo (e sapere cosa si fa)`)
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  const esito = verificaEsportazione(doc)
  if (!esito.ok) throw new Error(`il file non passa la verifica (integrità/completezza): ${[...esito.integrita, ...esito.completezza].join('; ')}`)
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: urlDb })
  await client.connect()
  try {
    const { inserite, saltate } = await ripristina(client, doc, { svuota, log: m => console.error(m) })
    const totale = Object.values(inserite).reduce((s, n) => s + n, 0)
    console.error(`Ripristinate ${Object.keys(inserite).length} tabelle, ${totale} righe, in ${nomeDb}${saltate.length ? `; tabelle del file assenti nel database, saltate: ${saltate.join(', ')}` : ''}`)
    console.log('OK — ripristino eseguito (righe dello schema public; schema, funzioni, policy, auth e Storage NON compresi)')
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(e => { console.error(`Ripristino non riuscito: ${e.message}`); process.exit(1) })
}
