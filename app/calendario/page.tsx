'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const COLORS = [
  { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-800', label: 'bg-blue-200 text-blue-900' },
  { bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-800', label: 'bg-green-200 text-green-900' },
  { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-800', label: 'bg-purple-200 text-purple-900' },
  { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-800', label: 'bg-orange-200 text-orange-900' },
]

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

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const monthName = new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const todayStr = today.toISOString().split('T')[0]

  function ds(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function bookingForCell(roomId: string, day: number) {
    const d = ds(day)
    return bookings.find(b => b.room_id === roomId && b.check_in <= d && b.check_out > d) || null
  }

  function guestShortName(b: any) {
    const n = b.guests?.full_name || b.guests?.phone || ''
    return n.length > 8 ? n.slice(0, 8) + '…' : n
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={prevMonth} className="text-2xl text-gray-400 w-10 h-10 flex items-center justify-center">‹</button>
        <h1 className="text-base font-bold capitalize">{monthName}</h1>
        <button onClick={nextMonth} className="text-2xl text-gray-400 w-10 h-10 flex items-center justify-center">›</button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div className="overflow-x-scroll">
          <table className="border-collapse" style={{ minWidth: `${60 + daysInMonth * 36}px` }}>
            <thead>
              <tr>
                <th className="w-16 sticky left-0 bg-white z-10 border-b border-gray-100" />
                {days.map(day => {
                  const d = ds(day)
                  const isToday = d === todayStr
                  const wd = new Date(year, month, day).toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 2)
                  const isSun = new Date(year, month, day).getDay() === 0
                  return (
                    <th key={day} className={`w-9 text-center pb-1 border-b border-gray-100 ${isSun ? 'bg-gray-50' : ''}`}>
                      <div className={`text-[9px] ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{wd}</div>
                      <div className={`text-xs font-bold mx-auto w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>{day}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, ri) => {
                const color = COLORS[ri % COLORS.length]
                return (
                  <tr key={room.id}>
                    {/* Nome camera */}
                    <td className={`sticky left-0 z-10 bg-white border-r border-gray-100 px-1 py-1`}>
                      <div className={`text-[10px] font-bold px-1 py-1 rounded text-center ${color.label}`}>
                        {room.name.split(' ').slice(-1)[0]}
                      </div>
                    </td>
                    {/* Celle giorni */}
                    {days.map(day => {
                      const booking = bookingForCell(room.id, day)
                      const d = ds(day)
                      const isToday = d === todayStr
                      const isSun = new Date(year, month, day).getDay() === 0
                      const isFirst = booking && booking.check_in === d
                      const prevDay = day > 1 ? ds(day - 1) : null
                      const isFirstOfMonth = booking && day === 1 && (!prevDay || booking.check_in > prevDay)

                      return (
                        <td key={day}
                          onClick={() => booking && router.push(`/prenotazioni/${booking.id}`)}
                          className={`h-10 p-0 border-b border-gray-50 ${isSun ? 'border-r border-gray-100' : ''} ${booking ? 'cursor-pointer' : ''}`}
                        >
                          {booking ? (
                            <div className={`h-full flex items-center ${color.bg} ${isFirst || isFirstOfMonth ? 'rounded-l-full ml-0.5' : ''} ${booking.check_out === ds(day + 1) ? 'rounded-r-full mr-0.5' : ''}`}>
                              {(isFirst || isFirstOfMonth) && (
                                <span className="text-white text-[10px] font-semibold pl-2 whitespace-nowrap overflow-hidden">
                                  {guestShortName(booking)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className={`h-full ${isToday ? 'bg-blue-50' : isSun ? 'bg-gray-50' : ''}`} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      <div className="p-4 flex flex-wrap gap-3">
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
