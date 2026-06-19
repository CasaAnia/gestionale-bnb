'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const COLORS = [
  { bg: 'bg-blue-500', label: 'bg-blue-100 text-blue-900' },
  { bg: 'bg-green-500', label: 'bg-green-100 text-green-900' },
  { bg: 'bg-purple-500', label: 'bg-purple-100 text-purple-900' },
  { bg: 'bg-orange-500', label: 'bg-orange-100 text-orange-900' },
]

const CELL_W = 36 // px per giorno
const DAYS_TOTAL = 180 // giorni totali mostrati
const DAYS_BEFORE = 30 // giorni prima di oggi

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function Calendario() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -DAYS_BEFORE)

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

  // Scroll a oggi all'avvio
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = DAYS_BEFORE * CELL_W - 80
    }
  }, [loading])

  function bookingForCell(roomId: string, d: Date) {
    const ds = toStr(d)
    return bookings.find(b => b.room_id === roomId && b.check_in <= ds && b.check_out > ds) || null
  }

  function guestName(b: any) {
    const n = b.guests?.full_name || b.guests?.phone || ''
    return n.length > 9 ? n.slice(0, 9) + '…' : n
  }

  function scrollToToday() {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = DAYS_BEFORE * CELL_W - 80
    }
  }

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
        <div ref={scrollRef} className="overflow-x-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: `${64 + DAYS_TOTAL * CELL_W}px` }}>
            {/* Riga mesi */}
            <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200">
              <div className="shrink-0 bg-white" style={{ width: 64 }} />
              {days.map((d, i) => {
                const isFirst = d.getDate() === 1
                const isToday = toStr(d) === todayStr
                return (
                  <div key={i} style={{ width: CELL_W, minWidth: CELL_W }}
                    className={`text-center border-l ${isToday ? 'border-blue-300' : 'border-transparent'}`}>
                    {isFirst && (
                      <div className="text-[10px] font-bold text-gray-500 bg-gray-50 px-1 py-0.5 capitalize truncate">
                        {d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Riga giorni */}
            <div className="flex sticky top-6 z-20 bg-white border-b border-gray-100">
              <div className="shrink-0 bg-white border-r border-gray-100" style={{ width: 64 }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                const isSat = d.getDay() === 6
                const wd = d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 1)
                return (
                  <div key={i} style={{ width: CELL_W, minWidth: CELL_W }}
                    className={`text-center py-1 ${isSun || isSat ? 'bg-gray-50' : ''} ${isToday ? 'bg-blue-50' : ''}`}>
                    <div className={`text-[9px] ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{wd}</div>
                    <div className={`text-xs font-bold mx-auto flex items-center justify-center rounded-full`}
                      style={{ width: 22, height: 22, background: isToday ? '#2563eb' : 'transparent', color: isToday ? 'white' : (isSun ? '#ef4444' : '#374151') }}>
                      {d.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Righe camere */}
            {rooms.map((room, ri) => {
              const color = COLORS[ri % COLORS.length]
              return (
                <div key={room.id} className="flex border-b border-gray-100">
                  {/* Nome camera */}
                  <div className="shrink-0 sticky left-0 z-10 bg-white border-r border-gray-100 flex items-center justify-center py-1 px-1"
                    style={{ width: 64 }}>
                    <div className={`text-[10px] font-bold px-1 py-1 rounded text-center w-full ${color.label}`}>
                      {room.name.split(' ').slice(-1)[0]}
                    </div>
                  </div>

                  {/* Celle giorni */}
                  {days.map((d, i) => {
                    const booking = bookingForCell(room.id, d)
                    const ds = toStr(d)
                    const isToday = ds === todayStr
                    const isSun = d.getDay() === 0
                    const isSat = d.getDay() === 6
                    const isFirst = booking && booking.check_in === ds
                    const isFirstVisible = booking && i === 0 && booking.check_in < ds

                    return (
                      <div key={i} onClick={() => booking && router.push(`/prenotazioni/${booking.id}`)}
                        style={{ width: CELL_W, minWidth: CELL_W, height: 40 }}
                        className={`relative ${booking ? 'cursor-pointer' : ''} ${isSun || isSat ? 'bg-gray-50/60' : ''} ${isToday && !booking ? 'bg-blue-50' : ''}`}>
                        {booking ? (
                          <div className={`absolute inset-y-1.5 ${(isFirst || isFirstVisible) ? 'left-1 rounded-l-full' : 'left-0'}
                            ${booking.check_out === toStr(addDays(d, 1)) ? 'right-1 rounded-r-full' : 'right-0'}
                            ${color.bg} flex items-center overflow-hidden`}>
                            {(isFirst || isFirstVisible) && (
                              <span className="text-white text-[10px] font-semibold pl-2 whitespace-nowrap">
                                {guestName(booking)}
                              </span>
                            )}
                          </div>
                        ) : null}
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
            <div className={`w-3 h-3 rounded-full ${COLORS[ri % COLORS.length].bg}`} />
            <span className="text-xs text-gray-500">{room.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
