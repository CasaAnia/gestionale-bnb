#!/usr/bin/env node
// ============================================================================
// BACKUP LOCALE DEL GESTIONALE (07/09/2026, pezzo 3; rivisto per R2/R3):
// esporta TUTTE le tabelle dello schema public in un file JSON datato, da
// tenere fuori dal repository (cartella backup/, ignorata da git).
//
// Sorgenti (scripts/backup-lettura.mjs, stessa lettura della verifica):
//   · Supabase via API (default): SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) +
//     SUPABASE_SERVICE_ROLE_KEY letti SOLO dall'ambiente del processo; la
//     chiave non viene mai stampata, scritta su file né passata ad altri
//     programmi; la RLS viene scavalcata dalla service key, quindi il file
//     contiene tutto (tenerlo al sicuro come il database).
//   · --postgres: DATABASE_URL (collaudo locale su PostgreSQL 16, oppure la
//     stringa diretta di Supabase); la password resta nella variabile.
//
// Ogni tabella si legge con ORDINE STABILE sulla chiave primaria, avanzando
// sulle righe davvero restituite; il file registra per tabella la chiave, le
// righe attese dalla sorgente e le righe lette. Se una tabella non è completa
// (righe ≠ attese, chiave doppia o nulla) l'esportazione si FERMA con errore:
// mai un file «integro» incompleto. Limite dichiarato: le tabelle si leggono
// una dopo l'altra, non in un'unica transazione (vedi docs/backup.md).
//
// Uso:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-locale.mjs [--cartella backup]
//   DATABASE_URL=postgres://postgres@127.0.0.1:5433/collaudo node scripts/backup-locale.mjs --postgres
// Esce con 0 e stampa il percorso del file; altrimenti spiega e esce con 1.
// ============================================================================
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { componiEsportazione, nomeFileBackup, serializzaStabile, contieneSegreto } from './backup-comune.mjs'
import { sorgenteDaAmbiente, controllaCompletezza } from './backup-lettura.mjs'


export async function esporta(sorgente, log = m => process.stderr.write(m + '\n')) {
  const tabelle = {}
  const problemi = []
  for (const t of await sorgente.tabelle()) {
    const { righe, attese } = await sorgente.leggi(t)
    const p = controllaCompletezza(t.nome, righe, attese, t.chiave)
    problemi.push(...p)
    tabelle[t.nome] = { righe, attese, chiave: t.chiave, senzaChiave: t.senzaChiave }
    log(`  ${t.nome}: ${righe.length} righe${attese !== null && attese !== righe.length ? ` (attese ${attese})` : ''}${t.senzaChiave ? ' · senza chiave primaria' : ''}`)
  }
  if (problemi.length > 0) throw new Error(`esportazione INCOMPLETA, file non scritto:\n  ${problemi.join('\n  ')}`)
  return componiEsportazione({ origine: sorgente.tipo, sorgente: sorgente.host, tabelle })
}

async function main() {
  const argv = process.argv.slice(2)
  const usaPostgres = argv.includes('--postgres')
  const iCartella = argv.indexOf('--cartella')
  const cartella = iCartella >= 0 ? argv[iCartella + 1] : 'backup'
  const segreti = [process.env.SUPABASE_SERVICE_ROLE_KEY || '', (() => { try { return decodeURIComponent(new URL(process.env.DATABASE_URL || 'x://x').password) } catch { return '' } })()]
  const sorgente = await sorgenteDaAmbiente(usaPostgres)
  let doc
  try { doc = await esporta(sorgente) } finally { await sorgente.chiudi() }
  const testo = serializzaStabile(doc)
  if (contieneSegreto(testo, segreti)) throw new Error('il file conterrebbe un segreto: esportazione annullata')
  if (!existsSync(cartella)) mkdirSync(cartella, { recursive: true })
  const file = path.join(cartella, nomeFileBackup())
  writeFileSync(file, testo)
  const totale = Object.values(doc.tabelle).reduce((s, t) => s + t.righe, 0)
  process.stderr.write(`Esportate ${Object.keys(doc.tabelle).length} tabelle, ${totale} righe, da ${doc.origine} (${doc.sorgente}); completezza controllata tabella per tabella\n`)
  console.log(file)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(e => { console.error(`Backup non riuscito: ${e.message}`); process.exit(1) })
}
