// ============================================================================
// CLIENT CONDIVISO Fase 2B — Management API e progetto di PROVA.
// Le credenziali vivono SOLO in ~/.gestionale-2b (mai nel repo, mai nei log).
// Ogni chiamata verso un progetto passa dalla guardia anti-produzione.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { verificaNonProduzione, maschera } from './guardia.mjs'

const DIR = join(homedir(), '.gestionale-2b')
export const NOME_PROGETTO = 'gestionale-bnb-spese-test-2b-20260828'
export { maschera }

export const token = () => readFileSync(join(DIR, 'token.txt'), 'utf8').trim()

export function progetto() {
  const p = JSON.parse(readFileSync(join(DIR, 'progetto.json'), 'utf8'))
  verificaNonProduzione(p.ref)
  return p
}
export function salvaProgetto(dati) {
  verificaNonProduzione(dati.ref)
  writeFileSync(join(DIR, 'progetto.json'), JSON.stringify(dati, null, 2), { mode: 0o600 })
}
export const progettoEsiste = () => existsSync(join(DIR, 'progetto.json'))

// Management API (sempre col token personale)
export async function mgmt(percorso, opzioni = {}) {
  const r = await fetch('https://api.supabase.com/v1' + percorso, {
    ...opzioni,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json', ...(opzioni.headers || {}) },
  })
  return r
}

// Esecuzione SQL sul progetto di PROVA (mai sulla produzione: guardia dentro).
// Due vie: Management API (se c'è il token) oppure connessione Postgres
// DIRETTA con la password del db di prova (token già revocato dopo la 2B).
import pg from 'pg'
// i bigint (count) tornino numeri come via Management API, non stringhe
pg.types.setTypeParser(20, v => parseInt(v, 10))
pg.types.setTypeParser(1700, v => parseFloat(v))
pg.types.setTypeParser(1082, v => v)   // date come stringhe YYYY-MM-DD
let _pool = null
async function pool() {
  if (_pool) return _pool
  const p = progetto()
  const candidati = [
    { host: `db.${p.ref}.supabase.co`, port: 5432, user: 'postgres' },
    { host: 'aws-1-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${p.ref}` },
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${p.ref}` },
    { host: 'aws-1-eu-central-1.pooler.supabase.com', port: 6543, user: `postgres.${p.ref}` },
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: `postgres.${p.ref}` },
  ]
  for (const c of candidati) {
    const tentativo = new pg.Pool({
      ...c, database: 'postgres', password: p.db_pass,
      ssl: { rejectUnauthorized: false }, max: 3,
      connectionTimeoutMillis: 8000, allowExitOnIdle: true,
    })
    try {
      await tentativo.query('select 1')
      _pool = tentativo
      return _pool
    } catch { await tentativo.end().catch(() => {}) }
  }
  throw new Error('SQL: nessuna via di connessione al progetto di prova disponibile (token revocato e connessione diretta non raggiungibile)')
}

export async function sql(query) {
  const p = progetto()
  if (existsSync(join(DIR, 'token.txt'))) {
    const r = await mgmt(`/projects/${p.ref}/database/query`, {
      method: 'POST', body: JSON.stringify({ query }),
    })
    const testo = await r.text()
    if (!r.ok) {
      let msg = testo
      try { msg = JSON.parse(testo).message ?? testo } catch { /* testo grezzo */ }
      throw new Error(`SQL fallito (${r.status}): ${String(msg).slice(0, 500)}`)
    }
    try { return JSON.parse(testo) } catch { return testo }
  }
  const cli = await pool()
  try {
    const r = await cli.query(query)
    const ultimo = Array.isArray(r) ? r[r.length - 1] : r
    return ultimo.rows ?? []
  } catch (e) {
    throw new Error(`SQL fallito: ${String(e.message).slice(0, 500)}`)
  }
}

// Chiamate REST/Auth/Storage sul progetto di prova con una certa identità:
// 'anon' | 'service' | { jwt } — l'apikey è sempre quella anon (gateway),
// l'Authorization decide l'identità.
export async function rest(percorso, identita, opzioni = {}) {
  const p = progetto()
  const chiave = identita === 'service' ? p.service_key : identita === 'anon' ? p.anon_key : identita.jwt
  const r = await fetch(`https://${p.ref}.supabase.co${percorso}`, {
    ...opzioni,
    headers: {
      apikey: identita === 'service' ? p.service_key : p.anon_key,
      Authorization: 'Bearer ' + chiave,
      'Content-Type': 'application/json',
      ...(opzioni.headers || {}),
    },
  })
  return r
}
