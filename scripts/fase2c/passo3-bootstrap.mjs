#!/usr/bin/env node
// 2C-B · PASSO 3 — bootstrap_owner.sql, SOLO se in Authentication c'è
// esattamente un utente. Poi verifica: app_members contiene esattamente
// un owner e corrisponde all'unico utente reale. Output sempre mascherato.
import { sql, leggiFile } from './api2c.mjs'

const prima = (await sql('select count(*) n from auth.users'))[0]
if (prima.n !== 1) { console.error(`PASSO 3 ROSSO: utenti Authentication = ${prima.n}, atteso 1. STOP, bootstrap NON eseguito.`); process.exit(1) }
console.log('utenti Authentication: 1 ✓ — eseguo bootstrap_owner.sql…')

try {
  await sql(leggiFile('supabase/bootstrap_owner.sql'))
} catch (e) {
  console.error('PASSO 3 ROSSO — bootstrap fallito, transazione annullata, app_members invariata.')
  console.error(e.message)
  process.exit(1)
}

const dopo = (await sql(`select
  (select count(*) from app_members) membri,
  (select count(*) from app_members where role='owner') owner,
  (select count(*) from app_members m join auth.users u on u.id=m.user_id) corrispondenti,
  (select count(*) from auth.users) utenti`))[0]
console.log('dopo bootstrap:', JSON.stringify(dopo))
if (dopo.membri !== 1 || dopo.owner !== 1 || dopo.corrispondenti !== 1 || dopo.utenti !== 1) {
  console.error('PASSO 3 ROSSO: app_members non contiene esattamente un owner corrispondente all\'unico utente. STOP.')
  process.exit(1)
}
const email = (await sql(`select left(u.email,2)||'***@'||split_part(u.email,'@',2) mascherata
  from app_members m join auth.users u on u.id=m.user_id where m.role='owner'`))[0]
console.log(`PASSO 3 ✓ — owner unico configurato: ${email.mascherata}`)
