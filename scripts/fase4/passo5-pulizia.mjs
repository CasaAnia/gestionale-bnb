#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 5: pulizia guidata dai registri, col
// motore testato in locale (pulizia.mjs). Sequenza OBBLIGATORIA:
//  1. validazione di fotografia e registri (un fallimento BLOCCA tutto,
//     prima di qualsiasi cancellazione);
//  2. pulizia con recupero (id da token, utenti da identità), verifica dei
//     collegamenti prima di togliere file, chiusura solo a residui zero;
//  3. confronto finale con la fotografia: conteggi e impronte md5 riga per
//     riga di tabelle, storage e account Auth.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { sql, rest, maschera, progetto } from '../fase2b/api.mjs'
import { cartellaRegistri, IMPRONTA_INIZIALE, marcaPulito, tuttiIRegistri } from './registro.mjs'
import { improntaStato, CHIAVI_FOTOGRAFIA } from './impronta.mjs'
import { eseguiPulizia, validaPreliminari } from './pulizia.mjs'

console.log('Bersaglio:', maschera(progetto().ref))

// ---- 1. VALIDAZIONE OBBLIGATORIA, prima di qualsiasi cancellazione --------
const fotoFile = join(cartellaRegistri(), IMPRONTA_INIZIALE)
let fotografia = null
try { fotografia = existsSync(fotoFile) ? JSON.parse(readFileSync(fotoFile, 'utf8')) : null }
catch { fotografia = null }
const registri = tuttiIRegistri()
const preliminari = validaPreliminari({ fotografia, chiaviAttese: CHIAVI_FOTOGRAFIA, registri })
for (const c of preliminari.controlli)
  console.log(`${c.ok ? '✓' : '✗'} preliminare: ${c.nome}${c.dettaglio ? ' — ' + c.dettaglio : ''}`)
if (!preliminari.ok) {
  console.error('STOP: validazione preliminare fallita — NESSUNA cancellazione eseguita.')
  process.exit(1)
}

// ---- 2. PULIZIA col motore testato ----------------------------------------
const sicuro = (v) => /^[0-9a-zA-Z_@/.-]+$/.test(String(v))
const servizi = {
  async documentiDaToken(tokens) {
    const buoni = tokens.filter(sicuro)
    if (!buoni.length) return []
    return await sql(`select id, upload_token as token from public.family_documents
      where upload_token in (${buoni.map(t => `'${t}'`).join(',')})`)
  },
  async eliminaRicevuteDiDocumento(id) {
    if (!sicuro(id)) return 0
    return (await sql(`delete from public.family_receipts where document_id='${id}' returning id`)).length
  },
  async eliminaDocumento(id) {
    if (!sicuro(id)) return 0
    return (await sql(`delete from public.family_documents where id='${id}' returning id`)).length
  },
  async ricevutaCheUsaPercorso(percorso) {
    if (!sicuro(percorso)) return true   // prudenza: percorso strano = non si tocca
    const r = await sql(`select count(*)::int as n from public.family_receipts where storage_path='${percorso}'`)
    return r[0].n > 0
  },
  async eliminaOggetto(percorso) {
    const via = await rest('/storage/v1/object/scontrini', 'service', {
      method: 'DELETE', body: JSON.stringify({ prefixes: [percorso] }),
    })
    if (via.ok) return true
    if (via.status === 404) return false
    throw new Error(`storage DELETE ${percorso}: ${via.status}`)
  },
  async utentiDaIdentita(emails) {
    const buone = emails.filter(sicuro)
    if (!buone.length) return []
    return await sql(`select id from auth.users where email in (${buone.map(e => `'${e}'`).join(',')})`)
  },
  async rimuoviAppartenenza(id) {
    if (sicuro(id)) await sql(`delete from public.app_members where user_id='${id}'`)
  },
  async eliminaUtente(id) {
    const via = await rest(`/auth/v1/admin/users/${id}`, 'service', { method: 'DELETE' })
    if (via.ok) return true
    if (via.status === 404) return false
    throw new Error(`auth DELETE ${id}: ${via.status}`)
  },
  async residuiRegistro(dati) {
    const inLista = (vals) => vals.filter(sicuro).map(v => `'${v}'`).join(',')
    const residui = {}
    residui.documentiConToken = dati.tokens?.length
      ? (await sql(`select count(*)::int as n from public.family_documents where upload_token in (${inLista(dati.tokens)})`))[0].n : 0
    residui.documentiConId = dati.documenti?.length
      ? (await sql(`select count(*)::int as n from public.family_documents where id in (${inLista(dati.documenti)})`))[0].n : 0
    const percorsi = [...(dati.percorsi ?? []), ...(dati.estranei ?? [])]
    residui.ricevuteSuiPercorsi = percorsi.length
      ? (await sql(`select count(*)::int as n from public.family_receipts where storage_path in (${inLista(percorsi)})`))[0].n : 0
    residui.oggettiSuiPercorsi = percorsi.length
      ? (await sql(`select count(*)::int as n from storage.objects where name in (${inLista(percorsi)})`))[0].n : 0
    residui.utenti = dati.identita?.length
      ? (await sql(`select count(*)::int as n from auth.users where email in (${inLista(dati.identita)})`))[0].n : 0
    return residui
  },
  marcaPulito: async (r) => marcaPulito(r),
}
const bilancio = await eseguiPulizia(registri, servizi, console.log)
console.log(`pulizia: ${bilancio.puliti} registri chiusi, ${bilancio.aperti} ancora aperti · eliminati ${bilancio.documenti} documenti, ${bilancio.ricevute} ricevute, ${bilancio.oggetti} oggetti, ${bilancio.utenti} utenti`)

// ---- 3. CONFRONTO FINALE con la fotografia --------------------------------
const finale = await improntaStato({ escludi0022: !fotografia._meta?.colonne_0022_presenti })
let uguali = true
for (const t of CHIAVI_FOTOGRAFIA) {
  const ok = finale[t] && finale[t].n === fotografia[t].n && finale[t].impronta === fotografia[t].impronta
  if (!ok) {
    uguali = false
    console.error(`✗ ${t}: iniziale n=${fotografia[t].n} impronta=${fotografia[t].impronta.slice(0, 8)}… · finale n=${finale[t]?.n} impronta=${finale[t]?.impronta.slice(0, 8)}…`)
  }
}
const esito = uguali && bilancio.aperti === 0
console.log(esito
  ? `✓ PULIZIA COMPLETA E STATO INVARIATO — verificati per conteggio e impronta md5 riga per riga: ${CHIAVI_FOTOGRAFIA.join(', ')}${fotografia._meta?.colonne_0022_presenti ? '' : ' (colonne 0022 escluse dal confronto perché ASSENTI nella fotografia iniziale)'}`
  : '✗ COLLAUDO NON CHIUSO: registri aperti o differenze qui sopra — indagare prima di riprovare')
process.exit(esito ? 0 : 1)
