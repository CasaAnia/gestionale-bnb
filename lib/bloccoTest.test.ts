// Dal 17/11/2026 nessuna versione va online con test rossi: Vercel lancia i test prima della build.
// Questa guardia impedisce di toglierlo, o di saltare i test per far passare una pubblicazione.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

function fileDiTest(dir: string): string[] {
  const out: string[] = []
  for (const d of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
    const p = `${dir}/${d.name}`
    if (d.isDirectory()) out.push(...fileDiTest(p))
    else if (d.name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

test('la build lancia i test prima di tutto, e Vercel usa proprio quel comando', () => {
  const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> }
  assert.match(pkg.scripts.build, /^npm test && next build/, 'build deve cominciare con «npm test &&»')
  assert.equal(pkg.scripts.test, "node --test 'lib/**/*.test.ts'")
  // niente buildCommand in vercel.json che aggira lo script, niente ignoreCommand che salta la build
  const vercel = JSON.parse(leggi('vercel.json')) as Record<string, unknown>
  assert.equal(vercel.buildCommand, undefined)
  assert.equal(vercel.ignoreCommand, undefined)
})

test('nessun test saltato, isolato o «da fare»: un test rosso si corregge, non si spegne', () => {
  const vietati = /\.skip\(|\bskip:\s*(true|['"`])|\btest\.todo\(|\.only\(|\btodo:\s*(true|['"`])/
  const colpevoli = fileDiTest('lib').filter(f => f !== 'lib/bloccoTest.test.ts' && vietati.test(leggi(f)))
  assert.deepEqual(colpevoli, [])
})

test('il secondo controllo esiste: il workflow dei test a ogni push, su ogni ramo', () => {
  assert.ok(existsSync(new URL('../.github/workflows/test.yml', import.meta.url)))
  const wf = leggi('.github/workflows/test.yml')
  assert.match(wf, /on:\s*\n\s+push:\s*\n\s+pull_request:/)
  assert.match(wf, /run: npm test/)
  assert.doesNotMatch(wf, /branches:/, 'deve valere per ogni ramo')
})

test('la regola è scritta in REGOLE-FISSE.md e in CLAUDE.md', () => {
  for (const f of ['REGOLE-FISSE.md', 'CLAUDE.md']) {
    assert.match(leggi(f), /Dal 17\/11\/2026 nessuna versione va online con test rossi/, f)
  }
})
