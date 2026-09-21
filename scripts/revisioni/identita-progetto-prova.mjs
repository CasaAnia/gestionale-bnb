#!/usr/bin/env node
// ============================================================================
// IDENTITÀ DEL PROGETTO SUPABASE DI PROVA (21/09/2026)
//
// Prima di qualunque collaudo remoto: accerta che la connessione porti al
// progetto di PROVA e non a quello di produzione, e lo dimostra con controlli
// positivi sul database, non con il nome di una variabile.
//
// La stringa di connessione si legge da ~/.config/casa-ania/prova.env
// (DATABASE_URL_PROVA) oppure dall'ambiente: non viene MAI stampata.
//
// Uso: node scripts/revisioni/identita-progetto-prova.mjs
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import pg from 'pg'

export const REF_PROVA = 'exylddaptetwcjxyqids'
export const REF_PRODUZIONE = 'tnsaaoxlcldeltowhvwv'
const CONFIG = path.join(homedir(), '.config', 'casa-ania', 'prova.env')

export function leggiConnessione() {
  if (process.env.DATABASE_URL_PROVA) return process.env.DATABASE_URL_PROVA.trim()
  if (!existsSync(CONFIG)) throw new Error(`Manca il file con il collegamento: ${CONFIG}`)
  const riga = readFileSync(CONFIG, 'utf8').split('\n').find(r => r.startsWith('DATABASE_URL_PROVA='))
  const valore = riga?.slice('DATABASE_URL_PROVA='.length).trim().replace(/^["']|["']$/g, '')
  if (!valore || valore.includes('<INCOLLA')) throw new Error(`Il collegamento non è ancora stato scritto in ${CONFIG}`)
  return valore
}

/** Il riferimento del progetto sta nell'host (db.<ref>.supabase.co) oppure,
 *  col pooler, nel nome utente (postgres.<ref>). Mai altrove. */
export function refDellaConnessione(url) {
  const u = new URL(url)
  const daHost = u.hostname.match(/(?:^|\.)([a-z0-9]{20})\.supabase\.(co|com)$/)?.[1]
  const daUtente = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
  return { ref: daHost || daUtente || null, host: u.hostname, porta: u.port || '5432' }
}

/** La modalità del collegamento: il collaudo apre DUE connessioni che tengono
 *  aperte transazioni e blocchi, quindi il pooler «transaction» (porta 6543)
 *  non va: le sessioni verrebbero mescolate fra loro. Servono la connessione
 *  diretta o il pooler in modalità sessione (porta 5432). */
export function modalitaConnessione(url) {
  const { host, porta } = refDellaConnessione(url)
  const pooler = /pooler\.supabase\.com$/.test(host)
  if (pooler && porta === '6543') return { nome: 'pooler «transaction»', adatta: false, perche: 'mescola le sessioni: le due connessioni del collaudo non terrebbero i propri blocchi' }
  if (pooler) return { nome: 'pooler «session»', adatta: true, perche: 'ogni connessione ha la sua sessione: va bene' }
  if (/^db\..*\.supabase\.(co|com)$/.test(host)) return { nome: 'connessione diretta', adatta: true, perche: 'va bene' }
  return { nome: `sconosciuta (${host}:${porta})`, adatta: false, perche: 'non riconosco questo tipo di collegamento' }
}

export function controllaRef(url) {
  const { ref, host, porta } = refDellaConnessione(url)
  if (!ref) throw new Error(`Non riesco a riconoscere il progetto dall'indirizzo (${host}): fermo tutto`)
  if (ref === REF_PRODUZIONE) throw new Error('ATTENZIONE: questa connessione porta al progetto VERO. Fermo tutto, non tocco la produzione.')
  if (ref !== REF_PROVA) throw new Error(`Il progetto ${ref} non è quello di prova autorizzato: fermo tutto`)
  return { ref, host, porta }
}

async function main() {
  const url = leggiConnessione()
  const { ref, host, porta } = controllaRef(url)
  console.log(`progetto riconosciuto dall'indirizzo: ${ref} (prova) — host ${host.replace(ref, '<ref>')}, porta ${porta}`)
  console.log(`progetto di produzione (${REF_PRODUZIONE}): NON è questo`)
  const m = modalitaConnessione(url)
  console.log(`modalità: ${m.nome} — ${m.adatta ? 'ADATTA' : 'NON ADATTA'} al collaudo (${m.perche})`)
  if (!m.adatta) throw new Error('Serve la connessione diretta o il pooler in modalità «session»')

  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20000, statement_timeout: 15000 })
  await c.connect()
  try {
    const v = (await c.query('select version() v, current_database() d, current_user u, inet_server_port() p')).rows[0]
    console.log(`PostgreSQL: ${v.v.split(' on ')[0]}`)
    console.log(`database: ${v.d} · utente: ${v.u} · porta del server: ${v.p}`)
    // controllo positivo sui CONTENUTI: la produzione ha le prenotazioni vere,
    // il progetto di prova no. Solo conteggi, nessun dato di nessuna cliente.
    const tabelle = (await c.query(`select table_name from information_schema.tables where table_schema='public' and table_name in ('bookings','payments','guests') order by table_name`)).rows.map(r => r.table_name)
    console.log(`tabelle dell'app presenti in public: ${tabelle.length ? tabelle.join(', ') : 'nessuna'}`)
    for (const t of tabelle) {
      const n = (await c.query(`select count(*)::int n from public.${t}`)).rows[0].n
      console.log(`  ${t}: ${n} righe`)
    }
    const schemiCollaudo = (await c.query(`select nspname from pg_namespace where nspname like 'collaudo\\_%' or nspname like 'codex\\_%' order by nspname`)).rows.map(r => r.nspname)
    console.log(`schemi di collaudo già presenti (da NON toccare): ${schemiCollaudo.length ? schemiCollaudo.join(', ') : 'nessuno'}`)
  } finally { await c.end() }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error('fermo:', e.message); process.exit(2) })
