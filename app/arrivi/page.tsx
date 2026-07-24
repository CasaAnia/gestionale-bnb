'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUpcomingRoomChanges, buildChangeGroups, chainClipPath } from '@/lib/roomChanges'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import BackLink from '@/components/BackLink'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const CELL_W_MOBILE = 56
const CELL_W_DESKTOP = 84
const ROW_H_MOBILE = 64
const ROW_H_DESKTOP = 84
const HEADER_MONTH_H = 40
const HEADER_DAY_H = 50
const NAME_W_MOBILE = 110
const NAME_W_DESKTOP = 180
const DAYS_TOTAL = 90
const DAYS_BEFORE = 7
const HEADER_BG = '#ffffff'

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

function roomPreposition(room: string) {
  return /^[aeiouAEIOU]/.test(room) ? 'ad' : 'a'
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

  // Titolo sticky mese+anno: segue il mese più a sinistra attualmente in vista (come nel calendario)
  function fmtMonth(d: Date) {
    const l = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    return l.charAt(0).toUpperCase() + l.slice(1)
  }
  const [visibleMonth, setVisibleMonth] = useState(() => fmtMonth(new Date()))

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
  const tomorrowStr = toStr(addDays(today, 1))

  const roomNameById = useMemo(() => {
    const map: Record<string, string> = {}
    rooms.forEach(r => { map[r.id] = r.name.split(' ').slice(-1)[0] })
    return map
  }, [rooms])

  // Cambi camera (di soggiorni collegati) la cui nuova camera inizia oggi o domani
  const roomChanges = useMemo(
    () => getUpcomingRoomChanges(bookings, roomNameById, [todayStr, tomorrowStr]),
    [bookings, roomNameById, todayStr, tomorrowStr]
  )

  // Catene cambio camera: stesse del calendario, per il taglio a incastro delle barre
  const { outgoingIds, incomingIds } = useMemo(() => {
    const { edges } = buildChangeGroups(bookings)
    const outgoing = new Set<string>()
    const incoming = new Set<string>()
    edges.forEach(e => { outgoing.add(e.fromId); incoming.add(e.toId) })
    return { outgoingIds: outgoing, incomingIds: incoming }
  }, [bookings])

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
      updateVisibleMonth()
    }
  }, [loading, CELL_W])

  function updateVisibleMonth() {
    const sl = scrollRef.current?.scrollLeft ?? 0
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor(sl / CELL_W)))
    const label = fmtMonth(days[idx])
    setVisibleMonth(prev => (prev === label ? prev : label))
  }

  async function saveTime() {
    if (!popup) return
    setSavingTime(true)
    const time = popup.time
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
    <div className="flex flex-col h-screen pb-32 lg:pb-0">
      <div className="shrink-0 px-4 pt-3 pb-2"><BackLink href="/" /></div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div ref={scrollRef} onScroll={updateVisibleMonth} className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: totalW, position: 'relative', height: totalH }}>

            {/* ── HEADER MESI: titolo sticky + nome del mese nuovo in ottone al 1° del mese ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 31, display: 'flex', height: HEADER_MONTH_H, background: HEADER_BG }}>
              {monthGroups.map((mg, i) => i === 0 ? null : (
                <div key={i} style={{
                  position: 'absolute',
                  left: NAME_W + mg.startIdx * CELL_W + 6,
                  height: HEADER_MONTH_H,
                  display: 'flex', alignItems: 'center',
                  fontSize: isDesktop ? 10 : 9, fontWeight: 600, letterSpacing: '1.5px',
                  color: '#A9884E', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  {mg.label.split(' ')[0]}
                </div>
              ))}
              <div style={{ width: NAME_W, minWidth: NAME_W, height: HEADER_H, position: 'sticky', left: 0, zIndex: 32, background: HEADER_BG, borderRight: '2px solid #ECE8DD', borderBottom: '2px solid #ECE8DD', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 8px' }}>
                <span style={{ fontSize: isDesktop ? 12 : 11, fontWeight: 600, letterSpacing: '2px', textIndent: '2px', color: '#A9884E', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>
                  {visibleMonth.split(' ')[0]}
                </span>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: isDesktop ? 24 : 22, fontWeight: 600, color: '#1F3D2F', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
                  {visibleMonth.split(' ')[1]}
                </span>
              </div>
            </div>

            {/* ── HEADER GIORNI ── */}
            <div style={{ position: 'sticky', top: HEADER_MONTH_H, zIndex: 30, display: 'flex', height: HEADER_DAY_H, background: HEADER_BG, borderBottom: '2px solid #ECE8DD' }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, borderRight: '1px solid #ECE8DD' }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                return (
                  <div key={i} style={{
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center', paddingTop: 4,
                    background: isToday ? '#F3ECD8' : 'transparent',
                    borderLeft: '1px solid #F2EEE3',
                  }}>
                    <div style={{ fontSize: isDesktop ? 10 : 8, fontWeight: 600, color: isSun ? '#C58A67' : '#5c6b60', marginBottom: 2 }}>
                      {d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, isDesktop ? 3 : 2)}
                    </div>
                    <div style={{
                      fontSize: isDesktop ? 15 : 12, fontWeight: 700,
                      color: isToday ? 'white' : (isSun ? '#C58A67' : '#1F3D2F'),
                      background: isToday ? '#2D6A4F' : 'transparent',
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

            {/* ── SEPARATORI DI MESE: linea ottone al 1° del mese, sotto le barre ── */}
            {monthGroups.map((mg, i) => i === 0 ? null : (
              <div key={`sep-${i}`} style={{
                position: 'absolute',
                left: NAME_W + mg.startIdx * CELL_W - 1,
                top: HEADER_H,
                width: 2,
                height: totalH - HEADER_H,
                background: '#A9884E',
                opacity: 0.55,
                zIndex: 4,
                pointerEvents: 'none',
              }} />
            ))}

            {/* ── RIGHE CAMERE ── */}
            {rooms.map((room, ri) => {
              const rowTop = HEADER_H + ri * ROW_H
              const isEven = ri % 2 === 0
              return (
                <div key={room.id}>
                  <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalW, height: ROW_H, display: 'flex', borderBottom: '1px solid #ECE8DD' }}>
                    {/* Nome camera */}
                    {(() => {
                      const shortName = room.name.split(' ').slice(-1)[0]
                      return (
                    <div style={{
                      width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10,
                      background: 'white', borderRight: '2px solid #ECE8DD',
                      display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
                    }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 12 : 10, color: 'var(--color-brass)', flexShrink: 0 }}>
                        {ROOM_NUMBER_BY_NAME[shortName] || ''}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 16 : 13, fontWeight: 600, color: '#1F3D2F', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shortName}
                        </span>
                        <span style={{ fontSize: isDesktop ? 10 : 8, color: 'var(--color-stone)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isDesktop ? (ROOM_DESC_BY_NAME[shortName] || '') : (ROOM_DESC_BY_NAME[shortName] || '').split(' · ')[0]}
                        </span>
                      </span>
                    </div>
                      )
                    })()}
                    {/* Celle giorni */}
                    {days.map((d, i) => {
                      const isToday = toStr(d) === todayStr
                      const isSun = d.getDay() === 0
                      const dateStr = toStr(d)
                      return (
                        <div key={i}
                          style={{
                            width: CELL_W, minWidth: CELL_W, height: '100%',
                            background: isToday ? '#F3ECD8' : isSun ? '#F7F3E8' : (isEven ? 'white' : '#F7F3E8'),
                            borderLeft: isToday ? '2px solid #F3ECD8' : '1px solid #F2EEE3',
                          }} />
                      )
                    })}
                  </div>

                  {/* Barre prenotazioni — mostra solo il check-in day con l'orario */}
                  {bookingsForRoom(room.id).map((booking: any) => {
                    const startIdx = dayIndex(booking.check_in)
                    const endIdx = Math.min(DAYS_TOTAL, dayIndex(booking.check_out))
                    if (startIdx < 0 || startIdx >= DAYS_TOTAL || endIdx <= startIdx) return null

                    const time = booking.check_in_time || ''
                    const barWidth = (endIdx - startIdx) * CELL_W - 4
                    // Taglio a incastro identico al calendario per i soggiorni con cambio camera
                    const hasIncoming = incomingIds.has(booking.id)
                    const hasOutgoing = outgoingIds.has(booking.id)
                    // Il segmento in arrivo di un cambio camera non è un vero check-in con
                    // orario: al posto del "?" mostra le freccine ⇄ del cambio camera.
                    const isCambio = hasIncoming

                    return (
                      <div key={booking.id}
                        onClick={() => setPopup({ id: booking.id, name: booking.guests?.full_name || booking.guests?.phone || '', time: booking.check_in_time || '' })}
                        style={{
                          position: 'absolute',
                          top: rowTop + 6,
                          left: NAME_W + startIdx * CELL_W + 2,
                          width: barWidth,
                          height: ROW_H - 12,
                          background: '#6C9A7C',
                          borderRadius: `${hasIncoming ? 0 : 6}px ${hasOutgoing ? 0 : 6}px ${hasOutgoing ? 0 : 6}px ${hasIncoming ? 0 : 6}px`,
                          clipPath: chainClipPath(hasIncoming, hasOutgoing),
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          zIndex: 5,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8, maxWidth: '100%' }}>
                          {/* Orario — o freccine ⇄ se è l'arrivo di un cambio camera */}
                          <span style={{
                            color: isCambio ? 'white' : (time ? '#1F3D2F' : 'white'),
                            fontSize: isCambio ? (isDesktop ? 16 : 13) : (isDesktop ? 13 : 10),
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            lineHeight: 1,
                            textAlign: 'center',
                            minWidth: isCambio ? (isDesktop ? 50 : 37) : undefined,
                            background: isCambio ? 'rgba(255,255,255,0.30)' : (time ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.35)'),
                            borderRadius: 4,
                            padding: '1px 5px',
                          }}>
                            {isCambio ? '⇄' : (time || '?')}
                          </span>
                          {/* Nome */}
                          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: isDesktop ? 13 : 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                            {booking.guests?.full_name || booking.guests?.phone || ''}{hasOutgoing ? ' ⇄' : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && roomChanges.length > 0 && (
        <div className="shrink-0 px-4 py-2 bg-sand border-t border-card-border">
          <p className="text-xs font-semibold text-green-dark mb-1">⇄ Cambi camera</p>
          {roomChanges.map(m => (
            <p key={m.id} className="text-xs text-green-mid">
              <span className="font-medium">{m.guest}</span> da {m.fromRoom} {roomPreposition(m.toRoom)} {m.toRoom}
              <span className="text-green-mid"> ({m.date === todayStr ? 'oggi' : 'domani'})</span>
            </p>
          ))}
        </div>
      )}

      {/* Popup orario */}
      {popup && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-[60]" onClick={() => setPopup(null)}>
          <div className="bg-white rounded-t-2xl p-5 w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-lg mb-1">{popup.name}</p>
            <p className="text-sm text-gray-500 mb-4">Orario di arrivo</p>
            <input
              type="text" inputMode="numeric" placeholder="HH:MM"
              value={popup.time}
              onChange={e => {
                let v = e.target.value.replace(/[^0-9:]/g, '')
                if (v.length === 2 && !v.includes(':') && popup.time.length === 1) v = v + ':'
                setPopup({ ...popup, time: v })
              }}
              maxLength={5}
              className="w-full border border-card-border rounded-xl p-3 text-2xl font-bold text-center mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => router.push(`/prenotazioni/${popup.id}`)} className="flex-1 border border-card-border text-gray-600 rounded-xl py-3 font-semibold text-sm">
                Apri prenotazione
              </button>
              <button onClick={saveTime} disabled={savingTime} className="flex-1 bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
                {savingTime ? 'Salvo...' : 'Salva orario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="shrink-0 px-4 py-2 bg-white border-t border-card-border flex gap-4 items-center">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#6C9A7C' }} />
          <span className="text-xs text-gray-500">Orario arrivo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#6C9A7C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: 'white' }}>?</span>
          </div>
          <span className="text-xs text-gray-500">Orario non inserito</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ position: 'relative', width: 32, height: 16, flexShrink: 0 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 16, height: 16, background: '#6C9A7C', clipPath: 'polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }} />
            <div style={{ position: 'absolute', left: 16, top: 0, width: 16, height: 16, background: '#6C9A7C', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 6px 100%)' }} />
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 8, fontWeight: 700, color: 'white' }}>⇄</span>
          </div>
          <span className="text-xs text-gray-500">Cambio camera</span>
        </div>
        <span className="ml-auto text-[9px] text-gray-300">v. {process.env.NEXT_PUBLIC_BUILD_TAG}</span>
      </div>
    </div>
  )
}
