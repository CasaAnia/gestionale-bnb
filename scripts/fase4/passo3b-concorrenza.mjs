#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 3B: CONCORRENZA VERA della RPC con
// connessioni INDIPENDENTI e sovrapposizione VERIFICABILE.
// *** PREPARATO, NON ANCORA ESEGUITO: richiede il prossimo accesso remoto
// autorizzato (token temporaneo + passo0). ***
//
// Ogni ramo misura pid, inizio e fine ATTORNO alla chiamata dentro una
// funzione temporanea che cattura anche gli errori ATTESI (TOKEN_RIUSATO,
// GIA_IN_ARCHIVIO): le misure ci sono sempre. La prova è VALIDA solo con
// pid diversi e finestre intersecate (concorrenza.mjs), altrimenti NON
// VALIDA e va ripetuta — mai verdi da esecuzioni sequenziali.
// NB: casi della RPC 0022 — nulla a che vedere con le vecchie prove
// concorrenti di conferma/pagamento della 0020 (test-rpc 2B).
// ============================================================================
import { randomUUID, createHash } from 'node:crypto'
import { sql, maschera, progetto } from '../fase2b/api.mjs'
import { nuovoRegistro } from './registro.mjs'
import { batchRamo, provaValida } from './concorrenza.mjs'

const registro = nuovoRegistro('concorrenza')
console.log('Bersaglio:', maschera(progetto().ref), '· registro:', registro.file)

let passati = 0, falliti = 0, nonValidi = 0
const esito = (nome, ok, dettaglio = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nome}${dettaglio ? ' — ' + dettaglio : ''}`)
  ok ? passati++ : falliti++
}
const sha = (s) => createHash('sha256').update(s).digest('hex')
const SALE = randomUUID()
const GIORNO = '2026-09-05'
const percorso = (tok) => `${GIORNO}/${tok}-p1.jpg`
const pagina = (tok, impronta) =>
  `{"storage_path":"${percorso(tok)}","page_order":1,"mime_type":"image/jpeg","file_sha256":"${impronta}"}`

const [{ user_id: OWNER }] = await sql(`select user_id from public.app_members where role='owner' limit 1`)
const claims = `select set_config('request.jwt.claims',
  json_build_object('sub','${OWNER}','role','authenticated')::text, true);`
const rpc = (tok, kind, ambito, nota, pagineJson) =>
  `public.registra_documento_caricato('${tok}'::uuid,'${kind}','${ambito}',
    ${nota === null ? 'null' : `'${nota}'`}, '[${pagineJson}]'::jsonb)`

// un ramo: misure SEMPRE presenti (anche su errore atteso); la nota viene
// conservata nel risultato per confrontare il vincitore del caso B
async function ramo(nota, chiamataSql) {
  try {
    const [riga] = await sql(batchRamo(claims, chiamataSql))
    return { pid: riga.pid, prima: riga.prima, dopo: riga.dopo, r: riga.r, errore: riga.errore ?? null, nota }
  } catch (e) {
    // errore di TRASPORTO (non della RPC): niente misure → prova non valida
    return { trasporto: String(e.message), nota }
  }
}
function valuta(nome, a, b, controlli) {
  if (a.trasporto || b.trasporto) {
    nonValidi++
    console.log(`~ ${nome} NON VALIDO (errore di trasporto): ${a.trasporto ?? b.trasporto}`)
    return
  }
  const v = provaValida(a, b)
  if (!v.valida) { nonValidi++; console.log(`~ ${nome} NON VALIDO: ${v.motivo} — ripetere`); return }
  controlli()
}

// ---- caso A: stesso token e stesso manifesto → stesso documento ------------
{
  const T = randomUUID(); registro.annota('tokens', T)
  const S = sha(`conc-${SALE}-A`)
  const [a, b] = await Promise.all([
    ramo('conc-a', rpc(T, 'scontrino', 'personale', 'conc-a', pagina(T, S))),
    ramo('conc-a', rpc(T, 'scontrino', 'personale', 'conc-a', pagina(T, S))),
  ])
  registro.annota('documenti', a.r?.document_id); registro.annota('documenti', b.r?.document_id)
  valuta('caso A', a, b, async () => {
    const docs = await sql(`select count(*) as n from public.family_documents where upload_token='${T}'`)
    esito('A stesso token+manifesto: entrambe riuscite, STESSO documento, una sola registrazione',
      !a.errore && !b.errore && a.r?.document_id && a.r.document_id === b.r?.document_id
      && [a.r.ripetuta, b.r.ripetuta].sort().join() === 'false,true' && docs[0].n === 1,
      JSON.stringify({ pids: [a.pid, b.pid], a: a.r, b: b.r }))
  })
}

// ---- caso B: stesso token, manifesti DIVERSI → uno solo accettato ----------
{
  const T = randomUUID(); registro.annota('tokens', T)
  const S = sha(`conc-${SALE}-B`)
  const [a, b] = await Promise.all([
    ramo('nota UNO', rpc(T, 'scontrino', 'personale', 'nota UNO', pagina(T, S))),
    ramo('nota DUE', rpc(T, 'scontrino', 'personale', 'nota DUE', pagina(T, S))),
  ])
  registro.annota('documenti', a.r?.document_id); registro.annota('documenti', b.r?.document_id)
  valuta('caso B', a, b, async () => {
    const vincitori = [a, b].filter(x => x.r?.document_id && !x.errore)
    const perdenti = [a, b].filter(x => x.errore)
    const [doc] = await sql(`select note from public.family_documents where upload_token='${T}'`)
    // la nota salvata deve essere quella del ramo che HA VINTO, non una
    // qualunque delle due
    esito('B stesso token, manifesti diversi: UNO accettato, l\'altro TOKEN_RIUSATO, nota del VINCITORE riscontrata',
      vincitori.length === 1 && perdenti.length === 1
      && perdenti[0].errore.includes('TOKEN_RIUSATO')
      && doc?.note === vincitori[0].nota,
      JSON.stringify({ pids: [a.pid, b.pid], vinta: doc?.note, attesa: vincitori[0]?.nota, perdente: perdenti[0]?.errore?.slice(0, 40) }))
  })
}

// ---- caso C: token diversi, STESSA impronta → un documento, zero vuoti -----
{
  const T1 = randomUUID(), T2 = randomUUID()
  registro.annota('tokens', T1); registro.annota('tokens', T2)
  const S = sha(`conc-${SALE}-C`)
  const prima = (await sql(`select count(*) as n from public.family_documents`))[0].n
  const [a, b] = await Promise.all([
    ramo(null, rpc(T1, 'scontrino', 'personale', null, pagina(T1, S))),
    ramo(null, rpc(T2, 'scontrino', 'personale', null, pagina(T2, S))),
  ])
  registro.annota('documenti', a.r?.document_id); registro.annota('documenti', b.r?.document_id)
  valuta('caso C', a, b, async () => {
    const dopo = (await sql(`select count(*) as n from public.family_documents`))[0].n
    const vinte = [a, b].filter(x => x.r?.document_id && !x.errore)
    const perse = [a, b].filter(x => x.errore)
    esito('C token diversi, stessa impronta: UN documento valido, GIA_IN_ARCHIVIO all\'altro, NESSUN documento vuoto',
      vinte.length === 1 && perse.length === 1 && perse[0].errore.includes('GIA_IN_ARCHIVIO')
      && dopo === prima + 1,
      JSON.stringify({ pids: [a.pid, b.pid], documenti: `${prima}→${dopo}` }))
  })
}

console.log(`\nPASSO 3B: ${passati} passati, ${falliti} falliti, ${nonValidi} non validi (da ripetere)`)
process.exit(falliti || nonValidi ? 1 : 0)
