#!/usr/bin/env node
// 2C-B · PASSO 4 — applica 0021_protezione_family.sql in produzione.
// Precondizione bucket già verificata (esiste, unico, privato).
// UNA chiamata = UNA transazione: se fallisce non lascia modifiche parziali.
import { sql, leggiFile } from './api2c.mjs'

console.log('applico 0021 in produzione (transazione unica)…')
try {
  await sql(leggiFile('supabase/migrations/0021_protezione_family.sql'))
} catch (e) {
  console.error('PASSO 4 ROSSO — 0021 fallita, transazione annullata: policy e permessi INVARIATI (restano quelli storici, l\'app continua a funzionare).')
  console.error(e.message)
  process.exit(1)
}
console.log('PASSO 4 ✓ — 0021 applicata')
