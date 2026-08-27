// Accesso ai dati del modulo spese (estratto da SpeseTracker.tsx in Fase 1).
// UNICO punto che parla con Supabase per le spese: stesse query, stessa
// semantica, stessa tolleranza alle migrazioni non ancora applicate
// (0012/0013/0014/0015). La logica pura di filtro sta in ambito.ts.
import { supabase } from '@/lib/supabase'
import type { Ambito, Group, Category, Rule, Fx, Receipt, Item, Subcat, Budget } from './types'

// ---- caricamento base (tabelle principali; 0007 assente ⇒ needsSetup) ----
export async function caricaBase() {
  const [g, c, r, e] = await Promise.all([
    supabase.from('family_groups').select('*').order('sort'),
    supabase.from('family_categories').select('*').order('sort'),
    supabase.from('family_product_rules').select('*'),
    supabase.from('family_expenses').select('*').order('expense_date', { ascending: false }),
  ])
  if (g.error || e.error) return { needsSetup: true as const }
  return {
    needsSetup: false as const,
    groups: (g.data || []) as Group[],
    cats: (c.data || []) as Category[],
    rules: (r.data || []) as Rule[],
    expenses: (e.data || []) as Fx[],
  }
}

// Dettaglio prodotti: select * per tollerare la colonna category_id
// assente (migrazione 0014 non ancora applicata).
export async function caricaItems(expIds: string[]): Promise<Item[]> {
  if (!expIds.length) return []
  const it = await supabase.from('family_expense_items').select('*').in('expense_id', expIds)
  return it.error ? [] : ((it.data || []) as Item[])
}

// Sottocategorie (tollerante: senza migrazione 0015 restano vuote).
export async function caricaSubcats(): Promise<Subcat[]> {
  const sc = await supabase.from('family_subcategories').select('*').order('sort')
  return sc.error ? [] : ((sc.data || []) as Subcat[])
}

// Budget mensili (tollerante: senza migrazione 0013 la card non appare).
export async function caricaBudgets(ambito: Ambito): Promise<{ ok: boolean; budgets: Budget[] }> {
  const b = await supabase.from('family_budgets').select('*')
  if (b.error) return { ok: false, budgets: [] }
  return { ok: true, budgets: ((b.data || []) as Budget[]).filter(x => (x.ambito || 'personale') === ambito) }
}

// ---- scontrini fotografati, in attesa che Claude li legga ----
export async function caricaScontriniDaLeggere(ambito: Ambito): Promise<Receipt[] | null> {
  const { data, error } = await supabase.from('family_receipts')
    .select('*').eq('status', 'da_leggere').eq('ambito', ambito).order('uploaded_at', { ascending: false })
  if (error) return null // tabella/bucket non ancora pronti: la sezione resta nascosta
  return (data || []) as Receipt[]
}

// Anteprime: link firmati temporanei (il bucket è privato).
export async function urlFirmatiScontrini(receipts: Receipt[]): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  await Promise.all(receipts.map(async r => {
    const { data: s } = await supabase.storage.from('scontrini').createSignedUrl(r.storage_path, 3600)
    if (s?.signedUrl) urls[r.id] = s.signedUrl
  }))
  return urls
}

// Carica UNA foto nell'archivio: file nel bucket + riga in family_receipts.
// Se la riga fallisce, il file appena caricato viene rimosso (niente orfani).
export async function salvaFotoScontrino(file: File, note: string | null, ambito: Ambito): Promise<boolean> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('scontrini').upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (up.error) return false
  const ins = await supabase.from('family_receipts').insert({ storage_path: path, note, ambito })
  if (ins.error) { await supabase.storage.from('scontrini').remove([path]); return false }
  return true
}

export async function eliminaScontrino(r: Receipt) {
  await supabase.storage.from('scontrini').remove([r.storage_path])
  await supabase.from('family_receipts').delete().eq('id', r.id)
}

export async function aggiornaNotaScontrino(id: string, note: string | null) {
  await supabase.from('family_receipts').update({ note }).eq('id', id)
}

// Link firmato al volo per la foto collegata a una spesa (null se manca).
export async function urlFotoScontrino(receiptId: string): Promise<string | null> {
  const { data: rec } = await supabase.from('family_receipts').select('storage_path').eq('id', receiptId).single()
  if (!rec?.storage_path) return null
  const { data: s } = await supabase.storage.from('scontrini').createSignedUrl(rec.storage_path, 3600)
  return s?.signedUrl || null
}

// ---- spese ----
export async function inserisciSpesa(payload: Record<string, unknown>) {
  await supabase.from('family_expenses').insert(payload)
}

export async function eliminaSpesa(id: string) {
  await supabase.from('family_expenses').delete().eq('id', id)
}

// ---- budget ----
export async function salvaBudget(ambito: Ambito, category_name: string, monthly_amount: number) {
  await supabase.from('family_budgets')
    .upsert({ ambito, category_name, monthly_amount }, { onConflict: 'ambito,category_name' })
}

export async function aggiornaBudget(id: string, monthly_amount: number) {
  await supabase.from('family_budgets').update({ monthly_amount }).eq('id', id)
}

export async function eliminaBudget(id: string) {
  await supabase.from('family_budgets').delete().eq('id', id)
}
