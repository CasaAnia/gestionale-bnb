'use client'
import type { Fx, Group } from '@/lib/spese/types'
import { eur2, icona } from '@/lib/spese/costanti'
import { monthLabel } from '@/lib/spese/periodo'

// "Ultime spese" + elenco completo del periodo, con ✕ elimina e 🧾 foto.
// (Estratto da SpeseTracker.tsx in Fase 1: stesse classi e testi.)
export default function UltimeSpese({
  speseMese, showAll, setShowAll, isMese, month, periodLabel,
  groups, groupName, catName, colorOf, onOpenReceipt, onDelete,
}: {
  speseMese: Fx[]
  showAll: boolean
  setShowAll: (v: boolean) => void
  isMese: boolean
  month: string
  periodLabel: string
  groups: Group[]
  groupName: (id: string | null) => string
  catName: (id: string | null | undefined) => string
  colorOf: (id: string | null) => string
  onOpenReceipt: (receiptId: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
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
                  <button onClick={() => onOpenReceipt(r.receipt_id!)}
                    className="text-xs bg-sand text-[#7A5C1E] px-2 py-0.5 rounded-full">🧾 foto</button>
                )}
              </div>
              <p className="text-sm mt-1 truncate">{r.description || '—'}{r.store ? <span className="text-gray-400"> · {r.store}</span> : null}</p>
              <p className="text-xs text-gray-400">{r.expense_date}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p className="font-bold text-[#8C3B2E]">{eur2(Number(r.amount))}</p>
              <button onClick={() => onDelete(r.id)} className="text-gray-300 hover:text-[#8C3B2E] text-lg">✕</button>
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
}
