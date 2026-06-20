'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const COLORS = [
  { bg: '#3b82f6', label: 'bg-blue-100 text-blue-900' },
  { bg: '#22c55e', label: 'bg-green-100 text-green-900' },
  { bg: '#a855f7', label: 'bg-purple-100 text-purple-900' },
  { bg: '#f97316', label: 'bg-orange-100 text-orange-900' },
]

const CELL_W_MOBILE = 36
const CELL_W_DESKTOP = 52
const ROW_H_MOBILE = 44
const ROW_H_DESKTOP = 60
const HEADER_H_MOBILE = 52
const HEADER_H_DESKTOP = 64
const NAME_W_MOBILE = 64
const NAME_W_DESKTOP = 120
const DAYS_TOTAL = 180
const DAYS_BEFORE = 30

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function strToDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function Calendario() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const CELL_W = isDesktop ? CELL_W_DESKTOP : CELL_W_MOBILE
  const ROW_H = isDesktop ? ROW_H_DESKTOP : ROW_H_MOBILE
  const HEADER_H = isDesktop ? HEADER_H_DESKTOP : HEADER_H_MOBILE
  const NAME_W = isDesktop ? NAME_W_DESKTOP : NAME_W_MOBILE

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -DAYS_BEFORE)
  const endDate = addDays(startDate, DAYS_TOTAL)

  const days: Date[] = Array.from({ length: DAYS_TOTAL }, (_, i) => addDays(startDate, i))
  const todayStr = toStr(today)

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(full_name, phone)').neq('status', 'annullata'),
    ]).then(([{ data: r }, { data: b }]) => {
      const sorted = (r || []).sort((a: any, b: any) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      setBookings(b || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = DAYS_BEFORE * CELL_W - 80
    }
  }, [loading, CELL_W])

  function scrollToToday() {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = DAYS_BEFORE * CELL_W - 80
    }
  }

  function dayIndex(dateStr: string) {
    const d = strToDate(dateStr)
    return Math.round((d.getTime() - startDate.getTime()) / 86400000)
  }

  function bookingsForRoom(roomId: string) {
    const endStr = toStr(endDate)
    return bookings.filter(b =>
      b.room_id === roomId &&
      b.check_out > toStr(startDate) &&
      b.check_in < endStr
    )
  }

  const totalW = NAME_W + DAYS_TOTAL * CELL_W
  const totalH = HEADER_H + rooms.length * ROW_H

  return (
    <div className="flex flex-col h-screen pb-16 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <h1 className="text-base font-bold">Calendario</h1>
        <button onClick={scrollToToday} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-semibold">
          Oggi
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div ref={scrollRef} className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: totalW, position: 'relative', height: totalH }}>

            {/* ── HEADER MESI ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', height: 26, background: 'white', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, background: 'white', position: 'sticky', left: 0, zIndex: 31 }} />
              {days.map((d, i) => (
                d.getDate() === 1 ? (
                  <div key={i} style={{ position: 'absolute', left: NAME_W + i * CELL_W, fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f9fafb', padding: '3px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                    {d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                  </div>
                ) : null
              ))}
            </div>

            {/* ── HEADER GIORNI ── */}
            <div style={{ position: 'sticky', top: 26, zIndex: 30, display: 'flex', height: 26, background: 'white', borderBottom: '2px solid #e5e7eb' }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, background: 'white', position: 'sticky', left: 0, zIndex: 31, borderRight: '1px solid #e5e7eb' }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                const isSat = d.getDay() === 6
                return (
                  <div key={i} style={{
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center', paddingTop: 2,
                    background: isToday ? '#eff6ff' : (isSun || isSat ? '#f9fafb' : 'white'),
                    borderLeft: isToday ? '2px solid #3b82f6' : '1px solid #f3f4f6',
                  }}>
                    <div style={{ fontSize: isDesktop ? 11 : 9, color: isToday ? '#2563eb' : (isSun ? '#ef4444' : '#9ca3af') }}>
                      {d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, isDesktop ? 3 : 1)}
                    </div>
                    <div style={{ fontSize: isDesktop ? 14 : 11, fontWeight: 700, color: isToday ? 'white' : (isSun ? '#ef4444' : '#374151'), background: isToday ? '#2563eb' : 'transparent', borderRadius: '50%', width: isDesktop ? 26 : 20, height: isDesktop ? 26 : 20, lineHeight: isDesktop ? '26px' : '20px', margin: '0 auto' }}>
                      {d.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── GRIGLIA + NOMI CAMERE + BARRE ── */}
            {rooms.map((room, ri) => {
              const color = COLORS[ri % COLORS.length]
              const rowTop = HEADER_H + ri * ROW_H

              return (
                <div key={room.id}>
                  {/* Sfondo riga con celle */}
                  <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalW, height: ROW_H, display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
                    {/* Nome camera (sticky) */}
                    <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                      <div style={{ fontSize: isDesktop ? 13 : 10, fontWeight: 700, padding: '3px 4px', borderRadius: 4, textAlign: 'center', width: '100%', background: color.label.includes('blue') ? '#dbeafe' : color.label.includes('green') ? '#dcfce7' : color.label.includes('purple') ? '#f3e8ff' : '#ffedd5', color: color.label.includes('blue') ? '#1e3a5f' : color.label.includes('green') ? '#14532d' : color.label.includes('purple') ? '#581c87' : '#7c2d12' }}>
                        {isDesktop ? room.name : room.name.split(' ').slice(-1)[0]}
                      </div>
                    </div>
                    {/* Celle giorni */}
                    {days.map((d, i) => {
                      const isToday = toStr(d) === todayStr
                      const isSun = d.getDay() === 0
                      const isSat = d.getDay() === 6
                      return (
                        <div key={i} style={{ width: CELL_W, minWidth: CELL_W, height: '100%', background: isToday ? '#eff6ff' : (isSun || isSat ? '#f9fafb' : 'white'), borderLeft: isToday ? '2px solid #bfdbfe' : '1px solid #f3f4f6' }} />
                      )
                    })}
                  </div>

                  {/* Barre prenotazioni */}
                  {bookingsForRoom(room.id).map((booking: any) => {
                    const startIdx = Math.max(0, dayIndex(booking.check_in))
                    const endIdx = Math.min(DAYS_TOTAL, dayIndex(booking.check_out))
                    const barWidth = (endIdx - startIdx) * CELL_W
                    if (barWidth <= 0) return null
                    const guestName = booking.guests?.full_name || booking.guests?.phone || ''

                    return (
                      <div key={booking.id}
                        onClick={() => router.push(`/prenotazioni/${booking.id}`)}
                        style={{
                          position: 'absolute',
                          top: rowTop + 6,
                          left: NAME_W + startIdx * CELL_W + 1,
                          width: barWidth - 2,
                          height: ROW_H - 12,
                          background: color.bg,
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          overflow: 'hidden',
                          zIndex: 5,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        }}>
                        <span style={{ color: 'white', fontSize: isDesktop ? 14 : 11, fontWeight: 600, paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {guestName}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="shrink-0 px-4 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-3">
        {rooms.map((room, ri) => (
          <div key={room.id} className="flex items-center gap-1.5">
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[ri % COLORS.length].bg }} />
            <span className="text-xs text-gray-500">{room.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
