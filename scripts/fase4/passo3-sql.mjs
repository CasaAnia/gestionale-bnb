#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 3: la checklist PostgreSQL VERA (A–E della
// 0022) sul progetto di prova, con contesto AUTENTICATO simulato via claims
// e ruoli in transazioni esplicite. Ogni artefatto creato viene annotato in
// un registro locale per la pulizia finale.
// ============================================================================
import { randomUUID, createHash } from 'node:crypto'
import { sql, maschera, progetto } from '../fase2b/api.mjs'
import { nuovoRegistro } from './registro.mjs'

// registro INCREMENTALE: aggiornato a ogni artefatto, anche se il giro si
// interrompe a metà la pulizia ritrova tutto
const registro = nuovoRegistro('sql')
console.log('Bersaglio:', maschera(progetto().ref), '· registro:', registro.file)

let passati = 0, falliti = 0
const esito = (nome, ok, dettaglio = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nome}${dettaglio ? ' — ' + dettaglio : ''}`)
  ok ? passati++ : falliti++
}
// una chiamata che DEVE fallire con una certa sentinella
async function fallisce(nome, query, sentinella) {
  try {
    await sql(query)
    esito(nome, false, 'NESSUN errore (atteso ' + sentinella + ')')
  } catch (e) {
    const ok = String(e.message).includes(sentinella)
    esito(nome, ok, ok ? sentinella : `errore diverso: ${String(e.message).slice(0, 140)}`)
  }
}

const sha = (s) => createHash('sha256').update(s).digest('hex')
const GIORNO = '2026-09-01'
const T1 = randomUUID(), T2 = randomUUID(), T3 = randomUUID(), T4 = randomUUID()
for (const t of [T1, T2, T3, T4]) registro.annota('tokens', t)
const percorso = (tok, pag, ext = 'jpg') => `${GIORNO}/${tok}-p${pag}.${ext}`
const pagina = (tok, pag, impronta) =>
  `{"storage_path":"${percorso(tok, pag)}","page_order":${pag},"mime_type":"image/jpeg","file_sha256":"${impronta}"}`
// impronte UNICHE per ogni giro: il collaudo è ripetibile senza collisioni
const SALE = randomUUID()
const SHA1 = sha(`collaudo-${SALE}-foto-1`), SHA2A = sha(`collaudo-${SALE}-foto-2a`), SHA2B = sha(`collaudo-${SALE}-foto-2b`)

const [{ user_id: OWNER }] = await sql(`select user_id from public.app_members where role='owner' limit 1`)
const comeOwner = `select set_config('request.jwt.claims',
    json_build_object('sub','${OWNER}','role','authenticated')::text, true);
  set local role authenticated;`
const chiama = (tok, kind, ambito, nota, pagineJson) =>
  `select public.registra_documento_caricato('${tok}'::uuid,'${kind}','${ambito}',${nota === null ? 'null' : `'${nota}'`},'[${pagineJson}]'::jsonb) as r`

// ---- A. PRIVILEGI (transazioni esplicite, una per ruolo) -------------------
await fallisce('A1 anon: execute negato',
  `begin; set local role anon; ${chiama(T1, 'scontrino', 'personale', null, pagina(T1, 1, SHA1))}; rollback;`,
  'permission denied')
await fallisce('A2 service_role: execute negato',
  `begin; set local role service_role; ${chiama(T1, 'scontrino', 'personale', null, pagina(T1, 1, SHA1))}; rollback;`,
  'permission denied')

// ---- B. CONTROLLO INTERNO (autenticato ma NON membro) ----------------------
await fallisce('B1 autenticato non membro: NON_MEMBRO',
  `begin;
   select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
   set local role authenticated;
   ${chiama(T1, 'scontrino', 'personale', null, pagina(T1, 1, SHA1))};
   rollback;`, 'NON_MEMBRO')
await fallisce('B2 postgres senza claims: NON_MEMBRO (il definer non regala nulla)',
  chiama(T1, 'scontrino', 'personale', null, pagina(T1, 1, SHA1)), 'NON_MEMBRO')

// ---- C. PERCORSO DELL'OWNER ------------------------------------------------
const c1 = await sql(`begin; ${comeOwner} ${chiama(T1, 'scontrino', 'personale', 'prova collaudo', pagina(T1, 1, SHA1))}; commit;`)
const doc1 = c1[0]?.r
registro.annota('documenti', doc1?.document_id)
esito('C1 registrazione singola', !!doc1?.document_id && doc1

.ripetuta === false, JSON.stringify(doc1))

const c2 = await sql(`begin; ${comeOwner} ${chiama(T1, 'scontrino', 'personale', 'prova collaudo', pagina(T1, 1, SHA1))}; commit;`)
esito('C2 stessa chiamata: stesso id, ripetuta=true',
  c2[0]?.r?.document_id === doc1.document_id && c2[0]?.r?.ripetuta === true, JSON.stringify(c2[0]?.r))

await fallisce('C3 stesso token, nota diversa: TOKEN_RIUSATO',
  `begin; ${comeOwner} ${chiama(T1, 'scontrino', 'personale', 'NOTA DIVERSA', pagina(T1, 1, SHA1))}; rollback;`,
  'TOKEN_RIUSATO')

await fallisce('C4 pagina non combaciante nel percorso: PERCORSO_NON_COERENTE',
  `begin; ${comeOwner} ${chiama(T2, 'scontrino', 'personale', null,
    `{"storage_path":"${percorso(T2, 2)}","page_order":1,"mime_type":"image/jpeg","file_sha256":"${SHA2A}"}`)}; rollback;`,
  'PERCORSO_NON_COERENTE')

const primaC5 = (await sql(`select count(*) as n from public.family_documents`))[0].n
await fallisce('C5 token nuovo, stessa impronta: GIA_IN_ARCHIVIO',
  `begin; ${comeOwner} ${chiama(T2, 'scontrino', 'personale', null, pagina(T2, 1, SHA1))}; rollback;`,
  'GIA_IN_ARCHIVIO')
const dopoC5 = (await sql(`select count(*) as n from public.family_documents`))[0].n
esito('C5b nessun documento vuoto dopo il doppione', dopoC5 === primaC5, `${primaC5}→${dopoC5}`)

const c6 = await sql(`begin; ${comeOwner} ${chiama(T2, 'scontrino', 'azienda', 'multipagina',
  pagina(T2, 1, SHA2A) + ',' + pagina(T2, 2, SHA2B))}; commit;`)
registro.annota('documenti', c6[0]?.r?.document_id)
const ric2 = await sql(`select count(*) as n from public.family_receipts where document_id='${c6[0]?.r?.document_id}'`)
esito('C6 multipagina: 2 ricevute collegate', ric2[0].n === 2, JSON.stringify(c6[0]?.r))

const primaC7 = (await sql(`select (select count(*) from public.family_documents) as d, (select count(*) from public.family_receipts) as r`))[0]
await fallisce('C7 multipagina con una pagina doppione: TUTTE o nessuna',
  `begin; ${comeOwner} ${chiama(T3, 'scontrino', 'personale', null,
    pagina(T3, 1, sha(`collaudo-${SALE}-foto-3`)) + ',' + pagina(T3, 2, SHA2B))}; rollback;`,
  'GIA_IN_ARCHIVIO')
const dopoC7 = (await sql(`select (select count(*) from public.family_documents) as d, (select count(*) from public.family_receipts) as r`))[0]
esito('C7b rollback totale (né documento né ricevute)',
  dopoC7.d === primaC7.d && dopoC7.r === primaC7.r, JSON.stringify(dopoC7))

await fallisce('C8 pagine con lo stesso ordine: PAGINE_MALFORMATE (≠ doppione)',
  `begin; ${comeOwner} ${chiama(T4, 'scontrino', 'personale', null,
    `{"storage_path":"${percorso(T4, 1)}","page_order":1,"mime_type":null,"file_sha256":"${sha(`x1-${SALE}`)}"},{"storage_path":"${GIORNO}/${T4}-p1.png","page_order":1,"mime_type":null,"file_sha256":"${sha(`x2-${SALE}`)}"}`)}; rollback;`,
  'PAGINE_MALFORMATE')
await fallisce('C9 impronta non esadecimale: IMPRONTA_NON_VALIDA',
  `begin; ${comeOwner} ${chiama(T4, 'scontrino', 'personale', null, pagina(T4, 1, 'IMPRONTA-FINTA'))}; rollback;`,
  'IMPRONTA_NON_VALIDA')

// ---- D. IMMUTABILITÀ DEL MANIFESTO (distinta dai permessi di colonna) ------
const d1 = await sql(`update public.family_documents set note='nota aggiornata dal collaudo' where upload_token='${T1}' returning id`)
esito('D1 postgres aggiorna un campo di revisione (note): passa', d1.length === 1)
await fallisce('D2 postgres aggiorna upload_manifest: MANIFESTO_IMMUTABILE (trigger, non permessi)',
  `update public.family_documents set upload_manifest='{}'::jsonb where upload_token='${T1}'`,
  'MANIFESTO_IMMUTABILE')
await fallisce('D3 authenticated aggiorna upload_manifest: negato dai PERMESSI di colonna (messaggio diverso)',
  `begin; ${comeOwner} update public.family_documents set upload_manifest='{}'::jsonb where upload_token='${T1}'; rollback;`,
  'permission denied')

console.log(`\nPASSO 3: ${passati} passati, ${falliti} falliti`)
process.exit(falliti ? 1 : 0)
