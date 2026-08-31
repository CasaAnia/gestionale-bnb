// ============================================================================
// Test LOCALI del registro durevole (filesystem vero in una cartella
// temporanea, nessuna rete): blocco dei giri con registri pendenti,
// scelta del registro pendente, scritture ATOMICHE che preservano la
// copia precedente anche quando il disco tradisce.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nuovoRegistro, apriUltimoRegistro, scriviAtomica } from './registro.mjs'

const cartellaNuova = () => { process.env.REGISTRO_DIR = mkdtempSync(join(tmpdir(), 'registro-collaudo-')) }

test('un NUOVO giro è vietato finché il precedente non è pulito', () => {
  cartellaNuova()
  const r1 = nuovoRegistro()
  r1.documento('doc-pendente')
  assert.throws(() => nuovoRegistro(), /PENDENTE/)
  // gli identificativi pendenti restano raggiungibili, non nascosti da un secondo giro
  assert.deepEqual(apriUltimoRegistro().dati.docIds, ['doc-pendente'])
  r1.segna('pulito')
  const r2 = nuovoRegistro()
  assert.notEqual(r2.file, r1.file)
})

test('un registro ILLEGGIBILE blocca il nuovo giro invece di essere ignorato', () => {
  cartellaNuova()
  writeFileSync(join(process.env.REGISTRO_DIR, 'collaudo-contratto-1.json'), '{corrotto')
  assert.throws(() => nuovoRegistro(), /ILLEGGIBILE/)
})

test('apriUltimoRegistro sceglie il PENDENTE anche se non è il più recente', () => {
  cartellaNuova()
  const pendente = { pulito: false, docIds: ['doc-vecchio'], sonde: [] }
  writeFileSync(join(process.env.REGISTRO_DIR, 'collaudo-contratto-100.json'), JSON.stringify(pendente))
  writeFileSync(join(process.env.REGISTRO_DIR, 'collaudo-contratto-200.json'), JSON.stringify({ pulito: true, docIds: [], sonde: [] }))
  assert.deepEqual(apriUltimoRegistro().dati.docIds, ['doc-vecchio'])
})

test('guasto di SCRITTURA: la copia precedente resta intatta e leggibile', () => {
  cartellaNuova()
  const r = nuovoRegistro()
  r.documento('doc-salvato')
  const rotti = { writeFileSync: () => { throw new Error('disco pieno') }, renameSync }
  const rotto = apriUltimoRegistro(rotti)
  assert.throws(() => rotto.documento('doc-perso'), /disco pieno/)
  const riletto = apriUltimoRegistro()
  assert.deepEqual(riletto.dati.docIds, ['doc-salvato'])
})

test('guasto del RENAME: il file di destinazione non viene toccato', () => {
  cartellaNuova()
  const percorso = join(process.env.REGISTRO_DIR, 'atomico.json')
  scriviAtomica(percorso, 'prima')
  const rotti = { writeFileSync, renameSync: () => { throw new Error('rename negato') } }
  assert.throws(() => scriviAtomica(percorso, 'dopo', rotti), /rename negato/)
  assert.equal(readFileSync(percorso, 'utf8'), 'prima')
})

test('la scrittura riuscita sostituisce davvero il contenuto', () => {
  cartellaNuova()
  const percorso = join(process.env.REGISTRO_DIR, 'atomico.json')
  scriviAtomica(percorso, 'prima')
  scriviAtomica(percorso, 'dopo')
  assert.equal(readFileSync(percorso, 'utf8'), 'dopo')
})
