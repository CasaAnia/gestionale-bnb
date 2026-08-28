#!/usr/bin/env node
// Crea utenti Auth FITTIZI sul progetto di prova e/o esporta le 8 tabelle
// storiche in ~/.gestionale-2b/export-<tag>/tabelle/*.json (fuori dal repo).
// Nessun UUID utente nei log (mascherati).
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { rest, maschera } from './api.mjs'

const [comando, arg] = process.argv.slice(2)

if (comando === 'crea-utente') {
  // arg = email fittizia (dominio .locale, mai reale)
  const r = await rest('/auth/v1/admin/users', 'service', {
    method: 'POST',
    body: JSON.stringify({ email: arg, password: 'Prova2b!' + arg.length + 'x', email_confirm: true }),
  })
  const j = await r.json()
  if (!r.ok) { console.error('creazione utente fallita:', r.status, JSON.stringify(j).slice(0, 200)); process.exit(1) }
  console.log('utente fittizio creato:', arg, '| id:', maschera(j.id))
} else if (comando === 'accedi') {
  const r = await rest('/auth/v1/token?grant_type=password', 'anon', {
    method: 'POST',
    body: JSON.stringify({ email: arg, password: 'Prova2b!' + arg.length + 'x' }),
  })
  const j = await r.json()
  if (!r.ok) { console.error('login fallito:', r.status); process.exit(1) }
  writeFileSync(join(homedir(), '.gestionale-2b', 'jwt-' + arg.split('@')[0] + '.txt'), j.access_token, { mode: 0o600 })
  console.log('jwt di', arg, 'salvato (fuori dal repo)')
} else if (comando === 'esporta') {
  const TAB = ['family_groups', 'family_categories', 'family_subcategories', 'family_expenses',
    'family_expense_items', 'family_receipts', 'family_budgets', 'family_product_rules']
  const dir = join(homedir(), '.gestionale-2b', 'export-' + arg, 'tabelle')
  mkdirSync(dir, { recursive: true })
  for (const t of TAB) {
    const righe = []
    for (let da = 0; ; da += 1000) {
      const r = await rest(`/rest/v1/${t}?select=*&order=id&limit=1000&offset=${da}`, 'service')
      if (!r.ok) { console.error('export fallito', t, r.status); process.exit(1) }
      const blocco = await r.json()
      righe.push(...blocco)
      if (blocco.length < 1000) break
    }
    writeFileSync(join(dir, `${t}.json`), JSON.stringify(righe, null, 1))
  }
  console.log('export completato in export-' + arg)
} else {
  console.error('comando sconosciuto'); process.exit(1)
}
