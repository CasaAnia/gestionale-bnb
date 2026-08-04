'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BackBar from '@/components/BackBar'
import DemoGate from '@/components/DemoGate'
import { isDemoMode } from '@/lib/demoMode'

// Spese di famiglia: sezione separata dalle spese del B&B. Due livelli
// (gruppo = di chi e' la spesa, categoria = che tipo), piu' negozio,
// prodotto seguito, flag ricorrente e regole prodotto->gruppo.

type Group = { id: string; name: string; emoji: string | null; sort: number }
type Category = { id: string; group_id: string; name: string; sort: number }
type Rule = { id: string; keyword: string; group_id: string | null; category_id: string | null; track_detail: boolean }
type Fx = {
  id: string; expense_date: string; amount: number; group_id: string | null; category_id: string | null
  store: string | null; product: string | null; description: string | null; recurring: boolean; source: string
}

const GROUP_COLORS: Record<string, string> = {
  'Casa': '#2D6A4F', 'Ania': '#A9884E', 'Matteo': '#5E7FA3',
  'Matteo e Ania': '#9C6B99', 'Casa Granata': '#8C3B2E',
}
const FALLBACK_COLOR = '#7C857A'
const eur = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const eur2 = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export default function SpeseFamigliaPage() {
  return <DemoGate><SpeseFamiglia /></DemoGate>
}

function SpeseFamiglia() {
  const [groups, setGroups] = useState<Group[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [rows, setRows] = useState<Fx[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [groupFilter, setGroupFilter] = useState<string>('') // '' = tutti
  const [showForm, setShowForm] = useState(false)

  const blankForm = () => ({
    expense_date: new Date().toISOString().split('T')[0],
    amount: '', group_id: '', category_id: '', store: '', product: '', description: '', recurring: false,
  })
  const [form, setForm] = useState(blankForm())
  const [autoGroup, setAutoGroup] = useState<string | null>(null) // regola prodotto scattata
  const [saving, setSaving] = useState(false)

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
    setGroups(g.data || []); setCats(c.data || []); setRules(r.data || []); setRows(e.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const groupName = (id: string | null) => groups.find(x => x.id === id)?.name || '—'
  const groupEmoji = (id: string | null) => groups.find(x => x.id === id)?.emoji || ''
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
      group_id: form.group_id || null,
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
  const monthRows = rows.filter(r => r.expense_date.startsWith(month))
  const filtered = groupFilter ? monthRows.filter(r => r.group_id === groupFilter) : monthRows
  const totale = filtered.reduce((s, r) => s + Number(r.amount), 0)

  const perGroup = useMemo(() => {
    const m: Record<string, number> = {}
    monthRows.forEach(r => { const k = r.group_id || 'none'; m[k] = (m[k] || 0) + Number(r.amount) })
    return groups.map(g => ({ g, tot: m[g.id] || 0 })).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot)
  }, [monthRows, groups])
  const maxGroup = Math.max(1, ...perGroup.map(x => x.tot))

  const perCat = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(r => { const k = r.category_id || 'none'; m[k] = (m[k] || 0) + Number(r.amount) })
    return Object.entries(m).map(([id, tot]) => ({ id, tot })).sort((a, b) => b.tot - a.tot).slice(0, 8)
  }, [filtered])
  const maxCat = Math.max(1, ...perCat.map(x => x.tot))

  // Prodotti seguiti (track_detail): totale del mese per ciascuno.
  const tracked = useMemo(() => {
    const keys = rules.filter(r => r.track_detail).map(r => r.keyword)
    return keys.map(k => {
      const tot = monthRows
        .filter(r => strip(`${r.product || ''} ${r.description || ''}`).includes(strip(k)))
        .reduce((s, r) => s + Number(r.amount), 0)
      return { k, tot }
    }).filter(x => x.tot > 0)
  }, [monthRows, rules])

  const catsForGroup = cats.filter(c => c.group_id === form.group_id)

  if (needsSetup) return (
    <div className="p-4">
      <BackBar href="/" />
      <div className="bg-white rounded-[10px] border border-card-border p-5 text-sm text-green-dark">
        <p className="font-serif text-lg mb-2">Spese Famiglia</p>
        <p className="text-gray-600">La sezione è pronta, ma manca un passaggio: applicare la migrazione del database.</p>
        <p className="text-gray-600 mt-2">Apri Supabase → SQL Editor e incolla il file <code className="bg-sand px-1 rounded">0007_spese_famiglia.sql</code>, poi ricarica.</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 pb-24">
      <BackBar href="/" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-green-dark max-lg:hidden">Spese Famiglia</h1>
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
              {groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
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

      {/* FILTRO MESE + TOTALE */}
      <div className="flex items-center gap-2 mb-3">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-card-border rounded-lg p-2 text-sm flex-1" />
        <div className="bg-white rounded-xl px-4 py-2 border border-card-border text-right">
          <p className="text-xs text-gray-500">{groupFilter ? groupName(groupFilter) : 'Totale mese'}</p>
          <p className="font-bold text-[#8C3B2E]">{eur(totale)}</p>
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
                    {g.emoji} {g.name}
                  </button>
                )
              })}
            </div>
          )}

          {monthRows.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Nessuna spesa per questo mese</div>
          ) : (
            <>
              {/* DASHBOARD: per gruppo */}
              {!groupFilter && perGroup.length > 0 && (
                <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Dove va la spesa</p>
                  <div className="flex flex-col gap-2.5">
                    {perGroup.map(({ g, tot }) => (
                      <button key={g.id} onClick={() => setGroupFilter(g.id)} className="text-left">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-green-dark">{g.emoji} {g.name}</span>
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
              {perCat.length > 0 && (
                <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Voci dove spendi di più</p>
                  <div className="flex flex-col gap-2.5">
                    {perCat.map(({ id, tot }) => (
                      <div key={id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-green-dark">{catName(id) || 'Senza categoria'}</span>
                          <span className="font-semibold text-[#8C3B2E]">{eur(tot)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                          <div className="h-full rounded-full bg-[#C58A67]" style={{ width: `${(tot / maxCat) * 100}%` }} />
                        </div>
                      </div>
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

              {/* ELENCO */}
              <div className="flex flex-col gap-2">
                {filtered.map(r => (
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
