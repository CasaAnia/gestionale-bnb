// ============================================================================
// IMPRONTA DELLO STATO (Fase 4 · collaudo): per ogni tabella conteggio +
// md5 di TUTTE le righe (id e campi, in ordine stabile); per lo storage
// nomi ed eTag. "Invariato" si dichiara confrontando QUESTE impronte,
// mai conteggi scritti a mano nel codice.
// ============================================================================
import { sql } from '../fase2b/api.mjs'

export const TABELLE_IMPRONTA = {
  family_expenses: 'id', family_expense_items: 'id', family_receipts: 'id',
  family_documents: 'id', family_expense_documents: 'id',
  family_draft_expenses: 'id', family_draft_items: 'id',
  family_budgets: 'id', app_members: 'user_id',
}

export const CHIAVI_FOTOGRAFIA = [...Object.keys(TABELLE_IMPRONTA), 'storage.objects', 'auth.users']

// c'erano già le colonne della 0022 quando è stata scattata la fotografia?
export async function colonne0022Presenti() {
  const r = await sql(`select count(*)::int as n from information_schema.columns
    where table_schema='public' and table_name='family_documents'
    and column_name in ('upload_token','upload_manifest')`)
  return r[0].n === 2
}

// escludi0022: SOLO quando la fotografia iniziale è stata scattata PRIMA
// della 0022 (colonne assenti: escluderle è neutro sul lato iniziale e
// rende confrontabile il lato finale). Se le colonne c'erano GIÀ, si
// confrontano anche quelle: niente esclusioni indiscriminate.
export async function improntaStato({ escludi0022 }) {
  const stato = {}
  const riga = escludi0022
    ? `((to_jsonb(x) - 'upload_token') - 'upload_manifest')::text`
    : `to_jsonb(x)::text`
  for (const [t, chiave] of Object.entries(TABELLE_IMPRONTA)) {
    const [r] = await sql(`select count(*)::int as n,
      coalesce(md5(string_agg(md5(${riga}), '|' order by ${chiave})), 'vuota') as impronta
      from public.${t} x`)
    stato[t] = r
  }
  const [og] = await sql(`select count(*)::int as n,
    coalesce(md5(string_agg(md5(name || coalesce(metadata->>'eTag', '')), '|' order by name)), 'vuota') as impronta
    from storage.objects`)
  stato['storage.objects'] = og
  // gli ACCOUNT Auth (id + email, solo in forma di impronta aggregata:
  // nessuna credenziale esportata): rileva anche un account sintetico
  // rimasto SENZA appartenenza, che app_members da sola non vede
  const [au] = await sql(`select count(*)::int as n,
    coalesce(md5(string_agg(md5(id::text || coalesce(email, '')), '|' order by id)), 'vuota') as impronta
    from auth.users`)
  stato['auth.users'] = au
  return stato
}
