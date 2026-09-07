#!/usr/bin/env node
// ============================================================================
// VERIFICA DI UN BACKUP LOCALE (07/09/2026, pezzo 3; rivista per R2/R3).
// Tre livelli DISTINTI, stampati con la loro etichetta:
//   INTEGRITÀ DEL FILE   — struttura, versione, data, conteggi coerenti,
//                          impronta SHA-256: il file è quello scritto.
//   COMPLETEZZA          — per tabella righe lette = attese dalla sorgente al
//                          momento dell'esportazione, chiave primaria presente
//                          e senza doppioni (registrate nel file).
//   CONFRONTO COL DATABASE (--confronta [contenuti]) — conteggi letti ADESSO
//                          dalla stessa sorgente (nessuna colonna «id»
//                          presunta); con «contenuti» rilegge ogni tabella con
//                          lo stesso lettore e confronta riga per riga sulla
//                          chiave primaria (mancanti, in più, diverse).
// Non scrive mai nulla sul database.
//
// Uso:
//   node scripts/backup-verifica.mjs backup/<file>.json
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-verifica.mjs <file> --confronta [contenuti]
//   DATABASE_URL=… node scripts/backup-verifica.mjs <file> --confronta contenuti --postgres
// Esce con 0 se tutto torna, con 1 se c'è anche un solo problema.
// ============================================================================
import { readFileSync } from 'node:fs'
import { verificaEsportazione, confrontaConteggi } from './backup-comune.mjs'
import { sorgenteDaAmbiente, confrontaRighe } from './backup-lettura.mjs'


export async function confrontaConSorgente(doc, riepilogo, sorgente, conContenuti) {
  const tabelle = await sorgente.tabelle()
  const vivi = {}
  for (const t of tabelle) vivi[t.nome] = await sorgente.conta(t.nome)
  const differenze = confrontaConteggi(riepilogo, vivi)
  if (conContenuti) {
    for (const t of tabelle) {
      const nelFile = doc.tabelle[t.nome]
      if (!nelFile) continue
      const { righe } = await sorgente.leggi(t)
      differenze.push(...confrontaRighe(t.nome, t.chiave, nelFile.dati, righe, t.tipi))   // tipi della tabella viva: confronto per tipo reale
    }
  }
  return differenze
}

async function main() {
  const argv = process.argv.slice(2)
  const file = argv.find(a => !a.startsWith('--') && a !== 'contenuti')
  const iConfronta = argv.indexOf('--confronta')
  const confronta = iConfronta >= 0
  const contenuti = confronta && argv[iConfronta + 1] === 'contenuti'
  const usaPostgres = argv.includes('--postgres')
  if (!file) { console.error('Uso: backup-verifica.mjs <file.json> [--confronta [contenuti]] [--postgres]'); process.exit(2) }
  let doc
  try { doc = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { throw new Error(`non riesco a leggere il file: ${e.message}`) }
  const esito = verificaEsportazione(doc)
  const stampa = (titolo, voci, okTesto) => {
    console.error(`${titolo}: ${voci.length === 0 ? okTesto : 'NON OK'}`)
    for (const v of voci) console.error(`  PROBLEMA — ${v}`)
  }
  stampa('INTEGRITÀ DEL FILE', esito.integrita, 'OK (struttura e impronta)')
  stampa('COMPLETEZZA DELL’ESPORTAZIONE', esito.completezza, 'OK (righe = attese, chiavi senza doppioni)')
  if (esito.riepilogo) {
    const totale = Object.values(esito.riepilogo).reduce((s, t) => s + t.righe, 0)
    console.error(`File del ${doc.creato_il} da ${doc.origine} (${doc.sorgente}): ${Object.keys(esito.riepilogo).length} tabelle, ${totale} righe`)
    for (const [nome, t] of Object.entries(esito.riepilogo)) console.error(`  ${nome}: ${t.righe}${t.attese !== null && t.attese !== t.righe ? ` (attese ${t.attese})` : ''}${t.chiave.length ? '' : ' · senza chiave'}`)
  }
  let differenze = []
  if (confronta && esito.riepilogo) {
    const sorgente = await sorgenteDaAmbiente(usaPostgres)
    try { differenze = await confrontaConSorgente(doc, esito.riepilogo, sorgente, contenuti) } finally { await sorgente.chiudi() }
    console.error(`CONFRONTO COL DATABASE (${contenuti ? 'conteggi e contenuti' : 'solo conteggi'}, letti adesso): ${differenze.length === 0 ? 'OK' : 'NON OK'}`)
    for (const d of differenze) console.error(`  DIFFERENZA — ${d}`)
  } else {
    console.error('CONFRONTO COL DATABASE: non richiesto (--confronta)')
  }
  const ok = esito.ok && differenze.length === 0
  console.log(ok ? `OK — file integro e completo${confronta ? (contenuti ? ', contenuti identici alla sorgente' : ', conteggi identici alla sorgente') : ' (sorgente non confrontata)'}` : 'NON OK — vedi sopra')
  process.exit(ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(e => { console.error(`Verifica non riuscita: ${e.message}`); process.exit(1) })
}
