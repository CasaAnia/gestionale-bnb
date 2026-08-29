#!/usr/bin/env node
// 2C-B · PASSO 1 — applica 0020_rifacimento_spese_schema.sql in produzione.
// UNA chiamata = UNA transazione. Qualsiasi errore SQL = stop, nulla applicato.
import { sql, leggiFile } from './api2c.mjs'

console.log('applico 0020 in produzione (transazione unica)…')
try {
  await sql(leggiFile('supabase/migrations/0020_rifacimento_spese_schema.sql'))
} catch (e) {
  console.error('PASSO 1 ROSSO — 0020 fallita, transazione annullata, database INVARIATO.')
  console.error(e.message)
  process.exit(1)
}
console.log('PASSO 1 ✓ — 0020 applicata')
