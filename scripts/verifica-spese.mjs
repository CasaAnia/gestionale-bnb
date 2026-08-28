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
//   Confronto tra DUE export (Fase 2A): riferimento ↔ candidato,
//   ID per ID e campo per campo su tutte le tabelle, più relazioni,
//   duplicati, file+hash (se presenti) e totali per ambito:
//   node scripts/verifica-spese.mjs --confronta /rif /candidato
//     [--consenti-aggiunte]   # i record NUOVI nel candidato non sono errore
//     [--campi-del-riferimento] # confronta SOLO i campi del riferimento:
//        per verificare una migrazione ADDITIVA (colonne nuove nel candidato
//        ammesse; i campi storici devono restare identici)
//   Il riepilogo mostra id e NOMI dei campi, mai i contenuti (privacy).
//
// Esce con codice 1 se anche una sola verifica fallisce.
// Il riepilogo mostra SOLO conteggi e totali aggregati: mai nomi, negozi,
// descrizioni o altri dati personali.
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (args[0] === '--confronta') {
  const [rif, cand] = args.slice(1).filter(a => !a.startsWith('--'))
  const consentiAggiunte = args.includes('--consenti-aggiunte')
  const campiRif = args.includes('--campi-del-riferimento')
  process.exit(await confronta(rif, cand, consentiAggiunte, campiRif))
}

const BACKUP = args.filter(a => !a.startsWith('--'))[0] ||
  '/Users/amerigogranata/Desktop/Backup completo spese prima del rifacimento 2026-08-27'
// --manifest <file>: usa i valori attesi di un manifest (es. la fixture
// anonimizzata della Fase 2B) al posto di quelli reali scritti sotto.
const iManifest = args.indexOf('--manifest')
const MANIFEST = iManifest >= 0 ? args[iManifest + 1] : null

// ============================================================================
// CONFRONTO riferimento ↔ candidato — ID per ID, campo per campo
// ============================================================================
async function confronta(rifDir, candDir, consentiAggiunte, campiRif = false) {
  const { createHash } = await import('node:crypto')
  const { readdirSync, statSync } = await import('node:fs')
  const TAB = ['family_groups', 'family_categories', 'family_subcategories', 'family_expenses',
    'family_expense_items', 'family_receipts', 'family_budgets', 'family_product_rules']
  if (!rifDir || !candDir) { console.error('Servono due cartelle: --confronta /riferimento /candidato'); return 1 }
  console.log(`Confronto\n  riferimento: ${rifDir}\n  candidato:   ${candDir}\n`)
  const cent = n => Math.round(Number(n) * 100)
  let errori = 0
  const err = m => { console.log('  ✗ ' + m); errori++ }
  const ok = m => console.log('  ✓ ' + m)

  const leggi = (dir, t) => {
    const f = join(dir, 'tabelle', `${t}.json`)
    if (!existsSync(f)) return null
    return JSON.parse(readFileSync(f, 'utf8'))
  }

  const tabelle = {}
  for (const t of TAB) {
    console.log(t)
    const rif = leggi(rifDir, t), cand = leggi(candDir, t)
    if (!rif || !cand) { err(`file mancante (${!rif ? 'riferimento' : 'candidato'})`); continue }
    tabelle[t] = { rif, cand }

    // duplicati di id (in entrambi)
    for (const [nome, lista] of [['riferimento', rif], ['candidato', cand]]) {
      const visti = new Set(); const dup = []
      for (const r of lista) { if (visti.has(r.id)) dup.push(r.id); visti.add(r.id) }
      if (dup.length) err(`id DUPLICATI nel ${nome}: ${dup.join(', ')}`)
    }

    const perIdCand = new Map(cand.map(r => [r.id, r]))
    const perIdRif = new Map(rif.map(r => [r.id, r]))
    // mancanti (nel candidato) e campi modificati, ID per ID e campo per campo
    let mancanti = 0, modificati = 0
    for (const r of rif) {
      const c = perIdCand.get(r.id)
      if (!c) { err(`record MANCANTE nel candidato: ${r.id}`); mancanti++; continue }
      const campi = campiRif ? new Set(Object.keys(r)) : new Set([...Object.keys(r), ...Object.keys(c)])
      const diff = [...campi].filter(k => JSON.stringify(r[k] ?? null) !== JSON.stringify(c[k] ?? null))
      if (diff.length) { err(`record MODIFICATO ${r.id}: campi [${diff.join(', ')}]`); modificati++ }
    }
    // aggiunti (nel candidato)
    const aggiunti = cand.filter(r => !perIdRif.has(r.id))
    if (aggiunti.length) {
      const m = `${aggiunti.length} record AGGIUNTI nel candidato`
      if (consentiAggiunte) console.log('  ⚠ ' + m + ' (consentiti)')
      else err(m + `: ${aggiunti.slice(0, 5).map(r => r.id).join(', ')}${aggiunti.length > 5 ? '…' : ''}`)
    }
    if (!mancanti && !modificati && (!aggiunti.length || consentiAggiunte))
      ok(`${rif.length} record del riferimento tutti presenti e identici`)
  }

  // relazioni nel candidato (righe orfane, riferimenti spezzati)
  console.log('Relazioni nel candidato')
  const C = t => tabelle[t]?.cand || []
  const ids = t => new Set(C(t).map(r => r.id))
  const idSpese = ids('family_expenses'), idGruppi = ids('family_groups')
  const idCategorie = ids('family_categories'), idDocs = ids('family_receipts')
  const orfane = C('family_expense_items').filter(i => !idSpese.has(i.expense_id))
  if (orfane.length) err(`righe con spesa inesistente (relazione SPEZZATA): ${orfane.map(i => i.id).join(', ')}`)
  else ok('ogni riga appartiene a una spesa esistente')
  const rotte = C('family_expenses').filter(e =>
    (e.group_id != null && !idGruppi.has(e.group_id)) ||
    (e.category_id != null && !idCategorie.has(e.category_id)) ||
    (e.receipt_id != null && !idDocs.has(e.receipt_id)))
  if (rotte.length) err(`spese con riferimenti spezzati: ${rotte.map(e => e.id).join(', ')}`)
  else ok('gruppi, categorie e documenti delle spese tutti esistenti')

  // differenze economiche: totali per ambito (in centesimi)
  console.log('Totali economici')
  const totali = lato => {
    const g = new Map((lato === 'rif' ? tabelle.family_groups?.rif : C('family_groups')).map(x => [x.id, x.ambito || 'personale']))
    const spese = lato === 'rif' ? tabelle.family_expenses?.rif : C('family_expenses')
    const out = { personale: 0, azienda: 0 }
    for (const e of spese || []) out[e.group_id ? (g.get(e.group_id) ?? 'personale') : 'personale'] += cent(e.amount)
    return out
  }
  const tr = totali('rif'), tc = totali('cand')
  for (const amb of ['personale', 'azienda']) {
    if (consentiAggiunte ? tc[amb] < tr[amb] : tc[amb] !== tr[amb])
      err(`DIFFERENZA ECONOMICA ${amb}: riferimento ${tr[amb]} cent, candidato ${tc[amb]} cent`)
    else ok(`${amb}: ${tc[amb]} cent${tc[amb] !== tr[amb] ? ' (aggiunte consentite)' : ''}`)
  }

  // file + hash (solo se ENTRAMBI hanno la cartella scontrini/)
  const dirR = join(rifDir, 'scontrini'), dirC = join(candDir, 'scontrini')
  if (existsSync(dirR) && existsSync(dirC)) {
    console.log('File')
    const walk = d => readdirSync(d, { recursive: true }).filter(f => statSync(join(d, f)).isFile())
    const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex')
    const fr = new Set(walk(dirR)), fc = new Set(walk(dirC))
    let fOk = true
    for (const f of fr) {
      if (!fc.has(f)) { err(`file MANCANTE nel candidato: ${f}`); fOk = false }
      else if (sha(join(dirR, f)) !== sha(join(dirC, f))) { err(`file MODIFICATO (hash diverso): ${f}`); fOk = false }
    }
    const inPiu = [...fc].filter(f => !fr.has(f))
    if (inPiu.length && !consentiAggiunte) { err(`${inPiu.length} file aggiunti nel candidato`); fOk = false }
    if (fOk) ok(`${fr.size} file tutti presenti con hash identico`)
  } else {
    console.log('File: cartella scontrini assente da uno dei due lati — confronto file saltato')
  }

  console.log('')
  if (errori > 0) { console.error(`ESITO CONFRONTO: ${errori} differenze. NON procedere.`); return 1 }
  console.log('ESITO CONFRONTO: nessuna differenza sui dati storici.')
  return 0
}

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
if (MANIFEST) Object.assign(ATTESI, JSON.parse(readFileSync(MANIFEST, 'utf8')).attesi)

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

// ---- 9. File del backup (saltato se l'export non ha la cartella scontrini) ----
if (existsSync(join(BACKUP, 'scontrini'))) {
  console.log('File')
  const mancanti = documenti.filter(r => !existsSync(join(BACKUP, 'scontrini', r.storage_path)))
  check('ogni documento ha il suo file nel backup', mancanti.length === 0,
    `${documenti.length - mancanti.length}/${documenti.length}`)
} else {
  console.log('File: cartella scontrini assente in questo export — controllo saltato')
}

// ---- Esito ----
console.log('')
if (falliti > 0) {
  console.error(`ESITO: ${falliti} verifiche FALLITE. Non proseguire: confronta col backup.`)
  process.exit(1)
}
console.log('ESITO: tutte le verifiche superate. I dati economici sono intatti.')
