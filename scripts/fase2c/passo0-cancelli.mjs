#!/usr/bin/env node
// ============================================================================
// 2C-B · PASSO 0 — CANCELLI PRIMA DI OGNI SCRITTURA. Tutto in sola lettura.
// 1. impronte dei tre file SQL = quelle approvate;
// 2. destinatario = progetto di .env.local, nome "Gestionale Casa Ania Rozzano";
// 3. produzione ↔ backup 2C-A: identici ID per ID, campo per campo, file+hash.
// Esce 1 (STOP) alla prima differenza.
// ============================================================================
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { destinatarioVerificato, maschera, NOME_ATTESO } from './api2c.mjs'

const REPO = '/Users/amerigogranata/gestionale-bnb'
const BACKUP_2CA = '/Users/amerigogranata/Desktop/Casa Ania/Backup spese/Backup completo spese pre-2C 2026-08-28'
const EXPORT_FRESCO = process.argv[2]
if (!EXPORT_FRESCO) { console.error('Serve la cartella per l\'export fresco'); process.exit(1) }

// --- cancello 1: impronte approvate dei tre file ---
const ATTESE = {
  'supabase/migrations/0020_rifacimento_spese_schema.sql': 'dd5b3202c538c83fffad90155576462d8765cfca67db851d053b2f688b63ec74',
  'supabase/bootstrap_owner.sql': '4a639283206f03c8c93dec7ff3e1624b7ec09c0dfdbbc6ab2f03b6b8eb835280',
  'supabase/migrations/0021_protezione_family.sql': '6271ce5081c3a24a4df084ad99a810031d97e1b457e82a31d52c5da4f5be99ee',
}
for (const [f, attesa] of Object.entries(ATTESE)) {
  const vera = createHash('sha256').update(readFileSync(`${REPO}/${f}`)).digest('hex')
  if (vera !== attesa) { console.error(`CANCELLO 1 ROSSO: impronta diversa per ${f}. STOP.`); process.exit(1) }
}
console.log('cancello 1 ✓ — impronte dei tre file identiche a quelle approvate')

// --- cancello 2: destinatario giusto ---
const ref = await destinatarioVerificato()
console.log(`cancello 2 ✓ — destinatario ${maschera(ref)} = "${NOME_ATTESO}" (coincide con .env.local)`)

// --- cancello 3: produzione identica al backup 2C-A ---
console.log('cancello 3: export fresco della produzione (solo GET/HEAD)…')
execFileSync('node', [`${REPO}/scripts/fase2c/backup-fresco.mjs`, EXPORT_FRESCO], { stdio: 'inherit' })
console.log('cancello 3: confronto ID per ID col backup 2C-A…')
execFileSync('node', [`${REPO}/scripts/verifica-spese.mjs`, '--confronta', BACKUP_2CA, EXPORT_FRESCO], { stdio: 'inherit' })
console.log('cancello 3 ✓ — produzione IDENTICA al backup 2C-A')
console.log('PASSO 0: TUTTI I CANCELLI VERDI — si può procedere con lo 0020')
