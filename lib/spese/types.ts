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

// ---- Nuovo modello 0020 (Fase 2A) — tipi delle tabelle nuove ----
import type { DocumentoStato, BozzaStato } from './stati.ts'

export type Documento = {
  id: string
  kind: 'scontrino' | 'fattura' | 'altro'
  doc_total: number | null            // il totale vive QUI, mai sulle spese
  supplier: string | null
  invoice_number: string | null
  document_date: string | null        // data della fattura
  due_date: string | null             // scadenza (sul documento)
  status: DocumentoStato
  ambito: Ambito
  error_message: string | null
  note: string | null
  created_at?: string
}

// Affidabilità PER CAMPO (mai un numero unico per riga)
export type Confidence = Record<string, { proposto?: unknown; confidence?: number; doubt_reason?: string }>

export type Bozza = {
  id: string
  document_id: string | null
  expense_date: string
  group_id: string | null
  category_id?: string | null         // compatibilità
  subcategory?: string | null         // compatibilità
  canonical_category_id?: string | null
  canonical_subcategory_id?: string | null
  store?: string | null
  description?: string | null
  payment_method?: string | null
  room_id?: string | null
  expense_nature?: 'ordinaria' | 'ricorrente' | 'straordinaria' | null
  status: BozzaStato
  confidence: Confidence
  arrotondamento_cent: number         // solo se letto dal documento o dichiarato
  expense_id?: string | null          // collegamento certo bozza → spesa (unique)
}

export type RigaBozza = {
  id: string
  draft_id: string
  raw_name?: string | null            // descrizione originale stampata
  name: string                        // normalizzata
  qty: number
  unit_price?: number | null
  discount: number
  amount: number
  group_id?: string | null            // destinatario della riga
  canonical_category_id?: string | null
  canonical_subcategory_id?: string | null
  necessity?: 'necessario' | 'discrezionale' | null   // facoltative: Claude non le compila
  planning?: 'previsto' | 'impulsivo' | null
  confidence: Confidence
}
