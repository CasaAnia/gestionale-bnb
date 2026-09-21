#!/usr/bin/env node
// ============================================================================
// IDENTITÀ DEL PROGETTO SUPABASE VERO (21/09/2026)
//
// Gemello del controllo per il progetto di prova, al contrario: accetta
// SOLO il database di produzione e rifiuta tutto il resto, così un backup
// non finisce per errore sul progetto sbagliato.
//
// Il collegamento si legge da ~/.config/casa-ania/produzione.env
// (DATABASE_URL_PRODUZIONE): non viene MAI stampato.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export const REF_PRODUZIONE = 'tnsaaoxlcldeltowhvwv'
export const REF_PROVA = 'exylddaptetwcjxyqids'
const CONFIG = path.join(homedir(), '.config', 'casa-ania', 'produzione.env')

export function leggiConnessione() {
  if (process.env.DATABASE_URL_PRODUZIONE) return process.env.DATABASE_URL_PRODUZIONE.trim()
  if (!existsSync(CONFIG)) throw new Error(`Manca il file con il collegamento: ${CONFIG}`)
  const riga = readFileSync(CONFIG, 'utf8').split('\n').find(r => r.startsWith('DATABASE_URL_PRODUZIONE='))
  const valore = riga?.slice('DATABASE_URL_PRODUZIONE='.length).trim().replace(/^["']|["']$/g, '')
  if (!valore || valore.includes('<INCOLLA') || valore.includes('INCOLLAQUI')) throw new Error(`Il collegamento non è ancora stato scritto in ${CONFIG}`)
  return valore
}

export function datiConnessione(url) {
  const u = new URL(url)
  const daHost = u.hostname.match(/(?:^|\.)([a-z0-9]{20})\.supabase\.(co|com)$/)?.[1]
  const daUtente = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
  return { ref: daHost || daUtente || null, host: u.hostname, porta: u.port || '5432' }
}

export function controllaProduzione(url) {
  const { ref, host, porta } = datiConnessione(url)
  if (!ref) throw new Error(`Non riconosco il progetto dall'indirizzo (${host}): fermo tutto`)
  if (ref === REF_PROVA) throw new Error('Questa è la connessione del progetto di PROVA: per il backup serve il database vero. Fermo tutto.')
  if (ref !== REF_PRODUZIONE) throw new Error(`Il progetto ${ref} non è quello di produzione atteso: fermo tutto`)
  const pooler = /pooler\.supabase\.com$/.test(host)
  if (pooler && porta === '6543') throw new Error('Pooler «transaction»: per il backup e per applicare serve la connessione diretta o il pooler «session»')
  return { ref, host, porta, modalita: pooler ? 'pooler «session»' : 'connessione diretta' }
}
