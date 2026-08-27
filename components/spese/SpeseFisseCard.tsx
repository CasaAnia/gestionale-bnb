'use client'
import { eur, eur2 } from '@/lib/spese/costanti'
import { monthLabel } from '@/lib/spese/periodo'

// Card "Spese fisse del mese": ricorrenti pagate (✓) e attese (~).
// (Estratta da SpeseTracker.tsx in Fase 1: stesse classi e testi.)
export default function SpeseFisseCard({ month, fisse, fisseTot }: {
  month: string
  fisse: { name: string; tot: number; day: number; paid: boolean }[]
  fisseTot: number
}) {
  return (
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
  )
}
