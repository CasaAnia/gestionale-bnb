#!/usr/bin/env node
// ============================================================================
// IMPORTAZIONE DELLE BOLLETTE GAS (Ania, 30/09/2026) — scripts/bollette
//
// Per ogni bolletta di bollette-gas.json:
//   1. documento `fattura` con fornitore, numero, data, SCADENZA e nota
//      (prima riga = titolo della voce in «Da controllare»);
//   2. il PDF nel bucket `scontrini` col percorso della 0022
//      (<AAAA-MM-GG>/<token>-p1.pdf, mai sovrascritto) e la ricevuta con
//      l'impronta sha256;
//   3. la bozza (gruppo Casa / Casa Ania, sottocategoria «Gas») scritta
//      con la STESSA via del flusso scontrini: costruisciPacchettoBozze +
//      la RPC atomica `elabora_sostituisci_bozze` (0023) → documento
//      «in_revisione» con il totale;
//   4. la categoria «Utenze» del gruppo sulla bozza e sulla riga (la RPC
//      della 0023 non porta category_id: senza, la spesa finirebbe in
//      «senza categoria»).
// Nessuna spesa definitiva: la crea solo Ania con «Segna pagata»
// (conferma_fattura_pagata / paga_fattura, da utente collegato).
//
// IDEMPOTENTE: chiave = fornitore + numero bolletta. Una bolletta già
// elaborata si salta; una rimasta a metà (documento senza bozze) si
// completa senza doppioni (impronta unica, percorso derivato dal token).
//
// Uso:
//   node scripts/bollette/importa-bollette.mjs            → PROVA: legge e mostra l'anteprima, non scrive
//   BOLLETTE_IMPORTA=1 node scripts/bollette/importa-bollette.mjs --scrivi
//   node scripts/bollette/importa-bollette.mjs --verifica → rilegge dal database e confronta
// ============================================================================
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { resolve, dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const QUI = dirname(fileURLToPath(import.meta.url))
const RADICE = resolve(QUI, '..', '..')
const modo = process.argv.includes('--scrivi') ? 'scrivi' : process.argv.includes('--verifica') ? 'verifica' : 'prova'
if (modo === 'scrivi' && process.env.BOLLETTE_IMPORTA !== '1') {
  console.error('STOP: la scrittura vuole BOLLETTE_IMPORTA=1 davanti al comando (dopo l\'ok di Ania all\'anteprima).')
  process.exit(1)
}

const testoEnv = readFileSync(resolve(RADICE, '.env.local'), 'utf8')
const env = nome => testoEnv.match(new RegExp(`^${nome}=(.+)$`, 'm'))?.[1]?.trim()
const url = env('NEXT_PUBLIC_SUPABASE_URL')
const chiave = env('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !chiave) { console.error('STOP: .env.local senza URL o service key'); process.exit(1) }
const H = { apikey: chiave, Authorization: `Bearer ${chiave}` }

const { costruisciPacchettoBozze } = await import(resolve(RADICE, 'lib/spese/elaborazioneBozze.ts'))

const dati = JSON.parse(readFileSync(join(QUI, 'bollette-gas.json'), 'utf8'))
const cartella = dati.cartellaPdf.replace(/^~/, homedir())

// ── piccoli aiuti ───────────────────────────────────────────────────────────
const euro = n => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const gma = iso => iso.split('-').reverse().join('/')
const cent = n => Math.round(n * 100)
const oggi = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })

async function leggi(percorso) {
  const r = await fetch(`${url}/rest/v1/${percorso}`, { headers: H })
  const t = await r.text()
  if (!r.ok) throw new Error(`lettura ${percorso.split('?')[0]}: ${r.status} ${t.slice(0, 200)}`)
  return JSON.parse(t)
}
async function scrivi(metodo, percorso, corpo) {
  if (modo !== 'scrivi') throw new Error('scrittura in modalità prova')
  const r = await fetch(`${url}/rest/v1/${percorso}`, {
    method: metodo, headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(corpo),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${metodo} ${percorso.split('?')[0]}: ${r.status} ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

// ── le righe che nascono da una bolletta ────────────────────────────────────
function fornituraDi(b) {
  const f = dati.forniture[`${b.fornitore}|${b.casa}`]
  if (!f) throw new Error(`bolletta ${b.n}: fornitura sconosciuta ${b.fornitore}|${b.casa}`)
  return f
}
export function notaBolletta(b) {
  const f = fornituraDi(b)
  return [
    `Bolletta gas ${f.breve} · ${b.casa}`,
    `Bolletta n. ${b.numero} · periodo ${gma(b.dal)}–${gma(b.al)}`,
    f.riga,
    ...(b.notaExtra ? [b.notaExtra] : []),
  ].join('\n')
}
function lettura(b, gruppoId, nota) {
  const f = fornituraDi(b)
  return {
    totale: b.importo,
    notaApplicata: { nota, effetto: { tipo: 'gruppo_unico', group_id: gruppoId }, come: `bolletta gas di ${b.casa}: tutto al gruppo ${f.gruppo}` },
    sorelle: [{
      ambito: f.ambito, destinatario: gruppoId, data: b.emessa, negozio: b.fornitore,
      // per Casa Ania il metodo è obbligatorio già in bozza: al pagamento lo
      // sostituisce quello scelto in «Segna pagata» (contanti o bonifico)
      metodo: f.ambito === 'azienda' ? 'bonifico' : null,
      natura: 'ricorrente',
      voci: [{ raw_name: `Bolletta n. ${b.numero}`, name: `Gas ${gma(b.dal)}–${gma(b.al)}`, qty: 1, amount: b.importo, sottocategoria: 'Gas' }],
    }],
  }
}

// ── contesto dal database ───────────────────────────────────────────────────
const gruppi = await leggi('family_groups?select=id,name,ambito')
const categorie = await leggi('family_categories?select=id,name,group_id')
const gruppoPer = nome => gruppi.find(g => g.name === nome) ?? (() => { throw new Error(`gruppo «${nome}» assente`) })()
const utenzePer = gid => categorie.find(c => c.group_id === gid && c.name === 'Utenze') ?? (() => { throw new Error(`categoria Utenze assente per ${gid}`) })()

async function documentoDi(b) {
  const r = await leggi(`family_documents?kind=eq.fattura&supplier=eq.${encodeURIComponent(b.fornitore)}&invoice_number=eq.${b.numero}&select=id,status,doc_total,due_date,document_date,upload_token,upload_ambito,note`)
  if (r.length > 1) throw new Error(`bolletta ${b.n}: ${r.length} documenti con la stessa chiave — controllo a mano`)
  return r[0] ?? null
}

// ── PROVA / SCRITTURA ───────────────────────────────────────────────────────
const righeAnteprima = []
const problemi = []
for (const b of dati.bollette) {
  const f = fornituraDi(b)
  const gruppo = gruppoPer(f.gruppo)
  if (gruppo.ambito !== f.ambito) throw new Error(`bolletta ${b.n}: il gruppo ${f.gruppo} è ${gruppo.ambito}, atteso ${f.ambito}`)
  const utenze = utenzePer(gruppo.id)
  const nota = notaBolletta(b)
  let pdf = null
  if (b.pdf) {
    const byte = readFileSync(join(cartella, b.pdf))
    pdf = { byte, sha: createHash('sha256').update(byte).digest('hex') }
  }
  const esistente = await documentoDi(b)
  const conStessaImpronta = pdf ? await leggi(`family_receipts?file_sha256=eq.${pdf.sha}&select=id,document_id`) : []
  const impronteAltrui = conStessaImpronta.filter(x => x.document_id !== esistente?.id)
  if (impronteAltrui.length) problemi.push(`bolletta ${b.n}: lo stesso PDF è già collegato al documento ${impronteAltrui[0].document_id}`)

  // il pacchetto si costruisce SEMPRE (anche in prova): è la stessa verifica della scrittura
  const prova = costruisciPacchettoBozze(lettura(b, gruppo.id, nota), { documentId: esistente?.id ?? 'anteprima', gruppi: gruppi.map(g => ({ id: g.id, ambito: g.ambito })), sottoCanoniche: [], nota })
  if (!prova.ok) problemi.push(`bolletta ${b.n}: pacchetto rifiutato — ${prova.errore}`)

  const stato = !esistente ? 'nuova' : ['da_elaborare', 'errore'].includes(esistente.status) ? 'da completare' : `già presente (${esistente.status})`
  righeAnteprima.push({ b, f, stato, pdf: b.pdf ?? 'senza PDF', id: esistente?.id })

  if (modo !== 'scrivi' || stato.startsWith('già') || impronteAltrui.length || !prova.ok) continue

  // 1. documento
  let doc = esistente
  if (!doc) {
    ;[doc] = await scrivi('POST', 'family_documents', {
      kind: 'fattura', supplier: b.fornitore, invoice_number: b.numero, document_date: b.emessa, due_date: b.scadenza,
      note: nota, upload_ambito: f.ambito, upload_token: randomUUID(),
    })
  }
  // 2. PDF e ricevuta
  if (pdf) {
    const ricevute = await leggi(`family_receipts?document_id=eq.${doc.id}&select=id,file_sha256`)
    if (!ricevute.length) {
      const percorso = `${oggi}/${doc.upload_token}-p1.pdf`
      const su = await fetch(`${url}/storage/v1/object/scontrini/${percorso}`, {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: pdf.byte,
      })
      // 409/400 «già esiste»: un giro precedente l'ha caricato (stesso token = stesso percorso)
      if (!su.ok) {
        const t = await su.text()
        if (!/exists|Duplicate/i.test(t)) throw new Error(`bolletta ${b.n}: caricamento PDF ${su.status} ${t.slice(0, 200)}`)
      }
      await scrivi('POST', 'family_receipts', {
        storage_path: percorso, document_id: doc.id, page_order: 1, mime_type: 'application/pdf', file_sha256: pdf.sha,
        ambito: f.ambito, status: 'letto', processed_at: new Date().toISOString(), note: `PDF ${b.pdf}`,
      })
    }
  }
  // 3. bozza con la RPC atomica del flusso scontrini
  const pac = costruisciPacchettoBozze(lettura(b, gruppo.id, nota), { documentId: doc.id, gruppi: gruppi.map(g => ({ id: g.id, ambito: g.ambito })), sottoCanoniche: [], nota })
  if (!pac.ok) throw new Error(`bolletta ${b.n}: ${pac.errore}`)
  const bozze = pac.pacchetto.bozze.map(({ rif, ...campi }) => ({
    ...campi, confidence: campi.confidence ?? {},
    righe: pac.pacchetto.righe.filter(r => r.bozzaRif === rif).map(({ bozzaRif, ...riga }) => { void bozzaRif; return { ...riga, confidence: riga.confidence ?? {} } }),
  }))
  const esito = await scrivi('POST', 'rpc/elabora_sostituisci_bozze', { p_document_id: doc.id, p_pacchetto: { doc_total: pac.pacchetto.documento.doc_total, bozze }, p_errore: null })
  if (!esito?.ok) throw new Error(`bolletta ${b.n}: RPC ${JSON.stringify(esito)}`)
  // 4. categoria Utenze del gruppo
  const bozzeScritte = await leggi(`family_draft_expenses?document_id=eq.${doc.id}&select=id`)
  for (const bz of bozzeScritte) {
    await scrivi('PATCH', `family_draft_expenses?id=eq.${bz.id}&category_id=is.null`, { category_id: utenze.id, subcategory: 'Gas' })
    await scrivi('PATCH', `family_draft_items?draft_id=eq.${bz.id}&category_id=is.null`, { category_id: utenze.id })
  }
  console.log(`✓ bolletta ${b.n} scritta (${doc.id})`)
}

// ── anteprima ───────────────────────────────────────────────────────────────
console.log(`\nANTEPRIMA — ${modo === 'scrivi' ? 'dopo la scrittura' : 'nessuna scrittura'}\n`)
for (const { b, f, stato, pdf } of righeAnteprima) {
  const pagata = b.giaPagata ? `GIÀ PAGATA il ${gma(b.giaPagata.il)} (${b.giaPagata.metodo}, ${euro(b.giaPagata.importo)}) → la segna Ania` : 'da pagare'
  console.log(`${String(b.n).padStart(2)}. ${b.casa.padEnd(10)} ${f.ambito.padEnd(9)} ${b.fornitore.padEnd(13)} n. ${b.numero.padEnd(12)} ${euro(b.importo).padStart(9)}  scad. ${gma(b.scadenza)}  ${pagata}  · ${pdf} · ${stato}`)
}
const totali = {}
for (const b of dati.bollette) if (!b.giaPagata) totali[b.casa] = (totali[b.casa] ?? 0) + cent(b.importo)
console.log('')
for (const [casa, c] of Object.entries(totali)) {
  const atteso = cent(dati.totaliAttesi[casa])
  console.log(`Da pagare ${casa}: ${euro(c / 100)} (atteso ${euro(atteso / 100)}) ${c === atteso ? '✓' : '✗ NON COINCIDE'}`)
  if (c !== atteso) problemi.push(`totale ${casa} diverso dall'atteso`)
}

// ── verifica: rilettura dal database ────────────────────────────────────────
if (modo !== 'prova') {
  console.log('\nRILETTURA DAL DATABASE')
  for (const b of dati.bollette) {
    const d = await documentoDi(b)
    if (!d) { console.log(`${b.n}. ✗ assente`); problemi.push(`bolletta ${b.n} assente`); continue }
    const ric = await leggi(`family_receipts?document_id=eq.${d.id}&select=storage_path,file_sha256`)
    const bz = await leggi(`family_draft_expenses?document_id=eq.${d.id}&select=group_id,category_id,subcategory,status,family_draft_items(amount,category_id)`)
    const f = fornituraDi(b)
    const ok = cent(d.doc_total ?? -1) === cent(b.importo) && d.due_date === b.scadenza && d.document_date === b.emessa
      && d.upload_ambito === f.ambito && ric.length === (b.pdf ? 1 : 0) && bz.length === 1
      && bz[0].group_id === gruppoPer(f.gruppo).id && bz[0].category_id === utenzePer(gruppoPer(f.gruppo).id).id
    console.log(`${b.n}. ${ok ? '✓' : '✗'} ${d.id} · ${d.status} · ${euro(Number(d.doc_total))} · scad. ${gma(d.due_date)} · ${d.upload_ambito} · PDF ${ric.length ? 'collegato' : 'nessuno'} · bozza ${bz[0]?.status ?? '—'}`)
    if (!ok) problemi.push(`bolletta ${b.n}: nel database non coincide`)
  }
}

if (problemi.length) { console.log('\nPROBLEMI:\n- ' + problemi.join('\n- ')); process.exit(1) }
console.log('\nTutto coerente.')
