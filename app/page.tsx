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
          <h1 className="font-serif text-2xl text-green-dark">Buongiorno, Ania</h1>
          <p className="text-sm text-gray-500 capitalize">{italianDate()}</p>
        </div>
        <Link href="/nuova" className="bg-green-mid text-cream-text rounded-full px-4 py-2 text-sm font-semibold">+ Prenota</Link>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <>
          {(data.checkInOggi.length > 0 || data.checkOutOggi.length > 0 || data.roomChanges.length > 0) && (
            <div className="bg-white rounded-[10px] border border-card-border p-3 mb-4">
              <p className="font-semibold text-green-dark text-sm mb-2">📋 Oggi</p>
              {data.checkInOggi.map((b: any) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm py-1">
                  <span className="bg-sage text-green-dark rounded px-1.5 py-0.5 text-xs font-bold">CHECK-IN</span>
                  <span className="font-medium">{b.guests?.full_name || b.guests?.phone}</span>
                  <span className="text-gray-500">— {b.rooms?.name}</span>
                  {b.check_in_time && <span className="bg-sage text-green-mid rounded px-1.5 py-0.5 text-xs font-bold">🕐 {b.check_in_time}</span>}
                  {b.extra_bed && <span className="bg-[#F1E0CE] text-[#7A4B22] rounded px-1 text-xs">+letto agg.</span>}
                </div>
              ))}
              {data.checkOutOggi.map((b: any) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm py-1">
                  <span className="bg-[#F4E6DF] text-[#7A3B22] rounded px-1.5 py-0.5 text-xs font-bold">CHECK-OUT</span>
                  <span className="font-medium">{b.guests?.full_name || b.guests?.phone}</span>
                  <span className="text-gray-500">— {b.rooms?.name}</span>
                </div>
              ))}
              {data.roomChanges.length > 0 && (
                <div className="bg-sand rounded-lg px-2 py-1.5 mt-2">
                  <p className="text-xs font-semibold text-green-dark mb-0.5">⇄ Cambi camera</p>
                  {data.roomChanges.map((m: any) => (
                    <p key={m.id} className="text-xs py-0.5">
                      <span className="font-medium">{m.guest}</span>
                      <span className="text-gray-500"> da {m.fromRoom} {roomPreposition(m.toRoom)} {m.toRoom}</span>
                      <span className="text-green-mid"> ({m.date === data.td ? 'oggi' : 'domani'})</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white rounded-[10px] p-4 border border-card-border">
              <p className="text-xs text-gray-500 mb-1">Entrate mese</p>
              <p className="font-serif text-2xl text-green-dark">€{fmt(data.entrateMese)}</p>
            </div>
            <div className="bg-white rounded-[10px] p-4 border border-card-border">
              <p className="text-xs text-gray-500 mb-1">Profitto mese</p>
              <p className={`font-serif text-2xl ${data.profittoMese >= 0 ? 'text-green-dark' : 'text-[#8C3B2E]'}`}>€{fmt(data.profittoMese)}</p>
            </div>
            <div className="bg-white rounded-[10px] p-4 border border-card-border">
              <p className="text-xs text-gray-500 mb-1">Tariffa media</p>
              <p className="font-serif text-2xl text-green-dark">€{fmt(data.tariffaMedia)}</p>
            </div>
            <div className="bg-white rounded-[10px] p-4 border border-card-border">
              <p className="text-xs text-gray-500 mb-1">Camere occupate</p>
              <p className="font-serif text-2xl text-green-dark">{data.camereOccupate}<span className="text-base text-gray-400">/4</span></p>
            </div>
          </div>

          <div className="bg-white rounded-[10px] p-4 border border-card-border mb-4">
            <p className="text-xs text-gray-500 mb-1">Spese anno</p>
            <p className="font-serif text-xl text-[#8C3B2E]">€{fmt(data.speseAnno)}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Link href="/prenotazioni" className="bg-sage rounded-[10px] p-3 text-center border border-card-border">
              <div className="text-2xl">📅</div>
              <div className="text-xs font-semibold text-green-dark mt-1">Prenotazioni</div>
            </Link>
            <Link href="/statistiche" className="bg-sand rounded-[10px] p-3 text-center border border-card-border">
              <div className="text-2xl">📊</div>
              <div className="text-xs font-semibold text-green-dark mt-1">Statistiche</div>
            </Link>
            <Link href="/spese" className="bg-[#F4E6DF] rounded-[10px] p-3 text-center border border-card-border">
              <div className="text-2xl">💶</div>
              <div className="text-xs font-semibold text-[#7A3B22] mt-1">Spese</div>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
