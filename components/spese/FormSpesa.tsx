'use client'
import type { Group, Category, Subcat } from '@/lib/spese/types'

export type FormSpesaValori = {
  expense_date: string; amount: string; group_id: string; category_id: string
  subcategory: string; store: string; product: string; description: string; recurring: boolean
}

// Form "Nuova spesa" manuale. (Estratto da SpeseTracker.tsx in Fase 1:
// stesse classi, testi e comportamento, regole prodotto comprese.)
export default function FormSpesa({
  form, setForm, autoGroup, setAutoGroup, groups, catsForGroup, subcats, stores,
  saving, catName, applyRules, onSave,
}: {
  form: FormSpesaValori
  setForm: (f: FormSpesaValori) => void
  autoGroup: string | null
  setAutoGroup: (v: string | null) => void
  groups: Group[]
  catsForGroup: Category[]
  subcats: Subcat[]
  stores: string[]
  saving: boolean
  catName: (id: string | null | undefined) => string
  applyRules: (text: string, current: FormSpesaValori) => FormSpesaValori
  onSave: () => void
}) {
  return (
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

      <button onClick={onSave} disabled={saving || !form.amount}
        className="w-full bg-[#C58A67] text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
        {saving ? 'Salvataggio…' : 'Salva spesa'}
      </button>
    </div>
  )
}
