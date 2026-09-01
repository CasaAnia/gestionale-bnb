// ============================================================================
// Collaudo della BOZZA 0023 (primitivo atomico «elabora_sostituisci_bozze»)
// — logica DECIDIBILE, testata in locale senza rete (strumenti0023.test.mjs).
// PREPARAZIONE: nessun passo va eseguito senza l'autorizzazione esplicita
// al collaudo isolato (PIANO-COLLAUDO-0023.md). Bersaglio: SOLO il
// progetto di prova della 2B; la guardia anti-produzione resta attiva in
// ogni passo.
// ============================================================================
import { ErroreCollaudo } from '../collaudo-contratto/strumenti.mjs'

export const FUNZIONE_0023 = 'elabora_sostituisci_bozze'
export const FIRMA_0023 = 'uuid, jsonb, text'
export const BOZZA_0023 = 'supabase/proposte/0023_elaborazione_bozze_atomica.BOZZA.sql'

// CANCELLO: ogni passo si rifiuta senza l'autorizzazione esplicita
// nell'ambiente del comando (mai in un file .env)
export function verificaAutorizzazione(env = process.env) {
  if (env.COLLAUDO_0023_AUTORIZZATO !== '1')
    throw new ErroreCollaudo('collaudo 0023 NON autorizzato: serve COLLAUDO_0023_AUTORIZZATO=1 nell\'ambiente del comando, dopo il via libera esplicito dell\'utente')
  return true
}

// controllo STATICO della bozza prima di toccare il progetto: se il
// testo è scivolato via dai vincoli della revisione R6, STOP in locale
export function problemiBozza(testo) {
  const problemi = []
  const esigi = (cond, msg) => { if (!cond) problemi.push(msg) }
  esigi(/for update/i.test(testo), 'manca il lock «for update» sul documento (arbitraggio concorrente)')
  esigi(/in \('da_elaborare', 'errore'\)/.test(testo), 'stati elaborabili non fissati dal server (attesi positivi: da_elaborare, errore)')
  esigi(!/p_stati_ammessi/.test(testo), 'p_stati_ammessi è ricomparso: gli stati non devono arrivare dal chiamante (R6)')
  esigi(/pacchetto senza bozze/.test(testo), 'manca il rifiuto del pacchetto senza bozze (R6)')
  esigi(/bozza senza righe/.test(testo), 'manca il rifiuto della bozza senza righe (R6)')
  esigi(/revoke execute[\s\S]*anon, authenticated/.test(testo), 'manca il revoke a public/anon/authenticated')
  esigi(/grant execute[\s\S]*to service_role/.test(testo), 'manca il grant al solo service_role')
  esigi(/set search_path = ''/.test(testo), 'manca il search_path vuoto (contratto 0021)')
  esigi(/security definer/.test(testo), 'manca security definer')
  return problemi
}

// giudizio sulla STRUTTURA applicata, dai risultati delle query di
// catalogo (funzione + privilegi EXECUTE): puro, testabile in locale
export function problemiStruttura({ funzioni, esecuzioni }) {
  const problemi = []
  const f = (funzioni ?? []).filter(x => x.nome === FUNZIONE_0023)
  if (f.length !== 1) return [`attesa ESATTAMENTE una ${FUNZIONE_0023}, trovate ${f.length}`]
  if (f[0].tipi !== FIRMA_0023) problemi.push(`firma inattesa: «${f[0].tipi}» invece di «${FIRMA_0023}»`)
  if (f[0].secdef !== true) problemi.push('non è security definer')
  if (!String(f[0].config ?? '').includes('search_path=')) problemi.push('search_path non fissato')
  const grants = (esecuzioni ?? []).filter(x => x.routine_name === FUNZIONE_0023).map(x => x.grantee)
  if (!grants.includes('service_role')) problemi.push('EXECUTE mancante a service_role')
  for (const vietato of ['anon', 'authenticated', 'PUBLIC'])
    if (grants.includes(vietato)) problemi.push(`EXECUTE concesso a ${vietato}: deve essere negato`)
  return problemi
}

// il corpo della chiamata RPC come lo costruisce lo strumento reale
// (scripts/elabora/elabora-bozze.mjs): ogni bozza porta le SUE righe,
// NESSUN p_stati_ammessi (li fissa il server)
export function corpoRpc0023(documentId, richiesta) {
  if (richiesta.errore !== undefined)
    return { p_document_id: documentId, p_pacchetto: null, p_errore: richiesta.errore }
  const { pacchetto } = richiesta
  const bozze = pacchetto.bozze.map(({ rif, ...campi }) => ({
    ...campi,
    confidence: campi.confidence ?? {},
    righe: pacchetto.righe.filter(r => r.bozzaRif === rif).map(({ bozzaRif, ...riga }) => {
      void bozzaRif
      return { ...riga, confidence: riga.confidence ?? {} }
    }),
  }))
  return { p_document_id: documentId, p_pacchetto: { doc_total: pacchetto.documento.doc_total, bozze }, p_errore: null }
}

// fixture: documento del collaudo (id nati lato client e REGISTRATI
// prima degli INSERT); opzionale una bozza pregressa con una riga, per
// le prove di sostituzione e di rollback
export function sqlFixture0023({ docId, stato, gruppoId, bozzaId = null, rigaId = null }) {
  const stmts = [
    `insert into public.family_documents (id, kind, status, upload_ambito, note)
      values ('${docId}', 'scontrino', '${stato}', 'personale', null)`,
  ]
  if (bozzaId && rigaId) stmts.push(
    `insert into public.family_draft_expenses (id, document_id, status, expense_date, group_id, arrotondamento_cent)
      values ('${bozzaId}', '${docId}', 'da_controllare', '2026-08-29', '${gruppoId}', 0)`,
    `insert into public.family_draft_items (id, draft_id, name, qty, discount, amount)
      values ('${rigaId}', '${bozzaId}', 'Voce pregressa collaudo 0023', 1, 0, 5)`,
  )
  return stmts
}

// PULIZIA per identificativi ESATTI dal registro (mai per nome), ordine
// delle FK della 0020: righe bozza → bozze → documenti; la funzione per
// ultima. Idempotente: rieseguibile dopo un'interruzione. In questo
// collaudo NESSUN documento viene mai confermato: niente spese
// definitive, niente ponte, il trigger 0021 non entra in gioco.
export function pianoPulizia0023({ docIds }) {
  const sentinella = `'00000000-0000-0000-0000-000000000000'`
  const doc = docIds.map(id => `'${id}'`).join(',') || sentinella
  return [
    `delete from public.family_draft_items where draft_id in
       (select id from public.family_draft_expenses where document_id in (${doc}))`,
    `delete from public.family_draft_expenses where document_id in (${doc})`,
    `delete from public.family_documents where id in (${doc})`,
    `drop function if exists public.${FUNZIONE_0023}(${FIRMA_0023})`,
  ]
}

// la fotografia di base deve essere COMPLETA prima di qualunque effetto
export function validaFotografia0023(foto) {
  if (!foto || typeof foto !== 'object') return false
  return ['conteggi', 'impronte', 'legacy', 'permessi', 'esecuzioni']
    .every(k => foto[k] != null && (!Array.isArray(foto[k]) || foto[k].length > 0 || k === 'legacy'))
}
