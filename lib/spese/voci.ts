// Voci e aggregazioni del modulo spese (estratte da SpeseTracker.tsx in
// Fase 1 — stessa logica, stessi risultati numerici; solo funzioni pure).
import type { Fx, Item, Voce } from './types.ts'
import { strip, corto } from './costanti.ts'
import { monthRange, monthKey } from './periodo.ts'

// Ogni spesa si scompone nelle sue righe di scontrino; la voce prende la
// SUA categoria se ce l'ha (migrazione 0014), sennò quella della spesa;
// stessa regola per la sottocategoria.
export function vociDi(
  spese: Fx[], itemsByExp: Record<string, Item[]>,
  catName: (id: string | null | undefined) => string,
  groupName: (id: string | null) => string,
): Voce[] {
  const out: Voce[] = []
  spese.forEach(e => {
    const catSpesa = catName(e.category_id) || 'Senza categoria'
    const dettagli = itemsByExp[e.id]
    const base = { store: e.store || '', d: e.expense_date, g: groupName(e.group_id), expId: e.id, rid: e.receipt_id }
    if (dettagli?.length) dettagli.forEach(it =>
      out.push({ n: it.name, a: Number(it.amount), q: Number(it.qty) || 1, cat: catName(it.category_id) || catSpesa, sott: it.subcategory || e.subcategory || '', ...base }))
    else out.push({ n: e.description || e.product || catSpesa, a: Number(e.amount), q: 1, cat: catSpesa, sott: e.subcategory || '', ...base })
  })
  return out
}

// Raggruppa le righe per spesa (dall'array piatto di family_expense_items)
export function itemsPerSpesa(items: Item[]): Record<string, Item[]> {
  const m: Record<string, Item[]> = {}
  items.forEach(it => { (m[it.expense_id] || (m[it.expense_id] = [])).push(it) })
  return m
}

// Linea del mese: spesa cumulata giorno per giorno (path SVG 340×56)
export function sparklinePath(speseMese: Fx[], daysInMonth: number, giorniPassati: number): string {
  const perGiorno = Array(daysInMonth).fill(0)
  speseMese.forEach(e => { perGiorno[Number(e.expense_date.slice(-2)) - 1] += Number(e.amount) })
  let cum = 0
  const punti = perGiorno.slice(0, giorniPassati).map((x: number) => cum += x)
  const max = Math.max(1, cum)
  const W = 340, H = 56
  return punti.map((p, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, daysInMonth - 1) * W).toFixed(1)},${(H - p / max * H * 0.9).toFixed(1)}`).join(' ')
}

// Tessere: totale per categoria, con confronto sul mese precedente
export function tessereCategorie(vociMese: Voce[], vociPrec: Voce[]) {
  const cur: Record<string, { tot: number; n: number }> = {}
  vociMese.forEach(v => { const e = cur[v.cat] || (cur[v.cat] = { tot: 0, n: 0 }); e.tot += v.a; e.n++ })
  const prev: Record<string, number> = {}
  vociPrec.forEach(v => { prev[v.cat] = (prev[v.cat] || 0) + v.a })
  return Object.entries(cur)
    .map(([cat, e]) => ({ cat, ...e, prev: prev[cat] || 0 }))
    .sort((a, b) => b.tot - a.tot)
}

// Speso per nome categoria (per i budget)
export function totalePerCategoria(vociMese: Voce[]): Record<string, number> {
  const m: Record<string, number> = {}
  vociMese.forEach(v => { m[v.cat] = (m[v.cat] || 0) + v.a })
  return m
}

// Spese fisse del mese: ricorrenti già pagate questo mese (✓) + attese
// (viste il mese scorso, non ancora ripagate, ~). Ordinate per giorno.
export function fisseMese(rows: Fx[], month: string) {
  const [ms, me] = monthRange(month)
  const [ps, pe] = monthRange(monthKey(month, -1))
  const nameOf = (r: Fx) => (r.description || r.product || r.store || 'Ricorrente').trim()
  const rec = rows.filter(r => r.recurring)
  const out: { name: string; tot: number; day: number; paid: boolean }[] = []
  const seen = new Set<string>()
  rec.filter(r => r.expense_date >= ms && r.expense_date <= me).forEach(r => {
    const name = nameOf(r); const k = strip(name)
    const ex = out.find(x => strip(x.name) === k)
    if (ex) { ex.tot += Number(r.amount); ex.day = Math.max(ex.day, Number(r.expense_date.slice(-2))) }
    else out.push({ name, tot: Number(r.amount), day: Number(r.expense_date.slice(-2)), paid: true })
    seen.add(k)
  })
  rec.filter(r => r.expense_date >= ps && r.expense_date <= pe).forEach(r => {
    const k = strip(nameOf(r))
    if (seen.has(k)) return
    seen.add(k)
    out.push({ name: nameOf(r), tot: Number(r.amount), day: Number(r.expense_date.slice(-2)), paid: false })
  })
  return out.sort((a, b) => a.day - b.day)
}

// Il racconto del mese: voce top, negozio top, acquisto più caro, caffè,
// chi ha speso cosa, confronto col periodo precedente.
export function costruisciRacconto(vociMese: Voce[], vociPrec: Voce[], totMese: number) {
  if (!vociMese.length) return null
  const perCat: Record<string, number> = {}, perG: Record<string, number> = {}, perS: Record<string, number> = {}
  vociMese.forEach(v => {
    perCat[v.cat] = (perCat[v.cat] || 0) + v.a
    perG[v.g] = (perG[v.g] || 0) + v.a
    if (v.store) { const k = corto(v.store); perS[k] = (perS[k] || 0) + v.a }
  })
  const topCat = Object.entries(perCat).sort((a, b) => b[1] - a[1])[0]
  const topS = Object.entries(perS).sort((a, b) => b[1] - a[1])[0]
  const topVoce = [...vociMese].sort((a, b) => b.a - a.a)[0]
  const caffe = vociMese.filter(v => strip(v.n).includes('caffe') || strip(v.n).includes('cappuccino'))
  const gruppi = Object.entries(perG).sort((a, b) => b[1] - a[1])
  const prevTot = vociPrec.reduce((s, v) => s + v.a, 0)
  const diff = prevTot > 0 ? Math.round((totMese - prevTot) / prevTot * 100) : null
  return { topCat, topS, topVoce, caffe, gruppi, prevTot, diff }
}

// Il conto del caffè: quanti caffè/cappuccini bevuti FUORI nel periodo
export function contoCaffe(vociMese: Voce[]) {
  const fuori = new Set(['Colazione/Bar', 'Mangiare fuori', 'Merenda'])
  const voci = vociMese.filter(v => fuori.has(v.cat) && /caff|espresso|cappucc/i.test(v.n))
  const caffe = voci.filter(v => !/cappucc/i.test(v.n))
  const capp = voci.filter(v => /cappucc/i.test(v.n))
  const nC = caffe.reduce((s, v) => s + v.q, 0), nK = capp.reduce((s, v) => s + v.q, 0)
  const tot = voci.reduce((s, v) => s + v.a, 0)
  const pasti = voci.filter(v => v.cat === 'Mangiare fuori').reduce((s, v) => s + v.a, 0)
  return { voci, nC, nK, tot, pasti }
}

// Totale speso per giorno del mese (per la griglia del Calendario)
export function spesePerGiorno(speseMese: Fx[]): Record<number, number> {
  const m: Record<number, number> = {}
  speseMese.forEach(e => { const g = Number(e.expense_date.slice(-2)); m[g] = (m[g] || 0) + Number(e.amount) })
  return m
}
