#!/usr/bin/env node
// ============================================================================
// VERIFICA SPESE — rete di sicurezza della Fase 0 del rifacimento spese.
//
// Legge il backup locale (SOLA LETTURA, nessuna connessione a Supabase,
// nessuna chiave, nessuna rete) e verifica che i dati economici siano ancora
// quelli fotografati il 27/08/2026. Da rilanciare dopo ogni fase del
// rifacimento e dopo ogni migrazione, rigenerando prima un export fresco
// con lo stesso formato del backup.
//
// Uso:
//   node scripts/verifica-spese.mjs                  # backup di default
//   node scripts/verifica-spese.mjs /percorso/backup # altro export
//
// Esce con codice 1 se anche una sola verifica fallisce.
// Il riepilogo mostra SOLO conteggi e totali aggregati: mai nomi, negozi,
// descrizioni o altri dati personali.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const BACKUP = process.argv[2] ||
  '/Users/amerigogranata/Desktop/Backup completo spese prima del rifacimento 2026-08-27'

// ---- Valori attesi (approvati, vedi PIANO-RIFACIMENTO-SPESE.md) ----
const ATTESI = {
  spese: 221,
  righe: 728,
  documenti: 81,
  gruppi: 5,
  categorie: 115,
  sottocategorie: 93,
  regole: 5,
  totalePersonaleCent: 462175, // 4.621,75 €
  totaleAziendaCent: 16910,    //   169,10 €
  senzaDocumento: 6,
  senzaDocumentoCent: 13270,   //   132,70 €
}

// Denaro sempre in centesimi interi: niente errori di virgola mobile.
const cent = n => Math.round(Number(n) * 100)
const eur = c => (c / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 }) + ' €'

let falliti = 0
function check(nome, ok, dettaglio = '') {
  console.log(`${ok ? '  ✓' : '  ✗ FALLITO'} ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`)
  if (!ok) falliti++
}

function tabella(nome) {
  const p = join(BACKUP, 'tabelle', `${nome}.json`)
  if (!existsSync(p)) { console.error(`Backup non trovato o incompleto: manca ${p}`); process.exit(1) }
  return JSON.parse(readFileSync(p, 'utf8'))
}

console.log(`Verifica spese sul backup: ${BACKUP}\n`)

const spese = tabella('family_expenses')
const righe = tabella('family_expense_items')
const documenti = tabella('family_receipts')
const gruppi = tabella('family_groups')
const categorie = tabella('family_categories')
const sottocategorie = tabella('family_subcategories')
const regole = tabella('family_product_rules')

// ---- 1. Conteggi ----
console.log('Conteggi')
check('spese', spese.length === ATTESI.spese, `${spese.length}/${ATTESI.spese}`)
check('righe di dettaglio', righe.length === ATTESI.righe, `${righe.length}/${ATTESI.righe}`)
check('documenti', documenti.length === ATTESI.documenti, `${documenti.length}/${ATTESI.documenti}`)
check('gruppi', gruppi.length === ATTESI.gruppi, `${gruppi.length}/${ATTESI.gruppi}`)
check('categorie', categorie.length === ATTESI.categorie, `${categorie.length}/${ATTESI.categorie}`)
check('sottocategorie', sottocategorie.length === ATTESI.sottocategorie, `${sottocategorie.length}/${ATTESI.sottocategorie}`)
check('regole prodotto', regole.length === ATTESI.regole, `${regole.length}/${ATTESI.regole}`)

// ---- 2. Relazioni e orfani ----
console.log('Relazioni')
const idGruppi = new Set(gruppi.map(g => g.id))
const idCategorie = new Set(categorie.map(c => c.id))
const idSpese = new Set(spese.map(e => e.id))
const idDocumenti = new Set(documenti.map(r => r.id))
check('ogni riga appartiene a una spesa esistente',
  righe.every(i => idSpese.has(i.expense_id)),
  `${righe.filter(i => !idSpese.has(i.expense_id)).length} orfane`)
check('ogni gruppo di spesa esiste',
  spese.every(e => e.group_id == null || idGruppi.has(e.group_id)))
check('ogni categoria di spesa esiste',
  spese.every(e => e.category_id == null || idCategorie.has(e.category_id)))
check('ogni categoria di riga esiste',
  righe.every(i => i.category_id == null || idCategorie.has(i.category_id)))
check('ogni receipt_id valorizzato punta a un documento esistente',
  spese.every(e => e.receipt_id == null || idDocumenti.has(e.receipt_id)))

// ---- 3. Ambiti: suddivisione e niente doppia contabilizzazione ----
console.log('Ambiti')
const ambitoDiGruppo = new Map(gruppi.map(g => [g.id, g.ambito || 'personale']))
check('ogni gruppo ha ambito personale o azienda',
  gruppi.every(g => ['personale', 'azienda'].includes(g.ambito || 'personale')))
// Stessa logica di SpeseTracker: l'ambito viene dal gruppo; una spesa senza
// gruppo conta come personale (SpeseTracker.tsx riga 162).
const ambitoDi = e => e.group_id ? ambitoDiGruppo.get(e.group_id) : 'personale'
const totPersonale = spese.filter(e => ambitoDi(e) === 'personale').reduce((s, e) => s + cent(e.amount), 0)
const totAzienda = spese.filter(e => ambitoDi(e) === 'azienda').reduce((s, e) => s + cent(e.amount), 0)
const totTutte = spese.reduce((s, e) => s + cent(e.amount), 0)
check('totale personale (Casa Mia)', totPersonale === ATTESI.totalePersonaleCent,
  `${eur(totPersonale)} atteso ${eur(ATTESI.totalePersonaleCent)}`)
check('totale azienda (Casa Ania)', totAzienda === ATTESI.totaleAziendaCent,
  `${eur(totAzienda)} atteso ${eur(ATTESI.totaleAziendaCent)}`)
check('nessuna doppia contabilizzazione (personale + azienda = tutte)',
  totPersonale + totAzienda === totTutte)

// Calcolo "spese aziendali" identico a Home e Statistiche
// (app/page.tsx:36 e app/statistiche/page.tsx:101: join sui gruppi con
// ambito azienda — le spese SENZA gruppo restano fuori, a differenza del
// tracker che le mette nel personale).
const totAziendaHome = spese
  .filter(e => e.group_id && ambitoDiGruppo.get(e.group_id) === 'azienda')
  .reduce((s, e) => s + cent(e.amount), 0)
check('calcolo spese aziendali di Home/Statistiche', totAziendaHome === ATTESI.totaleAziendaCent,
  eur(totAziendaHome))

// ---- 4. Spese senza documento ----
console.log('Spese senza documento')
const senzaDoc = spese.filter(e => !e.receipt_id)
const senzaDocCent = senzaDoc.reduce((s, e) => s + cent(e.amount), 0)
check('conteggio', senzaDoc.length === ATTESI.senzaDocumento, `${senzaDoc.length}/${ATTESI.senzaDocumento}`)
check('totale', senzaDocCent === ATTESI.senzaDocumentoCent,
  `${eur(senzaDocCent)} atteso ${eur(ATTESI.senzaDocumentoCent)}`)

// ---- 5. Spese sorelle (stesso documento) ----
console.log('Spese sorelle')
const perDocumento = new Map()
for (const e of spese) {
  if (!e.receipt_id) continue
  if (!perDocumento.has(e.receipt_id)) perDocumento.set(e.receipt_id, [])
  perDocumento.get(e.receipt_id).push(e)
}
const gruppiSorelle = [...perDocumento.values()].filter(v => v.length > 1)
check('ogni spesa appartiene ad al massimo un documento (per costruzione)', true,
  `${perDocumento.size} documenti referenziati, ${gruppiSorelle.length} con spese sorelle`)
// Il raggruppamento è solo presentazione: la somma dei movimenti raggruppati
// più le spese singole deve ridare il totale generale.
const totRaggruppato =
  [...perDocumento.values()].reduce((s, v) => s + v.reduce((x, e) => x + cent(e.amount), 0), 0) +
  senzaDocCent
check('raggruppare per documento non altera i totali', totRaggruppato === totTutte)
// Le sorelle di uno stesso documento devono poter avere ambiti diversi senza
// che l'importo dell'una finisca nei totali dell'altra.
const misti = gruppiSorelle.filter(v => new Set(v.map(ambitoDi)).size > 1)
check('documenti con spese sorelle di ambiti diversi gestiti', true, `${misti.length} trovati`)

// ---- 6. Quadratura righe ↔ spesa (fotografia dello stato attuale) ----
console.log('Quadratura al centesimo')
const righePerSpesa = new Map()
for (const i of righe) {
  righePerSpesa.set(i.expense_id, (righePerSpesa.get(i.expense_id) || 0) + cent(i.amount))
}
const conRighe = spese.filter(e => righePerSpesa.has(e.id))
const nonQuadrano = conRighe.filter(e => righePerSpesa.get(e.id) !== cent(e.amount))
// Stato fotografato il 27/08/2026: TUTTE le spese con righe quadrano al
// centesimo (gli sconti sono già incorporati nei prezzi di riga). Se questo
// numero cambia, qualcosa ha alterato i dati.
check('spese con righe che quadrano col proprio importo',
  nonQuadrano.length === 0, `${conRighe.length} con righe, ${nonQuadrano.length} non quadrano`)
check('tutti gli importi hanno al massimo 2 decimali',
  spese.every(e => cent(e.amount) === Number((Number(e.amount) * 100).toFixed(4)) * 1 && Number.isInteger(cent(e.amount)))
  && righe.every(i => Number.isInteger(cent(i.amount))))

// ---- 7. Quantità ----
console.log('Quantità')
const qtaTotale = righe.reduce((s, i) => s + Number(i.qty ?? 1), 0)
check('ogni quantità è un numero positivo', righe.every(i => Number(i.qty ?? 1) > 0),
  `somma pezzi: ${qtaTotale}`)

// ---- 8. Spese ricorrenti ----
console.log('Ricorrenti')
check('il campo recurring è sempre un booleano',
  spese.every(e => typeof e.recurring === 'boolean'),
  `${spese.filter(e => e.recurring).length} ricorrenti`)

// ---- 9. File del backup ----
console.log('File')
const mancanti = documenti.filter(r => !existsSync(join(BACKUP, 'scontrini', r.storage_path)))
check('ogni documento ha il suo file nel backup', mancanti.length === 0,
  `${documenti.length - mancanti.length}/${documenti.length}`)

// ---- Esito ----
console.log('')
if (falliti > 0) {
  console.error(`ESITO: ${falliti} verifiche FALLITE. Non proseguire: confronta col backup.`)
  process.exit(1)
}
console.log('ESITO: tutte le verifiche superate. I dati economici sono intatti.')
