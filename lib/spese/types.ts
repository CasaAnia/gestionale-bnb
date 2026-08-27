// Tipi del modulo spese (estratti da components/SpeseTracker.tsx in Fase 1
// del rifacimento — stessi nomi e stesse forme, nessun cambiamento).
//
// Rispecchiano le tabelle family_* di Supabase; i campi facoltativi con `?`
// sono colonne di migrazioni che potrebbero non essere ancora applicate
// (il codice le tollera assenti).

export type Ambito = 'personale' | 'azienda'
export type Group = { id: string; name: string; emoji: string | null; sort: number; ambito: string }
export type Category = { id: string; group_id: string; name: string; sort: number }
export type Rule = { id: string; keyword: string; group_id: string | null; category_id: string | null; track_detail: boolean }
export type Fx = {
  id: string; expense_date: string; amount: number; group_id: string | null; category_id: string | null
  store: string | null; product: string | null; description: string | null; recurring: boolean; source: string
  receipt_id: string | null; subcategory?: string | null
}
export type Receipt = { id: string; storage_path: string; note: string | null; status: string; uploaded_at: string }
export type Item = { id: string; expense_id: string; name: string; amount: number; qty?: number | null; category_id?: string | null; subcategory?: string | null }
export type Subcat = { id: string; category_name: string; name: string; sort: number }
export type Budget = { id: string; ambito: string; category_name: string; monthly_amount: number }
// Una "voce": la singola riga di scontrino (o la spesa intera se senza dettaglio)
export type Voce = { n: string; a: number; q: number; cat: string; sott: string; store: string; d: string; g: string; expId: string; rid: string | null }
export type Tab = 'home' | 'calendario' | 'racconto' | 'domanda'
export type Dettaglio = { titolo: string; voci: Voce[] } | null
export type Msg = { io: boolean; t: string }
