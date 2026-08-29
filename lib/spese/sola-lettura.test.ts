// Guardia PERMANENTE (3.2A.1): la prova sui dati reali e l'adattatore sono in
// SOLA LETTURA. Questo test legge i sorgenti e fallisce se compare una
// chiamata di scrittura o una RPC: insert, update, upsert, delete, rpc.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE_SOLA_LETTURA = [
  'app/nuove-spese-reali/RealiClient.tsx',
  'app/nuove-spese-reali/page.tsx',
  'lib/spese/adattatore.ts',
  'lib/spese/vista.ts',
]
const VIETATI = /\.(insert|update|upsert|delete|rpc)\s*\(/

test('la prova sui dati reali non contiene INSERT, UPDATE, DELETE, UPSERT o RPC', () => {
  for (const f of FILE_SOLA_LETTURA) {
    const sorgente = readFileSync(join(REPO, f), 'utf8')
    const colpo = sorgente.match(VIETATI)
    assert.equal(colpo, null, `${f} contiene una chiamata vietata: ${colpo?.[0]}`)
    assert.ok(!/service_role|SERVICE_ROLE/i.test(sorgente), `${f} tocca la service role`)
  }
})
