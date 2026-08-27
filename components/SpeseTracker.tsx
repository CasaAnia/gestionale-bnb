'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BackBar from '@/components/BackBar'
import DemoGate from '@/components/DemoGate'
import { isDemoMode } from '@/lib/demoMode'

// Tracker spese riutilizzabile. Due ambiti:
//  - 'personale' → Spese Famiglia (gruppi: Casa, Ania, Matteo, Matteo e Ania)
//  - 'azienda'   → Spese B&B (gruppo Casa Ania), contano nel profitto
//
// Design "4 schede" (scelto da Ania il 15/08/2026, ispirato ai migliori
// gestionali: Copilot Money, DailyBean, Monarch Money):
//  🏠 Home       — tessere-categoria con ▲▼ vs mese scorso, ritmo e previsione
//  📅 Calendario — giorni colorati per quanto si è speso, tocchi e vedi
//  📖 Racconto   — il riassunto del mese scritto, con i numeri toccabili
//  💬 Domanda    — chiedi a parole ("Quanto in bar a luglio?") e risponde
//
// Ogni voce di scontrino può avere la SUA categoria (migrazione 0014):
// se manca, vale quella della spesa madre. Il codice tollera la colonna
// assente (migrazione non ancora applicata).

import type { Ambito, Group, Category, Rule, Fx, Receipt, Item, Subcat, Budget, Voce, Tab, Dettaglio, Msg } from '@/lib/spese/types'
import { GROUP_COLORS, FALLBACK_COLOR, ACCENT, MESI, eur, eur2, strip, corto, icona } from '@/lib/spese/costanti'
import { monthRange, monthKey, monthLabel, weekRange, giornoBreve, periodoRange, periodoLabel, ritmoEPrevisione } from '@/lib/spese/periodo'
import {
  vociDi as vociDiPure, itemsPerSpesa, sparklinePath, tessereCategorie,
  totalePerCategoria, fisseMese, costruisciRacconto, contoCaffe, spesePerGiorno,
} from '@/lib/spese/voci'

export default function SpeseTracker({ ambito, title }: { ambito: Ambito; title: string }) {
  return <DemoGate><Tracker ambito={ambito} title={title} /></DemoGate>
}

function Tracker({ ambito, title }: { ambito: Ambito; title: string }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [rows, setRows] = useState<Fx[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [subcats, setSubcats] = useState<Subcat[]>([]) // sottocategorie (migrazione 0015)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  // Le 4 schede + mese scelto
  const [tab, setTab] = useState<Tab>('home')
  const [gFilter, setGFilter] = useState('') // "Di chi": id gruppo, '' = tutti
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  // Periodo: mese (default), settimana, anno o intervallo libero (Dal–al)
  const [periodMode, setPeriodMode] = useState<'mese' | 'settimana' | 'anno' | 'intervallo'>('mese')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [weekAnchor, setWeekAnchor] = useState(new Date().toISOString().split('T')[0])
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [dettaglio, setDettaglio] = useState<Dettaglio>(null) // lista voci aperta (tessera, racconto…)
  const [giornoSel, setGiornoSel] = useState('') // giorno toccato nel calendario
  const [showAll, setShowAll] = useState(false) // elenco completo del mese (in Home)
  const [chat, setChat] = useState<Msg[]>([])
  const [domanda, setDomanda] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Budget mensili per categoria (tabella family_budgets; se la migrazione
  // 0013 non e' ancora applicata la card resta nascosta).
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetsOk, setBudgetsOk] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ category_name: '', amount: '' })

  const blankForm = () => ({
    expense_date: new Date().toISOString().split('T')[0],
    amount: '', group_id: '', category_id: '', subcategory: '', store: '', product: '', description: '', recurring: false,
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
    // Dettaglio prodotti: select * per tollerare la colonna category_id
    // assente (migrazione 0014 non ancora applicata).
    const expIds = myExpenses.map((x: Fx) => x.id)
    if (expIds.length) {
      const it = await supabase.from('family_expense_items').select('*').in('expense_id', expIds)
      if (!it.error) setItems((it.data || []) as Item[])
    } else setItems([])
    // Sottocategorie (tollerante: senza migrazione 0015 restano vuote).
    const sc = await supabase.from('family_subcategories').select('*').order('sort')
    if (!sc.error) setSubcats((sc.data || []) as Subcat[])
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

  // Aggiunge/modifica la nota di uno scontrino già caricato.
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
  const catName = (id: string | null | undefined) => cats.find(x => x.id === id)?.name || ''
  const colorOf = (id: string | null) => GROUP_COLORS[groupName(id)] || FALLBACK_COLOR
  const stores = useMemo(() => Array.from(new Set(rows.map(r => r.store).filter(Boolean))) as string[], [rows])

  // Applica le regole prodotto: se descrizione/prodotto contiene una keyword,
  // propone il gruppo giusto.
  function applyRules(text: string, current: ReturnType<typeof blankForm>) {
    const t = strip(text)
    for (const rule of rules) {
      if (t.includes(strip(rule.keyword))) {
        const next = { ...current }
        if (rule.group_id) { next.group_id = rule.group_id; next.category_id = '' }
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
      ...(form.subcategory ? { subcategory: form.subcategory } : {}),
      store: form.store.trim() || null,
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

  // ================= LE VOCI (il cuore del nuovo design) =================
  // La scomposizione in voci e le aggregazioni vivono in lib/spese/voci.ts
  // (estratte in Fase 1, identiche); qui restano solo i collegamenti allo stato.
  const itemsByExp = useMemo(() => itemsPerSpesa(items), [items])

  const vociDi = (spese: Fx[]): Voce[] => vociDiPure(spese, itemsByExp, catName, groupName)

  const mKey = (offset: number) => monthKey(month, offset)

  // ---- periodo scelto ----
  // Il Calendario resta sempre per mese (è una griglia mensile); le altre
  // schede seguono il periodo scelto coi bottoni Mese/Settimana/Anno/Dal–al.
  const isMese = periodMode === 'mese' || tab === 'calendario'
  const [periodStart, periodEnd] = periodoRange(isMese, periodMode, { month, year, weekAnchor, fromDate, toDate })
  const periodLabel = periodoLabel(isMese, periodMode, { month, year, fromDate, toDate }, periodStart, periodEnd)

  const speseMese = useMemo(() => rows.filter(r => r.expense_date >= periodStart && r.expense_date <= periodEnd && (!gFilter || r.group_id === gFilter)), [rows, periodStart, periodEnd, gFilter])
  const vociMese = useMemo(() => vociDi(speseMese), [speseMese, itemsByExp, cats, groups])
  // Confronto col mese precedente: ha senso solo nella vista Mese
  const vociPrec = useMemo(() => isMese ? vociDi(rows.filter(r => r.expense_date.slice(0, 7) === mKey(-1) && (!gFilter || r.group_id === gFilter))) : [], [rows, month, gFilter, isMese, itemsByExp, cats, groups])
  const totMese = speseMese.reduce((s, r) => s + Number(r.amount), 0)

  // Ritmo e previsione (solo mese corrente)
  const { isCurrentMonth, daysInMonth, giorniPassati, mediaGiorno, previsione } = ritmoEPrevisione(totMese, month, new Date())

  // Linea del mese: spesa cumulata giorno per giorno
  const sparkline = useMemo(() => sparklinePath(speseMese, daysInMonth, giorniPassati), [speseMese, daysInMonth, giorniPassati])

  // Tessere: totale per categoria, con confronto sul mese precedente
  const tessere = useMemo(() => tessereCategorie(vociMese, vociPrec), [vociMese, vociPrec])

  // ---- budget: speso per nome categoria nel mese scelto ----
  const spentByCat = useMemo(() => totalePerCategoria(vociMese), [vociMese])
  const budgetRows = budgets
    .map(b => ({ b, spent: spentByCat[b.category_name] || 0 }))
    .sort((x, y) => y.spent / y.b.monthly_amount - x.spent / x.b.monthly_amount)
  const budgetColor = (ratio: number) => ratio >= 1 ? '#8C3B2E' : ratio >= 0.9 ? '#B07D4F' : '#5B8A70'
  const catNames = Array.from(new Set(cats.map(c => c.name))).sort()

  // ---- spese fisse del mese: ricorrenti gia' pagate + attese ----
  const fisse = useMemo(() => fisseMese(rows, month), [rows, month])
  const fisseTot = fisse.reduce((s, x) => s + x.tot, 0)

  const catsForGroup = cats.filter(c => c.group_id === form.group_id)

  // ================= 📖 RACCONTO =================
  const racconto = useMemo(() => costruisciRacconto(vociMese, vociPrec, totMese), [vociMese, vociPrec, totMese])

  // ---- il conto del caffè: quanti caffè/cappuccini bevuti FUORI questo mese ----
  const caffeMese = useMemo(() => contoCaffe(vociMese), [vociMese])

  function apriDettaglio(titolo: string, voci: Voce[]) {
    setDettaglio({ titolo, voci })
  }

  // ================= 💬 DOMANDA LIBERA =================
  function rispondi(q: string): string {
    const s = strip(q)
    // "da sempre" / "in tutto" / "tutti gli scontrini": nessun filtro mese
    const sempre = s.includes('sempre') || s.includes('in tutto') || s.includes('tutti gli scontrini') || s.includes('tutti i mesi')
    // Mese: se nominato, cerco l'anno più recente che ha dati
    let m = month, mLbl = monthLabel(month)
    let mesePreciso = false
    for (let i = 0; i < 12; i++) {
      if (s.includes(MESI[i])) {
        const mm = String(i + 1).padStart(2, '0')
        const anni = [...new Set(rows.map(r => r.expense_date.slice(0, 4)))].sort().reverse()
        m = `${anni[0] || month.slice(0, 4)}-${mm}`
        for (const y of anni) if (rows.some(r => r.expense_date.startsWith(`${y}-${mm}`))) { m = `${y}-${mm}`; break }
        mLbl = MESI[i]
        mesePreciso = true
        break
      }
    }
    const tuttoIlPeriodo = sempre && !mesePreciso
    const quando = tuttoIlPeriodo ? 'Da sempre' : `A ${mLbl}`
    let v = vociDi(tuttoIlPeriodo ? rows : rows.filter(r => r.expense_date.slice(0, 7) === m))
    if (!v.length) return tuttoIlPeriodo ? 'Non trovo spese registrate.' : `A ${mLbl} non trovo spese registrate.`
    const filtri: string[] = []
    // Persona/gruppo (prima i nomi più lunghi, così "Matteo e Ania" vince su "Matteo")
    const gNames = [...groups.map(g => g.name)].sort((a, b) => b.length - a.length)
    for (const g of gNames) if (s.includes(strip(g))) { v = v.filter(x => x.g === g); filtri.push(g); break }
    // Nome intero contenuto nella domanda, oppure una sua parola intera
    // (es. "bar" → "Colazione/Bar", "frutta" → "Frutta e verdura")
    const combacia = (nome: string) => {
      const full = strip(nome)
      if (s.includes(full)) return true
      return full.split(/[^a-z0-9]+/).some(w => w.length >= 3 && new RegExp(`\\b${w}\\b`).test(s))
    }
    // Categoria
    const cNames = [...new Set(cats.map(c => c.name))].sort((a, b) => b.length - a.length)
    for (const c of cNames) if (combacia(c)) { v = v.filter(x => x.cat === c); filtri.push(c.toLowerCase()); break }
    // Sottocategoria (es. "benzina", "trucchi", "affitto"). Se il nome è una
    // parola sola prende anche le voci che si CHIAMANO così: il caffè del
    // pranzo sta sotto Mangiare fuori/Pranzo ma deve contare come caffè.
    const sNames = [...new Set(subcats.map(x => x.name))].sort((a, b) => b.length - a.length)
    for (const sc of sNames) if (combacia(sc)) {
      const w = strip(sc)
      const unaParola = !/[^a-z0-9]/.test(w)
      v = v.filter(x => x.sott === sc || (unaParola && new RegExp(`\\b${w}`).test(strip(x.n))))
      filtri.push(sc.toLowerCase()); break
    }
    // Negozio
    const negozi = [...new Set(rows.filter(r => r.store).map(r => corto(r.store!)))]
    for (const n of negozi) if (n.length > 3 && s.includes(strip(n))) { v = v.filter(x => corto(x.store) === n); filtri.push(n); break }
    // "Dove abbiamo speso di più?"
    if (s.includes('dove') && s.includes('piu')) {
      const perS: Record<string, number> = {}, perC: Record<string, number> = {}
      v.forEach(x => { if (x.store) perS[corto(x.store)] = (perS[corto(x.store)] || 0) + x.a; perC[x.cat] = (perC[x.cat] || 0) + x.a })
      const ts = Object.entries(perS).sort((a, b) => b[1] - a[1])[0]
      const tc = Object.entries(perC).sort((a, b) => b[1] - a[1])[0]
      return `${quando} la voce più pesante è ${tc[0].toLowerCase()} (${eur(tc[1])})${ts ? ` e il negozio dove avete speso di più è ${ts[0]} (${eur(ts[1])})` : ''}.`
    }
    // Prodotto: parole della domanda cercate dentro i nomi delle voci
    if (!filtri.some(f => !groups.some(g => g.name === f))) {
      const parole = s.replace(/[?.,!]/g, ' ').split(/\s+/).filter(w => w.length > 3
        && !['quanto', 'quanti', 'quante', 'questo', 'mese', 'speso', 'spesa', 'spese', 'abbiamo', 'comprato', 'cosa', 'della', 'dello', 'delle', 'sempre', 'tutto', 'tutti', 'totale', 'scontrini', ...MESI].includes(w))
      let trovato = parole.length === 0
      for (const w of parole) {
        const match = v.filter(x => strip(x.n).includes(w))
        if (match.length) { v = match; filtri.push(w); trovato = true; break }
      }
      // Ha cercato qualcosa di preciso ("tè freddo") che non esiste:
      // niente totale generico, meglio dirlo chiaro.
      if (!trovato) return `Non trovo nessuna voce per «${q.trim()}»${quando === 'Da sempre' ? '' : ` a ${mLbl}`}. Prova con un altro nome, o aggiungi "da sempre" per cercare in tutti i mesi.`
    }
    if (!v.length) return `${quando} non trovo niente per «${q.trim()}».`
    const tot = v.reduce((sum, x) => sum + x.a, 0)
    const top = [...v].sort((a, b) => b.a - a.a).slice(0, 3).map(x => `${x.n} (${eur2(x.a)})`).join(', ')
    const cosa = filtri.length ? filtri.join(' · ') : 'in totale'
    return `${quando}, ${cosa}: ${eur2(tot)} in ${v.length} ${v.length === 1 ? 'voce' : 'voci'}.${v.length > 1 ? ` Le più grosse: ${top}.` : ''}`
  }
  function chiedi(q: string) {
    if (!q.trim()) return
    setChat(prev => [...prev, { io: true, t: q.trim() }, { io: false, t: rispondi(q) }])
    setDomanda('')
  }
  const DOMANDE_VELOCI = ambito === 'personale'
    ? ['Dove abbiamo speso di più?']
    : ['Dove abbiamo speso di più?', 'Quanto in detersivi questo mese?', 'Quanto in sacchetti da sempre?']

  // ================= 📅 CALENDARIO =================
  const perGiorno = useMemo(() => spesePerGiorno(speseMese), [speseMese])

  function cambiaMese(delta: number) {
    setMonth(mKey(delta)); setDettaglio(null); setGiornoSel(''); setShowAll(false)
  }
  function cambiaTab(t: Tab) {
    setTab(t); setDettaglio(null); setGiornoSel(''); setShowAll(false)
  }

  // Lista di voci (usata da tessere, racconto, calendario).
  // Le voci con lo stesso nome vengono SOMMATE (tutti i "kiwi" del mese in
  // una riga: ×7 e totale); in testa la divisione per negozio; se ci sono
  // sottocategorie diverse, sezioni con totalino.
  function ListaVoci({ voci, max }: { voci: Voce[]; max?: number }) {
    // q = pezzi/confezioni comprati (somma delle qty), righe = da quanti
    // acquisti viene la somma: la data si mostra solo se l'acquisto è uno.
    type Agg = { n: string; tot: number; q: number; righe: number; stores: string[]; sott: string; last: string; rids: string[] }
    // Pastiglie-filtro (scelto da Ania il 16/08/2026): tocchi una persona o un
    // negozio e la lista mostra solo quello; ritocchi e torna tutto. Le due
    // scelte si combinano (es. Matteo + Coin). Niente bordi neri: la pastiglia
    // attiva resta piena con ombra leggera, le altre si attenuano.
    const [gSel, setGSel] = useState('')
    const [sSel, setSSel] = useState('')
    // Totali delle pastiglie: incrociati con l'altro filtro (es. con Coin
    // attivo, "Matteo" mostra quanto ha speso Matteo da Coin), ma la
    // pastiglia resta visibile anche a €0 così si può sempre cambiare scelta.
    const perStore: Record<string, number> = {}
    const perGruppo: Record<string, number> = {}
    voci.forEach(v => {
      const s = corto(v.store)
      if (s) perStore[s] = (perStore[s] || 0) + ((!gSel || v.g === gSel) ? v.a : 0)
      if (v.g && v.g !== '—') perGruppo[v.g] = (perGruppo[v.g] || 0) + ((!sSel || corto(v.store) === sSel) ? v.a : 0)
    })
    const negozi = Object.entries(perStore).sort((a, b) => b[1] - a[1])
    const persone = Object.entries(perGruppo).sort((a, b) => b[1] - a[1])
    const vociVis = voci.filter(v => (!gSel || v.g === gSel) && (!sSel || corto(v.store) === sSel))
    const m: Record<string, Agg> = {}
    vociVis.forEach(v => {
      const k = (v.sott || '') + '|' + strip(v.n)
      const e = m[k] || (m[k] = { n: v.n, tot: 0, q: 0, righe: 0, stores: [], sott: v.sott || '', last: v.d, rids: [] })
      e.tot += v.a; e.q += v.q; e.righe++; if (v.d > e.last) e.last = v.d
      const s = corto(v.store); if (s && !e.stores.includes(s)) e.stores.push(s)
      if (v.rid && !e.rids.includes(v.rid)) e.rids.push(v.rid)
    })
    const righe = Object.values(m).sort((a, b) => b.tot - a.tot).slice(0, max || 999)
    const sotts = Array.from(new Set(righe.map(r => r.sott)))
    // Ordine fisso delle sezioni: il campo `sort` di family_subcategories
    // (es. Abbigliamento: Vestiti, Scarpe, Intimo, Accessori); "Altro" in fondo.
    const sortDi = (s: string) => {
      if (!s) return 9e9 // "Altro" sempre in fondo
      const sc = subcats.filter(x => x.name === s)
      return sc.length ? Math.min(...sc.map(x => x.sort)) : 8e9
    }
    // Le sezioni si mostrano appena c'è ALMENO una sottocategoria vera,
    // anche unica (es. luglio tutto "Pranzo"); lista piatta solo se
    // nessuna voce ha la sottocategoria.
    const mostraSezioni = sotts.some(s => s)
    const sezioni = mostraSezioni
      ? sotts.map(s => ({ s, list: righe.filter(r => r.sott === s) }))
          .sort((a, b) => sortDi(a.s) - sortDi(b.s))
      : [{ s: '', list: righe }]
    return (
      <div className="bg-white rounded-xl p-3 border border-card-border mb-3">
        {persone.length > 1 && (
          <div className="flex gap-1.5 flex-wrap pb-2 mb-1">
            {persone.map(([g, tot]) => {
              const on = gSel === g
              return (
                <button key={g} onClick={() => setGSel(on ? '' : g)}
                  className={`text-xs px-2 py-1 rounded-full text-white transition ${on ? 'shadow-md' : gSel ? 'opacity-40' : ''}`}
                  style={{ background: GROUP_COLORS[g] || FALLBACK_COLOR }}>
                  {on && '✓ '}{g} <b>{eur(tot)}</b>
                </button>
              )
            })}
          </div>
        )}
        {negozi.length > 1 && (
          <div className="flex gap-1.5 flex-wrap pb-2 mb-1 border-b border-[#F1EEE6]">
            {negozi.map(([s, tot]) => {
              const on = sSel === s
              return (
                <button key={s} onClick={() => setSSel(on ? '' : s)}
                  className={`text-xs bg-sand text-[#7A5C1E] px-2 py-1 rounded-full transition ${on ? 'shadow-md' : sSel ? 'opacity-40' : ''}`}>
                  {on && '✓ '}{s} <b>{eur(tot)}</b>
                </button>
              )
            })}
          </div>
        )}
        {sezioni.map(({ s, list }) => (
          <div key={s || '·'}>
            {mostraSezioni && (
              <p className="flex justify-between text-[11px] uppercase tracking-wide text-brass pt-2">
                <span>{s || 'Altro'}</span>
                <span>{eur2(list.reduce((x, r) => x + r.tot, 0))}</span>
              </p>
            )}
            {list.map(r => (
              <div key={(r.sott || '') + r.n} className="flex items-start justify-between gap-2 py-2 border-b border-[#F1EEE6] last:border-b-0 text-sm">
                <span className="flex-1 min-w-0">{r.n}{r.q > 1 && <span className="text-xs text-gray-400"> ×{r.q}</span>}
                  <br /><span className="text-xs text-gray-400">
                    {[r.stores.slice(0, 2).join(', ') + (r.stores.length > 2 ? ` +${r.stores.length - 2}` : ''),
                      r.righe === 1 ? `${r.last.slice(-2)} ${monthLabel(r.last.slice(0, 7)).slice(0, 3)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                  {r.rids.length > 0 && (
                    <span className="ml-1 whitespace-nowrap">
                      {r.rids.slice(0, 5).map(id => (
                        <button key={id} onClick={() => openReceiptPhoto(id)} title="Apri lo scontrino"
                          className="text-[13px] px-0.5 align-middle">🧾</button>
                      ))}
                      {r.rids.length > 5 && <span className="text-xs text-gray-400">+{r.rids.length - 5}</span>}
                    </span>
                  )}
                </span>
                <span className="font-bold text-[#8C3B2E] shrink-0">{eur2(r.tot)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

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
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value, subcategory: '' })}
              disabled={!form.group_id} className="border border-card-border rounded-lg p-2 text-sm disabled:opacity-50">
              <option value="">Categoria…</option>
              {catsForGroup.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Sottocategoria (solo se la categoria scelta ne ha) */}
          {(() => {
            const opts = subcats.filter(s => s.category_name === catName(form.category_id))
            if (!opts.length) return null
            return (
              <select value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}
                className="w-full border border-card-border rounded-lg p-2 text-sm mb-2">
                <option value="">Sottocategoria…</option>
                {opts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            )
          })()}

          <input list="stores-list" value={form.store} onChange={e => setForm({ ...form, store: e.target.value })}
            placeholder="Negozio" className="w-full border border-card-border rounded-lg p-2 text-sm mb-2" />
          <datalist id="stores-list">{stores.map(s => <option key={s} value={s} />)}</datalist>

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

      {/* LE 4 SCHEDE */}
      <div className="flex gap-1.5 bg-sand rounded-xl p-1 mb-3">
        {([['home', '🏠', 'Home'], ['calendario', '📅', 'Calendario'], ['racconto', '📖', 'Racconto'], ['domanda', '💬', 'Domanda']] as const).map(([t, ic, label]) => (
          <button key={t} onClick={() => cambiaTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-xs leading-tight transition ${tab === t ? 'bg-white text-green-mid font-bold shadow-sm' : 'text-gray-500'}`}>
            {ic}<br />{label}
          </button>
        ))}
      </div>

      {/* DI CHI (non serve nella Domanda: lì si chiede a parole) */}
      {tab !== 'domanda' && groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 mb-2">
          <button onClick={() => setGFilter('')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${gFilter === '' ? 'text-white border-transparent' : 'bg-white text-gray-600 border-card-border'}`}
            style={gFilter === '' ? { background: ACCENT } : {}}>
            Tutti
          </button>
          {groups.map(g => {
            const on = gFilter === g.id
            return (
              <button key={g.id} onClick={() => { setGFilter(on ? '' : g.id); setDettaglio(null) }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${on ? 'text-white border-transparent' : 'bg-white text-gray-600 border-card-border'}`}
                style={on ? { background: GROUP_COLORS[g.name] || FALLBACK_COLOR } : {}}>
                {g.name === 'Matteo e Ania' ? 'M e A' : g.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Periodo scelto (non serve nella Domanda: lì si chiede a parole).
          Nel Calendario niente bottoni: la griglia è per forza mensile. */}
      {tab !== 'domanda' && (
        <>
          {tab !== 'calendario' && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 mb-2">
              {([['anno', 'Anno'], ['mese', 'Mese'], ['settimana', 'Settimana'], ['intervallo', 'Dal–al']] as const).map(([m, label]) => (
                <button key={m} onClick={() => { setPeriodMode(m); setDettaglio(null); setShowAll(false) }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${periodMode === m ? 'text-white border-transparent' : 'bg-white text-gray-600 border-card-border'}`}
                  style={periodMode === m ? { background: ACCENT } : {}}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {isMese ? (
            <div className="flex items-center justify-center gap-4 mb-3">
              <button onClick={() => cambiaMese(-1)} aria-label="Mese precedente"
                className="w-8 h-8 rounded-full bg-white border border-card-border text-green-mid">‹</button>
              <span className="font-serif text-base text-green-dark capitalize min-w-[130px] text-center">
                {new Date(month + '-01T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => cambiaMese(1)} aria-label="Mese successivo"
                className="w-8 h-8 rounded-full bg-white border border-card-border text-green-mid">›</button>
            </div>
          ) : periodMode === 'settimana' ? (
            <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
              <span className="text-sm text-gray-500">Settimana dal</span>
              <input type="date" value={weekAnchor} onChange={e => { setWeekAnchor(e.target.value); setDettaglio(null) }}
                className="border border-card-border rounded-lg p-2 text-sm bg-white" />
              <span className="text-xs text-gray-400">{giornoBreve(periodStart)} → {giornoBreve(periodEnd)}</span>
            </div>
          ) : periodMode === 'anno' ? (
            <div className="flex items-center justify-center gap-4 mb-3">
              <button onClick={() => { setYear(String(Number(year) - 1)); setDettaglio(null) }} aria-label="Anno precedente"
                className="w-8 h-8 rounded-full bg-white border border-card-border text-green-mid">‹</button>
              <span className="font-serif text-base text-green-dark min-w-[80px] text-center">{year}</span>
              <button onClick={() => { setYear(String(Number(year) + 1)); setDettaglio(null) }} aria-label="Anno successivo"
                className="w-8 h-8 rounded-full bg-white border border-card-border text-green-mid">›</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
              <span className="text-sm text-gray-500">Dal</span>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDettaglio(null) }}
                className="border border-card-border rounded-lg p-2 text-sm bg-white" />
              <span className="text-sm text-gray-500">al</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDettaglio(null) }}
                className="border border-card-border rounded-lg p-2 text-sm bg-white" />
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento…</div>
      ) : tab === 'home' ? (
        /* ================= 🏠 HOME ================= */
        speseMese.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nessuna spesa in questo periodo</div>
        ) : (
          <>
            {/* Speso del periodo + ritmo + linea (ritmo e linea solo per mese) */}
            <div className="bg-white rounded-xl p-4 border border-card-border mb-3 text-center">
              <p className="text-xs text-gray-400">Speso {periodLabel}</p>
              <p className="font-serif text-4xl text-[#8C3B2E]">{eur(totMese)}</p>
              {isMese && isCurrentMonth && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {eur(mediaGiorno)} al giorno · di questo passo ~ <b className="text-[#8C3B2E]">{eur(previsione)}</b> a fine mese
                </p>
              )}
              {isMese && (
                <>
                  <svg viewBox="0 0 340 56" className="w-full h-[48px] mt-2">
                    <path d={sparkline} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>1</span><span className="capitalize">{monthLabel(month)}</span><span>{daysInMonth}</span>
                  </div>
                </>
              )}
            </div>

            {/* IL CONTO DEL CAFFÈ */}
            {caffeMese.tot > 0 && (
              <button onClick={() => apriDettaglio(`☕ I caffè di ${monthLabel(month)} · ${eur2(caffeMese.tot)}`, caffeMese.voci)}
                className="w-full bg-sand rounded-xl px-4 py-3 border border-card-border mb-3 text-left transition active:scale-[0.99]">
                <p className="text-sm text-green-dark">
                  ☕ <b>{caffeMese.nC} caffè{caffeMese.nK > 0 ? ` e ${caffeMese.nK} cappuccini` : ''}</b> fuori casa questo mese
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ti sono costati <b className="text-[#8C3B2E]">{eur2(caffeMese.tot)}</b>{caffeMese.pasti > 0 ? ` (di cui ${eur2(caffeMese.pasti)} a pranzo/cena)` : ''} · tocca per l'elenco
                </p>
              </button>
            )}

            {/* Tessere categoria */}
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Le tue voci · tocca per il dettaglio</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {tessere.map(t => (
                <button key={t.cat}
                  onClick={() => apriDettaglio(`${icona(t.cat)} ${t.cat} · ${eur(t.tot)}`, vociMese.filter(v => v.cat === t.cat))}
                  className="bg-white rounded-xl p-3 border border-card-border text-left transition active:scale-[0.98]">
                  <p className="text-xl">{icona(t.cat)}</p>
                  <p className="text-xs text-green-dark mt-0.5">{t.cat}</p>
                  <p className="font-serif text-lg text-[#8C3B2E]">
                    {eur(t.tot)}{' '}
                    <span className="text-xs">
                      {t.prev > 0 && (t.tot > t.prev * 1.1 ? <span className="text-[#8C3B2E]">▲</span>
                        : t.tot < t.prev * 0.9 ? <span className="text-green-mid">▼</span> : <span className="text-gray-400">≈</span>)}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-400">{t.n} {t.n === 1 ? 'voce' : 'voci'}</p>
                </button>
              ))}
            </div>

            {/* Dettaglio tessera aperta */}
            {dettaglio && (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass">{dettaglio.titolo}</p>
                  <button onClick={() => setDettaglio(null)} className="text-xs text-[#8C3B2E] font-semibold">✕ chiudi</button>
                </div>
                <ListaVoci voci={dettaglio.voci} />
              </>
            )}

            {/* BUDGET MENSILI PER CATEGORIA (solo vista Mese) */}
            {isMese && budgetsOk && (
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

            {/* SPESE FISSE DEL MESE (solo vista Mese) */}
            {isMese && fisse.length > 0 && (
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

            {/* ULTIME SPESE + elenco completo */}
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">{showAll ? (isMese ? `Tutte le spese di ${monthLabel(month)}` : `Tutte le spese ${periodLabel}`) : 'Ultime spese'}</p>
            <div className="flex flex-col gap-2">
              {(showAll ? [...speseMese] : [...speseMese].slice(0, 5)).map(r => (
                <div key={r.id} className="bg-white rounded-xl p-3 border border-card-border flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.group_id && groups.length > 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: colorOf(r.group_id) }}>
                          {groupName(r.group_id)}
                        </span>
                      )}
                      {r.category_id && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{icona(catName(r.category_id))} {catName(r.category_id)}</span>}
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
            {speseMese.length > 5 && (
              <button onClick={() => setShowAll(!showAll)} className="mt-3 text-xs text-brass font-semibold">
                {showAll ? 'Mostra meno' : `Vedi tutte le ${speseMese.length} spese →`}
              </button>
            )}
          </>
        )
      ) : tab === 'calendario' ? (
        /* ================= 📅 CALENDARIO ================= */
        <>
          <div className="bg-white rounded-xl p-4 border border-card-border mb-3 text-center">
            <p className="font-serif text-4xl text-[#8C3B2E]">{eur(totMese)}</p>
            <p className="text-xs text-gray-400">{Object.keys(perGiorno).length} giorni con spese</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-card-border mb-3">
            <div className="grid grid-cols-7 gap-1.5">
              {['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].map(d => (
                <div key={d} className="text-center text-[10px] uppercase text-brass py-0.5">{d}</div>
              ))}
              {Array.from({ length: (new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).getDay() + 6) % 7 }).map((_, i) => <div key={'v' + i} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const g = i + 1
                const sp = perGiorno[g]
                const gs = `${month}-${String(g).padStart(2, '0')}`
                const max = Math.max(1, ...Object.values(perGiorno))
                if (!sp) return (
                  <div key={g} className="aspect-square rounded-lg border border-dashed border-card-border flex items-center justify-center text-xs text-gray-300">{g}</div>
                )
                const t = sp / max
                const bg = t > 0.66 ? '#E5B8A6' : t > 0.33 ? '#F0D4C4' : '#F8EADF'
                return (
                  <button key={g} onClick={() => { setGiornoSel(giornoSel === gs ? '' : gs); setDettaglio(null) }}
                    className="aspect-square rounded-lg border flex flex-col items-center justify-center transition active:scale-[0.93]"
                    style={{ background: bg, borderColor: giornoSel === gs ? ACCENT : 'transparent', borderWidth: giornoSel === gs ? 2 : 1 }}>
                    <span className="text-xs font-semibold text-green-dark">{g}</span>
                    <span className="text-[9px] font-bold text-[#8C3B2E]">{eur(sp)}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Più il giorno è scuro, più avete speso. Toccane uno.</p>
          </div>
          {giornoSel && (() => {
            const v = vociDi(rows.filter(r => r.expense_date === giornoSel))
            if (!v.length) return null
            return (
              <>
                <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5 capitalize">
                  {new Date(giornoSel + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} · {eur2(v.reduce((s, x) => s + x.a, 0))}
                </p>
                <ListaVoci voci={v} />
              </>
            )
          })()}
        </>
      ) : tab === 'racconto' ? (
        /* ================= 📖 RACCONTO ================= */
        !racconto ? (
          <div className="text-center py-10 text-gray-400">Nessuna spesa da raccontare in questo periodo</div>
        ) : (
          <>
            <div className="bg-white rounded-xl p-4 border border-card-border mb-3 text-[15px] leading-relaxed text-green-dark">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-2">
                {isMese ? `Il racconto di ${monthLabel(month)}` : `Il racconto · ${periodLabel}`}
              </p>
              <p>
                {isMese ? 'Questo mese' : 'In questo periodo'} avete speso{' '}
                <button onClick={() => apriDettaglio(`Tutte le voci · ${eur(totMese)}`, vociMese)}
                  className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">{eur(totMese)}</button>
                {racconto.diff !== null && (racconto.diff <= 0
                  ? <>, il <span className="text-green-mid font-semibold">{Math.abs(racconto.diff)}% in meno</span> di {monthLabel(mKey(-1))} 👏</>
                  : <>, il <span className="text-[#8C3B2E] font-semibold">{racconto.diff}% in più</span> di {monthLabel(mKey(-1))}</>)}.{' '}
                La voce più pesante è stata{' '}
                <button onClick={() => apriDettaglio(`${icona(racconto.topCat[0])} ${racconto.topCat[0]} · ${eur(racconto.topCat[1])}`, vociMese.filter(v => v.cat === racconto.topCat[0]))}
                  className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">{racconto.topCat[0].toLowerCase()} ({eur(racconto.topCat[1])})</button>
                {racconto.topS && <>, e il negozio dove avete lasciato di più è{' '}
                  <button onClick={() => apriDettaglio(`🏪 ${racconto.topS[0]} · ${eur(racconto.topS[1])}`, vociMese.filter(v => corto(v.store) === racconto.topS[0]))}
                    className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">{racconto.topS[0]} ({eur(racconto.topS[1])})</button></>}.
              </p>
              <p className="mt-2">
                L&apos;acquisto singolo più caro: <b className="text-[#8C3B2E]">{racconto.topVoce.n} ({eur2(racconto.topVoce.a)})</b>.
                {racconto.caffe.length > 0 && <>{' '}E il rito del bar?{' '}
                  <button onClick={() => apriDettaglio(`☕ Caffè e cappuccini · ${eur2(racconto.caffe.reduce((s, v) => s + v.a, 0))}`, racconto.caffe)}
                    className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">
                    {racconto.caffe.length} caffè e cappuccini, {eur2(racconto.caffe.reduce((s, v) => s + v.a, 0))}</button> ☕</>}
              </p>
            </div>

            {groups.length > 1 && (
              <div className="bg-white rounded-xl p-4 border border-card-border mb-3">
                <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Chi ha speso cosa</p>
                <div className="flex flex-col gap-2.5">
                  {racconto.gruppi.map(([g, tot]) => (
                    <button key={g} onClick={() => apriDettaglio(`${g} · ${eur(tot)}`, vociMese.filter(v => v.g === g))} className="text-left">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-green-dark">{g}</span>
                        <span className="font-semibold" style={{ color: GROUP_COLORS[g] || FALLBACK_COLOR }}>{eur(tot)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(tot / Math.max(1, racconto.gruppi[0][1])) * 100}%`, background: GROUP_COLORS[g] || FALLBACK_COLOR }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dettaglio ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass">{dettaglio.titolo}</p>
                  <button onClick={() => setDettaglio(null)} className="text-xs text-[#8C3B2E] font-semibold">✕ chiudi</button>
                </div>
                <ListaVoci voci={dettaglio.voci} max={15} />
              </>
            ) : (
              <p className="text-xs text-gray-400 text-center">Tocca i numeri sottolineati per vedere il dettaglio.</p>
            )}
          </>
        )
      ) : (
        /* ================= 💬 DOMANDA LIBERA ================= */
        <>
          <div className="flex flex-col gap-2.5 mb-3">
            {chat.length === 0 && (
              <div className="self-start max-w-[88%] bg-white border border-card-border rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed">
                Chiedimi quello che vuoi sulle vostre spese: una persona, una voce, un negozio, un mese… anche insieme. 💬
              </div>
            )}
            {chat.map((b, i) => (
              <div key={i} className={b.io
                ? 'self-end max-w-[88%] bg-green-mid text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed'
                : 'self-start max-w-[88%] bg-white border border-card-border rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed'}>
                {b.t}
              </div>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 mb-2">
            {DOMANDE_VELOCI.map(q => (
              <button key={q} onClick={() => chiedi(q)}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm border bg-white text-green-mid border-card-border transition active:scale-[0.97]">
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={domanda} onChange={e => setDomanda(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') chiedi(domanda) }}
              placeholder="Scrivi (o detta) la domanda…"
              className="flex-1 border border-card-border rounded-xl p-2.5 text-sm bg-white" />
            <button onClick={() => chiedi(domanda)} disabled={!domanda.trim()}
              className="bg-green-mid text-white rounded-xl px-4 font-bold disabled:opacity-40">➤</button>
          </div>
        </>
      )}
    </div>
  )
}
