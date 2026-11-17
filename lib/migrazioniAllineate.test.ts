// Ogni modifica al database passa da un file in supabase/migrations, prima di applicarla (17/11/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const migrazioni = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()
const proposte = readdirSync(new URL('../supabase/proposte/', import.meta.url))

test('le migrazioni sono migrazioni: nessuna «bozza», un solo file per numero', () => {
  assert.deepEqual(migrazioni.filter(f => /BOZZA/i.test(f)), [])
  const numeri = migrazioni.map(f => f.slice(0, 4))
  assert.deepEqual(numeri.filter((n, i) => numeri.indexOf(n) !== i), [], 'due file con lo stesso numero')
  for (const f of migrazioni) assert.match(f, /^\d{4}_[a-z0-9_]+\.sql$/, f)
})

test('le bozze già applicate in produzione stanno fra le migrazioni, con la riga di stato', () => {
  // 20 bozze verificate contro lo schema vero il 17/11/2026, più l'allineamento 0066
  for (const n of ['0023', '0033', '0034', '0035', '0037', '0038', '0043', '0044', '0045', '0051', '0052', '0053', '0054', '0055', '0056', '0059', '0060', '0061', '0062', '0064', '0066']) {
    const f = migrazioni.find(m => m.startsWith(`${n}_`))
    assert.ok(f, `manca la migrazione ${n}`)
    const sql = leggi(`supabase/migrations/${f}`)
    assert.match(sql.split('\n').slice(0, 8).join('\n'), /^-- STATO/m, `${f}: manca la riga di stato in testa`)
  }
  // le bozze NON applicate restano proposte e si vedono: nessuna è finita fra le migrazioni
  for (const n of ['0026', '0036', '0041', '0042', '0049', '0050', '0065']) {
    assert.ok(proposte.some(p => p.startsWith(`${n}_`) && /BOZZA\.sql$/.test(p)), `la proposta ${n} deve restare fra le proposte`)
  }
})

test('0043: «pagato» e «bonifico» sono come in produzione (booleani col default, che possono essere nulli)', () => {
  const sql = leggi('supabase/migrations/0043_drift_bookings.sql')
  assert.match(sql, /add column if not exists pagato boolean default false;/)
  assert.match(sql, /add column if not exists bonifico boolean default false;/)
  assert.doesNotMatch(sql, /pagato boolean not null/)
})

test('0066 descrive ciò che c\'è già, senza cambiare nulla: tutto «if not exists»', () => {
  const sql = leggi('supabase/migrations/0066_allineamento_produzione_2026_11_17.sql').split('\n').filter(r => !r.trim().startsWith('--')).join('\n')
  for (const istruzione of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    assert.match(istruzione, /if not exists/i, `istruzione che potrebbe cambiare la produzione: ${istruzione.slice(0, 80)}`)
  }
  assert.doesNotMatch(sql, /\b(drop|delete|update|truncate)\b/i)
})

test('gli strumenti per tenere il repo uguale al database esistono', () => {
  assert.ok(existsSync(new URL('../scripts/schema/confronta-schema.mjs', import.meta.url)))
  const catalogo = leggi('supabase/strumenti/leggi-catalogo.sql')
  assert.doesNotMatch(catalogo.split('\n').filter(r => !r.trim().startsWith('--')).join('\n'), /\b(insert|update|delete|drop|alter|create|truncate|grant)\b/i, 'l\'estrazione del catalogo è solo una SELECT')
  assert.match(leggi('scripts/schema/confronta-schema.mjs'), /collaudo_schema/)
})

test('la regola è scritta in REGOLE-FISSE.md', () => {
  assert.match(leggi('REGOLE-FISSE.md'), /Ogni modifica al database passa da un file in supabase\/migrations, prima di applicarla\. Niente modifiche fatte solo nel SQL Editor/)
})
