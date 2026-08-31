#!/usr/bin/env node
// ============================================================================
// ELABORAZIONE «SOLO BOZZE» — lo strumento del RUNBOOK
// (RUNBOOK-ELABORAZIONE-BOZZE.md): prende l'id del documento e il file
// JSON della LETTURA (prodotta dall'assistente guardando le foto) e usa
// il modulo collaudato lib/spese/elaborazioneBozze per scrivere SOLO
// bozze. Lo scrittore parla con QUATTRO tabelle e basta: documenti,
// bozze, righe bozza, ricevute (lettura sha per i duplicati) —
// family_expenses e family_expense_items non sono raggiungibili da qui.
//
// CANCELLO DI ATTIVAZIONE: finché il flusso non è autorizzato
// dall'utente, lo script SI RIFIUTA di scrivere. Per attivarlo serve
// ELABORAZIONE_BOZZE_ATTIVA=1 nell'ambiente del comando (mai nel file
// .env). Con --prova esegue TUTTO tranne le scritture (le elenca).
//
// Uso: node scripts/elabora/elabora-bozze.mjs <documentId> <lettura.json> [--prova]
// ============================================================================
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// .env.local a mano (nessuna dipendenza): SOLO i due valori che servono
function ambiente() {
  const testo = readFileSync(resolve(RADICE, '.env.local'), 'utf8')
  const leggi = nome => testo.match(new RegExp(`^${nome}=(.+)$`, 'm'))?.[1]?.trim()
  const url = leggi('NEXT_PUBLIC_SUPABASE_URL')
  const chiave = leggi('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chiave) { console.error('STOP: .env.local senza URL o service key'); process.exit(1) }
  return { url, chiave }
}

const [documentId, fileLettura, flag] = process.argv.slice(2)
if (!documentId || !fileLettura) {
  console.error('Uso: node scripts/elabora/elabora-bozze.mjs <documentId> <lettura.json> [--prova]')
  process.exit(1)
}
const soloProva = flag === '--prova'
if (!soloProva && process.env.ELABORAZIONE_BOZZE_ATTIVA !== '1') {
  console.error(`STOP: il flusso «solo bozze» NON è ancora attivato (scheda: attivazione DA AUTORIZZARE).
Per una prova senza scritture: aggiungi --prova. Per l'uso vero, dopo il via
libera esplicito dell'utente: ELABORAZIONE_BOZZE_ATTIVA=1 davanti al comando.`)
  process.exit(1)
}

const { url, chiave } = ambiente()
const { elaboraDocumento } = await import(resolve(RADICE, 'lib/spese/elaborazioneBozze.ts'))

// REST solo sulle tabelle CONSENTITE (whitelist verificata a ogni chiamata)
const TABELLE = new Set(['family_documents', 'family_draft_expenses', 'family_draft_items', 'family_receipts', 'family_groups', 'family_canonical_subcategories'])
async function rest(tabella, percorso, opzioni = {}) {
  if (!TABELLE.has(tabella)) throw new Error(`tabella fuori perimetro: ${tabella}`)
  const r = await fetch(`${url}/rest/v1/${tabella}${percorso}`, {
    ...opzioni,
    headers: {
      apikey: chiave, Authorization: `Bearer ${chiave}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
      ...(opzioni.headers ?? {}),
    },
  })
  const testo = await r.text()
  if (!r.ok) return { errore: `${r.status}: ${testo.slice(0, 200)}` }
  try { return { dati: JSON.parse(testo) } } catch { return { dati: [] } }
}

const scritture = []
const scrivi = soloProva
  ? async (descrizione) => { scritture.push(descrizione); return {} }
  : null

const scrittore = {
  async leggiDocumento(id) {
    const r = await rest('family_documents', `?id=eq.${id}&select=status,note`)
    if (r.errore) return { errore: r.errore }
    if (!r.dati[0]) return { errore: 'documento inesistente' }
    return { documento: r.dati[0] }
  },
  async rimuoviBozzeDi(id) {
    if (scrivi) return scrivi(`DELETE bozze+righe del documento ${id}`)
    const bozze = await rest('family_draft_expenses', `?document_id=eq.${id}&select=id`)
    if (bozze.errore) return { errore: bozze.errore }
    const ids = (bozze.dati ?? []).map(b => b.id)
    if (ids.length) {
      const righe = await rest('family_draft_items', `?draft_id=in.(${ids.join(',')})`, { method: 'DELETE' })
      if (righe.errore) return { errore: righe.errore }
      const via = await rest('family_draft_expenses', `?document_id=eq.${id}`, { method: 'DELETE' })
      if (via.errore) return { errore: via.errore }
    }
    return {}
  },
  async inserisciBozza(b) {
    if (scrivi) { await scrivi(`INSERT bozza ${b.group_id} (${b.store ?? '-'})`); return { id: `prova-${scritture.length}` } }
    const r = await rest('family_draft_expenses', '', { method: 'POST', body: JSON.stringify(b) })
    if (r.errore) return { errore: r.errore }
    return { id: r.dati?.[0]?.id }
  },
  async inserisciRiga(riga) {
    if (scrivi) return scrivi(`INSERT riga «${riga.name}» → ${riga.draft_id}`)
    const r = await rest('family_draft_items', '', { method: 'POST', body: JSON.stringify(riga) })
    return r.errore ? { errore: r.errore } : {}
  },
  async aggiornaDocumento(id, campi) {
    if (scrivi) return scrivi(`UPDATE documento ${id}: ${JSON.stringify(campi)}`)
    const r = await rest('family_documents', `?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(campi) })
    return r.errore ? { errore: r.errore } : {}
  },
}

// contesto: gruppi e sottocategorie canoniche dal database, la nota dal
// documento, i possibili duplicati dallo sha256 delle ricevute
const gruppi = await rest('family_groups', '?select=id,ambito')
const sottoCanoniche = await rest('family_canonical_subcategories', '?select=id,canonical_category_id')
if (gruppi.errore || sottoCanoniche.errore) {
  console.error('STOP: contesto non leggibile:', gruppi.errore ?? sottoCanoniche.errore); process.exit(1)
}
const docCorrente = await scrittore.leggiDocumento(documentId)
const mie = await rest('family_receipts', `?document_id=eq.${documentId}&select=file_sha256`)
let duplicato = null
const shas = (mie.dati ?? []).map(x => x.file_sha256).filter(Boolean)
if (shas.length) {
  const uguali = await rest('family_receipts', `?file_sha256=in.(${shas.map(s => `"${s}"`).join(',')})&document_id=neq.${documentId}&select=document_id`)
  if (!uguali.errore && (uguali.dati ?? []).length)
    duplicato = { messaggio: `possibile duplicato: stessa foto del documento ${uguali.dati[0].document_id}` }
}

const lettura = JSON.parse(readFileSync(fileLettura, 'utf8'))
const esito = await elaboraDocumento(scrittore, documentId, { lettura }, {
  gruppi: (gruppi.dati ?? []).map(g => ({ id: g.id, ambito: g.ambito === 'azienda' ? 'azienda' : 'personale' })),
  sottoCanoniche: sottoCanoniche.dati ?? [],
  nota: docCorrente.documento?.note ?? null,
  duplicato,
})
console.log(JSON.stringify(esito, null, 2))
if (soloProva) {
  console.log(`\n--prova: NESSUNA scrittura eseguita. Le ${scritture.length} scritture sarebbero state:`)
  for (const s of scritture) console.log(` · ${s}`)
}
process.exit(esito.ok ? 0 : 1)
