// ============================================================================
// Collaudo contratto — STRUMENTI puri e testabili (strumenti.test.mjs).
// Qui vive la logica che decide STOP, quiescenza, prova della chiamata
// sospesa, fase B in un'unica transazione, fixture e piano di pulizia:
// i passi .mjs sono solo orchestrazione.
// ============================================================================

export class ErroreCollaudo extends Error {}

export const LEGACY = ['conferma_documento', 'scarta_documento', 'approva_fattura_da_pagare', 'paga_fattura', 'conferma_fattura_pagata']

// ---- pg e i microsecondi ---------------------------------------------------
// Il driver pg restituisce timestamp/timestamptz come Date (precisione
// al MILLISECONDO): i microsecondi delle finestre andrebbero persi
// PRIMA di provaValida e finestre davvero sovrapposte risulterebbero
// NON valide. Questo parser conserva il TESTO a sei decimali per i soli
// tipi temporali e delega tutto il resto al parser del driver.
export function tipiTimestampTesto(tipiPg) {
  const TIMESTAMP = 1114, TIMESTAMPTZ = 1184
  return {
    getTypeParser: (oid, formato) =>
      (oid === TIMESTAMP || oid === TIMESTAMPTZ) ? (v => v) : tipiPg.getTypeParser(oid, formato),
  }
}

// ---- contatore con STOP vero ----------------------------------------------
// `attesa` accumula (per le verifiche di chiusura); `esigi` è il
// cancello CRITICO: al primo fallimento LANCIA, così gli effetti
// successivi non partono (i passi rilasciano le risorse nei finally).
// `chiudi` fallisce anche con ZERO verifiche: un passo che non ha
// verificato nulla non è mai verde.
export function creaContatore(nomePasso, scrivi = console) {
  let ok = 0, ko = 0
  return {
    attesa(nome, condizione, dettaglio = '') {
      if (condizione) { ok++; scrivi.log(`  ✓ ${nome}`) }
      else { ko++; scrivi.error(`  ✗ ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`) }
      return !!condizione
    },
    esigi(nome, condizione, dettaglio = '') {
      if (condizione) { ok++; scrivi.log(`  ✓ ${nome}`); return }
      ko++
      scrivi.error(`  ✗ ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`)
      throw new ErroreCollaudo(`STOP al cancello critico: ${nome}`)
    },
    chiudi() {
      scrivi.log(`\n${nomePasso}: ${ok} verifiche superate, ${ko} fallite`)
      if (ko > 0) throw new ErroreCollaudo(`${nomePasso}: verifiche fallite`)
      if (ok === 0) throw new ErroreCollaudo(`${nomePasso}: ZERO verifiche eseguite — mai un verde vuoto`)
    },
  }
}

// involucro del passo: qualunque ErroreCollaudo/errore → exit 1, e il
// corpo tiene i propri finally per rilasciare sessioni e risorse
export async function eseguiPasso(nome, corpo) {
  try { await corpo() } catch (e) {
    console.error(`\n${nome}: STOP — ${String(e?.message ?? e)}`)
    process.exit(1)
  }
}

// ---- QUIESCENZA delle transazioni pregresse (criterio della fase B) -------
// query: iniettata (sql vero nei passi, finta nei test). Un giro:
//  · pregresse = sessioni ALTRUI con xact_start < taglio;
//  · orizzonte xmin del cluster oltre l'xid registrato al taglio.
// Ritorna { esito:'ok' } oppure { esito:'timeout', pregresse:[{pid,...}] }.
export async function attendiQuiescenza(query, { taglio, xidTaglio, tentativi = 10, pausaMs = 500, pausa = ms => new Promise(r => setTimeout(r, ms)) }) {
  let pregresse = []
  for (let giro = 0; giro < tentativi; giro++) {
    pregresse = await query(`select pid, xact_start::text, state, left(query, 80) as query
      from pg_stat_activity
      where pid <> pg_backend_pid() and xact_start is not null
        and xact_start < '${taglio}'::timestamptz`)
    const [oriz] = await query(`select pg_snapshot_xmin(pg_current_snapshot())::text::bigint as xmin`)
    if (pregresse.length === 0 && Number(oriz.xmin) > Number(xidTaglio)) return { esito: 'ok' }
    await pausa(pausaMs)
  }
  return { esito: 'timeout', pregresse }
}

// ---- prova che il backend Y è DAVVERO in attesa su una tabella ------------
// Niente pause come prova: si identifica Y per PID e si verifica che
// aspetti un lock proprio su quella relazione, con la query attesa.
export async function attesaSuTabella(query, { pid, tabella, funzione, tentativi = 10, pausaMs = 300, pausa = ms => new Promise(r => setTimeout(r, ms)) }) {
  for (let giro = 0; giro < tentativi; giro++) {
    const righe = await query(`select a.pid
      from pg_stat_activity a
      join pg_locks l on l.pid = a.pid and l.granted = false
      where a.pid = ${Number(pid)}
        and a.wait_event_type = 'Lock'
        and a.query ilike '%${funzione}%'
        and l.relation = 'public.${tabella}'::regclass`)
    if (righe.length > 0) return { trovato: true }
    await pausa(pausaMs)
  }
  return { trovato: false, dettaglio: `pid ${pid} non risulta in attesa di lock su ${tabella} con ${funzione}` }
}

// ---- FASE B in un'UNICA transazione (unica fonte per gli involucri) -------
// Costruisce l'intera transazione: timeout, barriera, revoche (firme
// FORNITE, lette da pg_proc dal chiamante) e ripuntamento degli
// involucri, ESTRATTI dalla bozza del contratto e ripuntati a private.
// Un'interruzione non può lasciare le RPC rivolte ai respingenti: o
// tutto o niente.
export function costruisciFaseB({ bozzaContratto, firme, legacy }) {
  const da = bozzaContratto.indexOf('create or replace function public.conferma_revisione')
  const finoA = bozzaContratto.indexOf('-- 7) PERMESSI')
  if (da < 0 || finoA < 0 || finoA <= da)
    throw new ErroreCollaudo('bozza del contratto senza la sezione degli involucri: fase B non costruibile')
  for (const n of legacy) {
    if (!firme[n]) throw new ErroreCollaudo(`firma mancante per ${n}: le revoche usano le firme lette da pg_proc`)
  }
  const involucri = bozzaContratto.slice(da, finoA)
    .replaceAll('public.conferma_documento(', 'private.conferma_documento(')
    .replaceAll('public.scarta_documento(', 'private.scarta_documento(')
  if (involucri.includes('public.conferma_documento(') || involucri.includes('public.scarta_documento('))
    throw new ErroreCollaudo('ripuntamento incompleto degli involucri')
  return `begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.family_documents, public.family_draft_expenses, public.family_draft_items in access exclusive mode;
revoke update, insert on public.family_draft_expenses from authenticated;
revoke update, insert on public.family_draft_items from authenticated;
revoke update on public.family_documents from authenticated;
${legacy.map(n => `revoke execute on function public.${n}(${firme[n]}) from authenticated;`).join('\n')}
${involucri}
commit;`
}

// ---- prove NEGATIVE della guardia di fase A -------------------------------
// La bozza è un blocco begin;…commit; autonomo: incollarla dopo un
// BEGIN del collaudo NON crea una transazione annidata e il suo COMMIT
// concluderebbe anche la sonda (overload o firma sbagliata). Se la
// guardia accettasse per ERRORE, il rosso arriverebbe DOPO il commit, a
// residui già persistiti e mai registrati. Qui la transazione la
// controlla il COLLAUDO: sonda + corpo della bozza SENZA begin/commit,
// chiusa SEMPRE da rollback — anche un'accettazione inattesa non
// lascia nulla nel database.
export function provaNegativaFaseA({ bozza, sonda }) {
  const inizio = bozza.indexOf('begin;')
  const fine = bozza.lastIndexOf('commit;')
  if (inizio < 0 || fine < 0 || fine <= inizio)
    throw new ErroreCollaudo('bozza della fase A senza begin;/commit; riconoscibili: prova negativa non costruibile')
  const corpo = bozza.slice(inizio + 'begin;'.length, fine)
  if (corpo.includes('commit;'))
    throw new ErroreCollaudo('corpo della bozza con un commit; interno: il rollback della prova negativa non sarebbe garantito')
  return `begin;\n${sonda}\n${corpo}\nrollback;`
}

// ---- fixture: costruttore PURO delle istruzioni ---------------------------
// importoRiga è SEPARATO dal totale (serve alle prove di quadratura);
// gli id sono FORNITI (generati e registrati PRIMA degli effetti).
export function sqlFixtureDocumento({ docId, bozzaId, rigaId, gruppoId, totale = 5, importoRiga = totale, stato = 'in_revisione', etichetta = 'Voce collaudo' }) {
  return [
    `insert into public.family_documents (id, kind, status, doc_total, upload_ambito)
      values ('${docId}', 'scontrino', '${stato}', ${totale}, 'personale')`,
    `insert into public.family_draft_expenses (id, document_id, status, expense_date, group_id, arrotondamento_cent)
      values ('${bozzaId}', '${docId}', 'da_controllare', '2026-08-29', '${gruppoId}', 0)`,
    `insert into public.family_draft_items (id, draft_id, name, qty, discount, amount)
      values ('${rigaId}', '${bozzaId}', '${etichetta.replaceAll("'", "''")}', 1, 0, ${importoRiga})`,
  ]
}

// ---- PIANO DI PULIZIA per identificativi ESATTI ---------------------------
// Solo gli artefatti REGISTRATI: docIds generati dal collaudo ed
// expenseIds delle spese confermate, CONSERVATI DUREVOLMENTE nel
// registro PRIMA di eliminare i riferimenti (dopo, non sarebbero più
// ricostruibili). Niente selezioni per nome. Il giornale si smonta col
// DROP della tabella (mai DELETE contro GIORNALE_IMMUTABILE) e se ne
// elimina anche la funzione del trigger. L'ordine RISPETTA le FK della
// 0020: le spese (family_expenses) sono referenziate con ON DELETE
// RESTRICT sia dal ponte (family_expense_documents.expense_id) sia
// dalle bozze (family_draft_expenses.expense_id) — i riferimenti si
// eliminano PRIMA, le spese poi, i documenti per ultimi (il ponte li
// referenzia RESTRICT). E il PONTE va via PRIMA delle righe definitive
// e delle spese anche per la protezione della 0021
// (private.blocca_spese_documentate, BEFORE UPDATE/DELETE su
// family_expenses e family_expense_items): finché esiste il
// collegamento a un documento CONFERMATO la cancellazione è respinta —
// anche come postgres, l'eccezione dipende dal claim service_role, non
// dal proprietario della connessione; qui non si disabilita nulla, si
// rispetta l'ordine. Correzioni e righe definitive (voci) delle spese
// del collaudo vengono eliminate esplicitamente e verificate.
// Idempotente: rieseguibile dopo un'interruzione.
export function pianoPulizia({ docIds, expenseIds = [] }) {
  const sentinella = `'00000000-0000-0000-0000-000000000000'`
  const doc = docIds.map(id => `'${id}'`).join(',') || sentinella
  const spesa = expenseIds.map(id => `'${id}'`).join(',') || sentinella
  return [
    `drop function if exists public.salva_revisione(uuid, uuid, bigint, jsonb)`,
    `drop function if exists public.esito_revisione(uuid)`,
    `drop function if exists public.conferma_revisione(uuid, uuid, bigint, jsonb)`,
    `drop function if exists public.scarta_revisione(uuid, uuid, bigint, text)`,
    `drop function if exists private.impronta_canonica(jsonb)`,
    `drop function if exists private.canonico(jsonb)`,
    `drop table if exists public.family_revision_ops`,
    `drop function if exists private.proteggi_giornale_revisione()`,
    `alter table public.family_documents drop column if exists revisione_rev`,
    `delete from public.family_corrections where document_id in (${doc})
       or expense_id in (${spesa})
       or draft_id in (select id from public.family_draft_expenses where document_id in (${doc}))`,
    `delete from public.family_expense_documents where document_id in (${doc})`,
    `delete from public.family_expense_items where expense_id in (${spesa})`,
    `delete from public.family_draft_items where draft_id in
       (select id from public.family_draft_expenses where document_id in (${doc}))`,
    `delete from public.family_draft_expenses where document_id in (${doc})`,
    `delete from public.family_expenses where id in (${spesa})`,
    `delete from public.family_documents where id in (${doc})`,
  ]
}

// esegue il piano UNA istruzione alla volta, registrando fin dove è
// arrivato: un'interruzione si riprende rilanciando (idempotente)
export async function eseguiPiano(query, piano, annota = () => {}) {
  for (let i = 0; i < piano.length; i++) {
    await query(piano[i])
    annota(i)
  }
}

// ---- validazione della FOTOGRAFIA (struttura e completezza) ---------------
// Va chiamata PRIMA di qualunque effetto della pulizia: una fotografia
// vuota o monca supererebbe il controllo di presenza e l'errore
// arriverebbe solo al confronto finale, a DROP già partiti.
export const TABELLE_FOTOGRAFATE = [
  'family_documents', 'family_draft_expenses', 'family_draft_items',
  'family_expenses', 'family_expense_documents', 'family_corrections', 'family_expense_items',
]
export function validaFotografia(foto) {
  const guasto = perche => { throw new ErroreCollaudo(`fotografia di base non valida: ${perche}`) }
  if (!foto || typeof foto !== 'object') guasto('assente o non è un oggetto')
  for (const t of TABELLE_FOTOGRAFATE) {
    if (!Number.isInteger(foto.conteggi?.[t])) guasto(`conteggio mancante per ${t}`)
    if (typeof foto.impronte?.[t] !== 'string' || !foto.impronte[t]) guasto(`impronta dei dati mancante per ${t}`)
  }
  if (!Array.isArray(foto.legacy) || foto.legacy.length !== LEGACY.length) guasto('definizioni legacy assenti o non cinque')
  for (const n of LEGACY) {
    const r = foto.legacy.find(x => x?.nome === n)
    if (!r || !r.impronta || !r.firma || !r.tipi) guasto(`legacy incompleta: ${n}`)
  }
  if (!Array.isArray(foto.permessi) || foto.permessi.length === 0
    || !foto.permessi.every(r => r?.table_name && r?.column_name && r?.privilege_type))
    guasto('permessi per colonna assenti o senza identità esatta (tabella, colonna, privilegio)')
  if (!Array.isArray(foto.esecuzioni)
    || !foto.esecuzioni.every(r => r?.routine_schema && r?.routine_name && r?.grantee))
    guasto('privilegi EXECUTE assenti o senza identità esatta (schema, funzione, ruolo)')
}

// ---- confronto delle FOTOGRAFIE (inizio vs fine) --------------------------
export function confrontaFotografie(base, fine) {
  const differenze = []
  const chiavi = new Set([...Object.keys(base), ...Object.keys(fine)])
  for (const k of chiavi) {
    if (JSON.stringify(base[k]) !== JSON.stringify(fine[k]))
      differenze.push(`${k}: ${JSON.stringify(base[k])} → ${JSON.stringify(fine[k])}`)
  }
  return { uguali: differenze.length === 0, differenze }
}
