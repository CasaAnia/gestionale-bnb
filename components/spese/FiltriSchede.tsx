'use client'
import type { Group, Tab } from '@/lib/spese/types'
import { GROUP_COLORS, FALLBACK_COLOR, ACCENT } from '@/lib/spese/costanti'
import { giornoBreve, type PeriodMode } from '@/lib/spese/periodo'

// Navigazione delle 4 schede + filtro "Di chi" + scelta del periodo.
// (Estratto da SpeseTracker.tsx in Fase 1: stesse classi, testi e regole —
// la Domanda non mostra filtri, il Calendario resta per mese.)
export default function FiltriSchede({
  tab, cambiaTab, groups, gFilter, setGFilter, chiudiDettaglio,
  periodMode, setPeriodMode, isMese, month, cambiaMese,
  weekAnchor, setWeekAnchor, year, setYear, fromDate, setFromDate, toDate, setToDate,
  periodStart, periodEnd, resetShowAll,
}: {
  tab: Tab
  cambiaTab: (t: Tab) => void
  groups: Group[]
  gFilter: string
  setGFilter: (id: string) => void
  chiudiDettaglio: () => void
  periodMode: PeriodMode
  setPeriodMode: (m: PeriodMode) => void
  isMese: boolean
  month: string
  cambiaMese: (delta: number) => void
  weekAnchor: string
  setWeekAnchor: (d: string) => void
  year: string
  setYear: (y: string) => void
  fromDate: string
  setFromDate: (d: string) => void
  toDate: string
  setToDate: (d: string) => void
  periodStart: string
  periodEnd: string
  resetShowAll: () => void
}) {
  return (
    <>
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
              <button key={g.id} onClick={() => { setGFilter(on ? '' : g.id); chiudiDettaglio() }}
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
                <button key={m} onClick={() => { setPeriodMode(m); chiudiDettaglio(); resetShowAll() }}
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
              <input type="date" value={weekAnchor} onChange={e => { setWeekAnchor(e.target.value); chiudiDettaglio() }}
                className="border border-card-border rounded-lg p-2 text-sm bg-white" />
              <span className="text-xs text-gray-400">{giornoBreve(periodStart)} → {giornoBreve(periodEnd)}</span>
            </div>
          ) : periodMode === 'anno' ? (
            <div className="flex items-center justify-center gap-4 mb-3">
              <button onClick={() => { setYear(String(Number(year) - 1)); chiudiDettaglio() }} aria-label="Anno precedente"
                className="w-8 h-8 rounded-full bg-white border border-card-border text-green-mid">‹</button>
              <span className="font-serif text-base text-green-dark min-w-[80px] text-center">{year}</span>
              <button onClick={() => { setYear(String(Number(year) + 1)); chiudiDettaglio() }} aria-label="Anno successivo"
                className="w-8 h-8 rounded-full bg-white border border-card-border text-green-mid">›</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
              <span className="text-sm text-gray-500">Dal</span>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); chiudiDettaglio() }}
                className="border border-card-border rounded-lg p-2 text-sm bg-white" />
              <span className="text-sm text-gray-500">al</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); chiudiDettaglio() }}
                className="border border-card-border rounded-lg p-2 text-sm bg-white" />
            </div>
          )}
        </>
      )}
    </>
  )
}
