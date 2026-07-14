'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Booking, Expense } from '@/lib/types'
import { getUpcomingRoomChanges } from '@/lib/roomChanges'

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }
function roomPreposition(room: string) { return /^[aeiouAEIOU]/.test(room) ? 'ad' : 'a' }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
function monthEnd() { const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0); return last.toISOString().split('T')[0] }
function yearStart() { return `${new Date().getFullYear()}-01-01` }
function italianDate() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const td = today()
      const tmr = tomorrow()
      const ms = monthStart()
      const me = monthEnd()
      const ys = yearStart()

      const [{ data: bookings }, { data: expenses }] = await Promise.all([
        supabase.from('bookings').select('*, rooms(name), guests(full_name, phone)'),
        supabase.from('expenses').select('*'),
      ])

      const b: any[] = bookings || []
      const e: any[] = expenses || []

      const active = b.filter((x: any) => x.status !== 'annullata')
      const checkInOggi = active.filter((x: any) => x.check_in === td)
      const checkOutOggi = active.filter((x: any) => x.check_out === td)
      const camereOccupate = active.filter((x: any) => x.check_in <= td && x.check_out > td).length

      const roomNameById: Record<string, string> = {}
      active.forEach((x: any) => { if (x.rooms?.name) roomNameById[x.room_id] = x.rooms.name.split(' ').slice(-1)[0] })
      const roomChanges = getUpcomingRoomChanges(active, roomNameById, [td, tmr])

      const bMese = active.filter((x: any) => x.check_in >= ms && x.check_in <= me)
      const entrateMese = bMese.reduce((s: number, x: any) => s + Number(x.total_amount), 0)
      const speseAnno = e.filter((x: any) => x.expense_date >= ys).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const speseMese = e.filter((x: any) => x.expense_date >= ms && x.expense_date <= me).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const profittoMese = entrateMese - speseMese

      const completate = active.filter((x: any) => x.price_per_night > 0)
      const tariffaMedia = completate.length > 0 ? completate.reduce((s: number, x: any) => s + Number(x.price_per_night), 0) / completate.length : 0

      setData({ entrateMese, speseAnno, profittoMese, tariffaMedia, checkInOggi, checkOutOggi, camereOccupate, roomChanges, td })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Casa Ania Rozzano</h1>
          <p className="text-sm text-gray-500 capitalize">{italianDate()}</p>
        </div>
        <Link href="/nuova" className="bg-blue-600 text-white rounded-full px-4 py-2 text-sm font-semibold shadow">+ Prenota</Link>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <>
          {(data.checkInOggi.length > 0 || data.checkOutOggi.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="font-semibold text-amber-800 text-sm mb-2">📋 Oggi</p>
              {data.checkInOggi.map((b: any) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm py-1">
                  <span className="bg-green-100 text-green-700 rounded px-1.5 py-0.5 text-xs font-bold">CHECK-IN</span>
                  <span className="font-medium">{b.guests?.full_name || b.guests?.phone}</span>
                  <span className="text-gray-500">— {b.rooms?.name}</span>
                  {b.check_in_time && <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 text-xs font-bold">🕐 {b.check_in_time}</span>}
                  {b.extra_bed && <span className="bg-orange-100 text-orange-700 rounded px-1 text-xs">+letto agg.</span>}
                </div>
              ))}
              {data.checkOutOggi.map((b: any) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm py-1">
                  <span className="bg-red-100 text-red-700 rounded px-1.5 py-0.5 text-xs font-bold">CHECK-OUT</span>
                  <span className="font-medium">{b.guests?.full_name || b.guests?.phone}</span>
                  <span className="text-gray-500">— {b.rooms?.name}</span>
                </div>
              ))}
            </div>
          )}

          {data.roomChanges.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
              <p className="font-semibold text-indigo-800 text-sm mb-2">⇄ Cambi camera</p>
              {data.roomChanges.map((m: any) => (
                <p key={m.id} className="text-sm py-0.5">
                  <span className="font-medium">{m.guest}</span>
                  <span className="text-gray-500"> da {m.fromRoom} {roomPreposition(m.toRoom)} {m.toRoom}</span>
                  <span className="text-indigo-500"> ({m.date === data.td ? 'oggi' : 'domani'})</span>
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Entrate mese</p>
              <p className="text-2xl font-bold text-blue-600">€{fmt(data.entrateMese)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Profitto mese</p>
              <p className={`text-2xl font-bold ${data.profittoMese >= 0 ? 'text-green-600' : 'text-red-600'}`}>€{fmt(data.profittoMese)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Tariffa media</p>
              <p className="text-2xl font-bold">€{fmt(data.tariffaMedia)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Camere occupate</p>
              <p className="text-2xl font-bold">{data.camereOccupate}<span className="text-base text-gray-400">/4</span></p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
            <p className="text-xs text-gray-500 mb-1">Spese anno</p>
            <p className="text-xl font-bold text-red-500">€{fmt(data.speseAnno)}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Link href="/prenotazioni" className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <div className="text-2xl">📅</div>
              <div className="text-xs font-semibold text-blue-700 mt-1">Prenotazioni</div>
            </Link>
            <Link href="/statistiche" className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
              <div className="text-2xl">📊</div>
              <div className="text-xs font-semibold text-green-700 mt-1">Statistiche</div>
            </Link>
            <Link href="/spese" className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
              <div className="text-2xl">💶</div>
              <div className="text-xs font-semibold text-orange-700 mt-1">Spese</div>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
