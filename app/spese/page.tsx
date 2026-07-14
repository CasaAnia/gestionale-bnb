'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Spese() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category_id: '', expense_date: new Date().toISOString().split('T')[0], amount: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7))

  async function load() {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('expenses').select('*, expense_categories(name)').order('expense_date', { ascending: false }),
      supabase.from('expense_categories').select('*').order('name'),
    ])
    setExpenses(e || []); setCategories(c || []); setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!form.amount || !form.expense_date) return
    setSaving(true)
    await supabase.from('expenses').insert({
      category_id: form.category_id || null, expense_date: form.expense_date,
      amount: parseFloat(form.amount), description: form.description || null, source: 'manuale'
    })
    setForm({ category_id: '', expense_date: new Date().toISOString().split('T')[0], amount: '', description: '' })
    setShowForm(false); setSaving(false); load()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Eliminare questa spesa?')) return
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(expenses.filter(e => e.id !== id))
  }

  const filtered = expenses.filter(e => e.expense_date.startsWith(monthFilter))
  const totale = filtered.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-green-dark">Spese</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-[#C58A67] text-white rounded-full px-3 py-1.5 text-sm font-semibold">
          {showForm ? '✕ Chiudi' : '+ Aggiungi'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
          <p className="font-semibold mb-3">Nuova spesa</p>
          <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}
            className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm">
            <option value="">Categoria (opzionale)</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})}
              className="border border-card-border rounded-lg p-2 text-sm" />
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
              placeholder="Importo €" className="border border-card-border rounded-lg p-2 text-sm" />
          </div>
          <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Descrizione" className="w-full border border-card-border rounded-lg p-2 text-sm mb-3" />
          <button onClick={save} disabled={saving || !form.amount}
            className="w-full bg-[#C58A67] text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Salva spesa'}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="border border-card-border rounded-lg p-2 text-sm flex-1" />
        <div className="bg-white rounded-xl px-4 py-2 border border-card-border text-right">
          <p className="text-xs text-gray-500">Totale mese</p>
          <p className="font-bold text-[#8C3B2E]">€{totale.toFixed(0)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Nessuna spesa per questo mese</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(e => (
            <div key={e.id} className="bg-white rounded-xl p-3 border border-card-border flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.expense_categories?.name || 'Altro'}</span>
                  {e.source === 'email' && <span className="text-xs bg-sage text-green-mid px-2 py-0.5 rounded-full">📧 email</span>}
                </div>
                <p className="text-sm mt-1">{e.description || '—'}</p>
                <p className="text-xs text-gray-400">{e.expense_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-[#8C3B2E]">€{Number(e.amount).toFixed(0)}</p>
                <button onClick={() => deleteExpense(e.id)} className="text-gray-300 hover:text-[#8C3B2E] text-lg">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
