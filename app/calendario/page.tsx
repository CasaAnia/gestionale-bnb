'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

const CELL_W_MOBILE = 56
const CELL_W_DESKTOP = 84
const ROW_H_MOBILE = 64
const ROW_H_DESKTOP = 84
const HEADER_MONTH_H = 24
const HEADER_DAY_H = 50
const NAME_W_MOBILE = 110
const NAME_W_DESKTOP = 180
const DAYS_TOTAL = 365
const DAYS_BEFORE = 180
const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const EXTRA_BED_MAX = 2

const GREEN = '#1fa84e'
const PURPLE = '#7c3aed'
const CYAN = '#0891b2'
const RED = '#dc2626'
const BLACK = '#1f2937'
const HEADER_BG = '#ffffff'
const GROUP_COLORS = ['#b45309', '#4338ca', '#be123c', '#065f46']

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

export default function Calendario() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)

  // Assegna un colore fisso a ogni gruppo di prenotazioni con cambio camera (max 4 colori, poi si ripetono)
  const groupColorMap = useMemo(() => {
    const ids: string[] = []
    for (const b of bookings) {
      if (b.group_id && bookings.some((x: any) => x.id !== b.id && x.group_id === b.group_id)) {
        if (!ids.includes(b.group_id)) ids.push(b.group_id)
      }
    }
    const map: Record<string, string> = {}
    ids.forEach((gid, i) => { map[gid] = GROUP_COLORS[i % GROUP_COLORS.length] })
    return map
  }, [bookings])

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
  const EXTRA_ROW_H = isDesktop ? 28 : 22

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -DAYS_BEFORE)
  const endDate = addDays(startDate, DAYS_TOTAL)
  const days: Date[] = Array.from({ length: DAYS_TOTAL }, (_, i) => addDays(startDate, i))
  const todayStr = toStr(today)

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(id, full_name, phone, rating)').neq('status', 'annullata'),
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

  function getExtraBedDays(booking: any): Set<string> {
    if (booking.extra_bed_dates && booking.extra_bed_dates.length > 0) return new Set(booking.extra_bed_dates)
    if (booking.extra_bed) {
      const s = new Set<string>()
      const d = strToDate(booking.check_in)
      const end = strToDate(booking.check_out)
      while (d < end) { s.add(toStr(d)); d.setDate(d.getDate() + 1) }
      return s
    }
    return new Set()
  }

  const extraBedsMap = new Map<string, number>()
  for (const b of bookings) {
    const extraDays = getExtraBedDays(b)
    const contrib = b.room_id === LENA_ID && b.num_guests >= 4 ? 2 : 1
    for (const day of extraDays) extraBedsMap.set(day, (extraBedsMap.get(day) || 0) + contrib)
  }

  function getDayColor(booking: any, dateStr: string): string {
    const extraDays = getExtraBedDays(booking)
    const contrib = booking.room_id === LENA_ID && booking.num_guests >= 4 ? 2 : 1
    const hasExtra = extraDays.has(dateStr)
    const others = (extraBedsMap.get(dateStr) || 0) - contrib
    const bedColor = others >= 2 ? BLACK : RED

    if (booking.pagato) {
      if (!hasExtra) return CYAN
      return `repeating-linear-gradient(45deg, ${bedColor} 0px, ${bedColor} 8px, ${CYAN} 8px, ${CYAN} 16px)`
    }
    if (booking.bonifico) {
      if (!hasExtra) return PURPLE
      return `repeating-linear-gradient(45deg, ${bedColor} 0px, ${bedColor} 8px, ${PURPLE} 8px, ${PURPLE} 16px)`
    }
    if (hasExtra) return bedColor
    return booking.color || GREEN
  }

  const totalW = NAME_W + DAYS_TOTAL * CELL_W
  const totalH = HEADER_H + rooms.length * ROW_H + EXTRA_ROW_H

  // Calcola mesi per header
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
                <button onClick={scrollToToday} style={{ fontSize: 10, fontWeight: 700, color: 'white', background: '#16a34a', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}>Oggi</button>
              </div>
              {monthGroups.map((mg, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: NAME_W + mg.startIdx * CELL_W,
                  width: mg.count * CELL_W,
                  height: HEADER_MONTH_H,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#16a34a',
                  borderLeft: i > 0 ? '1px solid #d1d5db' : 'none',
                  textTransform: 'capitalize',
                }}>
                  {mg.label}
                </div>
              ))}
            </div>

            {/* ── HEADER GIORNI ── */}
            <div style={{ position: 'sticky', top: HEADER_MONTH_H, zIndex: 30, display: 'flex', height: HEADER_DAY_H, background: HEADER_BG, borderBottom: '2px solid #9ca3af' }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, borderRight: '1px solid #d1d5db' }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                return (
                  <div key={i} style={{
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center',
                    paddingTop: 4,
                    background: isToday ? '#f0fdf4' : 'transparent',
                    borderLeft: '1px solid #d1d5db',
                  }}>
                    <div style={{ fontSize: isDesktop ? 10 : 8, color: isSun ? '#dc2626' : '#9ca3af', marginBottom: 2 }}>
                      {d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, isDesktop ? 3 : 2)}
                    </div>
                    <div style={{
                      fontSize: isDesktop ? 15 : 12, fontWeight: 700,
                      color: isToday ? 'white' : (isSun ? '#dc2626' : '#374151'),
                      background: isToday ? '#16a34a' : 'transparent',
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
                  <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalW, height: ROW_H, display: 'flex', borderBottom: '1px solid #d1d5db' }}>
                    {/* Nome camera */}
                    <div style={{
                      width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10,
                      background: 'white', borderRight: '2px solid #9ca3af',
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
                          onClick={() => router.push(`/nuova?room_id=${room.id}&check_in=${dateStr}`)}
                          style={{
                            width: CELL_W, minWidth: CELL_W, height: '100%',
                            background: isToday ? '#f0fdf4' : isSun ? '#fafafa' : (isEven ? 'white' : '#fafafa'),
                            borderLeft: isToday ? '2px solid #bbf7d0' : '1px solid #d1d5db',
                            cursor: 'pointer',
                          }} />
                      )
                    })}
                  </div>

                  {/* Barre prenotazioni */}
                  {bookingsForRoom(room.id).flatMap((booking: any) => {
                    const startIdx = Math.max(0, dayIndex(booking.check_in))
                    const endIdx = Math.min(DAYS_TOTAL, dayIndex(booking.check_out))
                    if (endIdx - startIdx <= 0) return []
                    const guestName = booking.guests?.full_name || booking.guests?.phone || ''
                    const isOttimo = booking.guests?.rating === 'ottimo'
                    const isEsclusiva = booking.color === '#f97316'
                    const vuoleRicevuta = booking.guests?.rating === 'vuole_ricevuta'
                    const hasExtraBed = booking.extra_bed || (booking.extra_bed_dates && booking.extra_bed_dates.length > 0)
                    const isMultiRoom = booking.group_id && bookings.some((b: any) =>
                      b.id !== booking.id && b.group_id === booking.group_id
                    )
                    const groupColor = isMultiRoom ? groupColorMap[booking.group_id] : null

                    const segments: { start: number; end: number; color: string }[] = []
                    let curColor = '', segStart = startIdx
                    for (let i = startIdx; i < endIdx; i++) {
                      const c = getDayColor(booking, toStr(addDays(startDate, i)))
                      if (c !== curColor) {
                        if (curColor) segments.push({ start: segStart, end: i, color: curColor })
                        curColor = c; segStart = i
                      }
                    }
                    if (curColor) segments.push({ start: segStart, end: endIdx, color: curColor })

                    return segments.map((seg, si) => {
                      const isFirst = si === 0
                      const isLast = si === segments.length - 1
                      return (
                        <div key={`${booking.id}-${si}`}
                          onClick={() => router.push(`/prenotazioni/${booking.id}`)}
                          style={{
                            position: 'absolute',
                            top: rowTop + 6,
                            left: NAME_W + seg.start * CELL_W + (isFirst ? 2 : 0),
                            width: (seg.end - seg.start) * CELL_W - (isFirst ? 2 : 0) - (isLast ? 2 : 0),
                            height: ROW_H - 12,
                            background: seg.color,
                            borderRadius: isFirst && isLast ? 6 : isFirst ? '6px 0 0 6px' : isLast ? '0 6px 6px 0' : 0,
                            cursor: 'pointer',
                            display: isFirst ? 'flex' : 'block',
                            alignItems: 'center',
                            overflow: 'hidden',
                            zIndex: 5,
                            boxShadow: groupColor ? `0 1px 3px rgba(0,0,0,0.2), inset 0 0 0 2px white, inset 0 0 0 4px ${groupColor}` : '0 1px 3px rgba(0,0,0,0.2)',
                          }}>
                          {isFirst && (
                            <span style={{ color: 'white', fontSize: isDesktop ? 13 : 10, fontWeight: 600, paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isEsclusiva ? '🔒 ' : isOttimo ? '⭐ ' : ''}{vuoleRicevuta ? '🧾 ' : ''}{hasExtraBed ? '🛏 ' : ''}{isMultiRoom ? '🔗 ' : ''}{guestName}
                            </span>
                          )}
                        </div>
                      )
                    })
                  })}
                </div>
              )
            })}

            {/* ── RIGA LETTI AGGIUNTIVI ── */}
            {(() => {
              const rowTop = HEADER_H + rooms.length * ROW_H
              return (
                <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalW, height: EXTRA_ROW_H, display: 'flex', borderTop: '2px solid #9ca3af' }}>
                  <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10, background: 'white', borderRight: '2px solid #9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: isDesktop ? 10 : 8, fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 4, padding: '1px 5px' }}>
                      🛏 extra
                    </span>
                  </div>
                  {days.map((d, i) => {
                    const dateStr = toStr(d)
                    const count = extraBedsMap.get(dateStr) || 0
                    const isFull = count >= EXTRA_BED_MAX
                    const isToday = dateStr === todayStr
                    return (
                      <div key={i} style={{ width: CELL_W, minWidth: CELL_W, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isFull ? '#fef2f2' : isToday ? '#f0fdf4' : 'white', borderLeft: isToday ? '2px solid #bbf7d0' : '1px solid #d1d5db' }}>
                        {count > 0 && (
                          <span style={{ fontSize: isDesktop ? 11 : 8, fontWeight: 700, color: isFull ? RED : '#d97706' }}>
                            {count}/{EXTRA_BED_MAX}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="shrink-0 px-4 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: GREEN }} />
          <span className="text-xs text-gray-500">Prenotazione</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: PURPLE }} />
          <span className="text-xs text-gray-500">Bonifico attesa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: CYAN }} />
          <span className="text-xs text-gray-500">Pagato</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: RED }} />
          <span className="text-xs text-gray-500">Letto extra</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: 'white', boxShadow: `inset 0 0 0 2px ${GROUP_COLORS[0]}` }} />
          <span className="text-xs text-gray-500">Cambio camera (colore diverso per ogni cliente)</span>
        </div>
      </div>
    </div>
  )
}
