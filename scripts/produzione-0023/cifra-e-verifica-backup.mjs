#!/usr/bin/env node
// ============================================================================
// CIFRATURA E VERIFICA del backup fresco — strumento LOCALE (nessuna
// rete): prende la cartella del backup già raccolto (backup-pre-0022.mjs,
// lo stesso raccoglitore a sola lettura usato per la 0022), la impacchetta,
// la CIFRA (AES-256-GCM, chiave generata qui e salvata SOLO in un file 600
// fuori repo) e POI VERIFICA DAVVERO: decifra in memoria e confronta ogni
// file byte per byte con l'originale. Senza verifica positiva l'archivio
// non è dichiarato valido.
//
// Uso: node scripts/produzione-0023/cifra-e-verifica-backup.mjs <cartella-backup> <archivio.tar.enc>
// La CHIAVE finisce in <archivio.tar.enc>.chiave (600): va conservata nel
// gestore di password e la SECONDA COPIA dell'archivio va su un altro
// supporto. Senza chiave il backup non è recuperabile.
// ============================================================================
import {
  createHash, createCipheriv, createDecipheriv, randomBytes,
} from 'node:crypto'
import {
  existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync,
} from 'node:fs'
import { join, relative, dirname } from 'node:path'

export function elencaFile(cartella) {
  const file = []
  const visita = dir => {
    for (const nome of readdirSync(dir).sort()) {
      const percorso = join(dir, nome)
      if (statSync(percorso).isDirectory()) visita(percorso)
      else file.push(percorso)
    }
  }
  visita(cartella)
  return file
}

// pacchetto SEMPLICE e deterministico (niente dipendenze): per ogni file
// una riga JSON con percorso relativo, dimensione e sha256, poi i byte.
export function impacchetta(cartella, ops = { readFileSync }) {
  const pezzi = []
  const indice = []
  for (const percorso of elencaFile(cartella)) {
    const dati = ops.readFileSync(percorso)
    const rel = relative(cartella, percorso)
    indice.push({ file: rel, byte: dati.length, sha256: createHash('sha256').update(dati).digest('hex') })
    const testata = Buffer.from(JSON.stringify({ file: rel, byte: dati.length }) + '\n', 'utf8')
    pezzi.push(Buffer.from(String(testata.length).padStart(10, '0'), 'utf8'), testata, dati)
  }
  return { pacchetto: Buffer.concat(pezzi), indice }
}

export function spacchetta(pacchetto) {
  const file = []
  let a = 0
  while (a < pacchetto.length) {
    const lunghezza = parseInt(pacchetto.subarray(a, a + 10).toString('utf8'), 10)
    if (!Number.isFinite(lunghezza)) throw new Error('pacchetto corrotto: testata illeggibile')
    const testata = JSON.parse(pacchetto.subarray(a + 10, a + 10 + lunghezza).toString('utf8'))
    const da = a + 10 + lunghezza
    file.push({ ...testata, dati: pacchetto.subarray(da, da + testata.byte) })
    a = da + testata.byte
  }
  return file
}

export function cifra(pacchetto, chiave) {
  const iv = randomBytes(12)
  const cifrario = createCipheriv('aes-256-gcm', chiave, iv)
  const corpo = Buffer.concat([cifrario.update(pacchetto), cifrario.final()])
  return Buffer.concat([iv, cifrario.getAuthTag(), corpo])
}

export function decifra(archivio, chiave) {
  const iv = archivio.subarray(0, 12)
  const tag = archivio.subarray(12, 28)
  const corpo = archivio.subarray(28)
  const d = createDecipheriv('aes-256-gcm', chiave, iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(corpo), d.final()]) // tag sbagliato → eccezione
}

// verifica VERA: decifra e confronta ogni file byte per byte con l'origine
export function verificaArchivio(archivio, chiave, cartella, ops = { readFileSync }) {
  const problemi = []
  let ricostruiti
  try { ricostruiti = spacchetta(decifra(archivio, chiave)) } catch (e) {
    return [`decifratura fallita (archivio o chiave corrotti): ${String(e.message)}`]
  }
  const originali = elencaFile(cartella)
  if (ricostruiti.length !== originali.length)
    problemi.push(`file: ${ricostruiti.length} nell'archivio, ${originali.length} nell'origine`)
  const perNome = new Map(ricostruiti.map(f => [f.file, f.dati]))
  for (const percorso of originali) {
    const rel = relative(cartella, percorso)
    const dati = perNome.get(rel)
    if (!dati) { problemi.push(`manca nell'archivio: ${rel}`); continue }
    if (!dati.equals(ops.readFileSync(percorso))) problemi.push(`contenuto DIVERSO: ${rel}`)
  }
  return problemi
}

// ---- esecuzione da riga di comando ----------------------------------------
const [cartella, destinazione] = process.argv.slice(2)
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!cartella || !destinazione) {
    console.error('Uso: node scripts/produzione-0023/cifra-e-verifica-backup.mjs <cartella-backup> <archivio.tar.enc>')
    process.exit(1)
  }
  if (!existsSync(cartella)) { console.error('cartella del backup inesistente'); process.exit(1) }
  if (existsSync(destinazione)) { console.error('destinazione già esistente: NON sovrascrivo. STOP.'); process.exit(1) }
  const fileChiave = `${destinazione}.chiave`
  if (existsSync(fileChiave)) { console.error('file della chiave già esistente: NON sovrascrivo. STOP.'); process.exit(1) }

  const { pacchetto, indice } = impacchetta(cartella)
  const chiave = randomBytes(32)
  const archivio = cifra(pacchetto, chiave)
  mkdirSync(dirname(destinazione), { recursive: true })
  writeFileSync(destinazione, archivio)
  writeFileSync(fileChiave, chiave.toString('hex') + '\n', { mode: 0o600 })
  chmodSync(fileChiave, 0o600)
  writeFileSync(`${destinazione}.indice.json`, JSON.stringify({
    generato_il: new Date().toISOString(), file: indice.length,
    byte_archivio: archivio.length,
    sha256_archivio: createHash('sha256').update(archivio).digest('hex'),
    contenuto: indice,
  }, null, 2))

  const problemi = verificaArchivio(readFileSync(destinazione), Buffer.from(readFileSync(fileChiave, 'utf8').trim(), 'hex'), cartella)
  if (problemi.length) {
    console.error('VERIFICA FALLITA — archivio NON valido:', problemi.slice(0, 5).join('; '))
    process.exit(1)
  }
  console.log(`ARCHIVIO CIFRATO E VERIFICATO: ${destinazione} (${indice.length} file, ${archivio.length} byte)`)
  console.log(`CHIAVE (600): ${fileChiave} — conservarla nel gestore di password; SENZA chiave il backup non si recupera.`)
  console.log('Copiare archivio+indice su un SECONDO supporto prima di procedere.')
}
