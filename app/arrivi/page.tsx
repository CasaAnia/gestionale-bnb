'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const CELL_W_MOBILE = 36
const CELL_W_DESKTOP = 52
const ROW_H_MOBILE = 44
const ROW_H_DESKTOP = 60
const HEADER_MONTH_H = 24
const HEADER_DAY_H = 50
const NAME_W_MOBILE = 72
const NAME_W_DESKTOP = 120
const DAYS_TOTAL = 90
const DAYS_BEFORE = 7
const HEADER_BG = '#2e7d32'

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function strToDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function Arrivi() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)
  const [popup, setPopup] = useState<{ id: string; name: string; time: string } | null>(null)
  const [savingTime, setSavingTime] = useState(false)
  const popupTimeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const CELL_W = isDesktop ? CELL_W_DESKTOP : CELL_W_MOBILE
  const ROW_H = isDesktop ? ROW_H_DESKTOP : ROW_H_MOBILE
  const HEADER_H = HEADER_MONTH_H + HEADER_DAY_H
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
      supabase.from('bookings')
        .select('*, guests(full_name, phone)')
        .eq('status', 'confermata'),
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
    if (scrollRef.current) scrollRef.current.scrollLeft = DAYS_BEFORE * CELL_W - 80
  }

  async function saveTime() {
    if (!popup) return
    setSavingTime(true)
    const time = popupTimeRef.current?.value ?? popup.time
    await supabase.from('bookings').update({ check_in_time: time || null }).eq('id', popup.id)
    setBookings(bookings.map(b => b.id === popup.id ? { ...b, check_in_time: time || null } : b))
    setSavingTime(false)
    setPopup(null)
  }

  function dayIndex(dateStr: string) {
    const d = strToDate(dateStr)
    return Math.round((d.getTime() - startDate.getTime()) / 86400000)
  }

  function bookingsForRoom(roomId: string) {
    return bookings.filter(b =>
      b.room_id === roomId &&
      b.check_out > toStr(startDate) &&
      b.check_in < toStr(endDate)
    )
  }

  const totalW = NAME_W + DAYS_TOTAL * CELL_W
  const totalH = HEADER_H + rooms.length * ROW_H

  // Mesi per header
  const monthGroups: { label: string; startIdx: number; count: number }[] = []
  days.forEach((d, i) => {
    const label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.label === label) last.count++
    else monthGroups.push({ label, startIdx: i, count: 1 })
  })

  return (
    <div className="flex flex-col h-screen pb-16 lg:pb-0">

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div ref={scrollRef} className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: totalW, position: 'relative', height: totalH }}>

            {/* ── HEADER MESI ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', height: HEADER_MONTH_H, background: HEADER_BG }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button onClick={scrollToToday} style={{ fontSize: 10, fontWeight: 700, color: HEADER_BG, background: 'white', border: 'none', borderRadius: 10, padding: '1px 7px', cursor: 'pointer' }}>Oggi</button>
              </div>
              {monthGroups.map((mg, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: NAME_W + mg.startIdx * CELL_W,
                  width: mg.count * CELL_W,
                  height: HEADER_MONTH_H,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  textTransform: 'capitalize',
                }}>
                  {mg.label}
                </div>
              ))}
            </div>

            {/* ── HEADER GIORNI ── */}
            <div style={{ position: 'sticky', top: HEADER_MONTH_H, zIndex: 30, display: 'flex', height: HEADER_DAY_H, background: HEADER_BG, borderBottom: '2px solid rgba(255,255,255,0.15)' }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, borderRight: '1px solid rgba(255,255,255,0.15)' }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                return (
                  <div key={i} style={{
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center', paddingTop: 4,
                    background: isToday ? 'rgba(255,255,255,0.2)' : 'transparent',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    <div style={{ fontSize: isDesktop ? 10 : 8, color: isSun ? '#fca5a5' : 'rgba(255,255,255,0.65)', marginBottom: 2 }}>
                      {d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, isDesktop ? 3 : 2)}
                    </div>
                    <div style={{
                      fontSize: isDesktop ? 15 : 12, fontWeight: 700,
                      color: isToday ? HEADER_BG : (isSun ? '#fca5a5' : 'white'),
                      background: isToday ? 'white' : 'transparent',
                      borderRadius: '50%',
                      width: isDesktop ? 26 : 20, height: isDesktop ? 26 : 20,
                      lineHeight: isDesktop ? '26px' : '20px',
                      margin: '0 auto',
                    }}>
                      {d.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── RIGHE CAMERE ── */}
            {rooms.map((room, ri) => {
              const rowTop = HEADER_H + ri * ROW_H
              const isEven = ri % 2 === 0
              return (
                <div key={room.id}>
                  <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalW, height: ROW_H, display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                    {/* Nome camera */}
                    <div style={{
                      width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10,
                      background: 'white', borderRight: '2px solid #e5e7eb',
                      display: 'flex', alignItems: 'center', padding: '0 8px',
                    }}>
                      <span style={{ fontSize: isDesktop ? 13 : 11, fontWeight: 700, color: '#1a5c2a' }}>
                        {isDesktop ? room.name : room.name.split(' ').slice(-1)[0]}
                      </span>
                    </div>
                    {/* Celle giorni */}
                    {days.map((d, i) => {
                      const isToday = toStr(d) === todayStr
                      const isSun = d.getDay() === 0
                      const dateStr = toStr(d)
                      return (
                        <div key={i}
                          style={{
                            width: CELL_W, minWidth: CELL_W, height: '100%',
                            background: isToday ? '#f0fdf4' : isSun ? '#fafafa' : (isEven ? 'white' : '#fafafa'),
                            borderLeft: isToday ? '2px solid #bbf7d0' : '1px solid #f3f4f6',
                          }} />
                      )
                    })}
                  </div>

                  {/* Barre prenotazioni — mostra solo il check-in day con l'orario */}
                  {bookingsForRoom(room.id).map((booking: any) => {
                    const startIdx = dayIndex(booking.check_in)
                    const endIdx = Math.min(DAYS_TOTAL, dayIndex(booking.check_out))
                    if (startIdx < 0 || startIdx >= DAYS_TOTAL || endIdx <= startIdx) return null

                    const barWidth = (endIdx - startIdx) * CELL_W - 4
                    const time = booking.check_in_time || ''

                    return (
                      <div key={booking.id}
                        onClick={() => setPopup({ id: booking.id, name: booking.guests?.full_name || booking.guests?.phone || '', time: booking.check_in_time || '' })}
                        style={{
                          position: 'absolute',
                          top: rowTop + 6,
                          left: NAME_W + startIdx * CELL_W + 2,
                          width: barWidth,
                          height: ROW_H - 12,
                          background: '#1a7a32',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          overflow: 'hidden',
                          zIndex: 5,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          paddingLeft: 8,
                          gap: 6,
                        }}>
                        {/* Orario */}
                        <span style={{
                          color: 'white',
                          fontSize: isDesktop ? 13 : 11,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          background: time ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
                          borderRadius: 4,
                          padding: '1px 5px',
                        }}>
                          {time || '?'}
                        </span>
                        {/* Nome */}
                        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: isDesktop ? 12 : 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {booking.guests?.full_name || booking.guests?.phone || ''}
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

      {/* Popup orario */}
      {popup && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setPopup(null)}>
          <div className="bg-white rounded-t-2xl p-5 w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-lg mb-1">{popup.name}</p>
            <p className="text-sm text-gray-500 mb-4">Orario di arrivo</p>
            <input
              ref={popupTimeRef}
              type="time"
              defaultValue={popup.time}
              onChange={e => setPopup({ ...popup, time: e.target.value })}
              onInput={e => setPopup({ ...popup, time: (e.target as HTMLInputElement).value })}
              className="w-full border border-gray-200 rounded-xl p-3 text-2xl font-bold text-center mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => router.push(`/prenotazioni/${popup.id}`)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 font-semibold text-sm">
                Apri prenotazione
              </button>
              <button onClick={saveTime} disabled={savingTime} className="flex-1 bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
                {savingTime ? 'Salvo...' : 'Salva orario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="shrink-0 px-4 py-2 bg-white border-t border-gray-100 flex gap-4 items-center">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#15803d' }} />
          <span className="text-xs text-gray-500">Orario arrivo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(0,0,0,0.15)', border: '1px solid #ccc' }} />
          <span className="text-xs text-gray-500">Orario non inserito</span>
        </div>
      </div>
    </div>
  )
}
