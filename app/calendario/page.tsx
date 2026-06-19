'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const ROOM_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500']
const ROOM_COLORS_LIGHT = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function Calendario() {
  const router = useRouter()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(full_name, phone, rating)').neq('status', 'annullata'),
    ]).then(([{ data: r }, { data: b }]) => {
      const sorted = (r || []).sort((a, b) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      setBookings(b || [])
      setLoading(false)
    })
  }, [])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const monthName = new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const todayStr = today.toISOString().split('T')[0]

  function getBookingForRoomDay(roomId: string, day: number) {
    const d = dateStr(year, month, day)
    return bookings.find(b => b.room_id === roomId && b.check_in <= d && b.check_out > d)
  }

  function isFirstDay(booking: any, day: number) {
    return booking.check_in === dateStr(year, month, day)
  }

  function isLastDay(booking: any, day: number) {
    const checkOutDate = new Date(booking.check_out)
    const dayDate = new Date(dateStr(year, month, day))
    const nextDay = new Date(dayDate)
    nextDay.setDate(nextDay.getDate() + 1)
    return checkOutDate <= nextDay && checkOutDate > dayDate
  }

  function getGuestName(booking: any) {
    const name = booking.guests?.full_name || booking.guests?.phone || ''
    return name.length > 10 ? name.substring(0, 10) + '…' : name
  }

  const roomColorMap: Record<string, number> = {}
  rooms.forEach((r, i) => { roomColorMap[r.id] = i })

  return (
    <div className="p-3 pb-24">
      {/* Header mese */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-2xl text-gray-500 px-2">‹</button>
        <h1 className="text-lg font-bold capitalize">{monthName}</h1>
        <button onClick={nextMonth} className="text-2xl text-gray-500 px-2">›</button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div className="overflow-x-auto -mx-3">
          <div className="min-w-max px-3">
            {/* Header giorni */}
            <div className="flex mb-1">
              <div className="w-20 shrink-0" />
              {days.map(day => {
                const d = dateStr(year, month, day)
                const isToday = d === todayStr
                const dayOfWeek = new Date(year, month, day).toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 2)
                return (
                  <div key={day} className={`w-10 shrink-0 text-center`}>
                    <div className={`text-[10px] ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>{dayOfWeek}</div>
                    <div className={`text-xs font-semibold w-7 h-7 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>{day}</div>
                  </div>
                )
              })}
            </div>

            {/* Righe camere */}
            {rooms.map((room, ri) => (
              <div key={room.id} className="flex items-center mb-1">
                {/* Nome camera */}
                <div className="w-20 shrink-0 pr-2">
                  <div className={`text-[11px] font-bold px-1.5 py-1 rounded-lg text-center ${ROOM_COLORS_LIGHT[ri]}`}>
                    {room.name.split(' ').slice(-1)[0]}
                  </div>
                </div>

                {/* Celle giorni */}
                {days.map(day => {
                  const booking = getBookingForRoomDay(room.id, day)
                  const d = dateStr(year, month, day)
                  const isToday = d === todayStr
                  const colorIdx = booking ? roomColorMap[booking.room_id] ?? ri : ri
                  const isFirst = booking && isFirstDay(booking, day)
                  const isLast = booking && isLastDay(booking, day)

                  return (
                    <div key={day}
                      onClick={() => booking && router.push(`/prenotazioni/${booking.id}`)}
                      className={`w-10 h-9 shrink-0 relative flex items-center ${booking ? 'cursor-pointer' : ''}`}
                    >
                      {booking ? (
                        <div className={`absolute inset-y-1 ${isFirst ? 'left-1 rounded-l-full' : 'left-0'} ${isLast ? 'right-1 rounded-r-full' : 'right-0'} ${ROOM_COLORS[colorIdx]} opacity-90 flex items-center overflow-hidden`}>
                          {isFirst && (
                            <span className="text-white text-[10px] font-semibold px-1.5 whitespace-nowrap leading-tight">
                              {getGuestName(booking)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className={`absolute inset-1 rounded border ${isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap gap-2">
        {rooms.map((room, ri) => (
          <div key={room.id} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${ROOM_COLORS[ri]}`} />
            <span className="text-xs text-gray-500">{room.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
