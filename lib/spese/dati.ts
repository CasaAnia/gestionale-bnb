// Accesso ai dati del modulo spese (estratto da SpeseTracker.tsx in Fase 1).
// UNICO punto che parla con Supabase per le spese: stesse query, stessa
// semantica, stessa tolleranza alle migrazioni non ancora applicate
// (0012/0013/0014/0015). La logica pura di filtro sta in ambito.ts.
import { supabase } from '@/lib/supabase'
import { scriviPoiAggiorna } from '@/lib/scritturaSicura'
import { esitoLettura, type EsitoLettura } from './esito'
import type { Ambito, Group, Category, Rule, Fx, Receipt, Item, Subcat, Budget } from './types'

// Residui (07/09/2026, pezzo 6): le scritture tornano l'esito di
// lib/scritturaSicura (null = salvato, altrimenti il testo «Non salvato,
// riprova…» da mostrare con AvvisoAzione); nessuna scrittura resta «void».
// Il percorso legacy del contratto di revisione e la logica delle spese NON
// cambiano: stesse query, solo esito e avviso.

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
// Esito esplicito (07/09/2026): `assente` = tabella non ancora creata (la
// sezione resta nascosta, com'era); `errore` = rete/permessi, da mostrare.
export async function caricaScontriniDaLeggere(ambito: Ambito): Promise<EsitoLettura<Receipt>> {
  try {
    const r = await supabase.from('family_receipts')
      .select('*').eq('status', 'da_leggere').eq('ambito', ambito).order('uploaded_at', { ascending: false })
    return esitoLettura<Receipt>({ data: r.data as Receipt[] | null, error: r.error }, 'caricare gli scontrini')
  } catch (err) {
    return esitoLettura<Receipt>({ data: null, error: err }, 'caricare gli scontrini')
  }
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

// Prima la riga, poi il file: se la riga non si cancella il file resta (e la
// foto si rivede); se resta solo il file orfano non è un danno per Ania.
export async function eliminaScontrino(r: Receipt): Promise<string | null> {
  const errore = await scriviPoiAggiorna(() => supabase.from('family_receipts').delete().eq('id', r.id), () => {})
  if (errore) return errore
  await supabase.storage.from('scontrini').remove([r.storage_path])   // file orfano tollerato
  return null
}

export function aggiornaNotaScontrino(id: string, note: string | null): Promise<string | null> {
  return scriviPoiAggiorna(() => supabase.from('family_receipts').update({ note }).eq('id', id), () => {})
}

// Link firmato al volo per la foto collegata a una spesa (null se manca).
export async function urlFotoScontrino(receiptId: string): Promise<string | null> {
  const { data: rec } = await supabase.from('family_receipts').select('storage_path').eq('id', receiptId).single()
  if (!rec?.storage_path) return null
  const { data: s } = await supabase.storage.from('scontrini').createSignedUrl(rec.storage_path, 3600)
  return s?.signedUrl || null
}

// ---- spese ----
export function inserisciSpesa(payload: Record<string, unknown>): Promise<string | null> {
  return scriviPoiAggiorna(() => supabase.from('family_expenses').insert(payload), () => {})
}

export function eliminaSpesa(id: string): Promise<string | null> {
  return scriviPoiAggiorna(() => supabase.from('family_expenses').delete().eq('id', id), () => {})
}

// ---- budget ----
export function salvaBudget(ambito: Ambito, category_name: string, monthly_amount: number): Promise<string | null> {
  return scriviPoiAggiorna(() => supabase.from('family_budgets')
    .upsert({ ambito, category_name, monthly_amount }, { onConflict: 'ambito,category_name' }), () => {})
}

export function aggiornaBudget(id: string, monthly_amount: number): Promise<string | null> {
  return scriviPoiAggiorna(() => supabase.from('family_budgets').update({ monthly_amount }).eq('id', id), () => {})
}

export function eliminaBudget(id: string): Promise<string | null> {
  return scriviPoiAggiorna(() => supabase.from('family_budgets').delete().eq('id', id), () => {})
}
