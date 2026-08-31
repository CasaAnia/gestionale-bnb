// ============================================================================
// Collaudo del CONTRATTO DI REVISIONE — helpers condivisi dei passi.
// PREPARAZIONE: questi script NON vanno eseguiti senza l'autorizzazione
// al collaudo isolato (vedi PIANO-COLLAUDO-CONTRATTO.md). Riusano
// l'aggancio della 2B (token fuori repo, guardia anti-produzione).
// ============================================================================
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { sql } from '../fase2b/api.mjs'

const QUI = dirname(fileURLToPath(import.meta.url))
export const RADICE = join(QUI, '..', '..')

export const sha256 = t => createHash('sha256').update(t, 'utf8').digest('hex')

// i VETTORI COMUNI dal file condiviso col client (il TS è header + JSON
// puro generato: si estrae dalla prima parentesi quadra)
export function vettoriComuni() {
  const testo = readFileSync(join(RADICE, 'lib/spese/contrattoVettori.ts'), 'utf8')
  return JSON.parse(testo.slice(testo.indexOf('[')))
}

export function bozzaSql(nome) {
  return readFileSync(join(RADICE, 'proposte', nome), 'utf8')
}

// contesto SQL «da membro» (stesso pattern del passo3 della 0022):
// claims + role dentro la transazione fornita
export async function ownerId() {
  const r = await sql(`select user_id from public.app_members where role='owner' limit 1`)
  if (!r[0]?.user_id) throw new Error('STOP: nessun owner in app_members (fixture della 2B mancanti)')
  return r[0].user_id
}
export const comeMembro = uid => `select set_config('request.jwt.claims',
    json_build_object('sub','${uid}','role','authenticated')::text, true);
  set local role authenticated;`

// esegue UNA transazione da membro e restituisce l'ULTIMA riga utile
export async function daMembro(uid, corpo, { commit = false } = {}) {
  const r = await sql(`begin; ${comeMembro(uid)} ${corpo}; ${commit ? 'commit' : 'rollback'};`)
  return r
}

// contatore degli esiti del passo: ogni verifica è ✓/✗ e alla fine si
// esce 1 se anche UNA sola è fallita (STOP esplicito, mai silenzioso)
export function contatore(nomePasso) {
  let ok = 0, ko = 0
  return {
    attesa(nome, condizione, dettaglio = '') {
      if (condizione) { ok++; console.log(`  ✓ ${nome}`) }
      else { ko++; console.error(`  ✗ ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`) }
    },
    async chiudi() {
      console.log(`\n${nomePasso}: ${ok} verifiche superate, ${ko} fallite`)
      if (ko > 0) { console.error('STOP: passo NON superato — niente passi successivi.'); process.exit(1) }
    },
  }
}

// fotografia di un documento con bozze, righe, spese e giornale: per i
// confronti byte-per-byte del «ramo perdente» (nessuna scrittura)
export async function fotografiaDocumento(docId) {
  const [r] = await sql(`select jsonb_build_object(
    'doc', (select to_jsonb(d) from public.family_documents d where id='${docId}'),
    'bozze', (select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.family_draft_expenses b where document_id='${docId}'),
    'righe', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.family_draft_items i
              where i.draft_id in (select id from public.family_draft_expenses where document_id='${docId}')),
    'spese', (select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from public.family_expenses s
              where s.id in (select expense_id from public.family_expense_documents where document_id='${docId}')),
    'giornale', (select coalesce(jsonb_agg(to_jsonb(g) order by g.op_key),'[]') from public.family_revision_ops g where document_id='${docId}')
  ) as foto`)
  return JSON.stringify(r.foto)
}

// fixture minima per un caso: documento in_revisione con una bozza e
// una riga, importi coerenti (5,00). Restituisce gli id.
let progressivo = 0
export async function fixtureDocumento(uid, { totale = 5, stato = 'in_revisione' } = {}) {
  const n = ++progressivo
  const [doc] = await sql(`insert into public.family_documents (kind, status, doc_total, upload_ambito)
    values ('scontrino', '${stato}', ${totale}, 'personale') returning id`)
  const [gruppo] = await sql(`select id from public.family_groups limit 1`)
  const [bozza] = await sql(`insert into public.family_draft_expenses
    (document_id, status, expense_date, group_id, arrotondamento_cent)
    values ('${doc.id}', 'da_controllare', '2026-08-29', '${gruppo.id}', 0) returning id`)
  const [riga] = await sql(`insert into public.family_draft_items (draft_id, name, qty, discount, amount)
    values ('${bozza.id}', 'Voce collaudo ${n}', 1, 0, ${totale}) returning id`)
  void uid
  return { docId: doc.id, bozzaId: bozza.id, rigaId: riga.id }
}
