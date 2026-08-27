// ============================================================================
// CARATTERIZZAZIONE DEL MODULO SPESE — Fase 0 del rifacimento (27/08/2026).
//
// Funzioni PURE che descrivono il comportamento economico atteso, in due parti:
//
//  A) Comportamento ATTUALE: dalla Fase 1 queste funzioni DELEGANO ai moduli
//     estratti (lib/spese/voci.ts e lib/spese/periodo.ts) usati davvero da
//     SpeseTracker — così i test di caratterizzazione verificano il codice
//     di produzione, non una copia.
//
//  B) Regole APPROVATE per il nuovo modulo (decisioni di Ania del 27/08/2026):
//     quadratura obbligatoria, fatture non pagate fuori dallo "Speso",
//     duplicati, raggruppamento per documento. Sono il contratto che
//     l'implementazione delle fasi 3–5 dovrà rispettare.
//
// Nessun accesso a Supabase, nessun dato reale: solo dati sintetici nei test.
// Il denaro viaggia SEMPRE in centesimi interi (niente virgola mobile).
// ============================================================================

// ---- tipi minimi (specchiano le tabelle, coi soli campi che servono qui) ----
export type Gruppo = { id: string; name: string; ambito: 'personale' | 'azienda' }
export type Spesa = {
  id: string
  expense_date: string          // YYYY-MM-DD
  amount: number                // euro, come in tabella
  group_id: string | null
  category_id: string | null
  subcategory?: string | null
  store?: string | null
  product?: string | null
  description?: string | null
  recurring: boolean
  receipt_id: string | null
  // Campi nuovi (0020) — facoltativi finché la migrazione non è applicata.
  // INVARIANTE (Ania, 28/08/2026): qui c'è SOLO denaro realmente uscito,
  // quindi niente payment_status/due_date/review_status: le fatture non
  // pagate e le bozze vivono su family_documents + family_draft_*.
  paid_at?: string | null
  payment_method?: string | null
}
export type Riga = {
  expense_id: string
  name: string
  amount: number
  qty?: number | null
  category_id?: string | null
  subcategory?: string | null
}
export type Voce = { n: string; a: number; q: number; cat: string; sott: string; store: string; d: string; g: string }

// ---- soldi in centesimi ----
export const cent = (euro: number) => Math.round(euro * 100)
export const sommaCent = (importi: number[]) => importi.reduce((s, x) => s + cent(x), 0)

// minuscole senza accenti, come strip() di SpeseTracker.tsx:69
export const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// ============================================================================
// A) COMPORTAMENTO ATTUALE — delega ai moduli estratti in Fase 1
// ============================================================================
import { vociDi as vociDiApp, itemsPerSpesa, fisseMese } from './voci.ts'
import { monthRange as monthRangeApp, weekRange as weekRangeApp } from './periodo.ts'
import type { Fx, Item } from './types.ts'

// lib/spese/voci.ts (ex SpeseTracker.tsx:323) — ogni spesa si scompone nelle
// sue righe; la riga prende la SUA categoria se ce l'ha, sennò quella della
// spesa madre; la sottocategoria segue la stessa regola; una spesa senza
// righe è una voce unica (descrizione, o prodotto, o nome categoria).
export function vociDi(
  spese: Spesa[], righe: Riga[],
  nomeCategoria: (id: string | null | undefined) => string,
  nomeGruppo: (id: string | null) => string,
): Voce[] {
  const items: Item[] = righe.map((r, i) => ({ id: `r${i}`, ...r }))
  return vociDiApp(spese as unknown as Fx[], itemsPerSpesa(items), nomeCategoria, nomeGruppo)
}

// lib/spese/periodo.ts — primo e ultimo giorno del mese YYYY-MM
export const monthRange = monthRangeApp

// lib/spese/periodo.ts — 7 giorni A PARTIRE dalla data scelta (non dal
// lunedì), calcolati in ora locale (non UTC: sennò parte un giorno prima).
export const weekRange = weekRangeApp

// SpeseTracker (periodoRange) — anno intero e intervallo Dal–al (estremi
// facoltativi: vuoto = da sempre / fino a sempre)
export const yearRange = (y: string): [string, string] => [`${y}-01-01`, `${y}-12-31`]
export const intervalloRange = (dal: string, al: string): [string, string] =>
  [dal || '0000-01-01', al || '9999-12-31']

// SpeseTracker.tsx:370 — una spesa sta nel periodo se la data è tra gli
// estremi COMPRESI (confronto tra stringhe YYYY-MM-DD)
export const nelPeriodo = (e: Spesa, [da, a]: [string, string]) =>
  e.expense_date >= da && e.expense_date <= a

// Aggregazione per chiave (gruppo, categoria, sottocategoria, negozio…):
// totale in centesimi per ogni valore della chiave.
export function aggregaVoci(voci: Voce[], chiave: (v: Voce) => string): Map<string, number> {
  const m = new Map<string, number>()
  voci.forEach(v => m.set(chiave(v), (m.get(chiave(v)) || 0) + cent(v.a)))
  return m
}

// La quantità è SEMPRE pezzi/confezioni comprati (regola di Ania), sommata
// tra le voci uguali come in ListaVoci (SpeseTracker.tsx:608-615).
export const sommaQty = (voci: Voce[]) => voci.reduce((s, v) => s + v.q, 0)

// SpeseTracker.tsx:162 — l'ambito viene dal gruppo; una spesa SENZA gruppo
// conta nel personale (inserimenti veloci lasciati vuoti).
export function totaliPerAmbito(spese: Spesa[], gruppi: Gruppo[]): { personale: number; azienda: number } {
  const ambito = new Map(gruppi.map(g => [g.id, g.ambito]))
  const out = { personale: 0, azienda: 0 }
  spese.forEach(e => {
    const a = e.group_id ? ambito.get(e.group_id) ?? 'personale' : 'personale'
    out[a] += cent(e.amount)
  })
  return out
}

// app/page.tsx:36 e app/statistiche/page.tsx:101 — Home e Statistiche
// calcolano le spese aziendali col join sui gruppi azienda: una spesa senza
// gruppo NON entra (differenza voluta rispetto al tracker, che la mette nel
// personale — dove comunque non tocca il profitto).
export function speseAziendaHomeCent(spese: Spesa[], gruppi: Gruppo[]): number {
  const azienda = new Set(gruppi.filter(g => g.ambito === 'azienda').map(g => g.id))
  return spese.filter(e => e.group_id && azienda.has(e.group_id))
    .reduce((s, e) => s + cent(e.amount), 0)
}

// lib/spese/voci.ts (ex SpeseTracker.tsx:419-440) — spese fisse del mese:
// le ricorrenti pagate questo mese (per nome, sommate, ✓) più quelle viste
// il mese scorso e non ancora ripagate (attese, ~). Ordinate per giorno.
// `mesePrecedente` documenta l'atteso: la funzione vera lo deriva da sola
// (monthKey(mese, -1)), quindi qui viene solo verificato.
export function speseFisseMese(spese: Spesa[], mese: string, mesePrecedente: string) {
  const [inizioPrec] = monthRange(mesePrecedente)
  if (inizioPrec.slice(0, 7) !== mesePrecedente) throw new Error('mese precedente non valido')
  return fisseMese(spese as unknown as Fx[], mese)
    .map(f => ({ name: f.name, totCent: cent(f.tot), day: f.day, paid: f.paid }))
}

// ============================================================================
// B) REGOLE APPROVATE PER IL NUOVO MODULO (contratto delle fasi 3–5)
// ============================================================================

// Spese sorelle: le spese che condividono lo stesso documento sono UN
// movimento nella vista documento/movimenti; le spese senza documento sono
// movimenti singoli. Il raggruppamento è SOLO presentazione: la somma dei
// movimenti deve ridare il totale delle spese, e ogni ambito riceve
// esclusivamente le proprie spese (mai il totale del documento).
export function raggruppaPerDocumento(spese: Spesa[]) {
  const perDoc = new Map<string, Spesa[]>()
  const singole: Spesa[] = []
  spese.forEach(e => {
    if (!e.receipt_id) { singole.push(e); return }
    if (!perDoc.has(e.receipt_id)) perDoc.set(e.receipt_id, [])
    perDoc.get(e.receipt_id)!.push(e)
  })
  return [
    ...[...perDoc.entries()].map(([receiptId, gruppo]) => ({
      receiptId, spese: gruppo, totCent: gruppo.reduce((s, e) => s + cent(e.amount), 0),
    })),
    ...singole.map(e => ({ receiptId: null as string | null, spese: [e], totCent: cent(e.amount) })),
  ]
}

// Quadratura ESATTA al centesimo e prezzo unitario: la logica vive in
// lib/spese/controlli.ts (Fase 2A); qui restano involucri di compatibilità
// per i test storici.
import { quadraturaDocumento, rigaCoerente as rigaCoerenteApp, possibileDuplicato as duplicatoApp } from './controlli.ts'

export function quadratura(docTotaleCent: number, righeCent: number[], arrotondamentoCent = 0) {
  const r = quadraturaDocumento(docTotaleCent, [{ righeCent, arrotondamentoCent }])
  return { sommaCent: r.sommaCent, diffCent: r.diffCent ?? 0, ok: r.ok }
}
export const rigaCoerente = rigaCoerenteApp

// Fatture non pagate e bozze (invariante del 28/08/2026): NON esistono in
// family_expenses, quindi lo "Speso" è semplicemente la somma delle spese
// per expense_date (che per le fatture pagate È la data di pagamento).
// Scadenzario e Impegnato vivono sui DOCUMENTI: vedi lib/spese/fatture.ts
// (impegnatoCent, scadute, approvaDaPagare, pagaFattura).
export function contaNelloSpeso(e: Spesa, periodo: [string, string]): boolean {
  return e.expense_date >= periodo[0] && e.expense_date <= periodo[1]
}

export const possibileDuplicato = duplicatoApp
