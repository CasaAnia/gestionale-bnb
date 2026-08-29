// ============================================================================
// CLIENT Fase 2C-B — SQL sulla PRODUZIONE via Management API.
// Il token vive SOLO in ~/.gestionale-2c/token.txt (mai nel repo, mai nei log).
//
// GUARDIA DI DESTINAZIONE (contraria a quella della 2B): ogni chiamata è
// ammessa ESCLUSIVAMENTE verso il progetto il cui ref è configurato in
// .env.local E il cui nome sul dashboard è esattamente
// "Gestionale Casa Ania Rozzano". Qualsiasi differenza = stop totale.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const NOME_ATTESO = 'Gestionale Casa Ania Rozzano'
const REPO = '/Users/amerigogranata/gestionale-bnb'

export const token = () =>
  readFileSync(join(homedir(), '.gestionale-2c', 'token.txt'), 'utf8').trim()

export function refProduzione() {
  const env = Object.fromEntries(
    readFileSync(join(REPO, '.env.local'), 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  )
  return env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1]
}
export const maschera = ref => ref.slice(0, 4) + '****'

async function mgmt(percorso, opzioni = {}) {
  return fetch('https://api.supabase.com/v1' + percorso, {
    ...opzioni,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json', ...(opzioni.headers || {}) },
  })
}

// Verifica del destinatario: ref di .env.local presente tra i progetti del
// token E nome esattamente quello atteso. Ritorna il ref verificato.
let _refVerificato = null
export async function destinatarioVerificato() {
  if (_refVerificato) return _refVerificato
  const ref = refProduzione()
  const r = await mgmt('/projects')
  if (!r.ok) throw new Error('Management API non raggiungibile: ' + r.status)
  const p = (await r.json()).find(x => x.id === ref)
  if (!p) throw new Error(`GUARDIA: il progetto ${maschera(ref)} di .env.local NON è tra quelli del token. STOP.`)
  if (p.name !== NOME_ATTESO) throw new Error(`GUARDIA: il progetto ${maschera(ref)} si chiama "${p.name}", atteso "${NOME_ATTESO}". STOP.`)
  _refVerificato = ref
  return ref
}

// SQL in produzione: l'endpoint database/query esegue l'intero testo in UNA
// transazione (verificato in 2B: lo 0021 senza bucket è fallito senza lasciare
// modifiche parziali). Un file = una chiamata = una transazione.
export async function sql(query) {
  const ref = await destinatarioVerificato()
  const r = await mgmt(`/projects/${ref}/database/query`, {
    method: 'POST', body: JSON.stringify({ query }),
  })
  const testo = await r.text()
  if (!r.ok) {
    let msg = testo
    try { msg = JSON.parse(testo).message ?? testo } catch { /* testo grezzo */ }
    throw new Error(`SQL fallito (${r.status}): ${String(msg).slice(0, 600)}`)
  }
  try { return JSON.parse(testo) } catch { return testo }
}

export const leggiFile = f => readFileSync(join(REPO, f), 'utf8')
