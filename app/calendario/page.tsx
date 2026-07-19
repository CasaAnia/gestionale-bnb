'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { buildChangeGroups, chainClipPath } from '@/lib/roomChanges'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import BackLink from '@/components/BackLink'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

const CELL_W_MOBILE = 56
const CELL_W_DESKTOP = 84
const ROW_H_MOBILE = 64
const ROW_H_DESKTOP = 84
const HEADER_MONTH_H = 34
const HEADER_DAY_H = 50
const NAME_W_MOBILE = 110
const NAME_W_DESKTOP = 180
const DAYS_TOTAL = 365
const DAYS_BEFORE = 180
const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const EXTRA_BED_MAX = 2

const GREEN = '#6C9A7C'
const PURPLE = '#9B8EC4'
const CYAN = '#7D9DB0'
const RED = '#C58A67'
const BLACK = '#1f2937'
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

export default function Calendario() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)

  // Catene di cambio camera (per group_id o per stesso ospite/date contigue) e relative transizioni
  const changeGroups = useMemo(() => buildChangeGroups(bookings), [bookings])

  // Per ogni prenotazione: esce verso un'altra camera (taglio a destra) e/o arriva da un'altra camera (taglio a sinistra)
  const { outgoingIds, incomingIds } = useMemo(() => {
    const outgoing = new Set<string>()
    const incoming = new Set<string>()
    changeGroups.edges.forEach(e => { outgoing.add(e.fromId); incoming.add(e.toId) })
    return { outgoingIds: outgoing, incomingIds: incoming }
  }, [changeGroups])

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // Titolo sticky mese+anno: segue il mese più a sinistra attualmente in vista
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
  const EXTRA_ROW_H = isDesktop ? 28 : 22

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -DAYS_BEFORE)
  const endDate = addDays(startDate, DAYS_TOTAL)
  const days: Date[] = Array.from({ length: DAYS_TOTAL }, (_, i) => addDays(startDate, i))
  const todayStr = toStr(today)

  // Somma acconti per prenotazione (vuota se la tabella payments non è ancora migrata)
  const [accontiByBooking, setAccontiByBooking] = useState<Record<string, number>>({})

  // Notti coperte dagli acconti per prenotazione (-1 = tutte). Nei soggiorni con
  // cambio camera i soldi ricevuti "scorrono" lungo tutta la catena in ordine di
  // data, qualunque sia il segmento su cui l'acconto è stato registrato.
  const paidNightsByBooking = useMemo(() => {
    const map: Record<string, number> = {}
    const groups: Record<string, any[]> = {}
    bookings.forEach((b: any) => { const k = b.group_id || b.id; (groups[k] = groups[k] || []).push(b) })
    Object.values(groups).forEach(segs => {
      let money = segs.reduce((s, b) => s + (accontiByBooking[b.id] || 0), 0)
      if (money <= 0) return
      const totale = segs.reduce((s, b) => s + Number(b.total_amount), 0)
      const ordinati = [...segs].sort((a, b) => a.check_in.localeCompare(b.check_in))
      if (money >= totale) { ordinati.forEach(b => { map[b.id] = -1 }); return }
      for (const b of ordinati) {
        const prezzo = Number(b.price_per_night)
        const notti = Math.round((strToDate(b.check_out).getTime() - strToDate(b.check_in).getTime()) / 86400000)
        if (prezzo <= 0) continue
        const coperte = Math.min(notti, Math.floor(money / prezzo))
        if (coperte > 0) map[b.id] = coperte
        money -= coperte * prezzo
        if (coperte < notti) break
      }
    })
    return map
  }, [bookings, accontiByBooking])

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(id, full_name, phone, rating)').neq('status', 'annullata'),
      supabase.from('payments').select('booking_id, amount'),
    ]).then(([{ data: r }, { data: b }, { data: p }]) => {
      const sorted = (r || []).sort((a: any, b: any) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      setBookings(b || [])
      const sums: Record<string, number> = {}
      for (const x of p || []) sums[x.booking_id] = (sums[x.booking_id] || 0) + Number(x.amount)
      setAccontiByBooking(sums)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = DAYS_BEFORE * CELL_W - 80
    }
  }, [loading, CELL_W])

  function updateVisibleMonth() {
    const sl = scrollRef.current?.scrollLeft ?? 0
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor(sl / CELL_W)))
    const label = fmtMonth(days[idx])
    setVisibleMonth(prev => (prev === label ? prev : label))
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
    // Acconti: le notti interamente coperte dai soldi ricevuti diventano blu
    // (da sinistra, lungo tutta la catena); a saldo raggiunto è tutta blu.
    const coperte = paidNightsByBooking[booking.id]
    if (coperte !== undefined) {
      const giorno = Math.round((strToDate(dateStr).getTime() - strToDate(booking.check_in).getTime()) / 86400000)
      if (coperte === -1 || giorno < coperte) {
        if (!hasExtra) return CYAN
        return `repeating-linear-gradient(45deg, ${bedColor} 0px, ${bedColor} 8px, ${CYAN} 8px, ${CYAN} 16px)`
      }
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
    <div className="flex flex-col h-screen pb-32 lg:pb-0">
      <div className="shrink-0 px-4 pt-3 pb-2"><BackLink href="/" /></div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div ref={scrollRef} onScroll={updateVisibleMonth} className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: totalW, position: 'relative', height: totalH }} onClick={() => setSelectedGroupId(null)}>

            {/* ── HEADER MESI: titolo sticky + nome del mese nuovo in ottone al 1° del mese ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', height: HEADER_MONTH_H, background: HEADER_BG }}>
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
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 19 : 15, fontWeight: 600, color: '#1F3D2F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {visibleMonth}
                </span>
              </div>
            </div>

            {/* ── HEADER GIORNI ── */}
            <div style={{ position: 'sticky', top: HEADER_MONTH_H, zIndex: 30, display: 'flex', height: HEADER_DAY_H, background: HEADER_BG, borderBottom: '2px solid #D6CFBD' }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, borderRight: '1px solid #ECE8DD' }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                return (
                  <div key={i} style={{
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center',
                    paddingTop: 4,
                    background: isToday ? '#F3ECD8' : 'transparent',
                    borderLeft: '1px solid #ECE8DD',
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
                      background: 'white', borderRight: '2px solid #D6CFBD',
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
                          onClick={() => router.push(`/nuova?room_id=${room.id}&check_in=${dateStr}`)}
                          style={{
                            width: CELL_W, minWidth: CELL_W, height: '100%',
                            background: isToday ? '#F3ECD8' : isSun ? '#F7F3E8' : (isEven ? 'white' : '#F7F3E8'),
                            borderLeft: isToday ? '2px solid #F3ECD8' : '1px solid #ECE8DD',
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
                    const chainKey = changeGroups.chainKeyOf[booking.id]
                    const isMultiRoom = !!chainKey
                    const hasIncoming = incomingIds.has(booking.id)
                    const hasOutgoing = outgoingIds.has(booking.id)
                    const isSelected = isMultiRoom && selectedGroupId === chainKey
                    const isDimmed = selectedGroupId !== null && !isSelected
                    const insetV = 6
                    const insetH = 2

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
                      const cutLeft = isFirst && hasIncoming
                      const cutRight = isLast && hasOutgoing
                      const clipPath = chainClipPath(cutLeft, cutRight)
                      const leftRounded = isFirst && !cutLeft
                      const rightRounded = isLast && !cutRight
                      return (
                        <div key={`${booking.id}-${si}`}
                          onClick={(e) => {
                            if (isMultiRoom) {
                              e.stopPropagation()
                              // Primo tocco: evidenzia la catena. Secondo tocco sul segmento evidenziato: apre il dettaglio.
                              if (selectedGroupId === chainKey) {
                                router.push(`/prenotazioni/${booking.id}`)
                              } else {
                                setSelectedGroupId(chainKey)
                              }
                            } else {
                              router.push(`/prenotazioni/${booking.id}`)
                            }
                          }}
                          style={{
                            position: 'absolute',
                            top: rowTop + insetV,
                            left: NAME_W + seg.start * CELL_W + (isFirst ? insetH : 0),
                            width: (seg.end - seg.start) * CELL_W - (isFirst ? insetH : 0) - (isLast ? insetH : 0),
                            height: ROW_H - insetV * 2,
                            background: seg.color,
                            borderRadius: `${leftRounded ? 6 : 0}px ${rightRounded ? 6 : 0}px ${rightRounded ? 6 : 0}px ${leftRounded ? 6 : 0}px`,
                            clipPath,
                            cursor: 'pointer',
                            display: isFirst ? 'flex' : 'block',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            zIndex: isSelected ? 15 : 5,
                            opacity: isDimmed ? 0.3 : 1,
                            boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'opacity 0.15s',
                          }}>
                          {isFirst && (
                            <>
                              <span style={{ color: 'white', fontSize: isDesktop ? 13 : 10, fontWeight: 600, paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                                {hasIncoming ? '⇄ ' : ''}{guestName}{hasOutgoing ? ' ⇄' : ''}
                              </span>
                              {(isEsclusiva || isOttimo || vuoleRicevuta || hasExtraBed) && (
                                <span style={{ fontSize: isDesktop ? 12 : 9, paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1.3 }}>
                                  {isEsclusiva ? '🔒 ' : ''}{isOttimo ? '⭐ ' : ''}{vuoleRicevuta ? '🧾 ' : ''}{hasExtraBed ? '🛏 ' : ''}
                                </span>
                              )}
                            </>
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
                <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalW, height: EXTRA_ROW_H, display: 'flex', borderTop: '2px solid #D6CFBD' }}>
                  <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10, background: 'white', borderRight: '2px solid #D6CFBD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: isDesktop ? 10 : 8, fontWeight: 700, color: '#7A4B22', background: '#F1E0CE', borderRadius: 4, padding: '1px 5px' }}>
                      🛏 extra
                    </span>
                  </div>
                  {days.map((d, i) => {
                    const dateStr = toStr(d)
                    const count = extraBedsMap.get(dateStr) || 0
                    const isFull = count >= EXTRA_BED_MAX
                    const isToday = dateStr === todayStr
                    return (
                      <div key={i} style={{ width: CELL_W, minWidth: CELL_W, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isFull ? '#F6E4DE' : isToday ? '#F3ECD8' : 'white', borderLeft: isToday ? '2px solid #F3ECD8' : '1px solid #ECE8DD' }}>
                        {count > 0 && (
                          <span style={{ fontSize: isDesktop ? 11 : 8, fontWeight: 700, color: isFull ? RED : '#7A4B22' }}>
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
      <div className="shrink-0 px-4 py-2 bg-white border-t border-card-border flex flex-wrap gap-3 items-center">
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
          <div style={{ position: 'relative', width: 32, height: 16, flexShrink: 0 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 16, height: 16, background: GREEN, clipPath: 'polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }} />
            <div style={{ position: 'absolute', left: 16, top: 0, width: 16, height: 16, background: GREEN, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 6px 100%)' }} />
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 8, fontWeight: 700, color: 'white' }}>⇄</span>
          </div>
          <span className="text-xs text-gray-500">Cambio camera (1° tocco: abbina · 2° tocco: apri)</span>
        </div>
        <span className="ml-auto text-[9px] text-gray-300">v. {process.env.NEXT_PUBLIC_BUILD_TAG}</span>
      </div>
    </div>
  )
}
