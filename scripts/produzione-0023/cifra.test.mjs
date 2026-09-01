// Test LOCALI dello strumento di cifratura/verifica del backup: nessuna
// rete. La verifica deve accorgersi DAVVERO di archivio corrotto, chiave
// sbagliata, file mancante o modificato.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import {
  cifra, decifra, impacchetta, spacchetta, verificaArchivio,
} from './cifra-e-verifica-backup.mjs'

function cartellaFinta() {
  const dir = mkdtempSync(join(tmpdir(), 'backup-finto-'))
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ attesi: { spese: 2 } }))
  mkdirSync(join(dir, 'tabelle'))
  writeFileSync(join(dir, 'tabelle', 'family_expenses.json'), '[{"id":1},{"id":2}]')
  writeFileSync(join(dir, 'tabelle', 'binario.bin'), randomBytes(1024))
  return dir
}

test('giro completo: impacchetta → cifra → decifra → spacchetta, byte per byte', () => {
  const dir = cartellaFinta()
  const { pacchetto, indice } = impacchetta(dir)
  assert.equal(indice.length, 3)
  const chiave = randomBytes(32)
  const archivio = cifra(pacchetto, chiave)
  assert.notDeepEqual(archivio.subarray(28, 60), pacchetto.subarray(0, 32), 'i byte cifrati non sono in chiaro')
  const file = spacchetta(decifra(archivio, chiave))
  assert.deepEqual(file.map(f => f.file).sort(), ['manifest.json', 'tabelle/binario.bin', 'tabelle/family_expenses.json'])
  assert.equal(readFileSync(join(dir, 'tabelle', 'binario.bin')).equals(file.find(f => f.file === 'tabelle/binario.bin').dati), true)
  assert.deepEqual(verificaArchivio(archivio, chiave, dir), [])
})

test('controprove: un byte corrotto, la chiave sbagliata o un file cambiato NON passano', () => {
  const dir = cartellaFinta()
  const chiave = randomBytes(32)
  const archivio = cifra(impacchetta(dir).pacchetto, chiave)
  // archivio corrotto di UN byte (nel corpo cifrato)
  const corrotto = Buffer.from(archivio)
  corrotto[40] = corrotto[40] ^ 0xff
  assert.match(verificaArchivio(corrotto, chiave, dir)[0], /decifratura fallita/)
  // chiave sbagliata
  assert.match(verificaArchivio(archivio, randomBytes(32), dir)[0], /decifratura fallita/)
  // origine cambiata DOPO la cifratura: la verifica se ne accorge
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ attesi: { spese: 999 } }))
  assert.ok(verificaArchivio(archivio, chiave, dir).some(p => /contenuto DIVERSO: manifest.json/.test(p)))
})
