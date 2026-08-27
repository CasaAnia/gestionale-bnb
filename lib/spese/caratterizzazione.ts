// ============================================================================
// CARATTERIZZAZIONE DEL MODULO SPESE — Fase 0 del rifacimento (27/08/2026).
//
// Funzioni PURE che descrivono il comportamento economico atteso, in due parti:
//
//  A) Comportamento ATTUALE, copiato pari pari da components/SpeseTracker.tsx
//     (che NON è stato toccato): quando la Fase 1 estrarrà la logica in
//     lib/spese/, i test di caratterizzazione dovranno continuare a passare
//     con le funzioni estratte al posto di queste.
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
  // Campi nuovi (migrazione 0020, fasi 3-5) — facoltativi finché non esiste:
  payment_status?: 'pagata' | 'non_pagata'
  paid_at?: string | null
  due_date?: string | null
  review_status?: 'da_elaborare' | 'da_controllare' | 'pronta' | 'confermata' | 'errore'
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
// A) COMPORTAMENTO ATTUALE (da SpeseTracker.tsx — non modificato)
// ============================================================================

// SpeseTracker.tsx:323 — ogni spesa si scompone nelle sue righe; la riga
// prende la SUA categoria se ce l'ha, sennò quella della spesa madre; la
// sottocategoria segue la stessa regola; una spesa senza righe è una voce
// unica che si chiama come la descrizione (o il prodotto, o la categoria).
export function vociDi(
  spese: Spesa[], righe: Riga[],
  nomeCategoria: (id: string | null | undefined) => string,
  nomeGruppo: (id: string | null) => string,
): Voce[] {
  const perSpesa = new Map<string, Riga[]>()
  righe.forEach(r => {
    if (!perSpesa.has(r.expense_id)) perSpesa.set(r.expense_id, [])
    perSpesa.get(r.expense_id)!.push(r)
  })
  const out: Voce[] = []
  spese.forEach(e => {
    const catSpesa = nomeCategoria(e.category_id) || 'Senza categoria'
    const dettagli = perSpesa.get(e.id)
    const base = { store: e.store || '', d: e.expense_date, g: nomeGruppo(e.group_id) }
    if (dettagli?.length) dettagli.forEach(it =>
      out.push({ n: it.name, a: Number(it.amount), q: Number(it.qty) || 1, cat: nomeCategoria(it.category_id) || catSpesa, sott: it.subcategory || e.subcategory || '', ...base }))
    else out.push({ n: e.description || e.product || catSpesa, a: Number(e.amount), q: 1, cat: catSpesa, sott: e.subcategory || '', ...base })
  })
  return out
}

// SpeseTracker.tsx:336 — primo e ultimo giorno del mese YYYY-MM
export function monthRange(m: string): [string, string] {
  const [y, mo] = m.split('-').map(Number)
  const last = new Date(y, mo, 0).getDate()
  return [`${m}-01`, `${m}-${String(last).padStart(2, '0')}`]
}

// SpeseTracker.tsx:351 — 7 giorni A PARTIRE dalla data scelta (non dal
// lunedì), calcolati in ora locale (non UTC: sennò parte un giorno prima).
export function weekRange(d: string): [string, string] {
  const dt = new Date(d + 'T00:00:00')
  const end = new Date(dt); end.setDate(dt.getDate() + 6)
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return [fmt(dt), fmt(end)]
}

// SpeseTracker.tsx:360-363 — anno intero e intervallo Dal–al (estremi
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

// SpeseTracker.tsx:419-440 — spese fisse del mese: le ricorrenti pagate
// questo mese (per nome, sommate, ✓) più quelle viste il mese scorso e non
// ancora ripagate (attese, ~). Ordinate per giorno.
export function speseFisseMese(spese: Spesa[], mese: string, mesePrecedente: string) {
  const [ms, me] = monthRange(mese)
  const [ps, pe] = monthRange(mesePrecedente)
  const nomeDi = (r: Spesa) => (r.description || r.product || r.store || 'Ricorrente').trim()
  const rec = spese.filter(r => r.recurring)
  const out: { name: string; totCent: number; day: number; paid: boolean }[] = []
  const viste = new Set<string>()
  rec.filter(r => r.expense_date >= ms && r.expense_date <= me).forEach(r => {
    const name = nomeDi(r); const k = strip(name)
    const ex = out.find(x => strip(x.name) === k)
    if (ex) { ex.totCent += cent(r.amount); ex.day = Math.max(ex.day, Number(r.expense_date.slice(-2))) }
    else out.push({ name, totCent: cent(r.amount), day: Number(r.expense_date.slice(-2)), paid: true })
    viste.add(k)
  })
  rec.filter(r => r.expense_date >= ps && r.expense_date <= pe).forEach(r => {
    const k = strip(nomeDi(r))
    if (viste.has(k)) return
    viste.add(k)
    out.push({ name: nomeDi(r), totCent: cent(r.amount), day: Number(r.expense_date.slice(-2)), paid: false })
  })
  return out.sort((a, b) => a.day - b.day)
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

// Quadratura obbligatoria: somma delle righe (sconti già incorporati nei
// prezzi, regola esistente) + eventuale arrotondamento = totale documento,
// con tolleranza di 1 centesimo. Se non torna, la spesa DEVE restare
// "da controllare" e la conferma è bloccata.
export function quadratura(docTotaleCent: number, righeCent: number[], arrotondamentoCent = 0) {
  const somma = righeCent.reduce((s, x) => s + x, 0) + arrotondamentoCent
  const diffCent = docTotaleCent - somma
  return { sommaCent: somma, diffCent, ok: Math.abs(diffCent) <= 1 }
}

// Prezzo unitario (quando disponibile): unit_price × qty deve ridare
// l'importo della riga più lo sconto, al centesimo.
export function rigaCoerente(unitPrice: number, qty: number, amountCent: number, discountCent = 0) {
  return Math.abs(Math.round(unitPrice * 100 * qty) - (amountCent + discountCent)) <= 1
}

// Fatture Casa Ania (decisione di Ania, 27/08/2026): una spesa entra nel
// totale principale "Speso" SOLO alla data effettiva di pagamento. Non
// pagata ⇒ mai nello Speso (sta in Impegnato/Da pagare). Le spese normali
// (senza payment_status) sono pagate per definizione alla loro data.
// Le bozze (review_status diverso da confermata) non contano mai.
export function contaNelloSpeso(e: Spesa, periodo: [string, string]): boolean {
  if (e.review_status && e.review_status !== 'confermata') return false
  if (e.payment_status === 'non_pagata') return false
  const dataEffettiva = e.paid_at || e.expense_date
  return dataEffettiva >= periodo[0] && dataEffettiva <= periodo[1]
}

// Impegnato/Da pagare: le fatture confermate ma non pagate, con lo stato
// "scaduta" DERIVATO (non salvato): non pagata + scadenza superata.
export function scadenzario(spese: Spesa[], oggi: string) {
  const daPagare = spese.filter(e =>
    (!e.review_status || e.review_status === 'confermata') && e.payment_status === 'non_pagata')
  return {
    daPagare,
    impegnatoCent: daPagare.reduce((s, e) => s + cent(e.amount), 0),
    scadute: daPagare.filter(e => e.due_date != null && e.due_date < oggi),
  }
}

// Possibili duplicati (avviso, mai blocco): 'certo' = stesso file (sha256);
// 'probabile' = stesso negozio + data + totale al centesimo; 'possibile' =
// stessi data e totale con negozio simile. Altrimenti nessun sospetto.
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
