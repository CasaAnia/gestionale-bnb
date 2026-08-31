// ============================================================================
// FONTE DATI del nuovo modulo spese (3.2B) — SOLO LETTURE.
// Un'unica lettura alimenta sia il guscio (via adattatore) sia le analisi
// operative trasferite (Calendario/Racconto/Domanda, che lavorano sulle
// stesse tabelle grezze). Le SCRITTURE vivono in scritturaSupabase.ts,
// tenute separate: la preview /nuove-spese-reali importa SOLO questo file.
// ============================================================================
import { supabase } from '@/lib/supabase'
import type { TabelleGrezze } from './adattatore'
import type { Rule, Subcat } from './types'

async function tutta<T>(tabella: string, colonne: string): Promise<T[]> {
  const righe: T[] = []
  for (let da = 0; ; da += 1000) {
    // ordinamento ESPLICITO: la paginazione oltre le 1.000 righe non deve
    // dipendere dall'ordine implicito di Postgres
    const { data, error } = await supabase.from(tabella).select(colonne)
      .order('id', { ascending: true }).range(da, da + 999)
    if (error) throw new Error(`${tabella}: ${error.message}`)
    righe.push(...(data as T[]))
    if (!data || data.length < 1000) break
  }
  return righe
}

export type FonteCompleta = TabelleGrezze & {
  regole: Rule[]
  sottocategorieLegacy: Subcat[]
}

export async function leggiTutto(): Promise<FonteCompleta> {
  const [documenti, ponte, spese, righe, ricevute, bozze, righeBozza,
    gruppi, categorie, categorieCanoniche, sottocategorieCanoniche, camere, budget,
    regole, sottocategorieLegacy] = await Promise.all([
    tutta<TabelleGrezze['documenti'][0]>('family_documents',
      'id, kind, status, doc_total, supplier, invoice_number, document_date, due_date, upload_ambito, error_message, note, doc_total_derivato, created_at'),
    tutta<TabelleGrezze['ponte'][0]>('family_expense_documents', 'id, expense_id, document_id'),
    tutta<TabelleGrezze['spese'][0]>('family_expenses',
      'id, amount, expense_date, group_id, category_id, subcategory, description, store, product, receipt_id, payment_method, paid_at, room_id, canonical_category_id, canonical_subcategory_id, expense_nature, recurring, source'),
    tutta<TabelleGrezze['righe'][0]>('family_expense_items',
      'id, expense_id, name, amount, category_id, subcategory, qty, unit_price, discount, group_id, canonical_category_id, canonical_subcategory_id, necessity, planning, is_adjustment'),
    tutta<TabelleGrezze['ricevute'][0]>('family_receipts',
      'id, document_id, storage_path, page_order, mime_type, note, status, ambito, uploaded_at'),
    tutta<TabelleGrezze['bozze'][0]>('family_draft_expenses',
      'id, document_id, status, expense_date, group_id, category_id, subcategory, canonical_category_id, canonical_subcategory_id, store, description, payment_method, room_id, expense_nature, confidence, arrotondamento_cent, expense_id'),
    tutta<TabelleGrezze['righeBozza'][0]>('family_draft_items',
      'id, draft_id, raw_name, name, qty, unit_price, discount, amount, group_id, category_id, subcategory, canonical_category_id, canonical_subcategory_id, necessity, planning, confidence, excluded, user_added'),
    tutta<TabelleGrezze['gruppi'][0]>('family_groups', 'id, name, ambito, sort, emoji'),
    tutta<TabelleGrezze['categorie'][0]>('family_categories', 'id, name, group_id, sort'),
    tutta<TabelleGrezze['categorieCanoniche'][0]>('family_canonical_categories', 'id, name'),
    tutta<TabelleGrezze['sottocategorieCanoniche'][0]>('family_canonical_subcategories', 'id, name, canonical_category_id'),
    tutta<TabelleGrezze['camere'][0]>('rooms', 'id, name, active'),  // TUTTE: le archiviate risolvono lo storico
    tutta<NonNullable<TabelleGrezze['budget']>[0]>('family_budgets', 'id, ambito, category_name, monthly_amount'),
    tutta<Rule>('family_product_rules', 'id, keyword, group_id, category_id, track_detail'),
    tutta<Subcat>('family_subcategories', 'id, category_name, name, sort'),
  ])
  return {
    documenti, ponte, spese, righe, ricevute, bozze, righeBozza,
    gruppi, categorie, categorieCanoniche, sottocategorieCanoniche, camere, budget,
    regole, sottocategorieLegacy,
  }
}

// Link firmato al volo (bucket privato): per aprire le foto esistenti.
export async function urlFirmato(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from('scontrini').createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? null
}
