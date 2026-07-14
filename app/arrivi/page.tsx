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

const HIGHLIGHT_COLORS = ['#FF4FD8', '#FFE93B', '#8C8C8C']

// Collega in "catene" le prenotazioni con cambio camera reale: stesso group_id, oppure stesso ospite
// con camere diverse e date contigue/sovrapposte (anche senza group_id). Assegna un colore a rotazione
// (in ordine cronologico) a ogni catena.
function buildChangeGroups(bookings: any[]): {
  chainKeyOf: Record<string, string>
  colorOf: Record<string, string>
} {
  const n = bookings.length
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  function union(a: number, b: number) {
    a = find(a); b = find(b)
    if (a !== b) parent[a] = b
  }

  const byGroupId = new Map<string, number[]>()
  bookings.forEach((b, i) => {
    if (!b.group_id) return
    if (!byGroupId.has(b.group_id)) byGroupId.set(b.group_id, [])
    byGroupId.get(b.group_id)!.push(i)
  })
  byGroupId.forEach(idxs => { for (let k = 1; k < idxs.length; k++) union(idxs[0], idxs[k]) })
  // group_id condivisi da almeno 2 prenotazioni: collegamento esplicito, va sempre evidenziato
  const explicitGroupIds = new Set([...byGroupId.entries()].filter(([, idxs]) => idxs.length >= 2).map(([gid]) => gid))

  // Stesso ospite, camere diverse, date contigue o sovrapposte (ma non identiche: due camere nelle
  // stesse identiche date sono una prenotazione multipla contemporanea, non un cambio camera)
  const byGuest = new Map<string, number[]>()
  bookings.forEach((b, i) => {
    if (!b.guest_id) return
    if (!byGuest.has(b.guest_id)) byGuest.set(b.guest_id, [])
    byGuest.get(b.guest_id)!.push(i)
  })
  byGuest.forEach(idxs => {
    for (let x = 0; x < idxs.length; x++) {
      for (let y = x + 1; y < idxs.length; y++) {
        const a = bookings[idxs[x]], b = bookings[idxs[y]]
        if (a.room_id === b.room_id) continue
        if (a.check_in === b.check_in && a.check_out === b.check_out) continue
        if (a.check_in <= b.check_out && b.check_in <= a.check_out) union(idxs[x], idxs[y])
      }
    }
  })

  const components = new Map<number, number[]>()
  bookings.forEach((_, i) => {
    const r = find(i)
    if (!components.has(r)) components.set(r, [])
    components.get(r)!.push(i)
  })

  const chainKeyOf: Record<string, string> = {}
  const ranges: { key: string; start: string; end: string }[] = []

  components.forEach(idxs => {
    if (idxs.length < 2) return
    const sorted = idxs.map(i => bookings[i]).sort((a, b) => a.check_in.localeCompare(b.check_in))
    const hasChange = sorted.some((b, i) => i > 0 && b.room_id !== sorted[i - 1].room_id)
    const hasExplicitLink = sorted.some(b => b.group_id && explicitGroupIds.has(b.group_id))
    if (!hasChange && !hasExplicitLink) return
    const key = `chain-${[...sorted.map(b => b.id)].sort()[0]}`
    sorted.forEach(b => { chainKeyOf[b.id] = key })
    const start = sorted[0].check_in
    const end = sorted.reduce((m, b) => (b.check_out > m ? b.check_out : m), sorted[0].check_out)
    ranges.push({ key, start, end })
  })

  // Colori a rotazione in ordine cronologico (1° soggiorno rosa, 2° giallo, 3° grigio, poi si ripete).
  // Se il prossimo colore in rotazione è già in uso da un soggiorno ancora sovrapposto, si passa al
  // successivo: così soggiorni vicini nel tempo non risultano quasi sempre dello stesso colore, e due
  // soggiorni che si sovrappongono davvero non hanno lo stesso colore a meno che siano più di 3 insieme.
  ranges.sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key))
  const colorOf: Record<string, string> = {}
  const active: { end: string; color: string }[] = []
  let pointer = 0
  ranges.forEach(g => {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= g.start) active.splice(i, 1)
    }
    const used = new Set(active.map(a => a.color))
    let color = HIGHLIGHT_COLORS[pointer % HIGHLIGHT_COLORS.length]
    for (let steps = 0; used.has(color) && steps < HIGHLIGHT_COLORS.length - 1; steps++) {
      pointer = (pointer + 1) % HIGHLIGHT_COLORS.length
      color = HIGHLIGHT_COLORS[pointer % HIGHLIGHT_COLORS.length]
    }
    colorOf[g.key] = color
    pointer = (pointer + 1) % HIGHLIGHT_COLORS.length
    active.push({ end: g.end, color })
  })

  return { chainKeyOf, colorOf }
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

  // Catene di cambio camera (per group_id o per stesso ospite/date contigue) e relativi colori
  const changeGroups = useMemo(() => buildChangeGroups(bookings), [bookings])

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
    <div className="flex flex-col h-screen pb-16 lg:pb-0">

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div ref={scrollRef} className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: totalW, position: 'relative', height: totalH }}>

            {/* ── HEADER MESI ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', height: HEADER_MONTH_H, background: HEADER_BG }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button onClick={scrollToToday} style={{ fontSize: 10, fontWeight: 700, color: 'white', background: '#16a34a', border: 'none', borderRadius: 10, padding: '1px 7px', cursor: 'pointer' }}>Oggi</button>
              </div>
              {monthGroups.map((mg, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: NAME_W + mg.startIdx * CELL_W,
                  width: mg.count * CELL_W,
                  height: HEADER_MONTH_H,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#16a34a',
                  borderLeft: i > 0 ? '1px solid #e5e7eb' : 'none',
                  textTransform: 'capitalize',
                }}>
                  {mg.label}
                </div>
              ))}
            </div>

            {/* ── HEADER GIORNI ── */}
            <div style={{ position: 'sticky', top: HEADER_MONTH_H, zIndex: 30, display: 'flex', height: HEADER_DAY_H, background: HEADER_BG, borderBottom: '2px solid #e5e7eb' }}>
              <div style={{ width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 31, background: HEADER_BG, borderRight: '1px solid #e5e7eb' }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                return (
                  <div key={i} style={{
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center', paddingTop: 4,
                    background: isToday ? '#A8DCF0' : 'transparent',
                    borderLeft: '1px solid #f3f4f6',
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
                            background: isToday ? '#A8DCF0' : isSun ? '#fafafa' : (isEven ? 'white' : '#fafafa'),
                            borderLeft: isToday ? '2px solid #A8DCF0' : '1px solid #f3f4f6',
                          }} />
                      )
                    })}
                  </div>

                  {/* Barre prenotazioni — mostra solo il check-in day con l'orario */}
                  {bookingsForRoom(room.id).flatMap((booking: any) => {
                    const startIdx = dayIndex(booking.check_in)
                    const endIdx = Math.min(DAYS_TOTAL, dayIndex(booking.check_out))
                    if (startIdx < 0 || startIdx >= DAYS_TOTAL || endIdx <= startIdx) return []

                    const time = booking.check_in_time || ''
                    const chainKey = changeGroups.chainKeyOf[booking.id]
                    const highlightColor = chainKey ? changeGroups.colorOf[chainKey] : null
                    const insetV = highlightColor ? 10 : 6
                    const insetH = highlightColor ? 8 : 2
                    const barWidth = (endIdx - startIdx) * CELL_W - insetH * 2

                    const bar = (
                      <div key={booking.id}
                        onClick={() => setPopup({ id: booking.id, name: booking.guests?.full_name || booking.guests?.phone || '', time: booking.check_in_time || '' })}
                        style={{
                          position: 'absolute',
                          top: rowTop + insetV,
                          left: NAME_W + startIdx * CELL_W + insetH,
                          width: barWidth,
                          height: ROW_H - insetV * 2,
                          background: '#1a7a32',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          zIndex: 5,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8, maxWidth: '100%' }}>
                          {/* Orario */}
                          <span style={{
                            color: 'white',
                            fontSize: isDesktop ? 13 : 10,
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
                          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: isDesktop ? 13 : 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                            {booking.guests?.full_name || booking.guests?.phone || ''}
                          </span>
                        </div>
                      </div>
                    )

                    if (!highlightColor) return [bar]

                    const backdrop = (
                      <div key={`${booking.id}-hl`}
                        style={{
                          position: 'absolute',
                          top: rowTop,
                          left: NAME_W + startIdx * CELL_W,
                          width: (endIdx - startIdx) * CELL_W,
                          height: ROW_H,
                          background: highlightColor,
                          zIndex: 4,
                          pointerEvents: 'none',
                        }} />
                    )
                    return [backdrop, bar]
                  })}
                </div>
              )
            })}
          </div>
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
