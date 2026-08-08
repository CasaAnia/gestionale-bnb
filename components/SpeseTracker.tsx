'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BackBar from '@/components/BackBar'
import DemoGate from '@/components/DemoGate'
import { isDemoMode } from '@/lib/demoMode'

// Tracker spese riutilizzabile. Due ambiti:
//  - 'personale' → Spese Famiglia (gruppi: Casa, Ania, Matteo, Matteo e Ania)
//  - 'azienda'   → Spese B&B (gruppo Casa Granata / Casa Ania), contano nel profitto
// Due livelli (gruppo → categoria), più negozio, prodotto seguito, flag
// ricorrente, regole prodotto→gruppo, foto scontrini.

type Ambito = 'personale' | 'azienda'
type Group = { id: string; name: string; emoji: string | null; sort: number; ambito: string }
type Category = { id: string; group_id: string; name: string; sort: number }
type Rule = { id: string; keyword: string; group_id: string | null; category_id: string | null; track_detail: boolean }
type Fx = {
  id: string; expense_date: string; amount: number; group_id: string | null; category_id: string | null
  store: string | null; product: string | null; description: string | null; recurring: boolean; source: string
  receipt_id: string | null
}
type Receipt = { id: string; storage_path: string; note: string | null; status: string; uploaded_at: string }
type Item = { id: string; expense_id: string; name: string; amount: number }
type Budget = { id: string; ambito: string; category_name: string; monthly_amount: number }

const GROUP_COLORS: Record<string, string> = {
  'Casa': '#5B8A70', 'Ania': '#BCA06A', 'Matteo': '#8AA1B8',
  'Matteo e Ania': '#AD90A8', 'Casa Ania': '#BC7E6E',
}
const FALLBACK_COLOR = '#9AA096'
const ACCENT = '#7D9DB0' // azzurro carta da zucchero, come "pagato" in arrivi/calendario
const BAR_COLOR = '#D2A98C' // pesca tenue per le barre categoria
const eur = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const eur2 = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export default function SpeseTracker({ ambito, title }: { ambito: Ambito; title: string }) {
  return <DemoGate><Tracker ambito={ambito} title={title} /></DemoGate>
}

function Tracker({ ambito, title }: { ambito: Ambito; title: string }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [rows, setRows] = useState<Fx[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [periodMode, setPeriodMode] = useState<'mese' | 'settimana' | 'anno' | 'intervallo'>('mese')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [weekAnchor, setWeekAnchor] = useState(new Date().toISOString().split('T')[0])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('') // '' = tutti
  const [catFilter, setCatFilter] = useState<string>('') // nome categoria, '' = tutte
  const [senzaCaffe, setSenzaCaffe] = useState(false) // con Mangiare fuori: nasconde le righe Caffè
  const [caffeFilter, setCaffeFilter] = useState(false) // voce "☕ Caffè": solo le righe Caffè, tutte le categorie
  const [search, setSearch] = useState('')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Budget mensili per categoria (tabella family_budgets; se la migrazione
  // 0013 non e' ancora applicata la card resta nascosta).
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetsOk, setBudgetsOk] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ category_name: '', amount: '' })

  const blankForm = () => ({
    expense_date: new Date().toISOString().split('T')[0],
    amount: '', group_id: '', category_id: '', store: '', product: '', description: '', recurring: false,
  })
  const [form, setForm] = useState(blankForm())
  const [autoGroup, setAutoGroup] = useState<string | null>(null) // regola prodotto scattata
  const [saving, setSaving] = useState(false)

  // Scontrini fotografati, in attesa che Claude li legga.
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({})
  const [receiptNote, setReceiptNote] = useState('')
  const [uploading, setUploading] = useState(false)
  // Foto scelte ma non ancora salvate (si salvano col bottone Salva).
  const [staged, setStaged] = useState<{ file: File; url: string }[]>([])

  async function loadReceipts() {
    const { data, error } = await supabase.from('family_receipts')
      .select('*').eq('status', 'da_leggere').eq('ambito', ambito).order('uploaded_at', { ascending: false })
    if (error) return // tabella/bucket non ancora pronti: la sezione resta nascosta
    const list = (data || []) as Receipt[]
    setReceipts(list)
    // Anteprime: link firmati temporanei (il bucket è privato).
    const urls: Record<string, string> = {}
    await Promise.all(list.map(async r => {
      const { data: s } = await supabase.storage.from('scontrini').createSignedUrl(r.storage_path, 3600)
      if (s?.signedUrl) urls[r.id] = s.signedUrl
    }))
    setReceiptUrls(urls)
  }

  async function load() {
    if (isDemoMode()) return // in dimostrazione non si carica nulla
    setLoading(true)
    const [g, c, r, e] = await Promise.all([
      supabase.from('family_groups').select('*').order('sort'),
      supabase.from('family_categories').select('*').order('sort'),
      supabase.from('family_product_rules').select('*'),
      supabase.from('family_expenses').select('*').order('expense_date', { ascending: false }),
    ])
    if (g.error || e.error) { setNeedsSetup(true); setLoading(false); return } // migrazione non ancora applicata
    // Tiene solo i gruppi di questo ambito (personale o azienda), e di
    // conseguenza solo le sue categorie, regole e spese.
    const myGroups = (g.data || []).filter((x: Group) => (x.ambito || 'personale') === ambito)
    const myIds = new Set(myGroups.map((x: Group) => x.id))
    setGroups(myGroups)
    setCats((c.data || []).filter((x: Category) => myIds.has(x.group_id)))
    setRules((r.data || []).filter((x: Rule) => x.group_id != null && myIds.has(x.group_id)))
    // Spese dell'ambito: gruppo appartenente a questo ambito. Nel personale
    // mostro anche quelle senza gruppo (inserimenti veloci lasciati vuoti).
    const myExpenses = (e.data || []).filter((x: Fx) => myIds.has(x.group_id || '') || (ambito === 'personale' && !x.group_id))
    setRows(myExpenses)
    setLoading(false)
    loadReceipts()
    // Dettaglio prodotti delle spese di questo ambito (per "dove spendi di più").
    const expIds = myExpenses.map((x: Fx) => x.id)
    if (expIds.length) {
      const it = await supabase.from('family_expense_items').select('id, expense_id, name, amount').in('expense_id', expIds)
      if (!it.error) setItems((it.data || []) as Item[])
    } else setItems([])
    // Budget mensili (tollerante: senza migrazione 0013 la card non appare).
    const b = await supabase.from('family_budgets').select('*')
    if (!b.error) {
      setBudgets(((b.data || []) as Budget[]).filter(x => (x.ambito || 'personale') === ambito))
      setBudgetsOk(true)
    }
  }
  useEffect(() => { load() }, [])

  // Aggiunge le foto scelte all'anteprima (non le salva ancora).
  function stagePhotos(files: FileList) {
    const next = Array.from(files).map(file => ({ file, url: URL.createObjectURL(file) }))
    setStaged(prev => [...prev, ...next])
  }
  function removeStaged(i: number) {
    setStaged(prev => { URL.revokeObjectURL(prev[i]?.url); return prev.filter((_, idx) => idx !== i) })
  }

  // Salva le foto in anteprima nell'archivio del gestionale (col Salva).
  // Se qualcosa fallisce, avvisa e TIENE le foto non salvate per riprovare.
  async function saveStaged() {
    if (!staged.length) return
    setUploading(true)
    const note = receiptNote.trim() || null
    const remaining: typeof staged = []
    let ok = 0
    try {
      for (const s of staged) {
        const ext = (s.file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('scontrini').upload(path, s.file, { contentType: s.file.type || 'image/jpeg' })
        if (up.error) { remaining.push(s); continue }
        const ins = await supabase.from('family_receipts').insert({ storage_path: path, note, ambito })
        if (ins.error) { await supabase.storage.from('scontrini').remove([path]); remaining.push(s); continue }
        URL.revokeObjectURL(s.url); ok++
      }
    } catch (e: any) {
      setUploading(false)
      alert('Salvataggio interrotto — probabile connessione assente. Le foto sono ancora qui: riprova.\n(' + (e?.message || 'errore di rete') + ')')
      return
    }
    setUploading(false)
    if (remaining.length) {
      setStaged(remaining)
      alert(`${ok > 0 ? ok + ' salvati. ' : ''}${remaining.length} non salvati: riprova (controlla la connessione).`)
    } else {
      setStaged([]); setReceiptNote('')
    }
    loadReceipts()
  }

  async function deleteReceipt(r: Receipt) {
    if (!confirm('Eliminare questa foto?')) return
    await supabase.storage.from('scontrini').remove([r.storage_path])
    await supabase.from('family_receipts').delete().eq('id', r.id)
    setReceipts(receipts.filter(x => x.id !== r.id))
  }

  // Aggiunge/modifica la nota di uno scontrino già caricato (l'ordine foto/nota
  // non conta più: la puoi scrivere anche dopo).
  async function editReceiptNote(r: Receipt) {
    const nota = prompt('Nota per questo scontrino (indicazioni per me):', r.note || '')
    if (nota === null) return
    const value = nota.trim() || null
    await supabase.from('family_receipts').update({ note: value }).eq('id', r.id)
    setReceipts(receipts.map(x => x.id === r.id ? { ...x, note: value } : x))
  }

  // Riapre la foto dello scontrino collegato a una spesa (link firmato al volo).
  async function openReceiptPhoto(receiptId: string) {
    const { data: rec } = await supabase.from('family_receipts').select('storage_path').eq('id', receiptId).single()
    if (!rec?.storage_path) { alert('Foto non trovata.'); return }
    const { data: s } = await supabase.storage.from('scontrini').createSignedUrl(rec.storage_path, 3600)
    if (s?.signedUrl) window.open(s.signedUrl, '_blank')
  }

  const groupName = (id: string | null) => groups.find(x => x.id === id)?.name || '—'
  const catName = (id: string | null) => cats.find(x => x.id === id)?.name || ''
  const colorOf = (id: string | null) => GROUP_COLORS[groupName(id)] || FALLBACK_COLOR
  const stores = useMemo(() => Array.from(new Set(rows.map(r => r.store).filter(Boolean))) as string[], [rows])

  // Applica le regole prodotto: se descrizione/prodotto contiene una keyword,
  // propone il gruppo giusto (e riempie il prodotto seguito se track_detail).
  function applyRules(text: string, current: ReturnType<typeof blankForm>) {
    const t = strip(text)
    for (const rule of rules) {
      if (t.includes(strip(rule.keyword))) {
        const next = { ...current }
        if (rule.group_id) { next.group_id = rule.group_id; next.category_id = '' }
        if (rule.track_detail && !next.product) next.product = rule.keyword
        setAutoGroup(rule.group_id ? groupName(rule.group_id) : null)
        return next
      }
    }
    setAutoGroup(null)
    return current
  }

  async function save() {
    if (!form.amount || !form.expense_date) return
    setSaving(true)
    await supabase.from('family_expenses').insert({
      expense_date: form.expense_date,
      amount: parseFloat(form.amount.replace(',', '.')),
      // Se c'è un solo gruppo (caso azienda) e non è stato scelto, lo assegno da solo.
      group_id: form.group_id || (groups.length === 1 ? groups[0].id : null),
      category_id: form.category_id || null,
      store: form.store.trim() || null,
      product: form.product.trim() || null,
      description: form.description.trim() || null,
      recurring: form.recurring,
      source: 'manuale',
    })
    setForm(blankForm()); setAutoGroup(null); setShowForm(false); setSaving(false); load()
  }

  async function del(id: string) {
    if (!confirm('Eliminare questa spesa?')) return
    await supabase.from('family_expenses').delete().eq('id', id)
    setRows(rows.filter(r => r.id !== id))
  }

  // ---- budget mensili ----
  async function saveBudget() {
    const name = budgetForm.category_name
    const amt = parseFloat(budgetForm.amount.replace(',', '.'))
    if (!name || !amt) return
    await supabase.from('family_budgets')
      .upsert({ ambito, category_name: name, monthly_amount: amt }, { onConflict: 'ambito,category_name' })
    setBudgetForm({ category_name: '', amount: '' }); setShowBudgetForm(false); load()
  }
  async function editBudget(b: Budget) {
    const v = prompt(`Budget mensile per "${b.category_name}" (vuoto per toglierlo):`, String(b.monthly_amount))
    if (v === null) return
    const amt = parseFloat(v.replace(',', '.'))
    if (!v.trim() || !amt) await supabase.from('family_budgets').delete().eq('id', b.id)
    else await supabase.from('family_budgets').update({ monthly_amount: amt }).eq('id', b.id)
    load()
  }

  // ---- dati del periodo ----
  // Intervallo [inizio, fine] inclusi (stringhe YYYY-MM-DD) del periodo scelto.
  function monthRange(m: string): [string, string] {
    const [y, mo] = m.split('-').map(Number)
    const last = new Date(y, mo, 0).getDate()
    return [`${m}-01`, `${m}-${String(last).padStart(2, '0')}`]
  }
  function weekRange(d: string): [string, string] {
    // 7 giorni a partire dalla data scelta (inizio = data, non il lunedì).
    const dt = new Date(d + 'T00:00:00')
    const end = new Date(dt); end.setDate(dt.getDate() + 6)
    const fmt = (x: Date) => x.toISOString().split('T')[0]
    return [fmt(dt), fmt(end)]
  }
  const [periodStart, periodEnd] = periodMode === 'mese' ? monthRange(month)
    : periodMode === 'settimana' ? weekRange(weekAnchor)
    : periodMode === 'anno' ? [`${year}-01-01`, `${year}-12-31`]
    : [fromDate || '0000-01-01', toDate || '9999-12-31']

  const periodRows = rows.filter(r => r.expense_date >= periodStart && r.expense_date <= periodEnd)
  // Ricerca libera su negozio + descrizione + prodotto, E dentro il dettaglio
  // prodotti dello scontrino (accenti/maiuscole ignorati).
  const q = strip(search.trim())
  const itemMatchIds = useMemo(
    () => q ? new Set(items.filter(it => strip(it.name).includes(q)).map(it => it.expense_id)) : new Set<string>(),
    [items, q])
  const searched = q
    ? periodRows.filter(r => strip(`${r.store || ''} ${r.description || ''} ${r.product || ''}`).includes(q) || itemMatchIds.has(r.id))
    : periodRows
  const grouped = groupFilter ? searched.filter(r => r.group_id === groupFilter) : searched
  // Filtro per nome categoria (non per id): così "Bar" vale per tutti i gruppi
  // che hanno una categoria con quel nome, anche con "Tutti" selezionato.
  const catOf = (r: Fx) => catName(r.category_id) || 'Senza categoria'
  const isCaffeRow = (r: Fx) => strip(r.description || '') === 'caffe'
  // Interruttore "senza caffè": filtrando Mangiare fuori si può togliere il
  // caffè scorporato dai pasti (righe con descrizione "Caffè").
  const noCaffe = (r: Fx) => !(senzaCaffe && catFilter === 'Mangiare fuori' && isCaffeRow(r))
  // Voce trasversale "☕ Caffè": tutte le righe Caffè di qualunque categoria
  // (colazione sotto Bar, pranzo/cena sotto Mangiare fuori) nel periodo scelto.
  const filtered = caffeFilter
    ? grouped.filter(isCaffeRow)
    : (catFilter ? grouped.filter(r => catOf(r) === catFilter) : grouped).filter(noCaffe)
  const totale = filtered.reduce((s, r) => s + Number(r.amount), 0)

  // Aggregato per gruppo: rispetta il filtro categoria (ma non quello gruppo,
  // così le card degli altri gruppi restano visibili quando uno è attivo).
  const perGroup = useMemo(() => {
    const base = caffeFilter
      ? searched.filter(isCaffeRow)
      : (catFilter ? searched.filter(r => catOf(r) === catFilter) : searched).filter(noCaffe)
    const m: Record<string, number> = {}
    base.forEach(r => { const k = r.group_id || 'none'; m[k] = (m[k] || 0) + Number(r.amount) })
    return groups.map(g => ({ g, tot: m[g.id] || 0 })).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot)
  }, [searched, groups, catFilter, cats, senzaCaffe, caffeFilter])
  const maxGroup = Math.max(1, ...perGroup.map(x => x.tot))

  // Aggregato per nome categoria sulle righe già filtrate per gruppo (ma non
  // per categoria, così le barre restano tutte visibili quando una è attiva).
  const perCatAll = useMemo(() => {
    const m: Record<string, { tot: number; n: number }> = {}
    grouped.forEach(r => {
      const k = catName(r.category_id) || 'Senza categoria'
      const e = m[k] || (m[k] = { tot: 0, n: 0 })
      e.tot += Number(r.amount); e.n += 1
    })
    return Object.entries(m).map(([name, { tot, n }]) => ({ name, tot, n })).sort((a, b) => b.tot - a.tot)
  }, [grouped, cats])
  // Chip "Per cosa": la categoria con più spese registrate viene prima.
  const perCatByUse = useMemo(() => [...perCatAll].sort((a, b) => b.n - a.n), [perCatAll])
  const perCat = perCatAll.slice(0, 8)
  const maxCat = Math.max(1, ...perCat.map(x => x.tot))

  // Se cambio periodo/gruppo/ricerca e la categoria scelta sparisce, la tolgo.
  useEffect(() => {
    if (catFilter && !perCatAll.some(c => c.name === catFilter)) setCatFilter('')
  }, [catFilter, perCatAll])

  // Totale per negozio (dove spendi di più, negozio per negozio).
  const perStore = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(r => { const s = (r.store || '').trim(); if (s) m[s] = (m[s] || 0) + Number(r.amount) })
    return Object.entries(m).map(([store, tot]) => ({ store, tot })).sort((a, b) => b.tot - a.tot).slice(0, 8)
  }, [filtered])
  const maxStore = Math.max(1, ...perStore.map(x => x.tot))

  // Prodotti dove spendi di più: aggrega i dettagli-prodotto delle spese del
  // periodo (+ gruppo). Fa emergere anche voci insospettabili.
  const topProducts = useMemo(() => {
    const scope = new Set(filtered.map(r => r.id))
    const m: Record<string, number> = {}
    items.forEach(it => {
      if (!scope.has(it.expense_id)) return
      if (q && !strip(it.name).includes(q)) return // in ricerca, solo i prodotti che combaciano
      const name = it.name.trim(); if (!name) return
      m[name] = (m[name] || 0) + Number(it.amount)
    })
    return Object.entries(m).map(([name, tot]) => ({ name, tot })).sort((a, b) => b.tot - a.tot)
  }, [items, filtered, q])
  const maxProduct = Math.max(1, ...topProducts.map(x => x.tot))

  // ---- confronto e andamento (vista Mese) ----
  // Mese a distanza `offset` dal mese scelto (es. -1 = mese precedente).
  const monthKey = (offset: number) => {
    const [y, mo] = month.split('-').map(Number)
    const d = new Date(y, mo - 1 + offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const monthLabel = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString('it-IT', { month: 'long' })
  // Stesse spese filtrate (ricerca, gruppo, categoria) ma su TUTTI i mesi:
  // servono per confrontare il mese scelto con i precedenti a parita' di filtri.
  const filteredAll = rows.filter(r =>
    (!q || strip(`${r.store || ''} ${r.description || ''} ${r.product || ''}`).includes(q) || itemMatchIds.has(r.id))
    && (!groupFilter || r.group_id === groupFilter)
    && (caffeFilter ? isCaffeRow(r) : (!catFilter || catOf(r) === catFilter) && noCaffe(r)))
  const chartMonths = [-5, -4, -3, -2, -1, 0].map(off => {
    const m = monthKey(off)
    const [s, e] = monthRange(m)
    return { m, tot: filteredAll.filter(r => r.expense_date >= s && r.expense_date <= e).reduce((sum, r) => sum + Number(r.amount), 0) }
  })
  const maxChart = Math.max(1, ...chartMonths.map(x => x.tot))
  const prevTot = chartMonths[4].tot
  const diffPct = prevTot > 0 ? Math.round(((totale - prevTot) / prevTot) * 100) : null
  // Media al giorno e stima di fine mese (solo per il mese in corso).
  const oggi = new Date()
  const isCurrentMonth = month === oggi.toISOString().slice(0, 7)
  const daysInMonth = Number(monthRange(month)[1].slice(-2))
  const mediaGiorno = totale / (isCurrentMonth ? oggi.getDate() : daysInMonth)
  const previsione = mediaGiorno * daysInMonth

  // ---- budget mensili: speso per nome categoria nel mese scelto (senza
  // filtri: il budget e' un tetto assoluto, non segue ricerca/gruppo) ----
  const spentByCat = useMemo(() => {
    const m: Record<string, number> = {}
    periodRows.forEach(r => { const k = catName(r.category_id) || 'Senza categoria'; m[k] = (m[k] || 0) + Number(r.amount) })
    return m
  }, [periodRows, cats])
  const budgetRows = budgets
    .map(b => ({ b, spent: spentByCat[b.category_name] || 0 }))
    .sort((x, y) => y.spent / y.b.monthly_amount - x.spent / x.b.monthly_amount)
  const budgetColor = (ratio: number) => ratio >= 1 ? '#8C3B2E' : ratio >= 0.9 ? '#B07D4F' : '#5B8A70'
  const catNames = Array.from(new Set(cats.map(c => c.name))).sort()

  // ---- spese fisse del mese: ricorrenti gia' pagate + attese (viste il
  // mese scorso ma non ancora in questo), col giorno stimato dall'ultima volta ----
  const fisse = useMemo(() => {
    if (periodMode !== 'mese') return []
    const [ms, me] = monthRange(month)
    const [ps, pe] = monthRange(monthKey(-1))
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
    // rows e' ordinato dal piu' recente: la prima occorrenza e' l'ultima pagata.
    rec.filter(r => r.expense_date >= ps && r.expense_date <= pe).forEach(r => {
      const k = strip(nameOf(r))
      if (seen.has(k)) return
      seen.add(k)
      out.push({ name: nameOf(r), tot: Number(r.amount), day: Number(r.expense_date.slice(-2)), paid: false })
    })
    return out.sort((a, b) => a.day - b.day)
  }, [rows, month, periodMode])
  const fisseTot = fisse.reduce((s, x) => s + x.tot, 0)

  // Prodotti seguiti (track_detail): totale del mese per ciascuno.
  const tracked = useMemo(() => {
    const keys = rules.filter(r => r.track_detail).map(r => r.keyword)
    return keys.map(k => {
      const tot = periodRows
        .filter(r => strip(`${r.product || ''} ${r.description || ''}`).includes(strip(k)))
        .reduce((s, r) => s + Number(r.amount), 0)
      return { k, tot }
    }).filter(x => x.tot > 0)
  }, [periodRows, rules])

  const catsForGroup = cats.filter(c => c.group_id === form.group_id)

  if (needsSetup) return (
    <div className="p-4">
      <BackBar href="/" />
      <div className="bg-white rounded-[10px] border border-card-border p-5 text-sm text-green-dark">
        <p className="font-serif text-lg mb-2">{title}</p>
        <p className="text-gray-600">La sezione è pronta, ma manca un passaggio: applicare la migrazione del database.</p>
        <p className="text-gray-600 mt-2">Apri Supabase → SQL Editor e incolla il file <code className="bg-sand px-1 rounded">0007_spese_famiglia.sql</code>, poi ricarica.</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 pb-24">
      <BackBar href="/" />
      <h1 className="font-serif text-xl text-green-dark max-lg:hidden mb-4">{title}</h1>

      {/* SCONTRINI DA LEGGERE */}
      <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">📷 Scontrini</p>
          {receipts.length > 0 && (
            <span className="text-xs bg-sand text-[#7A5C1E] px-2 py-0.5 rounded-full">{receipts.length} da leggere</span>
          )}
        </div>

        {/* 1. Bottone principale: apre direttamente la fotocamera */}
        {staged.length === 0 && (
          <>
            <label className="w-full flex items-center justify-center gap-2 bg-green-mid text-white rounded-2xl py-5 text-lg font-semibold cursor-pointer transition active:scale-[0.98]">
              📷 Scatta scontrino
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files; if (f && f.length) stagePhotos(f); e.currentTarget.value = '' }} />
            </label>
            {/* Alternative usate di rado: piccole, sotto */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button onClick={() => { setShowForm(!showForm); setForm(blankForm()); setAutoGroup(null) }}
                className="rounded-lg py-2 text-xs bg-[#FBF9F4] border border-card-border text-gray-600 transition active:scale-[0.97]">
                {showForm ? '✕ Chiudi' : '＋ Aggiungi'}
              </button>
              <label className="rounded-lg py-2 text-xs bg-[#FBF9F4] border border-card-border text-gray-600 text-center cursor-pointer transition active:scale-[0.97]">
                🖼️ Libreria
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { const f = e.target.files; if (f && f.length) stagePhotos(f); e.currentTarget.value = '' }} />
              </label>
              <label className="rounded-lg py-2 text-xs bg-[#FBF9F4] border border-card-border text-gray-600 text-center cursor-pointer transition active:scale-[0.97]">
                📁 File
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { const f = e.target.files; if (f && f.length) stagePhotos(f); e.currentTarget.value = '' }} />
              </label>
            </div>
          </>
        )}

        {/* 2. Anteprima + nota + Salva */}
        {staged.length > 0 && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {staged.map((s, i) => (
                <div key={i} className="relative">
                  <img src={s.url} alt="anteprima" className="w-full h-24 object-cover rounded-lg border border-card-border" />
                  <button onClick={() => removeStaged(i)}
                    className="absolute top-1 right-1 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center text-[#8C3B2E] text-sm shadow-sm">✕</button>
                </div>
              ))}
              <label className="h-24 flex flex-col items-center justify-center gap-1 border border-dashed border-card-border rounded-lg text-gray-400 text-xs cursor-pointer">
                <span className="text-xl">＋</span>altra foto
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { const f = e.target.files; if (f && f.length) stagePhotos(f); e.currentTarget.value = '' }} />
              </label>
            </div>
            <textarea value={receiptNote} onChange={e => setReceiptNote(e.target.value)} rows={2}
              placeholder="Nota:"
              className="w-full border border-card-border rounded-lg p-2 text-sm mb-2 resize-none" />
            <button onClick={saveStaged} disabled={uploading}
              className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
              {uploading ? 'Salvataggio…' : `💾 Salva ${staged.length > 1 ? staged.length + ' scontrini' : 'scontrino'}`}
            </button>
          </div>
        )}

        {receipts.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {receipts.map(r => (
              <div key={r.id} className="relative">
                {receiptUrls[r.id]
                  ? <img src={receiptUrls[r.id]} alt="scontrino" onClick={() => window.open(receiptUrls[r.id], '_blank')}
                      className="w-full h-24 object-cover rounded-lg border border-card-border cursor-pointer" />
                  : <div className="w-full h-24 rounded-lg bg-sand flex items-center justify-center text-2xl">🧾</div>}
                <button onClick={() => editReceiptNote(r)} className="block w-full text-left text-[10px] text-gray-500 mt-0.5 truncate">
                  {r.note ? r.note : <span className="text-brass">✏️ aggiungi nota</span>}
                </button>
                <button onClick={() => deleteReceipt(r)}
                  className="absolute top-1 right-1 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center text-[#8C3B2E] text-sm shadow-sm">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FORM */}
      {showForm && (
        <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
          <p className="font-semibold mb-3">Nuova spesa</p>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
              className="border border-card-border rounded-lg p-2 text-sm" />
            <input inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="Importo €" className="border border-card-border rounded-lg p-2 text-sm" />
          </div>

          <input value={form.description}
            onChange={e => setForm(applyRules(e.target.value, { ...form, description: e.target.value }))}
            placeholder="Descrizione (es. bar, Esselunga, vodka…)" className="w-full border border-card-border rounded-lg p-2 text-sm mb-2" />

          {autoGroup && (
            <p className="text-xs mb-2 px-2 py-1 rounded-lg" style={{ background: '#F3ECD8', color: '#7A5C1E' }}>
              Regola prodotto → assegnato a <b>{autoGroup}</b> (puoi cambiarlo qui sotto)
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2">
            <select value={form.group_id} onChange={e => { setForm({ ...form, group_id: e.target.value, category_id: '' }); setAutoGroup(null) }}
              className="border border-card-border rounded-lg p-2 text-sm">
              <option value="">Gruppo…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
              disabled={!form.group_id} className="border border-card-border rounded-lg p-2 text-sm disabled:opacity-50">
              <option value="">Categoria…</option>
              {catsForGroup.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <input list="stores-list" value={form.store} onChange={e => setForm({ ...form, store: e.target.value })}
              placeholder="Negozio" className="border border-card-border rounded-lg p-2 text-sm" />
            <datalist id="stores-list">{stores.map(s => <option key={s} value={s} />)}</datalist>
            <input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}
              placeholder="Prodotto seguito (opz.)" className="border border-card-border rounded-lg p-2 text-sm" />
          </div>

          <label className="flex items-center gap-2 text-sm mb-3 text-gray-600">
            <input type="checkbox" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
            Spesa ricorrente (acqua, frutta, verdura…)
          </label>

          <button onClick={save} disabled={saving || !form.amount}
            className="w-full bg-[#C58A67] text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Salva spesa'}
          </button>
        </div>
      )}

      {/* CARD FILTRI: periodo, ricerca, di chi, per cosa — tutto in un posto solo */}
      <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
        <div className="bg-white rounded-xl px-4 py-2.5 border border-card-border text-center mb-2">
          <p className="text-base text-gray-500">{[groupFilter ? groupName(groupFilter) : '', caffeFilter ? '☕ Caffè' : catFilter, senzaCaffe && !caffeFilter && catFilter === 'Mangiare fuori' ? 'senza caffè' : ''].filter(Boolean).join(' · ') || 'Totale'}</p>
          <p className="font-serif text-4xl text-[#8C3B2E]">{eur(totale)}</p>
          {/* Confronto col mese precedente, a parita' di filtri */}
          {periodMode === 'mese' && diffPct !== null && (
            diffPct === 0
              ? <p className="text-sm text-gray-500">≈ come a {monthLabel(monthKey(-1))} ({eur(prevTot)})</p>
              : <p className="text-sm" style={{ color: diffPct < 0 ? '#2D6A4F' : '#8C3B2E' }}>
                  {diffPct < 0 ? '▼' : '▲'} {Math.abs(diffPct)}% in {diffPct < 0 ? 'meno' : 'più'} di {monthLabel(monthKey(-1))} ({eur(prevTot)})
                </p>
          )}
          {periodMode === 'mese' && totale > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Media {eur(mediaGiorno)} al giorno{isCurrentMonth ? ` · a fine mese ~ ${eur(previsione)}` : ''}
            </p>
          )}
          {/* Andamento degli ultimi 6 mesi: tocca una barra per andare a quel mese */}
          {periodMode === 'mese' && chartMonths.some(x => x.tot > 0) && (
            <div className="mt-2">
              <div className="flex items-end gap-1.5 h-14">
                {chartMonths.map(({ m, tot }) => (
                  <button key={m} onClick={() => setMonth(m)} aria-label={`${monthLabel(m)}: ${eur(tot)}`}
                    className="flex-1 flex flex-col justify-end h-full">
                    <div className="w-full rounded-t transition-all"
                      style={{ height: `${tot > 0 ? Math.max(5, (tot / maxChart) * 100) : 0}%`, background: m === month ? ACCENT : BAR_COLOR }} />
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 text-[10px] text-gray-400">
                {chartMonths.map(({ m }) => <span key={m} className="flex-1 text-center">{monthLabel(m).slice(0, 3)}</span>)}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 mb-1">
          {([['mese', 'Mese'], ['settimana', 'Settimana'], ['anno', 'Anno'], ['intervallo', 'Dal–al']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setPeriodMode(m)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${periodMode === m ? 'text-white border-transparent' : 'bg-[#FBF9F4] text-gray-600 border-card-border'}`}
              style={periodMode === m ? { background: ACCENT } : {}}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {periodMode === 'mese' && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-card-border rounded-lg p-2 text-sm w-auto" />
          )}
          {periodMode === 'settimana' && (
            <>
              <span className="text-sm text-gray-500">Settimana dal</span>
              <input type="date" value={weekAnchor} onChange={e => setWeekAnchor(e.target.value)}
                className="border border-card-border rounded-lg p-2 text-sm w-auto" />
              <span className="text-xs text-gray-400">{periodStart} → {periodEnd}</span>
            </>
          )}
          {periodMode === 'anno' && (
            <>
              <span className="text-sm text-gray-500">Anno</span>
              <input type="number" value={year} onChange={e => setYear(e.target.value)} min="2024" max="2099" step="1"
                className="border border-card-border rounded-lg p-2 text-sm w-24" />
            </>
          )}
          {periodMode === 'intervallo' && (
            <>
              <span className="text-sm text-gray-500">Dal</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border border-card-border rounded-lg p-2 text-sm w-auto" />
              <span className="text-sm text-gray-500">al</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border border-card-border rounded-lg p-2 text-sm w-auto" />
            </>
          )}
        </div>

        <div className="relative mt-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Cerca negozio o prodotto (es. Esselunga, bagnoschiuma)"
            className="w-full border border-card-border rounded-lg p-2 pr-8 text-sm" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Pulisci ricerca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
          )}
        </div>

        {/* DI CHI (gruppi) */}
        {!loading && groups.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass mt-3 mb-1.5">Di chi</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              <button onClick={() => setGroupFilter('')}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${groupFilter === '' ? 'text-white border-transparent' : 'bg-[#FBF9F4] text-gray-600 border-card-border'}`}
                style={groupFilter === '' ? { background: ACCENT } : {}}>
                Tutti
              </button>
              {groups.map(g => {
                const on = groupFilter === g.id
                return (
                  <button key={g.id} onClick={() => setGroupFilter(on ? '' : g.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${on ? 'text-white border-transparent' : 'bg-[#FBF9F4] text-gray-600 border-card-border'}`}
                    style={on ? { background: GROUP_COLORS[g.name] || FALLBACK_COLOR } : {}}>
                    {g.name}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* PER COSA (categorie, per nome: seguono il gruppo selezionato) */}
        {!loading && perCatAll.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass mt-2 mb-1.5">Per cosa</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              <button onClick={() => { setCatFilter(''); setCaffeFilter(false) }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${catFilter === '' && !caffeFilter ? 'text-white border-transparent' : 'bg-[#FBF9F4] text-gray-600 border-card-border'}`}
                style={catFilter === '' && !caffeFilter ? { background: ACCENT } : {}}>
                Tutte le voci
              </button>
              <button onClick={() => { setCaffeFilter(v => !v); setCatFilter('') }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition-transform duration-100 active:scale-[0.97] ${caffeFilter ? 'text-white border-transparent' : 'bg-[#FBF9F4] text-gray-600 border-card-border'}`}
                style={caffeFilter ? { background: ACCENT } : {}}>
                ☕ Caffè
              </button>
              {perCatByUse.map(({ name }) => {
                const on = catFilter === name
                return (
                  <Fragment key={name}>
                    <button onClick={() => { setCatFilter(on ? '' : name); setCaffeFilter(false) }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${on ? 'border-transparent' : 'bg-[#FBF9F4] text-gray-600 border-card-border'}`}
                      style={on ? { background: BAR_COLOR, color: '#4A2E1B' } : {}}>
                      {name}
                    </button>
                    {name === 'Mangiare fuori' && on && (
                      <button onClick={() => setSenzaCaffe(v => !v)}
                        className={`chip-in shrink-0 rounded-full px-3 py-1.5 text-sm border transition-transform duration-100 active:scale-[0.97] ${senzaCaffe ? 'text-white border-transparent' : 'bg-[#FBF9F4] text-gray-600 border-card-border'}`}
                        style={senzaCaffe ? { background: ACCENT } : {}}>
                        ☕ senza caffè
                      </button>
                    )}
                  </Fragment>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* BUDGET MENSILI PER CATEGORIA (solo vista Mese) */}
      {!loading && periodMode === 'mese' && budgetsOk && (
        <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass">Budget di {monthLabel(month)}</p>
            <button onClick={() => setShowBudgetForm(!showBudgetForm)}
              className="text-xs text-brass font-semibold">{showBudgetForm ? '✕ Chiudi' : '＋ Budget'}</button>
          </div>
          {showBudgetForm && (
            <div className="flex gap-2 mb-3">
              <select value={budgetForm.category_name} onChange={e => setBudgetForm({ ...budgetForm, category_name: e.target.value })}
                className="flex-1 border border-card-border rounded-lg p-2 text-sm min-w-0">
                <option value="">Categoria…</option>
                {catNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input inputMode="decimal" value={budgetForm.amount} onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                placeholder="€ al mese" className="w-24 border border-card-border rounded-lg p-2 text-sm" />
              <button onClick={saveBudget} disabled={!budgetForm.category_name || !budgetForm.amount}
                className="bg-green-mid text-white rounded-lg px-3 text-sm font-semibold disabled:opacity-50">OK</button>
            </div>
          )}
          {budgetRows.length === 0 && !showBudgetForm && (
            <p className="text-sm text-gray-400">Nessun budget impostato: tocca ＋ per dare un tetto a una voce (es. Mangiare fuori).</p>
          )}
          <div className="flex flex-col gap-2.5">
            {budgetRows.map(({ b, spent }) => {
              const ratio = spent / Number(b.monthly_amount)
              return (
                <button key={b.id} onClick={() => editBudget(b)} className="text-left">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-green-dark">{b.category_name}</span>
                    <span className="font-semibold" style={{ color: budgetColor(ratio) }}>
                      {eur(spent)} su {eur(Number(b.monthly_amount))}{ratio >= 1 ? ' — superato' : ''}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%`, background: budgetColor(ratio) }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* SPESE FISSE DEL MESE (ricorrenti: pagate ✓ e attese ~) */}
      {!loading && periodMode === 'mese' && fisse.length > 0 && (
        <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass">Spese fisse del mese</p>
            <span className="font-serif text-lg text-[#8C3B2E]">{eur(fisseTot)}</span>
          </div>
          <div className="flex flex-col">
            {fisse.map(f => (
              <div key={f.name} className="flex items-center justify-between text-sm py-1.5 border-b border-[#F1EEE6] last:border-b-0">
                <span className="text-green-dark truncate mr-2">🔁 {f.name}</span>
                <span className="shrink-0 text-gray-400">
                  {f.paid
                    ? <span><span className="text-green-mid">✓</span> {f.day} {monthLabel(month).slice(0, 3)} · <span className="text-gray-600 font-semibold">{eur2(f.tot)}</span></span>
                    : <span>~ {f.day} {monthLabel(month).slice(0, 3)} · {eur2(f.tot)}</span>}
                </span>
              </div>
            ))}
          </div>
          {fisse.some(f => !f.paid) && (
            <p className="text-[11px] text-gray-400 mt-2">~ = attesa: vista il mese scorso ma non ancora registrata questo mese.</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento…</div>
      ) : (
        <>
          {periodRows.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Nessuna spesa in questo periodo</div>
          ) : (
            <>
              {/* DASHBOARD: per gruppo */}
              {!q && !groupFilter && perGroup.length > 0 && (
                <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Dove va la spesa</p>
                  <div className="flex flex-col gap-2.5">
                    {perGroup.map(({ g, tot }) => (
                      <button key={g.id} onClick={() => setGroupFilter(g.id)} className="text-left">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-green-dark">{g.name}</span>
                          <span className="font-semibold" style={{ color: GROUP_COLORS[g.name] || FALLBACK_COLOR }}>{eur(tot)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(tot / maxGroup) * 100}%`, background: GROUP_COLORS[g.name] || FALLBACK_COLOR }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DASHBOARD: per categoria */}
              {!q && perCat.length > 0 && (
                <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Voci dove spendi di più</p>
                  <div className="flex flex-col gap-2.5">
                    {perCat.map(({ name, tot }) => (
                      <button key={name} onClick={() => { setCatFilter(catFilter === name ? '' : name); setCaffeFilter(false) }}
                        className={`text-left transition ${catFilter && catFilter !== name ? 'opacity-40' : ''}`}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-green-dark">{name}</span>
                          <span className="font-semibold text-[#8C3B2E]">{eur(tot)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(tot / maxCat) * 100}%`, background: BAR_COLOR }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PRODOTTI DOVE SPENDI DI PIÙ (dal dettaglio scontrini) */}
              {topProducts.length > 0 && (
                <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Prodotti dove spendi di più</p>
                  <div className="flex flex-col gap-2.5">
                    {(showAllProducts ? topProducts : topProducts.slice(0, 10)).map(({ name, tot }) => (
                      <button key={name} onClick={() => setSearch(name)} className="text-left">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-green-dark capitalize">{name}</span>
                          <span className="font-semibold text-[#8C3B2E]">{eur2(tot)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(tot / maxProduct) * 100}%`, background: '#7FA88F' }} />
                        </div>
                      </button>
                    ))}
                  </div>
                  {topProducts.length > 10 && (
                    <button onClick={() => setShowAllProducts(!showAllProducts)}
                      className="mt-3 text-xs text-brass font-semibold">
                      {showAllProducts ? 'Mostra meno' : `Vedi tutti i ${topProducts.length} prodotti →`}
                    </button>
                  )}
                </div>
              )}

              {/* DASHBOARD: per negozio */}
              {perStore.length > 0 && (
                <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Per negozio</p>
                  <div className="flex flex-col gap-2.5">
                    {perStore.map(({ store, tot }) => (
                      <button key={store} onClick={() => setSearch(store)} className="text-left">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-green-dark">{store}</span>
                          <span className="font-semibold text-[#8C3B2E]">{eur(tot)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(tot / maxStore) * 100}%`, background: '#8AA1B8' }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PRODOTTI SEGUITI */}
              {tracked.length > 0 && (
                <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Prodotti seguiti</p>
                  <div className="grid grid-cols-2 gap-2">
                    {tracked.map(({ k, tot }) => (
                      <div key={k} className="bg-sand rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 capitalize">{k}</p>
                        <p className="font-serif text-lg text-green-dark">{eur2(tot)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ELENCO — dalla spesa più vecchia alla più recente */}
              <div className="flex flex-col gap-2">
                {[...filtered].sort((a, b) => a.expense_date.localeCompare(b.expense_date)).map(r => (
                  <div key={r.id} className="bg-white rounded-xl p-3 border border-card-border flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.group_id && (
                          <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: colorOf(r.group_id) }}>
                            {groupName(r.group_id)}
                          </span>
                        )}
                        {r.category_id && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{catName(r.category_id)}</span>}
                        {r.recurring && <span className="text-xs bg-sage text-green-mid px-2 py-0.5 rounded-full">🔁</span>}
                        {r.receipt_id && (
                          <button onClick={() => openReceiptPhoto(r.receipt_id!)}
                            className="text-xs bg-sand text-[#7A5C1E] px-2 py-0.5 rounded-full">🧾 foto</button>
                        )}
                      </div>
                      <p className="text-sm mt-1 truncate">{r.description || '—'}{r.store ? <span className="text-gray-400"> · {r.store}</span> : null}</p>
                      <p className="text-xs text-gray-400">{r.expense_date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-[#8C3B2E]">{eur2(Number(r.amount))}</p>
                      <button onClick={() => del(r.id)} className="text-gray-300 hover:text-[#8C3B2E] text-lg">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
