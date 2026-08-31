// Preflight LOCALE condiviso. Non applica SQL, non usa token, non fa deploy.
// Il verde riguarda solo i comandi elencati: UI/build/remoto restano separati.
// Nessuna dipendenza nuova, nessun file di report o configurazione riscritto.
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 15000 })
const elenco = testo => testo.split('\0').filter(Boolean)
const unico = voci => [...new Set(voci)].sort()
const fonte = file => /\.(?:[cm]?[jt]sx?|json|md|sql|ya?ml|css)$/.test(file)
  && !/(^|\/)(?:\.env[^/]*|node_modules|\.next|\.git)(\/|$)/.test(file)

export function fotografia(cwd = radice) {
  const head = git(cwd, ['rev-parse', '--verify', 'HEAD']).trim()
  const status = git(cwd, ['status', '--porcelain=v1', '-z'])
  const files = unico(elenco(git(cwd, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).filter(fonte))
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file).update('\0')
    try {
      const path = join(cwd, file), stat = lstatSync(path)
      if (stat.isSymbolicLink()) hash.update('link:').update(readlinkSync(path))
      else if (stat.isFile()) hash.update(readFileSync(path))
      else throw new Error(`tipo di sorgente inatteso: ${file}`)
    } catch (e) {
      if (e.code === 'ENOENT') hash.update('file-eliminato')
      else throw e
    }
    hash.update('\0')
  }
  return { head, status, impronta: hash.digest('hex'), file: files.length }
}

const validaFoto = f => f && /^[0-9a-f]{40,64}$/.test(f.head)
  && /^[0-9a-f]{64}$/.test(f.impronta) && typeof f.status === 'string'
  && Number.isInteger(f.file) && f.file > 0

export function giudica(passi, risultati, prima, dopo) {
  if (!Array.isArray(passi) || !passi.length || new Set(passi.map(p => p.nome)).size !== passi.length)
    return { codice: 1, stato: 'PIANO_INCOMPLETO' }
  if (!validaFoto(prima) || !validaFoto(dopo)) return { codice: 1, stato: 'FOTOGRAFIA_INCOMPLETA' }
  if (prima.head !== dopo.head || prima.impronta !== dopo.impronta || prima.status !== dopo.status || prima.file !== dopo.file)
    return { codice: 2, stato: 'CODICE_CAMBIATO_DURANTE_LE_PROVE' }
  if (!Array.isArray(risultati) || risultati.length !== passi.length
    || risultati.some((r, i) => !r || r.nome !== passi[i].nome || r.uscita !== 0))
    return { codice: 1, stato: 'VERIFICHE_FALLITE_O_INCOMPLETE' }
  return { codice: 0, stato: 'VERIFICHE_TECNICHE_OK' }
}

export async function eseguiPiano(passi, esegui, fotografa, avvisa = () => {}) {
  const prima = await fotografa()
  if (!validaFoto(prima) || !passi.length || new Set(passi.map(p => p.nome)).size !== passi.length)
    throw new Error('piano o fotografia iniziale incompleti: nessun controllo avviato')
  const risultati = []
  for (const passo of passi) {
    avvisa(passo.nome)
    let esito
    try { esito = await esegui(passo) }
    catch (e) { esito = { uscita: null, dettaglio: e.message } }
    risultati.push({ ...esito, nome: passo.nome })
    if (esito?.uscita !== 0) break
  }
  const dopo = await fotografa()
  return { ...giudica(passi, risultati, prima, dopo), prima, dopo, risultati }
}

export function creaPiano(cwd = radice, base = 'HEAD') {
  const commitBase = git(cwd, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim()
  const delta = unico([
    ...elenco(git(cwd, ['diff', '--name-only', '-z', commitBase, '--'])),
    ...elenco(git(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])),
  ])
  const lint = delta.filter(file => {
    if (!/\.[cm]?[jt]sx?$/.test(file) || !fonte(file)) return false
    try { return lstatSync(join(cwd, file)).isFile() }
    catch (e) { if (e.code === 'ENOENT') return false; throw e }
  })
  const passi = [
    { nome: 'Suite applicazione', args: ['--test', '--test-reporter=spec', 'lib/**/*.test.ts'] },
    { nome: 'Regressioni delle revisioni', args: ['--test', '--test-reporter=spec', 'scripts/revisioni/*.test.mjs'] },
    { nome: 'Strumenti locali', args: ['--test', '--test-reporter=spec',
      'scripts/verifica-consegna.test.mjs', 'scripts/fase4/collaudo.test.mjs',
      'scripts/collaudo-contratto/strumenti.test.mjs', 'scripts/collaudo-contratto/registro.test.mjs'] },
    { nome: 'TypeScript senza emissione', args: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'] },
  ]
  if (lint.length) passi.push({ nome: 'Lint dei file modificati', args: ['node_modules/eslint/bin/eslint.js', '--', ...lint] })
  return { commitBase, lint, passi }
}

function eseguiLocale(passo, cwd) {
  return new Promise(risolvi => {
    const processo = spawn(process.execPath, passo.args, {
      cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000,
    })
    let dettaglio = ''
    const raccogli = dati => { dettaglio = (dettaglio + dati.toString()).slice(-6000) }
    processo.stdout.on('data', raccogli)
    processo.stderr.on('data', raccogli)
    processo.on('error', e => risolvi({ uscita: null, dettaglio: e.message }))
    processo.on('close', (code, signal) => risolvi({ uscita: signal ? null : code, dettaglio }))
  })
}

export function opzioni(args) {
  let piano = false, base = 'HEAD'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--piano') piano = true
    else if (args[i] === '--base' && args[i + 1] && !args[i + 1].startsWith('--')) base = args[++i]
    else throw new Error(`opzione non valida: ${args[i]}; usa [--piano] [--base COMMIT]`)
  }
  return { piano, base }
}

async function main() {
  const opts = opzioni(process.argv.slice(2))
  const piano = creaPiano(radice, opts.base)
  if (opts.piano) {
    console.log(JSON.stringify({ modalita: 'SOLO_PIANO_NON_ESEGUITO', ...piano,
      esclusi: ['build', 'browser', 'collaudi remoti', 'migrazioni', 'push', 'deploy'] }, null, 2))
    return
  }
  console.log(`Base: ${piano.commitBase}; nessun file o servizio esterno da configurare.`)
  const r = await eseguiPiano(piano.passi, p => eseguiLocale(p, radice),
    () => fotografia(radice), nome => console.log(`Controllo: ${nome}`))
  for (const passo of r.risultati) {
    console.log(`${passo.uscita === 0 ? 'OK' : 'STOP'} — ${passo.nome}`)
    if (passo.uscita !== 0 && passo.dettaglio) console.error(passo.dettaglio)
  }
  console.log(`${r.stato}; HEAD ${r.prima.head}; impronta sorgenti ${r.prima.impronta}`)
  console.log(r.prima.status ? 'Albero con modifiche locali: il risultato NON è attribuibile al solo commit.' : 'Albero iniziale pulito.')
  if (!piano.lint.length) console.log('Lint non eseguito: nessun file JS/TS nel delta indicato.')
  console.log('UI, build e remoto NON verificati da questo comando. Completare CONSEGNA-ATTIVA.md; nessuna approvazione automatica.')
  process.exitCode = r.codice
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e => { console.error(`STOP: ${e.message}`); process.exitCode = 1 })
}
