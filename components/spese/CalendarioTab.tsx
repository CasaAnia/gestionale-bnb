'use client'
import type { Voce, Subcat } from '@/lib/spese/types'
import { ACCENT, eur, eur2 } from '@/lib/spese/costanti'
import ListaVoci from './ListaVoci'

// Scheda 📅 Calendario: griglia del mese coi giorni colorati per quanto si
// è speso; tocchi un giorno e vedi le voci. (Estratta da SpeseTracker.tsx
// in Fase 1: identica.)
export default function CalendarioTab({
  month, daysInMonth, perGiorno, totMese, giornoSel, onGiorno,
  vociGiorno, subcats, onOpenReceipt,
}: {
  month: string
  daysInMonth: number
  perGiorno: Record<number, number>
  totMese: number
  giornoSel: string
  onGiorno: (gs: string) => void
  vociGiorno: Voce[]
  subcats: Subcat[]
  onOpenReceipt: (receiptId: string) => void
}) {
  return (
    <>
      <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-3 text-center">
        <p className="font-serif text-4xl text-[#8C3B2E]">{eur(totMese)}</p>
        <p className="text-xs text-gray-400">{Object.keys(perGiorno).length} giorni con spese</p>
      </div>
      <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm mb-3">
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
              <button key={g} onClick={() => onGiorno(gs)}
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
      {giornoSel && vociGiorno.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5 capitalize">
            {new Date(giornoSel + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} · {eur2(vociGiorno.reduce((s, x) => s + x.a, 0))}
          </p>
          <ListaVoci voci={vociGiorno} subcats={subcats} onOpenReceipt={onOpenReceipt} />
        </>
      )}
    </>
  )
}
