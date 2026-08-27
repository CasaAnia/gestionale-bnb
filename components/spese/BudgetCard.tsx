'use client'
import type { Budget } from '@/lib/spese/types'
import { eur } from '@/lib/spese/costanti'
import { monthLabel } from '@/lib/spese/periodo'

const budgetColor = (ratio: number) => ratio >= 1 ? '#8C3B2E' : ratio >= 0.9 ? '#B07D4F' : '#5B8A70'

// Card "Budget di [mese]" con barre e form ＋ Budget. (Estratta da
// SpeseTracker.tsx in Fase 1: stesse classi, testi e colori.)
export default function BudgetCard({
  month, budgetRows, catNames, showBudgetForm, setShowBudgetForm,
  budgetForm, setBudgetForm, onSaveBudget, onEditBudget,
}: {
  month: string
  budgetRows: { b: Budget; spent: number }[]
  catNames: string[]
  showBudgetForm: boolean
  setShowBudgetForm: (v: boolean) => void
  budgetForm: { category_name: string; amount: string }
  setBudgetForm: (v: { category_name: string; amount: string }) => void
  onSaveBudget: () => void
  onEditBudget: (b: Budget) => void
}) {
  return (
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
          <button onClick={onSaveBudget} disabled={!budgetForm.category_name || !budgetForm.amount}
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
            <button key={b.id} onClick={() => onEditBudget(b)} className="text-left">
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
  )
}
