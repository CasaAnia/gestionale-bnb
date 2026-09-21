#!/usr/bin/env node
// ============================================================================
// BACKUP E FOTOGRAFIA DELLO STATO PRIMA DELLA 0057 (21/09/2026)
//
// SOLA LETTURA: non esegue nessuna scrittura sul database vero. Fa quello
// che chiede il piano (§3):
//   1. backup completo con pg_dump, in due formati e in DUE copie separate
//   2. verifica di integrità: elenco degli oggetti e conteggio delle righe
//      salvate confrontato coi conteggi letti dal database
//   3. definizioni e permessi ATTUALI delle quattro funzioni, salvati a parte
//   4. controllo che il trigger bookings_blocca_soggiorno NON esista già
//   5. conteggi di controllo (bookings, payments) da rifare dopo
//   6. confronto fra le definizioni remote e quelle che il file di
//      RIPRISTINO ricrea: se non combaciano, il ripristino non riporterebbe
//      allo stato di adesso e si deve fermare tutto
//
// I file finiscono in cartelle private (700), mai nel repository: contengono
// dati delle clienti. Nel rapporto vanno solo i numeri.
// ============================================================================
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, statSync, chmodSync, existsSync, copyFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { leggiConnessione, controllaProduzione } from './identita-progetto-vero.mjs'

const FUNZIONI = ['registra_acconto_prenotazione', 'registra_acconto', 'segna_pagato_prenotazione', 'segna_pagato']
const TRIGGER = 'bookings_blocca_soggiorno'
const radice = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

function pgDumpAdatto(versioneServer) {
  const grande = Number(String(versioneServer).split('.')[0])
  const candidati = [
    `/opt/homebrew/opt/libpq/bin/pg_dump`,
    `/opt/homebrew/opt/postgresql@${grande}/bin/pg_dump`,
    `/usr/local/opt/libpq/bin/pg_dump`,
    'pg_dump',
  ]
  for (const c of candidati) {
    try {
      const v = execFileSync(c, ['--version'], { encoding: 'utf8' }).match(/(\d+)\.\d+/)?.[1]
      if (v && Number(v) >= grande) return { comando: c, versione: v }
    } catch { /* non c'è: si prova il prossimo */ }
  }
  throw new Error(`Serve un pg_dump almeno della versione ${grande} (il server è ${versioneServer}): installalo prima del backup`)
}

async function main() {
  const url = leggiConnessione()
  const p = controllaProduzione(url)
  const quando = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const cartella = path.join(homedir(), 'Backup-CasaAnia', `prima-0057-${quando}`)
  const copia = path.join(homedir(), 'Documents', 'Backup-CasaAnia', `prima-0057-${quando}`)
  for (const d of [cartella, copia]) { mkdirSync(d, { recursive: true, mode: 0o700 }); chmodSync(d, 0o700) }
  console.log(`progetto VERO ${p.ref} — ${p.modalita}`)
  console.log(`cartella backup:      ${cartella}`)
  console.log(`seconda copia:        ${copia}`)

  const c = new pg.Client({ connectionString: url, statement_timeout: 120000, connectionTimeoutMillis: 30000 })
  await c.connect()
  const fotografia = { quando, progetto: p.ref, modalita: p.modalita }
  try {
    const v = (await c.query('select version() v, current_database() d, current_user u, (select setting from pg_settings where name=\'server_version\') sv')).rows[0]
    fotografia.postgres = v.sv; fotografia.database = v.d; fotografia.utente = v.u
    console.log(`PostgreSQL ${v.sv} · database ${v.d} · utente ${v.u}`)

    // 5. conteggi di controllo
    const conteggi = (await c.query(`select
      (select count(*) from public.bookings) bookings,
      (select count(*) from public.payments) payments,
      (select coalesce(sum(amount),0) from public.payments) somma_payments,
      (select count(*) from public.guests) guests`)).rows[0]
    fotografia.conteggi = conteggi
    console.log(`conteggi: bookings ${conteggi.bookings} · payments ${conteggi.payments} (somma ${conteggi.somma_payments}) · guests ${conteggi.guests}`)

    // 3. definizioni e permessi attuali delle quattro funzioni
    const def = await c.query(`select proname, pg_get_function_identity_arguments(oid) argomenti, pg_get_functiondef(oid) definizione,
        coalesce(array_to_string(proacl, E'\\n'), '(permessi predefiniti)') permessi
      from pg_proc where proname = any($1::text[]) and pronamespace = 'public'::regnamespace order by proname, argomenti`, [FUNZIONI])
    fotografia.funzioni = def.rows.map(r => ({ nome: r.proname, argomenti: r.argomenti, permessi: r.permessi, impronta: r.definizione.length }))
    console.log(`funzioni trovate: ${def.rows.length}`)
    for (const r of def.rows) console.log(`  ${r.proname}(${r.argomenti})`)

    // 4. il trigger della 0057 non deve esistere già
    const trg = await c.query('select tgname from pg_trigger where tgname = $1', [TRIGGER])
    fotografia.triggerGiaPresente = trg.rowCount > 0
    console.log(`trigger ${TRIGGER} già presente: ${trg.rowCount > 0 ? 'SÌ (ANOMALIA)' : 'no (atteso)'}`)

    // permessi attuali, in chiaro, per la verifica dopo
    const perm = await c.query(`select p.proname, pg_get_function_identity_arguments(p.oid) argomenti, r.rolname,
        has_function_privilege(r.rolname, p.oid, 'execute') puo
      from pg_proc p cross join (select unnest(array['anon','authenticated','service_role']) rolname) r
      where p.proname = any($1::text[]) and p.pronamespace = 'public'::regnamespace order by p.proname, argomenti, r.rolname`, [FUNZIONI])
    fotografia.permessi = perm.rows

    writeFileSync(path.join(cartella, 'definizioni-attuali.sql'),
      def.rows.map(r => `-- ${r.proname}(${r.argomenti})\n-- permessi: ${r.permessi.replace(/\n/g, ' ')}\n${r.definizione};\n`).join('\n'), { mode: 0o600 })

    // 6. confronto con il file di ripristino: deve ricreare le stesse firme
    const ripristino = readFileSync(path.join(radice, 'supabase/proposte/0057_RIPRISTINO.BOZZA.sql'), 'utf8')
    const firmeRemote = def.rows.map(r => `${r.proname}(${r.argomenti})`).sort()
    const mancanti = firmeRemote.filter(f => {
      const nome = f.slice(0, f.indexOf('('))
      return !new RegExp(`create or replace function\\s+public\\.${nome}\\s*\\(`, 'i').test(ripristino)
    })
    fotografia.ripristinoCopreTutte = mancanti.length === 0
    fotografia.firmeRemote = firmeRemote
    console.log(`il file di ripristino ricrea tutte le funzioni trovate: ${mancanti.length === 0 ? 'sì' : 'NO → ' + mancanti.join(', ')}`)

    // 1-2. il backup vero e proprio
    const { comando, versione } = pgDumpAdatto(v.sv)
    console.log(`pg_dump usato: ${comando} (versione ${versione})`)
    const completo = path.join(cartella, 'backup-completo.dump')
    const leggibile = path.join(cartella, 'backup-completo.sql')
    const env = { ...process.env, PGCONNECT_TIMEOUT: '30' }
    execFileSync(comando, ['--format=custom', '--no-owner', '--no-privileges', '--file', completo, url], { env, stdio: ['ignore', 'inherit', 'inherit'] })
    execFileSync(comando, ['--format=plain', '--no-owner', '--no-privileges', '--file', leggibile, url], { env, stdio: ['ignore', 'inherit', 'inherit'] })
    for (const f of [completo, leggibile]) chmodSync(f, 0o600)

    // verifica di integrità: elenco oggetti + righe salvate contro i conteggi letti
    const pgRestore = comando.replace(/pg_dump$/, 'pg_restore')
    const elenco = execFileSync(pgRestore, ['--list', completo], { encoding: 'utf8' })
    writeFileSync(path.join(cartella, 'elenco-oggetti.txt'), elenco, { mode: 0o600 })
    const testo = readFileSync(leggibile, 'utf8')
    const righeSalvate = t => {
      const i = testo.indexOf(`COPY public.${t} `)
      if (i < 0) return null
      const blocco = testo.slice(i, testo.indexOf('\n\\.\n', i))
      return blocco.split('\n').length - 1
    }
    const verifica = { bookings: righeSalvate('bookings'), payments: righeSalvate('payments'), guests: righeSalvate('guests') }
    fotografia.righeNelBackup = verifica
    const integro = ['bookings', 'payments', 'guests'].every(t => Number(verifica[t]) === Number(conteggi[t]))
    fotografia.backupIntegro = integro
    console.log(`righe nel backup: bookings ${verifica.bookings} · payments ${verifica.payments} · guests ${verifica.guests}`)
    console.log(`integrità (righe salvate = righe nel database): ${integro ? 'OK' : 'NON CORRISPONDE'}`)
    fotografia.dimensioni = { dump: statSync(completo).size, sql: statSync(leggibile).size }
    fotografia.oggettiNelDump = elenco.split('\n').filter(r => r && !r.startsWith(';')).length

    writeFileSync(path.join(cartella, 'fotografia-prima.json'), JSON.stringify(fotografia, null, 2), { mode: 0o600 })

    // seconda copia, con impronta per confronto
    for (const f of ['backup-completo.dump', 'backup-completo.sql', 'definizioni-attuali.sql', 'elenco-oggetti.txt', 'fotografia-prima.json']) {
      copyFileSync(path.join(cartella, f), path.join(copia, f)); chmodSync(path.join(copia, f), 0o600)
    }
    const impronta = f => execFileSync('shasum', ['-a', '256', f], { encoding: 'utf8' }).split(' ')[0]
    const uguali = ['backup-completo.dump', 'backup-completo.sql'].every(f => impronta(path.join(cartella, f)) === impronta(path.join(copia, f)))
    console.log(`seconda copia identica all'originale: ${uguali ? 'sì' : 'NO'}`)
    console.log(`\nfatto. Nessuna scrittura eseguita sul database.`)
    if (!integro || !uguali || fotografia.triggerGiaPresente || !fotografia.ripristinoCopreTutte) { console.error('\nATTENZIONE: un controllo non è passato: NON applicare la 0057.'); process.exit(1) }
  } finally { await c.end() }
}
main().catch(e => { console.error('fermo:', e.message); process.exit(2) })
