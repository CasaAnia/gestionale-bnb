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

      const [{ data: bookings }, { data: expenses }, { data: payments }] = await Promise.all([
        supabase.from('bookings').select('*, rooms(name), guests(full_name, phone)'),
        supabase.from('expenses').select('*'),
        supabase.from('payments').select('booking_id, amount'),
      ])

      const b: any[] = bookings || []
      const e: any[] = expenses || []

      const active = b.filter((x: any) => x.status !== 'annullata')
      const checkInOggi = active.filter((x: any) => x.check_in === td)
      const checkOutOggi = active.filter((x: any) => x.check_out === td)
      const camereOccupate = active.filter((x: any) => x.check_in <= td && x.check_out > td).length

      // Percentuale di occupazione del mese corrente: notti-camera occupate su notti-camera
      // disponibili (4 camere × giorni del mese). Ogni soggiorno conta solo le notti che
      // cadono dentro il mese.
      const now = new Date()
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const nextMonthStart = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}-01`
      const nightsInMonth = (ci: string, co: string) => {
        const s = ci > ms ? ci : ms
        const e = co < nextMonthStart ? co : nextMonthStart
        if (e <= s) return 0
        return Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)
      }
      const notteCamereMese = active.reduce((sum: number, x: any) => sum + nightsInMonth(x.check_in, x.check_out), 0)
      const occupazioneMese = daysInMonth > 0 ? Math.round((notteCamereMese / (4 * daysInMonth)) * 100) : 0

      const roomNameById: Record<string, string> = {}
      active.forEach((x: any) => { if (x.rooms?.name) roomNameById[x.room_id] = x.rooms.name.split(' ').slice(-1)[0] })
      const roomChanges = getUpcomingRoomChanges(active, roomNameById, [td, tmr])

      const bMese = active.filter((x: any) => x.check_in >= ms && x.check_in <= me)
      const entrateMese = bMese.reduce((s: number, x: any) => s + Number(x.total_amount), 0)

      // Già incassato / da incassare del mese. Da noi si paga tutto all'arrivo, quindi
      // una prenotazione iniziata conta come incassata per intero — tranne quando ci
      // sono acconti registrati (vale quello che è stato segnato ricevuto) o un
      // bonifico ancora in attesa. I segmenti di un cambio camera (stesso group_id)
      // sono un unico soggiorno: gli acconti possono stare su un segmento qualsiasi.
      const accontiPerBooking: Record<string, number> = {}
      for (const p of payments || []) accontiPerBooking[p.booking_id] = (accontiPerBooking[p.booking_id] || 0) + Number(p.amount)
      const accontiPerGruppo: Record<string, number> = {}
      for (const x of active) {
        const key = x.group_id || x.id
        accontiPerGruppo[key] = (accontiPerGruppo[key] || 0) + (accontiPerBooking[x.id] || 0)
      }
      const gruppiMese: Record<string, any[]> = {}
      for (const x of bMese) {
        const key = x.group_id || x.id
        ;(gruppiMese[key] = gruppiMese[key] || []).push(x)
      }
      let incassatoMese = 0
      for (const [key, segs] of Object.entries(gruppiMese)) {
        const dovuto = segs.reduce((s: number, x: any) => s + Number(x.total_amount), 0)
        const ricevuto = accontiPerGruppo[key] || 0
        if (ricevuto > 0) incassatoMese += Math.min(ricevuto, dovuto)
        else incassatoMese += segs.reduce((s: number, x: any) => {
          if (x.pagato) return s + Number(x.total_amount)
          if (x.bonifico) return s // bonifico in attesa: non ancora incassato
          return x.check_in <= td ? s + Number(x.total_amount) : s
        }, 0)
      }
      const daIncassareMese = Math.max(0, entrateMese - incassatoMese)
      const speseAnno = e.filter((x: any) => x.expense_date >= ys).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const speseMese = e.filter((x: any) => x.expense_date >= ms && x.expense_date <= me).reduce((s: number, x: any) => s + Number(x.amount), 0)
      const profittoMese = entrateMese - speseMese

      const completate = active.filter((x: any) => x.price_per_night > 0)
      const tariffaMedia = completate.length > 0 ? completate.reduce((s: number, x: any) => s + Number(x.price_per_night), 0) / completate.length : 0

      // Da incassare: soggiorni con acconti registrati ma non ancora saldati.
      // I segmenti di un cambio camera (stesso group_id) contano come un unico soggiorno.
      const accontiSum: Record<string, number> = {}
      for (const p of payments || []) accontiSum[p.booking_id] = (accontiSum[p.booking_id] || 0) + Number(p.amount)
      const gruppi: Record<string, { id: string; guest: string; dovuto: number; ricevuto: number }> = {}
      for (const b of active) {
        const key = b.group_id || b.id
        if (!gruppi[key]) gruppi[key] = { id: b.id, guest: b.guests?.full_name || b.guests?.phone || 'Ospite', dovuto: 0, ricevuto: 0 }
        gruppi[key].dovuto += Number(b.total_amount)
        gruppi[key].ricevuto += accontiSum[b.id] || 0
      }
      const daIncassare = Object.values(gruppi)
        .filter(g => g.ricevuto > 0 && g.dovuto - g.ricevuto > 0.5)
        .map(g => ({ ...g, residuo: g.dovuto - g.ricevuto }))
        .sort((a, b) => b.residuo - a.residuo)

      setData({ entrateMese, incassatoMese, daIncassareMese, speseMese, profittoMese, tariffaMedia, checkInOggi, checkOutOggi, camereOccupate, occupazioneMese, roomChanges, td, daIncassare })
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
              <p className="text-[11px] uppercase mb-2.5 text-brass" style={{ letterSpacing: '2px' }}>Oggi</p>
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

          {data.daIncassare?.length > 0 && (
            <div className="bg-white rounded-[10px] border border-card-border p-3 mb-4">
              <p className="text-[11px] uppercase mb-1.5 text-brass" style={{ letterSpacing: '2px' }}>💶 Da incassare</p>
              {data.daIncassare.map((g: any) => (
                <Link key={g.id} href={`/prenotazioni/${g.id}`} className="flex items-center justify-between py-1.5 border-t border-card-border text-sm">
                  <span className="font-medium text-green-dark">{g.guest}</span>
                  <span className="font-bold" style={{ color: '#8a4f2f' }}>€{g.residuo.toFixed(0)}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="bg-white rounded-[10px] p-5 border border-card-border mb-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass">Entrate mese</p>
              <p className="text-xs text-gray-500">totale €{fmt(data.entrateMese)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Già incassato</p>
                <p className="font-serif text-2xl text-green-dark">€{fmt(data.incassatoMese)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Da incassare</p>
                <p className="font-serif text-2xl" style={{ color: data.daIncassareMese > 0 ? '#8a4f2f' : 'var(--color-green-dark)' }}>€{fmt(data.daIncassareMese)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-[10px] p-5 border border-card-border">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Profitto mese</p>
              <p className={`font-serif text-2xl ${data.profittoMese >= 0 ? 'text-green-dark' : 'text-[#8C3B2E]'}`}>€{fmt(data.profittoMese)}</p>
            </div>
            <div className="bg-white rounded-[10px] p-5 border border-card-border">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Spese mese</p>
              <p className="font-serif text-2xl text-[#8C3B2E]">€{fmt(data.speseMese)}</p>
            </div>
            <div className="bg-white rounded-[10px] p-5 border border-card-border">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Camere occupate</p>
              <p className="font-serif text-2xl text-green-dark">{data.occupazioneMese}<span className="text-base text-gray-400">% mese</span></p>
            </div>
            <div className="bg-white rounded-[10px] p-5 border border-card-border">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Tariffa media</p>
              <p className="font-serif text-2xl text-green-dark">€{fmt(data.tariffaMedia)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
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
            <Link href="/impostazioni" className="bg-white rounded-[10px] p-3 text-center border border-card-border">
              <div className="text-2xl">🔔</div>
              <div className="text-xs font-semibold text-green-dark mt-1">Impostazioni e notifiche</div>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
