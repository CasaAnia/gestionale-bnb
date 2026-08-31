import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eseguiPiano, giudica, opzioni } from './verifica-consegna.mjs'

const foto = { head: 'a'.repeat(40), impronta: 'b'.repeat(64), file: 4, status: '' }
const passi = [{ nome: 'A', args: [] }, { nome: 'B', args: [] }]
const verdi = passi.map(p => ({ nome: p.nome, uscita: 0 }))

test('verde tecnico solo con tutti i passi e fotografie complete e identiche', () => {
  assert.equal(giudica(passi, verdi, foto, foto).stato, 'VERIFICHE_TECNICHE_OK')
  for (const dati of [[], verdi.slice(0, 1), [...verdi, verdi[0]], [...verdi].reverse(),
    [{ nome: 'A', uscita: null }, verdi[1]], [{ nome: 'A', uscita: '0' }, verdi[1]]])
    assert.notEqual(giudica(passi, dati, foto, foto).codice, 0)
  assert.notEqual(giudica([], [], foto, foto).codice, 0)
  assert.notEqual(giudica([passi[0], passi[0]], verdi, foto, foto).codice, 0)
  assert.notEqual(giudica(passi, verdi, {}, foto).codice, 0)
})

test('commit, contenuto e stato cambiati durante i controlli invalidano il risultato', () => {
  for (const dopo of [{ ...foto, head: 'c'.repeat(40) }, { ...foto, impronta: 'd'.repeat(64) },
    { ...foto, status: 'file modificato' }, { ...foto, file: 5 }])
    assert.equal(giudica(passi, verdi, foto, dopo).stato, 'CODICE_CAMBIATO_DURANTE_LE_PROVE')
})

test('il primo rosso arresta il piano e non diventa una consegna incompleta verde', async () => {
  const chiamate = []
  const r = await eseguiPiano(passi, async p => { chiamate.push(p.nome); return { uscita: 1 } }, () => foto)
  assert.deepEqual(chiamate, ['A'])
  assert.equal(r.codice, 1)
})

test('eccezioni, timeout/esito nullo e letture fallite non diventano successo', async () => {
  for (const esegui of [async () => { throw Error('avvio fallito') }, async () => ({ uscita: null })])
    assert.equal((await eseguiPiano(passi, esegui, () => foto)).codice, 1)
  let chiamate = 0
  await assert.rejects(eseguiPiano(passi, async () => { chiamate++; return { uscita: 0 } }, () => ({})))
  assert.equal(chiamate, 0)
  let letture = 0
  await assert.rejects(eseguiPiano(passi, async () => ({ uscita: 0 }), () => {
    if (++letture > 1) throw Error('fotografia finale illeggibile')
    return foto
  }), /fotografia finale/)
})

test('una verifica sospesa viene attesa: niente verde con lavoro ancora in volo', async () => {
  let sblocca
  const attesa = new Promise(r => { sblocca = r })
  let concluso = false
  const lavoro = eseguiPiano(passi, async () => { await attesa; return { uscita: 0 } }, () => foto)
    .then(r => { concluso = true; return r })
  await new Promise(r => setImmediate(r))
  assert.equal(concluso, false)
  sblocca()
  assert.equal((await lavoro).codice, 0)
})

test('opzioni esplicite: nessun argomento ignorato o comando remoto accettato', () => {
  assert.deepEqual(opzioni(['--piano', '--base', '7df3c86']), { piano: true, base: '7df3c86' })
  for (const args of [['--base'], ['--remoto'], ['--deploy'], ['--base', '--piano']])
    assert.throws(() => opzioni(args))
})

test('CLI effettiva in --piano: solo comandi locali previsti, senza eseguirli', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const testo = execFileSync(process.execPath, ['scripts/verifica-consegna.mjs', '--piano'], { cwd: root, encoding: 'utf8' })
  const piano = JSON.parse(testo)
  assert.equal(piano.modalita, 'SOLO_PIANO_NON_ESEGUITO')
  assert.ok(piano.passi.length >= 3)
  for (const p of piano.passi) assert.ok(p.args[0] === '--test' || p.args[0].startsWith('node_modules/'))
  assert.ok(piano.esclusi.includes('build'))
  assert.ok(piano.esclusi.includes('collaudi remoti'))
})
