'use client'
import { useEffect, useMemo, useState } from 'react'
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

const GROUP_COLORS: Record<string, string> = {
  'Casa': '#5B8A70', 'Ania': '#BCA06A', 'Matteo': '#8AA1B8',
  'Matteo e Ania': '#AD90A8', 'Casa Ania': '#BC7E6E',
}
const FALLBACK_COLOR = '#9AA096'
const BAR_COLOR = '#D2A98C' // pesca tenue per le barre categoria
// Faccine dei gruppi tenute nel codice (non nel DB): incollando la migrazione
// in Supabase gli emoji si erano corrotti. Qui restano sempre puliti.
const GROUP_EMOJI: Record<string, string> = {
  'Casa': '🏠', 'Ania': '👩', 'Matteo': '👦', 'Matteo e Ania': '👦👩', 'Casa Ania': '🥂',
}
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
  const [search, setSearch] = useState('')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [showForm, setShowForm] = useState(false)

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
  const groupEmoji = (id: string | null) => GROUP_EMOJI[groupName(id)] || ''
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
  const filtered = catFilter ? grouped.filter(r => catOf(r) === catFilter) : grouped
  const totale = filtered.reduce((s, r) => s + Number(r.amount), 0)

  const perGroup = useMemo(() => {
    const m: Record<string, number> = {}
    searched.forEach(r => { const k = r.group_id || 'none'; m[k] = (m[k] || 0) + Number(r.amount) })
    return groups.map(g => ({ g, tot: m[g.id] || 0 })).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot)
  }, [searched, groups])
  const maxGroup = Math.max(1, ...perGroup.map(x => x.tot))

  // Aggregato per nome categoria sulle righe già filtrate per gruppo (ma non
  // per categoria, così le barre restano tutte visibili quando una è attiva).
  const perCatAll = useMemo(() => {
    const m: Record<string, number> = {}
    grouped.forEach(r => { const k = catName(r.category_id) || 'Senza categoria'; m[k] = (m[k] || 0) + Number(r.amount) })
    return Object.entries(m).map(([name, tot]) => ({ name, tot })).sort((a, b) => b.tot - a.tot)
  }, [grouped, cats])
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-green-dark max-lg:hidden">{title}</h1>
        <button onClick={() => { setShowForm(!showForm); setForm(blankForm()); setAutoGroup(null) }}
          className="ml-auto bg-[#C58A67] text-white rounded-full px-3 py-1.5 text-sm font-semibold">
          {showForm ? '✕ Chiudi' : '+ Aggiungi'}
        </button>
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
              {groups.map(g => <option key={g.id} value={g.id}>{GROUP_EMOJI[g.name] || ''} {g.name}</option>)}
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

      {/* SCONTRINI DA LEGGERE */}
      <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold">📷 Scontrini</p>
          {receipts.length > 0 && (
            <span className="text-xs bg-sand text-[#7A5C1E] px-2 py-0.5 rounded-full">{receipts.length} da leggere</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">Scatta la foto, scrivi la nota (facoltativa) e premi Salva. Resta in “da leggere” finché non la trasformo in spesa.</p>

        {/* 1. Scegli/scatta le foto (non ancora salvate) */}
        {staged.length === 0 && (
          <label className="w-full flex items-center justify-center gap-2 bg-green-mid text-white rounded-xl py-2.5 font-semibold cursor-pointer">
            📷 Scatta / scegli scontrino
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => { const f = e.target.files; if (f && f.length) stagePhotos(f); e.currentTarget.value = '' }} />
          </label>
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
              placeholder="Nota (facoltativa): es. «vodka e caffè sono di Casa Ania», oppure «aggiungi la regola: pannolini → Matteo»"
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

      {/* FILTRO PERIODO + TOTALE */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex bg-white border border-card-border rounded-lg p-0.5 text-sm">
            {([['mese', 'Mese'], ['settimana', 'Settimana'], ['anno', 'Anno'], ['intervallo', 'Dal–al']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setPeriodMode(m)}
                className={`px-3 py-1 rounded-md transition ${periodMode === m ? 'text-white' : 'text-gray-500'}`}
                style={periodMode === m ? { background: FALLBACK_COLOR } : {}}>
                {label}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl px-4 py-2 border border-card-border text-right ml-auto">
            <p className="text-xs text-gray-500">{[groupFilter ? groupName(groupFilter) : '', catFilter].filter(Boolean).join(' · ') || 'Totale'}</p>
            <p className="font-bold text-[#8C3B2E]">{eur(totale)}</p>
          </div>
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
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento…</div>
      ) : (
        <>
          {/* CHIP GRUPPI */}
          {groups.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
              <button onClick={() => setGroupFilter('')}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${groupFilter === '' ? 'text-white border-transparent' : 'bg-white text-gray-600 border-card-border'}`}
                style={groupFilter === '' ? { background: FALLBACK_COLOR } : {}}>
                Tutti
              </button>
              {groups.map(g => {
                const on = groupFilter === g.id
                return (
                  <button key={g.id} onClick={() => setGroupFilter(on ? '' : g.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${on ? 'text-white border-transparent' : 'bg-white text-gray-600 border-card-border'}`}
                    style={on ? { background: GROUP_COLORS[g.name] || FALLBACK_COLOR } : {}}>
                    {GROUP_EMOJI[g.name] || ''} {g.name}
                  </button>
                )
              })}
            </div>
          )}

          {/* CHIP CATEGORIE (per nome, seguono il gruppo selezionato) */}
          {perCatAll.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
              <button onClick={() => setCatFilter('')}
                className={`shrink-0 rounded-full px-3 py-1 text-xs border transition ${catFilter === '' ? 'border-transparent' : 'bg-white text-gray-500 border-card-border'}`}
                style={catFilter === '' ? { background: '#F3ECD8', color: '#7A5C1E' } : {}}>
                Tutte le voci
              </button>
              {perCatAll.map(({ name }) => {
                const on = catFilter === name
                return (
                  <button key={name} onClick={() => setCatFilter(on ? '' : name)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs border transition ${on ? 'border-transparent' : 'bg-white text-gray-500 border-card-border'}`}
                    style={on ? { background: BAR_COLOR, color: '#5C3A24' } : {}}>
                    {name}
                  </button>
                )
              })}
            </div>
          )}

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
                          <span className="text-green-dark">{GROUP_EMOJI[g.name] || ''} {g.name}</span>
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
                      <button key={name} onClick={() => setCatFilter(catFilter === name ? '' : name)}
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
                            {groupEmoji(r.group_id)} {groupName(r.group_id)}
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
