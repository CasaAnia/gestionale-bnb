#!/usr/bin/env node
// ============================================================================
// ELABORAZIONE «SOLO BOZZE» — lo strumento del RUNBOOK
// (RUNBOOK-ELABORAZIONE-BOZZE.md): prende l'id del documento e il file
// JSON della LETTURA (prodotta dall'assistente guardando le foto) e usa
// il modulo collaudato lib/spese/elaborazioneBozze per scrivere SOLO
// bozze, MAI spese definitive.
//
// SCRITTURE: esclusivamente attraverso il PRIMITIVO ATOMICO — la RPC
// `elabora_sostituisci_bozze` della migrazione 0023 (PROPOSTA, da
// applicare a mano con autorizzazione separata). Qui non esiste alcuna
// DELETE/INSERT/PATCH diretta sulle tabelle: senza quella RPC lo
// strumento NON PUÒ scrivere nulla, nemmeno attivato per sbaglio
// (revisione R1: niente compensazioni REST spacciate per atomicità).
// Le letture REST restano confinate alla whitelist qui sotto e sono di
// SOLA lettura (il metodo HTTP non è configurabile).
//
// CANCELLO DI ATTIVAZIONE: finché il flusso non è autorizzato
// dall'utente, lo script SI RIFIUTA di fare QUALSIASI cosa — anche
// --prova, perché legge il database vero col service role (revisione
// R3). Serve ELABORAZIONE_BOZZE_ATTIVA=1 nell'ambiente del comando (mai
// nel file .env). Con --prova esegue tutto tranne la scrittura (mostra
// la chiamata atomica che verrebbe inviata).
//
// Uso: ELABORAZIONE_BOZZE_ATTIVA=1 node scripts/elabora/elabora-bozze.mjs <documentId> <lettura.json> [--prova]
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
  console.error('Uso: ELABORAZIONE_BOZZE_ATTIVA=1 node scripts/elabora/elabora-bozze.mjs <documentId> <lettura.json> [--prova]')
  process.exit(1)
}
const soloProva = flag === '--prova'
// il cancello vale per TUTTO, --prova compreso: anche solo leggere il
// database vero col service role è un passaggio remoto da autorizzare
if (process.env.ELABORAZIONE_BOZZE_ATTIVA !== '1') {
  console.error(`STOP: il flusso «solo bozze» NON è ancora attivato (scheda: attivazione DA AUTORIZZARE).
Vale anche per --prova: legge il database vero col service role. Dopo il via
libera esplicito dell'utente: ELABORAZIONE_BOZZE_ATTIVA=1 davanti al comando.
Le scritture restano comunque impossibili finché la migrazione 0023 (RPC
atomica) non è applicata e collaudata con la SUA autorizzazione.`)
  process.exit(1)
}

const { url, chiave } = ambiente()
const { elaboraDocumento } = await import(resolve(RADICE, 'lib/spese/elaborazioneBozze.ts'))

const intestazioni = {
  apikey: chiave, Authorization: `Bearer ${chiave}`,
  'Content-Type': 'application/json',
}

// LETTURE REST sulla whitelist e basta: niente metodo configurabile,
// quindi da qui non parte alcuna scrittura di tabella
const TABELLE_IN_LETTURA = new Set(['family_documents', 'family_receipts', 'family_groups', 'family_canonical_subcategories'])
async function leggiRest(tabella, percorso) {
  if (!TABELLE_IN_LETTURA.has(tabella)) throw new Error(`tabella fuori perimetro: ${tabella}`)
  const r = await fetch(`${url}/rest/v1/${tabella}${percorso}`, { headers: intestazioni })
  const testo = await r.text()
  if (!r.ok) return { errore: `${r.status}: ${testo.slice(0, 200)}` }
  try { return { dati: JSON.parse(testo) } } catch { return { dati: [] } }
}

// l'UNICA scrittura possibile: la RPC atomica della migrazione 0023
const RPC_CONSENTITE = new Set(['elabora_sostituisci_bozze'])
async function rpc(nome, corpo) {
  if (!RPC_CONSENTITE.has(nome)) throw new Error(`RPC fuori perimetro: ${nome}`)
  const r = await fetch(`${url}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: intestazioni, body: JSON.stringify(corpo),
  })
  const testo = await r.text()
  if (r.status === 404)
    return { errore: `contratto database ASSENTE: la RPC ${nome} non esiste — la migrazione 0023 va applicata e collaudata con autorizzazione separata; senza di essa questo strumento non scrive nulla` }
  if (!r.ok) return { errore: `${r.status}: ${testo.slice(0, 200)}` }
  try { return { dati: JSON.parse(testo) } } catch { return { errore: `risposta RPC non interpretabile: ${testo.slice(0, 120)}` } }
}

// il pacchetto per la RPC: ogni bozza porta le SUE righe (il legame
// bozzaRif→draft_id lo fa la transazione, non il client)
function corpoRpc(documentId, richiesta) {
  if (richiesta.errore !== undefined)
    return { p_document_id: documentId, p_stati_ammessi: richiesta.statiAmmessi, p_pacchetto: null, p_errore: richiesta.errore }
  const { pacchetto } = richiesta
  const bozze = pacchetto.bozze.map(({ rif, ...campi }) => ({
    ...campi,
    confidence: campi.confidence ?? {},
    righe: pacchetto.righe.filter(r => r.bozzaRif === rif).map(({ bozzaRif, ...riga }) => {
      void bozzaRif
      return { ...riga, confidence: riga.confidence ?? {} }
    }),
  }))
  return {
    p_document_id: documentId, p_stati_ammessi: richiesta.statiAmmessi,
    p_pacchetto: { doc_total: pacchetto.documento.doc_total, bozze }, p_errore: null,
  }
}

const chiamateSimulate = []
const scrittore = {
  async leggiDocumento(id) {
    const r = await leggiRest('family_documents', `?id=eq.${id}&select=status,note`)
    if (r.errore) return { errore: r.errore }
    if (!r.dati[0]) return { errore: 'documento inesistente' }
    return { documento: r.dati[0] }
  },
  async sostituisciBozze(id, richiesta) {
    const corpo = corpoRpc(id, richiesta)
    if (soloProva) {
      chiamateSimulate.push(corpo)
      const bozze = corpo.p_pacchetto?.bozze ?? []
      return { ok: true, bozze: bozze.length, righe: bozze.reduce((n, b) => n + b.righe.length, 0) }
    }
    const r = await rpc('elabora_sostituisci_bozze', corpo)
    if (r.errore) return { ok: false, errore: r.errore }
    const esito = r.dati
    if (!esito || typeof esito.ok !== 'boolean')
      return { ok: false, errore: `esito RPC senza ok: ${JSON.stringify(esito).slice(0, 120)}` }
    if (!esito.ok) return { ok: false, statoAttuale: esito.stato_attuale ?? undefined, errore: esito.errore ?? 'errore non dichiarato dalla RPC' }
    return { ok: true, bozze: esito.bozze ?? 0, righe: esito.righe ?? 0 }
  },
}

// contesto: gruppi e sottocategorie canoniche dal database, la nota dal
// documento, i possibili duplicati dallo sha256 delle ricevute
const gruppi = await leggiRest('family_groups', '?select=id,ambito')
const sottoCanoniche = await leggiRest('family_canonical_subcategories', '?select=id,canonical_category_id')
if (gruppi.errore || sottoCanoniche.errore) {
  console.error('STOP: contesto non leggibile:', gruppi.errore ?? sottoCanoniche.errore); process.exit(1)
}
const docCorrente = await scrittore.leggiDocumento(documentId)
if (docCorrente.errore) { console.error('STOP: documento non leggibile:', docCorrente.errore); process.exit(1) }

// VERIFICA DUPLICATI: un errore qui è uno STOP, mai «nessun duplicato»
// (revisione R3) — e le ricevute senza impronta diventano un dubbio
const mie = await leggiRest('family_receipts', `?document_id=eq.${documentId}&select=file_sha256`)
if (mie.errore) { console.error('STOP: verifica duplicati fallita (lettura ricevute):', mie.errore); process.exit(1) }
let duplicato = null
const ricevute = mie.dati ?? []
const shas = ricevute.map(x => x.file_sha256).filter(Boolean)
if (ricevute.length && shas.length < ricevute.length) {
  duplicato = { messaggio: 'verifica duplicati incompleta: ricevute senza impronta sha256 — controllo manuale' }
} else if (shas.length) {
  const uguali = await leggiRest('family_receipts', `?file_sha256=in.(${shas.map(s => `"${s}"`).join(',')})&document_id=neq.${documentId}&select=document_id`)
  if (uguali.errore) { console.error('STOP: verifica duplicati fallita (ricerca impronte):', uguali.errore); process.exit(1) }
  if ((uguali.dati ?? []).length)
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
  console.log(`\n--prova: NESSUNA scrittura eseguita. La chiamata atomica sarebbe stata:`)
  for (const c of chiamateSimulate) console.log(JSON.stringify(c, null, 2))
}
process.exit(esito.ok ? 0 : 1)
