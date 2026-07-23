'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BackLink from '@/components/BackLink'

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

function getWeekDays() {
  const days = []
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function getMonthDays() {
  const now = new Date()
  const year = now.getFullYear(); const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 1; i <= lastDay; i++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return days
}

function getYearMonths() {
  const year = new Date().getFullYear()
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

// Notti di un soggiorno che cadono in un dato mese [ms, nms) — nms = 1° del mese dopo.
function nightsInMonth(ci: string, co: string, ms: string, nms: string) {
  const s = ci > ms ? ci : ms
  const e = co < nms ? co : nms
  if (e <= s) return 0
  return Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)
}

// Colore della cella heatmap: dal crema chiaro (0%) al verde scuro Casa Ania (100%).
function occColor(pct: number) {
  const t = Math.max(0, Math.min(1, pct / 100))
  const r = Math.round(237 + (45 - 237) * t)
  const g = Math.round(243 + (106 - 243) * t)
  const b = Math.round(233 + (79 - 233) * t)
  return `rgb(${r}, ${g}, ${b})`
}

const MESI_INIZIALI = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D']
const MESI_NOMI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

export default function Statistiche() {
  const [period, setPeriod] = useState<'settimana' | 'mese' | 'anno'>('mese')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: bookings }, { data: expenses }] = await Promise.all([
        supabase.from('bookings').select('*').neq('status', 'annullata'),
        supabase.from('expenses').select('*'),
      ])
      setData({ bookings: bookings || [], expenses: expenses || [] })
      setLoading(false)
    }
    load()
  }, [])

  function calcPeriod() {
    if (!data) return []
    const { bookings, expenses } = data

    // Da noi si paga tutto all'arrivo: l'intera prenotazione conta nel giorno di
    // check-in (stesso criterio della Home). Prima veniva spalmata sulle notti,
    // con il letto extra diviso per notte: uscivano cifre non tonde e totali
    // diversi da quelli della Home.
    function revenueForDay(day: string) {
      return bookings.filter((b: any) => b.check_in === day)
        .reduce((s: number, b: any) => s + Number(b.total_amount), 0)
    }

    function expensesForDay(day: string) {
      return expenses.filter((e: any) => e.expense_date === day).reduce((s: number, e: any) => s + Number(e.amount), 0)
    }

    function revenueForMonth(month: string) {
      return bookings.filter((b: any) => b.check_in.startsWith(month)).reduce((s: number, b: any) => s + Number(b.total_amount), 0)
    }

    function expensesForMonth(month: string) {
      return expenses.filter((e: any) => e.expense_date.startsWith(month)).reduce((s: number, e: any) => s + Number(e.amount), 0)
    }

    if (period === 'settimana') {
      return getWeekDays().map(day => ({
        label: new Date(day).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }),
        revenue: revenueForDay(day),
        expenses: expensesForDay(day),
        profit: revenueForDay(day) - expensesForDay(day),
      }))
    }
    if (period === 'mese') {
      return getMonthDays().map(day => ({
        label: new Date(day).getDate().toString(),
        revenue: revenueForDay(day),
        expenses: expensesForDay(day),
        profit: revenueForDay(day) - expensesForDay(day),
      }))
    }
    return getYearMonths().map(month => ({
      label: new Date(month + '-01').toLocaleDateString('it-IT', { month: 'short' }),
      revenue: revenueForMonth(month),
      expenses: expensesForMonth(month),
      profit: revenueForMonth(month) - expensesForMonth(month),
    }))
  }

  // Occupazione per mese (indipendente dal periodo scelto): heatmap anni × mesi.
  function buildOccupancy(): { years: number[]; cell: Record<string, number | null> } | null {
    if (!data) return null
    const bookings: any[] = data.bookings
    if (!bookings.length) return { years: [], cell: {} }
    let earliest = bookings[0].check_in
    for (const b of bookings) if (b.check_in < earliest) earliest = b.check_in
    const startYear = Number(earliest.slice(0, 4))
    const startMonthIdx = Number(earliest.slice(5, 7)) - 1
    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth()
    const years: number[] = []
    for (let y = startYear; y <= curYear; y++) years.push(y)
    const cell: Record<string, number | null> = {}
    for (const y of years) {
      for (let m = 0; m < 12; m++) {
        const afterStart = y > startYear || (y === startYear && m >= startMonthIdx)
        const beforeEnd = y < curYear || (y === curYear && m <= curMonth)
        if (!afterStart || !beforeEnd) { cell[`${y}-${m}`] = null; continue }
        const daysInMonth = new Date(y, m + 1, 0).getDate()
        const ms = `${y}-${String(m + 1).padStart(2, '0')}-01`
        const nmDate = new Date(y, m + 1, 1)
        const nms = `${nmDate.getFullYear()}-${String(nmDate.getMonth() + 1).padStart(2, '0')}-01`
        let occ = 0
        for (const b of bookings) occ += nightsInMonth(b.check_in, b.check_out, ms, nms)
        cell[`${y}-${m}`] = Math.min(100, Math.round((occ / (4 * daysInMonth)) * 100))
      }
    }
    return { years, cell }
  }
  const occ = buildOccupancy()

  const rows = calcPeriod()
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses
  const maxRevenue = Math.max(...rows.map(r => r.revenue), 1)

  return (
    <div className="p-4">
      <div className="mb-2"><BackLink href="/" /></div>
      <h1 className="font-serif text-xl text-green-dark mb-4 max-lg:hidden">Statistiche</h1>

      <div className="flex gap-2 mb-4">
        {(['settimana', 'mese', 'anno'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${period === p ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-card-border'}`}>
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white rounded-xl p-3 border border-card-border text-center">
              <p className="text-xs text-gray-500 mb-1">Entrate</p>
              <p className="font-bold text-green-mid text-sm">€{fmt(totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-card-border text-center">
              <p className="text-xs text-gray-500 mb-1">Spese</p>
              <p className="font-bold text-[#8C3B2E] text-sm">€{fmt(totalExpenses)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-card-border text-center">
              <p className="text-xs text-gray-500 mb-1">Profitto</p>
              <p className={`font-bold text-sm ${totalProfit >= 0 ? 'text-green-mid' : 'text-[#8C3B2E]'}`}>€{fmt(totalProfit)}</p>
            </div>
          </div>

          {/* Grafico a barre */}
          <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">Entrate per {period}</p>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {rows.map((r, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col justify-end" style={{ height: 100 }}>
                    <div className="w-full bg-green-mid rounded-t-sm transition-all"
                      style={{ height: `${Math.max(2, (r.revenue / maxRevenue) * 100)}%` }} />
                  </div>
                  {rows.length <= 12 && (
                    <span className="text-[9px] text-gray-400 text-center leading-tight">{r.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tabella riepilogo */}
          <div className="bg-white rounded-xl border border-card-border overflow-hidden">
            <div className="grid grid-cols-4 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
              <span>Periodo</span><span className="text-right">Entrate</span><span className="text-right">Spese</span><span className="text-right">Profitto</span>
            </div>
            {rows.filter(r => r.revenue > 0 || r.expenses > 0).map((r, i) => (
              <div key={i} className="grid grid-cols-4 px-3 py-2 text-sm border-t border-gray-50">
                <span className="text-gray-600">{r.label}</span>
                <span className="text-right text-green-mid">€{fmt(r.revenue)}</span>
                <span className="text-right text-[#8C3B2E]">€{fmt(r.expenses)}</span>
                <span className={`text-right font-semibold ${r.profit >= 0 ? 'text-green-mid' : 'text-[#8C3B2E]'}`}>€{fmt(r.profit)}</span>
              </div>
            ))}
            {rows.filter(r => r.revenue > 0 || r.expenses > 0).length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">Nessun dato per questo periodo</div>
            )}
          </div>

          {/* Occupazione: heatmap anni × mesi (% di camere occupate sul mese) */}
          {occ && occ.years.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-card-border mt-4">
              <p className="text-sm font-semibold text-gray-600">Occupazione</p>
              <p className="text-xs text-gray-400 mb-3">% di camere occupate sul mese — verde più intenso = più pieno</p>
              <div className="overflow-x-auto">
                <table className="border-separate w-full" style={{ borderSpacing: 2, tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}></th>
                      {MESI_INIZIALI.map((m, i) => (
                        <th key={i} className="text-[10px] font-normal text-gray-400 pb-1" title={MESI_NOMI[i]}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {occ.years.map(y => (
                      <tr key={y}>
                        <td className="text-[10px] text-gray-500 pr-1 whitespace-nowrap">{y}</td>
                        {Array.from({ length: 12 }, (_, m) => {
                          const v = occ.cell[`${y}-${m}`]
                          if (v == null) return <td key={m} className="rounded" style={{ height: 26, background: '#F6F2EA' }} />
                          return (
                            <td key={m} title={`${MESI_NOMI[m]} ${y}: ${v}%`}
                              className="text-center text-[10px] rounded"
                              style={{ height: 26, background: occColor(v), color: v >= 55 ? '#fff' : '#1F3D2F' }}>
                              {v}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-gray-400">0%</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(to right, ${occColor(0)}, ${occColor(50)}, ${occColor(100)})` }} />
                <span className="text-[10px] text-gray-400">100%</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
