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

    function revenueForDay(day: string) {
      return bookings.filter((b: any) => b.check_in <= day && b.check_out > day)
        .reduce((s: number, b: any) => {
          const notti = Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
          return s + Number(b.price_per_night) + (b.extra_bed ? Number(b.extra_bed_total) / notti : 0)
        }, 0)
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

  const rows = calcPeriod()
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses
  const maxRevenue = Math.max(...rows.map(r => r.revenue), 1)

  return (
    <div className="p-4">
      <div className="mb-2"><BackLink href="/" /></div>
      <h1 className="font-serif text-xl text-green-dark mb-4">Statistiche</h1>

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
        </>
      )}
    </div>
  )
}
