// Controlli del nuovo modulo spese (Fase 2A): quadratura esatta sulle
// sorelle, avvisi non bloccanti, duplicati, coerenza canonica.
// Funzioni pure; il denaro viaggia in centesimi interi.

export const SOGLIA_CONFIDENCE = 0.8 // di partenza: si tara sui primi scontrini veri

// ---------------------------------------------------------------------------
// Quadratura — ESATTA e BLOCCANTE (regola di Ania, 27/08/2026)
// ---------------------------------------------------------------------------
// Somma delle righe di TUTTE le bozze sorelle + arrotondamenti ESPLICITI
// (letti dal documento o dichiarati dall'utente) = doc_total, differenza
// esattamente ZERO. Nessuna tolleranza automatica.
export function quadraturaDocumento(
  docTotaleCent: number | null,
  sorelle: { righeCent: number[]; arrotondamentoCent?: number }[],
) {
  if (docTotaleCent == null) {
    return { ok: false, sommaCent: 0, diffCent: null as number | null, motivo: 'totale documento mancante' }
  }
  const somma = sorelle.reduce((s, b) =>
    s + b.righeCent.reduce((x, c) => x + c, 0) + (b.arrotondamentoCent || 0), 0)
  const diffCent = docTotaleCent - somma
  return { ok: diffCent === 0, sommaCent: somma, diffCent, motivo: diffCent === 0 ? null : 'differenza non dichiarata' }
}

// Prezzo unitario (quando disponibile): unit_price × qty = importo + sconto.
// Qui la tolleranza di 1 centesimo RESTA: copre solo l'arrotondamento del
// prezzo unitario stampato, non il totale del documento.
export function rigaCoerente(unitPrice: number, qty: number, amountCent: number, discountCent = 0) {
  return Math.abs(Math.round(unitPrice * 100 * qty) - (amountCent + discountCent)) <= 1
}

// ---------------------------------------------------------------------------
// Avvisi — visibili e registrati ma NON bloccanti (Ania, 28/08/2026)
// ---------------------------------------------------------------------------
export type Avviso = { campo: string; messaggio: string }

export function avvisiBozza(b: {
  expense_date: string
  group_id?: string | null
  canonical_subcategory_id?: string | null
  subcategory?: string | null
  confidence?: Record<string, { confidence?: number; doubt_reason?: string }>
}, oggi: string): Avviso[] {
  const out: Avviso[] = []
  if (b.expense_date < '2024-11-01')
    out.push({ campo: 'expense_date', messaggio: 'data precedente a novembre 2024' })
  if (b.expense_date > oggi)
    out.push({ campo: 'expense_date', messaggio: 'data futura' })
  if (!b.canonical_subcategory_id && !b.subcategory)
    out.push({ campo: 'subcategory', messaggio: 'sottocategoria non determinabile: mostrare "Non specificata"' })
  if (!b.group_id)
    out.push({ campo: 'group_id', messaggio: 'gruppo mancante' })
  for (const [campo, v] of Object.entries(b.confidence || {})) {
    if (v?.confidence != null && v.confidence < SOGLIA_CONFIDENCE)
      out.push({ campo, messaggio: `affidabilità bassa (${v.confidence})${v.doubt_reason ? `: ${v.doubt_reason}` : ''}` })
  }
  return out
}

// ---------------------------------------------------------------------------
// Duplicati (avviso, mai blocco automatico)
// ---------------------------------------------------------------------------
const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function possibileDuplicato(
  a: { date: string; totCent: number; store?: string | null; sha256?: string | null },
  b: { date: string; totCent: number; store?: string | null; sha256?: string | null },
): 'certo' | 'probabile' | 'possibile' | null {
  if (a.sha256 && b.sha256 && a.sha256 === b.sha256) return 'certo'
  if (a.date !== b.date || a.totCent !== b.totCent) return null
  const sa = strip(a.store || ''), sb = strip(b.store || '')
  if (sa && sa === sb) return 'probabile'
  if (sa && sb && (sa.startsWith(sb) || sb.startsWith(sa))) return 'possibile'
  return null
}

// ---------------------------------------------------------------------------
// Coerenza canonica: la sottocategoria deve appartenere alla categoria
// scelta (lo stesso vincolo della FK composita nella 0020)
// ---------------------------------------------------------------------------
export function canonicaCoerente(
  scelta: { canonical_category_id?: string | null; canonical_subcategory_id?: string | null },
  sottocategorie: { id: string; canonical_category_id: string }[],
): boolean {
  if (!scelta.canonical_subcategory_id) return true       // sottocategoria facoltativa
  if (!scelta.canonical_category_id) return false          // sottocategoria senza categoria: no
  const s = sottocategorie.find(x => x.id === scelta.canonical_subcategory_id)
  return !!s && s.canonical_category_id === scelta.canonical_category_id
}
