'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BackBar from '@/components/BackBar'
import { ROOM_NUMBER_BY_NAME } from '@/lib/roomTypes'
import { contoSoggiorno } from '@/lib/conto'

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

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Incassi reali: ogni entrata è attribuita al giorno in cui i soldi arrivano davvero.
// - Se ci sono pagamenti registrati (acconti/bonifici) → ognuno nel suo giorno (paid_on);
//   l'eventuale parte non pagata NON viene contata (è ancora da incassare).
// - Se non c'è nessun pagamento registrato → si assume saldo intero alla consegna chiavi
//   (primo check-in del soggiorno), tranne bonifici in attesa o arrivi ancora futuri.
// I segmenti di un cambio camera (stesso group_id) sono un unico soggiorno.
function buildReceipts(bookings: any[], payments: any[], today: string): { date: string; amount: number }[] {
  const paysByBooking: Record<string, any[]> = {}
  for (const p of payments) (paysByBooking[p.booking_id] = paysByBooking[p.booking_id] || []).push(p)
  const groups: Record<string, any[]> = {}
  for (const b of bookings) { const k = b.group_id || b.id; (groups[k] = groups[k] || []).push(b) }
  const receipts: { date: string; amount: number }[] = []
  for (const k in groups) {
    const segs = groups[k]
    const gp: any[] = []
    for (const s of segs) for (const p of (paysByBooking[s.id] || [])) gp.push(p)
    if (gp.length > 0) {
      for (const p of gp) if (p.paid_on) receipts.push({ date: p.paid_on, amount: Number(p.amount) })
    } else {
      const dovuto = segs.reduce((s: number, x: any) => s + Number(x.total_amount), 0)
      const firstCheckIn = segs.map((s: any) => s.check_in).sort()[0]
      const bonifico = segs.some((s: any) => s.bonifico)
      const pagato = segs.some((s: any) => s.pagato)
      if (pagato || (!bonifico && firstCheckIn <= today)) receipts.push({ date: firstCheckIn, amount: dovuto })
    }
  }
  return receipts
}

export default function Statistiche() {
  const [period, setPeriod] = useState<'settimana' | 'mese' | 'anno'>('mese')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: bookings }, { data: expenses }, { data: payments }, { data: rooms }] = await Promise.all([
        supabase.from('bookings').select('*').neq('status', 'annullata'),
        supabase.from('family_expenses').select('expense_date, amount, family_groups!inner(ambito)').eq('family_groups.ambito', 'azienda'),
        supabase.from('payments').select('booking_id, amount, paid_on'),
        supabase.from('rooms').select('id, name'),
      ])
      setData({ bookings: bookings || [], expenses: expenses || [], payments: payments || [], rooms: rooms || [] })
      setLoading(false)
    }
    load()
  }, [])

  function calcPeriod() {
    if (!data) return []
    const { expenses } = data

    // Entrate = incasso REALE, attribuito al giorno in cui i soldi arrivano davvero
    // (acconti/bonifici nel loro giorno; altrimenti saldo intero alla consegna chiavi).
    const receipts = buildReceipts(data.bookings, data.payments || [], todayStr())

    function revenueForDay(day: string) {
      return receipts.filter(r => r.date === day).reduce((s, r) => s + r.amount, 0)
    }

    function expensesForDay(day: string) {
      return expenses.filter((e: any) => e.expense_date === day).reduce((s: number, e: any) => s + Number(e.amount), 0)
    }

    function revenueForMonth(month: string) {
      return receipts.filter(r => r.date.startsWith(month)).reduce((s, r) => s + r.amount, 0)
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

  // Sconti concessi nel periodo (mese o anno corrente): valore a prezzo pieno,
  // sconti, valore dopo sconto, incassato. Tutto attribuito pro-quota sulle
  // notti dormite (mai alla data in cui si è premuto "Applica sconto") e tutto
  // dal conto unico: con discount_type null lo sconto è SEMPRE zero e il
  // valore resta il total_amount salvato — i dati storici non generano sconti
  // artificiali né vengono reinterpretati.
  function calcSconti() {
    if (!data || period === 'settimana') return null
    const now = new Date()
    const y = now.getFullYear(); const m = now.getMonth()
    const start = period === 'mese' ? `${y}-${String(m + 1).padStart(2, '0')}-01` : `${y}-01-01`
    const endD = period === 'mese' ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1)
    const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-01`
    let pieno = 0, sconti = 0, valore = 0
    for (const b of data.bookings) {
      const totN = Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
      if (totN <= 0) continue
      const inWin = nightsInMonth(b.check_in, b.check_out, start, end)
      if (inWin <= 0) continue
      const q = inWin / totN
      const v = Number(b.total_amount || 0)
      const s = b.discount_type ? contoSoggiorno(b).sconto : 0
      valore += v * q
      sconti += s * q
      pieno += (v + s) * q
    }
    // Incassato: solo denaro con una data reale nel periodo (stessa logica delle Entrate)
    const receipts = buildReceipts(data.bookings, data.payments || [], todayStr())
    const incassato = receipts.filter(r => r.date >= start && r.date < end).reduce((s, r) => s + r.amount, 0)
    return { pieno, sconti, valore, incassato }
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

  // Rendimento per camera nell'anno corrente, contando solo le notti già trascorse
  // (fino a stanotte compresa): l'incasso di un soggiorno è ripartito pro-quota
  // sulle sue notti, così un soggiorno a cavallo di due mesi pesa sul mese giusto.
  function buildRoomStats() {
    if (!data) return null
    const rooms: any[] = data.rooms || []
    const bookings: any[] = data.bookings
    if (!rooms.length || !bookings.length) return null
    const now = new Date()
    const year = now.getFullYear()
    const curMonth = now.getMonth()
    const tom = new Date(now); tom.setDate(now.getDate() + 1)
    const cap = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`
    const stats: Record<string, { name: string; nights: number; revenue: number; monthly: number[] }> = {}
    for (const r of rooms) stats[r.id] = { name: r.name, nights: 0, revenue: 0, monthly: Array(12).fill(0) }
    let firstNight: string | null = null
    for (const b of bookings) {
      const st = stats[b.room_id]
      if (!st) continue
      const totNights = Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
      if (totNights <= 0) continue
      const perNight = Number(b.total_amount || 0) / totNights
      for (let m = 0; m <= curMonth; m++) {
        const ms = `${year}-${String(m + 1).padStart(2, '0')}-01`
        const nmD = new Date(year, m + 1, 1)
        const nms = `${nmD.getFullYear()}-${String(nmD.getMonth() + 1).padStart(2, '0')}-01`
        const end = nms < cap ? nms : cap
        if (end <= ms) continue
        const n = nightsInMonth(b.check_in, b.check_out, ms, end)
        if (n <= 0) continue
        st.nights += n
        st.revenue += n * perNight
        st.monthly[m] += n * perNight
        const s = b.check_in > ms ? b.check_in : ms
        if (!firstNight || s < firstNight) firstNight = s
      }
    }
    const list = Object.values(stats).filter(s => s.nights > 0).sort((a, b2) => b2.revenue - a.revenue)
    if (!list.length || !firstNight) return null
    const daysElapsed = Math.max(1, Math.round((new Date(cap).getTime() - new Date(firstNight).getTime()) / 86400000))
    const firstMonthIdx = Number(firstNight.slice(5, 7)) - 1
    const numMonths = curMonth - firstMonthIdx + 1
    return { year, list, daysElapsed, firstMonthIdx, curMonth, numMonths }
  }
  const roomStats = buildRoomStats()

  const rows = calcPeriod()
  const sconti = calcSconti()
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses
  const maxRevenue = Math.max(...rows.map(r => r.revenue), 1)

  return (
    <div className="p-4">
      <BackBar href="/" />
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

          {/* Sconti concessi: valore pieno, sconti, valore dopo sconto, incassato.
              Attribuiti alle notti dormite del periodo, dal conto unico */}
          {sconti && (
            <div className="bg-white rounded-xl p-4 border border-card-border mt-4">
              <p className="text-sm font-semibold text-gray-600">Sconti concessi</p>
              <p className="text-xs text-gray-400 mb-3">{period === 'mese' ? 'mese corrente' : `anno ${new Date().getFullYear()}`} · valori attribuiti alle notti del periodo</p>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Valore a prezzo pieno</span>
                <span className="font-semibold">€{fmt(sconti.pieno)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Sconti concessi</span>
                <span className="font-semibold" style={{ color: '#8a4f2f' }}>−€{fmt(sconti.sconti)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Valore soggiorni dopo sconto</span>
                <span className="font-semibold text-green-mid">€{fmt(sconti.valore)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-gray-600">Incassato realmente</span>
                <span className="font-bold text-green-mid">€{fmt(sconti.incassato)}</span>
              </div>
            </div>
          )}

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

          {/* Rendimento camere: classifica dell'anno in corso (incassi pro-quota a notte) */}
          {roomStats && (
            <div className="bg-white rounded-xl p-4 border border-card-border mt-4">
              <p className="text-sm font-semibold text-gray-600">Rendimento camere</p>
              <p className="text-xs text-gray-400 mb-3">anno {roomStats.year} · incassi e notti fino a oggi</p>
              {roomStats.list.map((s, i) => (
                <div key={s.name} className={i > 0 ? 'mt-3' : ''}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium text-green-dark">
                      {s.name}
                      {i === 0 && <span className="ml-1.5 text-[10px] bg-[#EDF3E9] text-green-mid rounded-full px-2 py-0.5">migliore</span>}
                    </span>
                    <span className="text-sm font-semibold text-green-mid">€{fmt(s.revenue)}</span>
                  </div>
                  <div className="h-1.5 rounded-full my-1.5" style={{ background: '#F6F2EA' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (s.revenue / roomStats.list[0].revenue) * 100)}%`, background: i === 0 ? '#2D6A4F' : '#6C9A7C' }} />
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {s.nights} notti · {Math.round((s.nights / roomStats.daysElapsed) * 100)}% occupazione · media €{fmt(s.revenue / s.nights)}/notte
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Camera del mese: incasso di ogni camera in ogni mese, in grassetto la migliore,
              ultima riga = media mensile (incasso totale ÷ mesi trascorsi) */}
          {roomStats && (() => {
            const cols = [...roomStats.list].sort((a, b2) => (ROOM_NUMBER_BY_NAME[a.name] || '99').localeCompare(ROOM_NUMBER_BY_NAME[b2.name] || '99'))
            const gridCols = { display: 'grid', gridTemplateColumns: `44px repeat(${cols.length}, 1fr)` } as const
            const months = Array.from({ length: roomStats.numMonths }, (_, k) => roomStats.firstMonthIdx + k)
            return (
              <div className="bg-white rounded-xl p-4 border border-card-border mt-4">
                <p className="text-sm font-semibold text-gray-600">Camera del mese</p>
                <p className="text-xs text-gray-400 mb-3">incasso di ogni camera, mese per mese — in verde la migliore del mese</p>
                <div className="rounded-lg border border-card-border overflow-hidden">
                  <div className="bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-500" style={gridCols}>
                    <span></span>
                    {cols.map(s => <span key={s.name} className="text-right truncate">{s.name}</span>)}
                  </div>
                  {months.map(m => {
                    const top = Math.max(...cols.map(s => s.monthly[m]))
                    return (
                      <div key={m} className="px-2 py-2 text-xs border-t border-gray-50" style={gridCols}>
                        <span className="text-gray-600">{MESI_NOMI[m].slice(0, 3)}</span>
                        {cols.map(s => (
                          <span key={s.name} className={`text-right ${s.monthly[m] <= 0 ? 'text-gray-300' : top > 0 && s.monthly[m] === top ? 'font-semibold text-green-mid' : 'text-gray-600'}`}>
                            {s.monthly[m] <= 0 ? '—' : `€${fmt(s.monthly[m])}`}
                          </span>
                        ))}
                      </div>
                    )
                  })}
                  <div className="px-2 py-2 text-xs border-t border-card-border bg-gray-50" style={gridCols}>
                    <span className="font-semibold text-gray-500">Media</span>
                    {cols.map(s => (
                      <span key={s.name} className="text-right font-semibold text-green-mid">€{fmt(s.revenue / roomStats.numMonths)}</span>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Media = incasso al mese, calcolata su tutti i mesi da {MESI_NOMI[roomStats.firstMonthIdx]} a {MESI_NOMI[roomStats.curMonth]}
                </p>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
