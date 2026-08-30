#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 3B: CONCORRENZA VERA della RPC con
// connessioni INDIPENDENTI e sovrapposizione VERIFICABILE.
// *** PREPARATO, NON ANCORA ESEGUITO: richiede il prossimo accesso remoto
// autorizzato (token temporaneo + passo0). ***
//
// Metodo: due batch lanciati in parallelo (Promise.all) sull'endpoint SQL;
// ogni batch è una connessione/backend a sé. Dentro ogni batch:
//   select pg_sleep(0.5);                      ← allinea le partenze
//   select pg_backend_pid(), clock_timestamp() prima, registra(...),
//          clock_timestamp() dopo
// La sovrapposizione si DIMOSTRA con: pid diversi E intervalli
// [prima, dopo] che si intersecano (altrimenti il test è NON VALIDO e va
// ripetuto: nessuna conclusione da esecuzioni sequenziali).
// NB: questi casi riguardano la RPC della 0022 — nulla a che vedere con le
// vecchie prove concorrenti di conferma/pagamento della 0020 (test-rpc 2B).
// ============================================================================
import { randomUUID, createHash } from 'node:crypto'
import { sql, maschera, progetto } from '../fase2b/api.mjs'
import { nuovoRegistro } from './registro.mjs'

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
const comeOwner = `select set_config('request.jwt.claims',
    json_build_object('sub','${OWNER}','role','authenticated')::text, true);
  set local role authenticated;`

// un ramo concorrente: parte, aspetta mezzo secondo (allineamento), chiama.
// Ritorna pid, finestra temporale ed esito (o l'errore con la sentinella).
async function ramo(tok, kind, ambito, nota, pagineJson) {
  const q = `${comeOwner}
    select pg_sleep(0.5);
    select pg_backend_pid() as pid, clock_timestamp() as prima,
      public.registra_documento_caricato('${tok}'::uuid,'${kind}','${ambito}',
        ${nota === null ? 'null' : `'${nota}'`}, '[${pagineJson}]'::jsonb) as r,
      clock_timestamp() as dopo`
  try {
    const [riga] = await sql(q)
    return { pid: riga.pid, prima: riga.prima, dopo: riga.dopo, r: riga.r }
  } catch (e) {
    return { errore: String(e.message) }
  }
}
// la prova vale SOLO se davvero concorrente: pid diversi e finestre intersecate
function sovrapposti(a, b) {
  if (!a.pid || !b.pid) return true              // un ramo è fallito prima: non giudicabile qui
  if (a.pid === b.pid) return false
  return a.prima <= b.dopo && b.prima <= a.dopo
}

// ---- caso A: stesso token e stesso manifesto → stesso documento ------------
{
  const T = randomUUID(); registro.annota('tokens', T)
  const S = sha(`conc-${SALE}-A`)
  const [a, b] = await Promise.all([
    ramo(T, 'scontrino', 'personale', 'conc-a', pagina(T, S)),
    ramo(T, 'scontrino', 'personale', 'conc-a', pagina(T, S)),
  ])
  registro.annota('documenti', a.r?.document_id); registro.annota('documenti', b.r?.document_id)
  if (!sovrapposti(a, b)) { nonValidi++; console.log('~ caso A NON VALIDO (nessuna sovrapposizione): ripetere') }
  else {
    const docs = await sql(`select count(*) as n from public.family_documents where upload_token='${T}'`)
    esito('A stesso token+manifesto: entrambe riuscite, STESSO documento, una sola registrazione',
      a.r?.document_id && a.r.document_id === b.r?.document_id
      && [a.r.ripetuta, b.r.ripetuta].sort().join() === 'false,true' && docs[0].n === 1,
      JSON.stringify({ pidDiversi: a.pid !== b.pid, a: a.r, b: b.r }))
  }
}

// ---- caso B: stesso token, manifesti DIVERSI → uno solo accettato ----------
{
  const T = randomUUID(); registro.annota('tokens', T)
  const S = sha(`conc-${SALE}-B`)
  const [a, b] = await Promise.all([
    ramo(T, 'scontrino', 'personale', 'nota UNO', pagina(T, S)),
    ramo(T, 'scontrino', 'personale', 'nota DUE', pagina(T, S)),
  ])
  registro.annota('documenti', a.r?.document_id); registro.annota('documenti', b.r?.document_id)
  if (!sovrapposti(a, b)) { nonValidi++; console.log('~ caso B NON VALIDO: ripetere') }
  else {
    const vincitore = a.r ? a : b.r ? b : null
    const perdente = a.r ? b : a
    const [doc] = await sql(`select note from public.family_documents where upload_token='${T}'`)
    esito('B stesso token, manifesti diversi: UNO accettato, l\'altro TOKEN_RIUSATO, nota del vincitore',
      !!vincitore?.r && !!perdente?.errore && perdente.errore.includes('TOKEN_RIUSATO')
      && doc && ['nota UNO', 'nota DUE'].includes(doc.note),
      JSON.stringify({ vinta: doc?.note, perdente: perdente?.errore?.slice(0, 60) }))
  }
}

// ---- caso C: token diversi, STESSA impronta → un documento, zero vuoti -----
{
  const T1 = randomUUID(), T2 = randomUUID()
  registro.annota('tokens', T1); registro.annota('tokens', T2)
  const S = sha(`conc-${SALE}-C`)
  const prima = (await sql(`select count(*) as n from public.family_documents`))[0].n
  const [a, b] = await Promise.all([
    ramo(T1, 'scontrino', 'personale', null, pagina(T1, S)),
    ramo(T2, 'scontrino', 'personale', null, pagina(T2, S)),
  ])
  registro.annota('documenti', a.r?.document_id); registro.annota('documenti', b.r?.document_id)
  if (!sovrapposti(a, b)) { nonValidi++; console.log('~ caso C NON VALIDO: ripetere') }
  else {
    const dopo = (await sql(`select count(*) as n from public.family_documents`))[0].n
    const vinte = [a, b].filter(x => x.r?.document_id)
    const perse = [a, b].filter(x => x.errore)
    esito('C token diversi, stessa impronta: UN documento valido, GIA_IN_ARCHIVIO all\'altro, NESSUN documento vuoto',
      vinte.length === 1 && perse.length === 1 && perse[0].errore.includes('GIA_IN_ARCHIVIO')
      && dopo === prima + 1,
      JSON.stringify({ documenti: `${prima}→${dopo}` }))
  }
}

console.log(`\nPASSO 3B: ${passati} passati, ${falliti} falliti, ${nonValidi} non validi (da ripetere)`)
process.exit(falliti || nonValidi ? 1 : 0)
