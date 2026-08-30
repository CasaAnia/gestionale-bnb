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

export async function improntaStato() {
  const stato = {}
  for (const [t, chiave] of Object.entries(TABELLE_IMPRONTA)) {
    // to_jsonb (chiavi in ordine deterministico) MENO le due colonne che la
    // 0022 aggiunge in mezzo al collaudo: così la fotografia PRE-0022 resta
    // confrontabile con lo stato finale (le colonne su rimuovere assenti
    // sono un'operazione neutra)
    const [r] = await sql(`select count(*)::int as n,
      coalesce(md5(string_agg(md5(((to_jsonb(x) - 'upload_token') - 'upload_manifest')::text), '|' order by ${chiave})), 'vuota') as impronta
      from public.${t} x`)
    stato[t] = r
  }
  const [og] = await sql(`select count(*)::int as n,
    coalesce(md5(string_agg(md5(name || coalesce(metadata->>'eTag', '')), '|' order by name)), 'vuota') as impronta
    from storage.objects`)
  stato['storage.objects'] = og
  return stato
}
