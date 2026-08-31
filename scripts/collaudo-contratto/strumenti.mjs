// ============================================================================
// Collaudo contratto — STRUMENTI puri e testabili (strumenti.test.mjs).
// Qui vive la logica che decide STOP, quiescenza, prova della chiamata
// sospesa, fase B in un'unica transazione, fixture e piano di pulizia:
// i passi .mjs sono solo orchestrazione.
// ============================================================================

export class ErroreCollaudo extends Error {}

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
// Solo gli artefatti REGISTRATI (docIds generati dal collaudo): niente
// selezioni per nome. Ordine figli→genitori; il giornale si smonta col
// DROP della tabella (porta via righe, trigger e FK in un colpo, senza
// scontrarsi con GIORNALE_IMMUTABILE). Idempotente: rieseguibile dopo
// un'interruzione, ogni istruzione è un no-op su ciò che non c'è più.
export function pianoPulizia({ docIds }) {
  const dentro = docIds.map(id => `'${id}'`).join(',') || `'00000000-0000-0000-0000-000000000000'`
  return [
    `drop function if exists public.salva_revisione(uuid, uuid, bigint, jsonb)`,
    `drop function if exists public.esito_revisione(uuid)`,
    `drop function if exists public.conferma_revisione(uuid, uuid, bigint, jsonb)`,
    `drop function if exists public.scarta_revisione(uuid, uuid, bigint, text)`,
    `drop function if exists private.impronta_canonica(jsonb)`,
    `drop function if exists private.canonico(jsonb)`,
    `drop table if exists public.family_revision_ops`,
    `alter table public.family_documents drop column if exists revisione_rev`,
    `delete from public.family_expenses where id in
       (select expense_id from public.family_expense_documents where document_id in (${dentro}))`,
    `delete from public.family_expense_documents where document_id in (${dentro})`,
    `delete from public.family_draft_items where draft_id in
       (select id from public.family_draft_expenses where document_id in (${dentro}))`,
    `delete from public.family_draft_expenses where document_id in (${dentro})`,
    `delete from public.family_documents where id in (${dentro})`,
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
