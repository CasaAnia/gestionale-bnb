'use client'
import { useEffect, useMemo, useState } from 'react'
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
import { GROUP_COLORS, FALLBACK_COLOR, strip } from '@/lib/spese/costanti'
import { monthKey, periodoRange, periodoLabel, ritmoEPrevisione } from '@/lib/spese/periodo'
import { rispondi as rispondiDomanda } from '@/lib/spese/domanda'
import {
  vociDi as vociDiPure, itemsPerSpesa, sparklinePath, tessereCategorie,
  totalePerCategoria, fisseMese, costruisciRacconto, contoCaffe, spesePerGiorno,
} from '@/lib/spese/voci'
import { filtraPerAmbito } from '@/lib/spese/ambito'
import * as dati from '@/lib/spese/dati'
import ScontriniBlock from '@/components/spese/ScontriniBlock'
import FormSpesa from '@/components/spese/FormSpesa'
import FiltriSchede from '@/components/spese/FiltriSchede'
import HomeTab from '@/components/spese/HomeTab'
import CalendarioTab from '@/components/spese/CalendarioTab'
import RaccontoTab from '@/components/spese/RaccontoTab'
import DomandaTab from '@/components/spese/DomandaTab'

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

  // L'accesso a Supabase vive in lib/spese/dati.ts (estratto in Fase 1,
  // stesse query); il filtro per ambito in lib/spese/ambito.ts (puro).
  async function loadReceipts() {
    const list = await dati.caricaScontriniDaLeggere(ambito)
    if (list === null) return // tabella/bucket non ancora pronti: la sezione resta nascosta
    setReceipts(list)
    setReceiptUrls(await dati.urlFirmatiScontrini(list))
  }

  async function load() {
    if (isDemoMode()) return // in dimostrazione non si carica nulla
    setLoading(true)
    const base = await dati.caricaBase()
    if (base.needsSetup) { setNeedsSetup(true); setLoading(false); return } // migrazione non ancora applicata
    const mio = filtraPerAmbito(ambito, base.groups, base.cats, base.rules, base.expenses)
    setGroups(mio.groups)
    setCats(mio.cats)
    setRules(mio.rules)
    setRows(mio.expenses)
    setLoading(false)
    loadReceipts()
    setItems(await dati.caricaItems(mio.expenses.map(x => x.id)))
    const sc = await dati.caricaSubcats()
    if (sc.length) setSubcats(sc)
    const b = await dati.caricaBudgets(ambito)
    if (b.ok) { setBudgets(b.budgets); setBudgetsOk(true) }
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
        if (!await dati.salvaFotoScontrino(s.file, note, ambito)) { remaining.push(s); continue }
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
    await dati.eliminaScontrino(r)
    setReceipts(receipts.filter(x => x.id !== r.id))
  }

  // Aggiunge/modifica la nota di uno scontrino già caricato.
  async function editReceiptNote(r: Receipt) {
    const nota = prompt('Nota per questo scontrino (indicazioni per me):', r.note || '')
    if (nota === null) return
    const value = nota.trim() || null
    await dati.aggiornaNotaScontrino(r.id, value)
    setReceipts(receipts.map(x => x.id === r.id ? { ...x, note: value } : x))
  }

  // Riapre la foto dello scontrino collegato a una spesa (link firmato al volo).
  async function openReceiptPhoto(receiptId: string) {
    const url = await dati.urlFotoScontrino(receiptId)
    if (!url) { alert('Foto non trovata.'); return }
    window.open(url, '_blank')
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
    await dati.inserisciSpesa({
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
    await dati.eliminaSpesa(id)
    setRows(rows.filter(r => r.id !== id))
  }

  // ---- budget mensili ----
  async function saveBudget() {
    const name = budgetForm.category_name
    const amt = parseFloat(budgetForm.amount.replace(',', '.'))
    if (!name || !amt) return
    await dati.salvaBudget(ambito, name, amt)
    setBudgetForm({ category_name: '', amount: '' }); setShowBudgetForm(false); load()
  }
  async function editBudget(b: Budget) {
    const v = prompt(`Budget mensile per "${b.category_name}" (vuoto per toglierlo):`, String(b.monthly_amount))
    if (v === null) return
    const amt = parseFloat(v.replace(',', '.'))
    if (!v.trim() || !amt) await dati.eliminaBudget(b.id)
    else await dati.aggiornaBudget(b.id, amt)
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
  // Il motore vive in lib/spese/domanda.ts (estratto in Fase 1, identico).
  const rispondi = (q: string): string =>
    rispondiDomanda(q, { rows, month, groups, cats, subcats, vociDi })
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
      <ScontriniBlock receipts={receipts} receiptUrls={receiptUrls} staged={staged}
        receiptNote={receiptNote} uploading={uploading} showForm={showForm}
        onStagePhotos={stagePhotos} onRemoveStaged={removeStaged} onSaveStaged={saveStaged}
        onReceiptNote={setReceiptNote}
        onToggleForm={() => { setShowForm(!showForm); setForm(blankForm()); setAutoGroup(null) }}
        onEditNote={editReceiptNote} onDelete={deleteReceipt} />

      {/* FORM */}
      {showForm && (
        <FormSpesa form={form} setForm={setForm} autoGroup={autoGroup} setAutoGroup={setAutoGroup}
          groups={groups} catsForGroup={catsForGroup} subcats={subcats} stores={stores}
          saving={saving} catName={catName} applyRules={applyRules} onSave={save} />
      )}

      {/* LE 4 SCHEDE + DI CHI + PERIODO */}
      <FiltriSchede tab={tab} cambiaTab={cambiaTab} groups={groups} gFilter={gFilter}
        setGFilter={setGFilter} chiudiDettaglio={() => setDettaglio(null)}
        periodMode={periodMode} setPeriodMode={setPeriodMode} isMese={isMese}
        month={month} cambiaMese={cambiaMese}
        weekAnchor={weekAnchor} setWeekAnchor={setWeekAnchor} year={year} setYear={setYear}
        fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate}
        periodStart={periodStart} periodEnd={periodEnd} resetShowAll={() => setShowAll(false)} />

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento…</div>
      ) : tab === 'home' ? (
        /* ================= 🏠 HOME ================= */
        <HomeTab speseMese={speseMese} vociMese={vociMese} totMese={totMese}
          periodLabel={periodLabel} isMese={isMese} isCurrentMonth={isCurrentMonth}
          mediaGiorno={mediaGiorno} previsione={previsione} sparkline={sparkline}
          daysInMonth={daysInMonth} month={month} caffeMese={caffeMese} tessere={tessere}
          dettaglio={dettaglio} apriDettaglio={apriDettaglio} chiudiDettaglio={() => setDettaglio(null)}
          budgetsOk={budgetsOk} budgetRows={budgetRows} catNames={catNames}
          showBudgetForm={showBudgetForm} setShowBudgetForm={setShowBudgetForm}
          budgetForm={budgetForm} setBudgetForm={setBudgetForm}
          onSaveBudget={saveBudget} onEditBudget={editBudget}
          fisse={fisse} fisseTot={fisseTot} showAll={showAll} setShowAll={setShowAll}
          groups={groups} subcats={subcats} groupName={groupName} catName={catName}
          colorOf={colorOf} onOpenReceipt={openReceiptPhoto} onDelete={del} />
      ) : tab === 'calendario' ? (
        /* ================= 📅 CALENDARIO ================= */
        <CalendarioTab month={month} daysInMonth={daysInMonth} perGiorno={perGiorno}
          totMese={totMese} giornoSel={giornoSel}
          onGiorno={gs => { setGiornoSel(giornoSel === gs ? '' : gs); setDettaglio(null) }}
          vociGiorno={giornoSel ? vociDi(rows.filter(r => r.expense_date === giornoSel)) : []}
          subcats={subcats} onOpenReceipt={openReceiptPhoto} />
      ) : tab === 'racconto' ? (
        /* ================= 📖 RACCONTO ================= */
        !racconto ? (
          <div className="text-center py-10 text-gray-400">Nessuna spesa da raccontare in questo periodo</div>
        ) : (
          <RaccontoTab racconto={racconto} vociMese={vociMese} totMese={totMese} isMese={isMese}
            month={month} mesePrecedente={mKey(-1)} periodLabel={periodLabel} groups={groups}
            dettaglio={dettaglio} apriDettaglio={apriDettaglio} chiudiDettaglio={() => setDettaglio(null)}
            subcats={subcats} onOpenReceipt={openReceiptPhoto} />
        )
      ) : (
        /* ================= 💬 DOMANDA LIBERA ================= */
        <DomandaTab chat={chat} domanda={domanda} setDomanda={setDomanda}
          domandeVeloci={DOMANDE_VELOCI} onChiedi={chiedi} />
      )}
    </div>
  )
}
