'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUpcomingRoomChanges, buildChangeGroups, chainClipPath } from '@/lib/roomChanges'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { nomeOspite } from '@/lib/guestName'
import { matchPrenotazione } from '@/lib/ricerca'
import { testoNavetta } from '@/lib/navetta'
import BackLink from '@/components/BackLink'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { etichettaPeriodo, GIORNI_QUINDICINA } from '@/lib/richiesteCalendario'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const FRAUNCES = { fontFamily: 'var(--font-fraunces), Georgia, serif' }
// Fattore di ingrandimento della griglia (1 = originale). Scala misure e testi.
const GRID_SCALE = 1.2
function gs(n: number) { return Math.round(n * GRID_SCALE) }
const CELL_W_MOBILE = gs(56)
const CELL_W_DESKTOP = gs(84)
const ROW_H_MOBILE = gs(64)
// Dal Mac (04/09/2026): stessa griglia leggera del Calendario e delle Richieste
// — righe 54, colonna camere 116 senza descrizione (tooltip), intestazione
// compatta, barre su una riga. Sul telefono le misure di sempre.
// Misure IDENTICHE al calendario delle Richieste e al Calendario: righe 44,
// giorni 40, camere 96, testi 11–13; niente striscia dei mesi sopra i giorni.
const ROW_H_DESKTOP = 44
const HEADER_MONTH_H_MOBILE = gs(40)
const HEADER_MONTH_H_DESKTOP = 0
const HEADER_DAY_H_MOBILE = gs(50)
const HEADER_DAY_H_DESKTOP = 40
const NAME_W_MOBILE = gs(110)
const NAME_W_DESKTOP = 96
// Selettore «Mese | 2 settimane» (stessa scelta ricordata del Calendario)
type ModoGriglia = 'mese' | 'quindici'
const COLONNE_VISIBILI: Record<ModoGriglia, number> = { mese: 30, quindici: GIORNI_QUINDICINA }
const CHIAVE_MODO = 'ca_calendario_modo'
const LARGHEZZA_MIN_COLONNA = 28
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
  const [popup, setPopup] = useState<{ id: string; name: string; time: string; shuttle: string } | null>(null)
  const [showStorico, setShowStorico] = useState(false)
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

  const [primoVisibile, setPrimoVisibile] = useState(DAYS_BEFORE)
  // Ricerca per nome o telefono (stesso campo del Calendario, dal Mac): gli
  // arrivi trovati restano pieni, gli altri si attenuano; si scorre al primo.
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const t = query.trim()
    if (!t) return []
    return bookings.filter((b: any) => matchPrenotazione(b, t)).sort((a: any, b: any) => a.check_in.localeCompare(b.check_in))
  }, [bookings, query])
  const matchedIds = useMemo(() => new Set(matches.map((m: any) => m.id)), [matches])
  const cercando = query.trim() !== ''
  const searchAttiva = matches.length > 0
  const [modo, setModo] = useState<ModoGriglia>('quindici')
  useEffect(() => {
    let v: string | null = null
    try { v = window.localStorage.getItem(CHIAVE_MODO) } catch { v = null }
    const t = setTimeout(() => { if (v === 'mese' || v === 'quindici') setModo(v) }, 0)
    return () => clearTimeout(t)
  }, [])
  const [larghezzaGriglia, setLarghezzaGriglia] = useState(0)
  const primoGiornoRef = useRef<number | null>(null)
  // Dal Mac le colonne riempiono il riquadro: 14 giorni (2 settimane) o 30 (mese)
  const CELL_W = isDesktop
    ? (larghezzaGriglia > 0 ? Math.max(LARGHEZZA_MIN_COLONNA, Math.floor((larghezzaGriglia - NAME_W_DESKTOP) / COLONNE_VISIBILI[modo])) : CELL_W_DESKTOP)
    : CELL_W_MOBILE
  const ROW_H = isDesktop ? ROW_H_DESKTOP : ROW_H_MOBILE
  const HEADER_MONTH_H = isDesktop ? HEADER_MONTH_H_DESKTOP : HEADER_MONTH_H_MOBILE
  const HEADER_DAY_H = isDesktop ? HEADER_DAY_H_DESKTOP : HEADER_DAY_H_MOBILE
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
        .in('status', ['confermata', 'completata']),
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
      if (primoGiornoRef.current !== null) {
        scrollRef.current.scrollLeft = primoGiornoRef.current * CELL_W
        primoGiornoRef.current = null
      } else {
        // Dal Mac colonne intere (un giorno di contesto a sinistra); sul telefono com'era
        scrollRef.current.scrollLeft = isDesktop ? (DAYS_BEFORE - 1) * CELL_W : DAYS_BEFORE * CELL_W - 80
      }
      updateVisibleMonth()
    }
  }, [loading, CELL_W])

  useEffect(() => {
    if (loading || !scrollRef.current) return
    const el = scrollRef.current
    const ro = new ResizeObserver(() => setLarghezzaGriglia(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  function cambiaModo(m: ModoGriglia) {
    if (m === modo) return
    primoGiornoRef.current = Math.max(0, Math.floor((scrollRef.current?.scrollLeft ?? 0) / CELL_W))
    setModo(m)
    try { window.localStorage.setItem(CHIAVE_MODO, m) } catch { /* niente memoria */ }
  }
  function cambiaRicerca(v: string) {
    setQuery(v)
    const t = v.trim()
    if (!t) return
    const primo = bookings.filter((b: any) => matchPrenotazione(b, t)).sort((a: any, b: any) => a.check_in.localeCompare(b.check_in))[0]
    if (primo) vaiAIndice(dayIndex(primo.check_in) - 1)
  }
  function vaiAIndice(idx: number) {
    scrollRef.current?.scrollTo({ left: Math.max(0, Math.min(days.length - 1, idx)) * CELL_W, behavior: 'smooth' })
  }
  // Frecce ‹ ›: a 2 settimane spostano di 14 giorni, a mese vanno al 1° del mese prima/dopo (entro i 90 giorni)
  function freccia(direzione: -1 | 1) {
    if (modo === 'quindici') { scrollRef.current?.scrollBy({ left: direzione * GIORNI_QUINDICINA * CELL_W, behavior: 'smooth' }); return }
    const d = days[Math.min(days.length - 1, Math.max(0, primoVisibile))]
    const primo = new Date(d.getFullYear(), d.getMonth() + (direzione === 1 ? 1 : (d.getDate() === 1 ? -1 : 0)), 1)
    vaiAIndice(Math.round((primo.getTime() - startDate.getTime()) / 86400000))
  }

  function updateVisibleMonth() {
    const sl = scrollRef.current?.scrollLeft ?? 0
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor(sl / CELL_W)))
    const label = fmtMonth(days[idx])
    setVisibleMonth(prev => (prev === label ? prev : label))
    // Per l'etichetta «1 – 14 set» conta il primo giorno visibile per più di metà
    const primo = Math.min(days.length - 1, Math.max(0, Math.round(sl / CELL_W)))
    setPrimoVisibile(prev => (prev === primo ? prev : primo))
  }

  // Salva insieme orario e navetta: un solo pannello, un solo dato condiviso
  // con il modulo prenotazione. Se la colonna shuttle non esiste ancora
  // (migrazione 0019 da incollare), l'orario si salva comunque.
  async function saveTime() {
    if (!popup) return
    setSavingTime(true)
    const time = popup.time
    const shuttle = popup.shuttle || null
    const { error } = await supabase.from('bookings').update({ check_in_time: time || null, shuttle }).eq('id', popup.id)
    if (error) {
      await supabase.from('bookings').update({ check_in_time: time || null }).eq('id', popup.id)
      if (popup.shuttle) alert('Orario salvato, ma la navetta no: va incollata la migrazione 0019 su Supabase.')
      setBookings(bookings.map(b => b.id === popup.id ? { ...b, check_in_time: time || null } : b))
    } else {
      setBookings(bookings.map(b => b.id === popup.id ? { ...b, check_in_time: time || null, shuttle } : b))
    }
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
    <div className="flex flex-col h-[calc(100dvh-3rem-5.5rem-env(safe-area-inset-bottom))] lg:h-screen lg:pb-0">
      {/* sticky: qui la pagina è più alta dello schermo, quindi scorre anche la finestra */}
      <div className="shrink-0 sticky top-12 lg:top-0 z-40 px-4 pt-3 lg:pt-4 pb-2 bg-cream/95 backdrop-blur-sm">
        <BackLink href="/" />
        {/* Dal Mac il titolo della pagina, con le stesse distanze delle Richieste (16 px sotto «Indietro», riga alta 44 px, 16 px prima del riquadro) */}
        {isDesktop && (
          <div className="flex items-center gap-4 mt-4 mb-2 min-h-[44px]">
            <h1 className="text-[22px] text-green-dark leading-tight mr-auto" style={FRAUNCES}>Arrivi</h1>
            {/* Stesso campo di ricerca del Calendario, stesso punto e stessa misura */}
            <div className="flex items-center gap-2 w-[360px] bg-white border rounded-full px-3 py-1.5" style={{ borderColor: '#C9BFA8' }}>
              <span aria-hidden className="text-[13px]">🔎</span>
              <input type="search" enterKeyHint="search" value={query} onChange={e => cambiaRicerca(e.target.value)} placeholder="Cerca nome o telefono…"
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-green-dark placeholder:text-stone [&::-webkit-search-cancel-button]:hidden" />
              {query !== '' && (
                <button onClick={() => cambiaRicerca('')} aria-label="Chiudi ricerca"
                  className="shrink-0 w-6 h-6 rounded-full bg-cream text-green-dark text-[12px] font-bold leading-none transition-transform duration-100 active:scale-[0.9]">✕</button>
              )}
            </div>
          </div>
        )}
        {isDesktop && cercando && matches.length === 0 && (
          <div className="text-[13.5px] font-bold" style={{ color: '#8c6a52' }}>Nessun arrivo trovato nei prossimi {DAYS_TOTAL - DAYS_BEFORE} giorni</div>
        )}
        {isDesktop && searchAttiva && (
          <div className="text-[13px] font-bold text-green-dark truncate">🔎 {matches.length === 1 ? nomeOspite(matches[0]) : `${matches.length} arrivi trovati`}</div>
        )}
      </div>

      {/* Dal Mac la griglia sta in un riquadro bianco arrotondato come il calendario
          delle Richieste, con la barra di navigazione come prima riga del riquadro */}
      <div className="flex flex-col flex-1 min-h-0 lg:flex-none lg:mx-4 lg:mb-6 lg:bg-white lg:rounded-xl lg:border lg:border-card-border lg:shadow-sm lg:overflow-hidden">
      {!loading && isDesktop && (
        <>
          {/* Riga di navigazione: la stessa del calendario delle Richieste */}
          <div className="shrink-0 flex items-center justify-between px-2 py-2 border-b" style={{ borderColor: '#D6CFBD' }}>
            <button type="button" onClick={() => freccia(-1)} aria-label={modo === 'quindici' ? 'Due settimane prima' : 'Mese precedente'}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-green-mid active:bg-sage transition-colors">
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            <span className="font-serif text-[17px] text-green-dark">
              {modo === 'quindici' ? etichettaPeriodo(days.slice(Math.max(0, primoVisibile), Math.max(0, primoVisibile) + GIORNI_QUINDICINA).map(toStr)) : visibleMonth}
            </span>
            <div className="flex items-center gap-1">
              <div role="group" aria-label="Vista del calendario" className="inline-flex rounded-full border bg-white p-0.5 mr-1" style={{ borderColor: '#C9BFA8' }}>
                {([['mese', 'Mese'], ['quindici', '2 settimane']] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => cambiaModo(v)} aria-pressed={modo === v}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${modo === v ? 'bg-green-mid text-cream-text' : 'text-green-dark'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => freccia(1)} aria-label={modo === 'quindici' ? 'Due settimane dopo' : 'Mese successivo'}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-green-mid active:bg-sage transition-colors">
                <ChevronRight size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dal Mac niente barra di scorrimento visibile sotto la griglia (sembrava un'ombra
          diversa dalle Richieste): si scorre con due dita, con le frecce e con i mesi */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div ref={scrollRef} onScroll={updateVisibleMonth} className={`overflow-auto flex-1 lg:flex-none ${isDesktop ? 'no-scrollbar' : ''}`} style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: totalW, position: 'relative', height: totalH }}>

            {/* ── HEADER MESI: titolo sticky + nome del mese nuovo in ottone al 1° del mese ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 31, display: 'flex', height: HEADER_MONTH_H, background: HEADER_BG }}>
              {HEADER_MONTH_H > 0 && monthGroups.map((mg, i) => i === 0 ? null : (
                <div key={i} style={{
                  position: 'absolute',
                  left: NAME_W + mg.startIdx * CELL_W + 6,
                  height: HEADER_MONTH_H,
                  display: 'flex', alignItems: 'center',
                  fontSize: isDesktop ? gs(10) : gs(9), fontWeight: 600, letterSpacing: '1.5px',
                  color: '#A9884E', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  {mg.label.split(' ')[0]}
                </div>
              ))}
              <div style={{ width: NAME_W, minWidth: NAME_W, height: HEADER_H, position: 'sticky', left: 0, zIndex: 32, background: HEADER_BG, borderRight: '2px solid #D6CFBD', borderBottom: '2px solid #D6CFBD', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 8px' }}>
                {!isDesktop && (
                  <>
                    <span style={{ fontSize: gs(11), fontWeight: 600, letterSpacing: '2px', textIndent: '2px', color: '#A9884E', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>
                      {visibleMonth.split(' ')[0]}
                    </span>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: gs(22), fontWeight: 600, color: '#1F3D2F', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
                      {visibleMonth.split(' ')[1]}
                    </span>
                  </>
                )}
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
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center', paddingTop: 4,
                    background: isToday ? '#F3ECD8' : 'transparent',
                    borderLeft: '1px solid #ECE8DD',
                  }}>
                    <div style={{ fontSize: isDesktop ? (modo === 'quindici' ? 10 : 8) : gs(8), fontWeight: 600, color: isSun ? '#C58A67' : '#5c6b60', marginBottom: 2, lineHeight: 1 }}>
                      {d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, isDesktop && modo === 'quindici' ? 3 : 2)}
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: isToday ? 'white' : (isSun ? '#C58A67' : '#1F3D2F'),
                      background: isToday ? '#2D6A4F' : 'transparent',
                      borderRadius: '50%',
                      width: isDesktop ? 20 : gs(20), height: isDesktop ? 20 : gs(20),
                      lineHeight: isDesktop ? '20px' : `${gs(20)}px`,
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
                  <div style={{ position: 'absolute', top: rowTop, left: 0, width: totalW, height: ROW_H, display: 'flex', borderBottom: ri === rooms.length - 1 && !isDesktop ? '2px solid #D6CFBD' : '1px solid #ECE8DD' }}>
                    {/* Nome camera */}
                    {(() => {
                      const shortName = room.name.split(' ').slice(-1)[0]
                      return (
                    <div title={isDesktop ? (ROOM_DESC_BY_NAME[shortName] || '') : undefined} style={{
                      width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10,
                      background: 'white', borderRight: '2px solid #D6CFBD',
                      display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
                    }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 10 : gs(10), color: 'var(--color-brass)', flexShrink: 0 }}>
                        {ROOM_NUMBER_BY_NAME[shortName] || ''}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 13 : gs(13), fontWeight: 600, color: '#1F3D2F', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shortName}
                        </span>
                        {!isDesktop && (
                          <span style={{ fontSize: gs(8), color: 'var(--color-stone)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {(ROOM_DESC_BY_NAME[shortName] || '').split(' · ')[0]}
                          </span>
                        )}
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
                            borderLeft: isToday && !isDesktop ? '2px solid #F3ECD8' : '1px solid #ECE8DD',
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
                        onClick={() => { setShowStorico(false); setPopup({ id: booking.id, name: nomeOspite(booking), time: booking.check_in_time || '', shuttle: booking.shuttle || '' }) }}
                        style={{
                          position: 'absolute',
                          top: rowTop + 6,
                          left: NAME_W + startIdx * CELL_W + 2,
                          width: barWidth,
                          height: ROW_H - 12,
                          background: '#7D9DB0',
                          borderRadius: `${hasIncoming ? 0 : 6}px ${hasOutgoing ? 0 : 6}px ${hasOutgoing ? 0 : 6}px ${hasIncoming ? 0 : 6}px`,
                          clipPath: chainClipPath(hasIncoming, hasOutgoing),
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          zIndex: searchAttiva && matchedIds.has(booking.id) ? 15 : 5,
                          opacity: searchAttiva && !matchedIds.has(booking.id) ? 0.3 : 1,
                          boxShadow: searchAttiva && matchedIds.has(booking.id) ? '0 3px 10px rgba(31,61,47,0.45)' : '0 1px 3px rgba(0,0,0,0.2)',
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8, maxWidth: '100%' }}>
                          {/* Orario — o freccine ⇄ se è l'arrivo di un cambio camera */}
                          <span style={{
                            color: isCambio ? 'white' : (time ? '#1F3D2F' : 'white'),
                            fontSize: isCambio ? (isDesktop ? 12 : gs(12)) : (isDesktop ? 11 : gs(10)),
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            lineHeight: 1,
                            textAlign: 'center',
                            // Riquadro «⇄» del cambio camera un 20% più corto di prima (richiesta di Ania, 04/09/2026: 44 → 40 → 36)
                            minWidth: isCambio ? (isDesktop ? 36 : gs(30)) : undefined,
                            background: isCambio ? 'rgba(255,255,255,0.30)' : (time ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.35)'),
                            borderRadius: 4,
                            padding: '1px 5px',
                          }}>
                            {isCambio ? '⇄' : (time || '?')}
                          </span>
                          {/* Nome */}
                          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: isDesktop ? (modo === 'quindici' ? 12 : 11) : gs(10), fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                            {nomeOspite(booking)}{hasOutgoing ? ' ⇄' : ''}
                          </span>
                          {/* Sul Mac la navetta sta in linea: la barra resta su una riga */}
                          {isDesktop && !isCambio && booking.shuttle === 'si' && (
                            <span style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 4, padding: '1px 5px', lineHeight: 1.25, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>🚌</span>
                          )}
                        </div>
                        {/* Navetta sotto l'orario, SOLO se confermata e solo l'icona:
                            ogni 🚌 nella griglia significa una cosa sola. "No" e
                            "Da definire" non mostrano nulla qui (restano nel popup
                            e nei promemoria). */}
                        {!isDesktop && !isCambio && booking.shuttle === 'si' && (
                          <div style={{ display: 'flex', paddingLeft: 8, marginTop: 3 }}>
                            <span style={{
                              background: 'rgba(255,255,255,0.92)',
                              borderRadius: 4, padding: '1px 5px', lineHeight: 1.25,
                              fontSize: isDesktop ? gs(11) : gs(9), whiteSpace: 'nowrap',
                            }}>
                              🚌
                            </span>
                          </div>
                        )}
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

      {/* Popup orario + navetta, con la memoria degli arrivi precedenti */}
      {popup && (() => {
        // Storico arrivi del cliente (24/08/2026): visite precedenti dello
        // stesso cliente (scheda, non nome), solo veri arrivi — i segmenti
        // preceduti da un check-out dello stesso ospite nello stesso giorno
        // (prolungamenti e cambi camera) non contano.
        const cur = bookings.find(b => b.id === popup.id)
        const precedenti = cur?.guest_id
          ? bookings
              .filter(b => b.id !== cur.id && b.guest_id === cur.guest_id && b.check_in < cur.check_in
                && !bookings.some(x => x.id !== b.id && x.guest_id === b.guest_id && x.check_out === b.check_in))
              .sort((a, b) => b.check_in.localeCompare(a.check_in))
          : []
        const ultimoConOra = precedenti.find(b => b.check_in_time)
        const dataIt = (s: string) => {
          const [y, m, dd] = s.split('-').map(Number)
          return new Date(y, m - 1, dd).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
        }
        const navettaTxt = (b: any) => b.shuttle === 'si' ? ' · 🚌' : b.shuttle === 'no' ? ' · no navetta' : ''
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setPopup(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-lg mb-1">{popup.name}</p>
            <p className="text-sm text-gray-500 mb-4">
              {popup.time || 'Orario da definire'} · {testoNavetta((popup.shuttle || null) as any)}
            </p>
            <input
              type="text" inputMode="numeric" placeholder="HH:MM"
              value={popup.time}
              onChange={e => {
                let v = e.target.value.replace(/[^0-9:]/g, '')
                if (v.length === 2 && !v.includes(':') && popup.time.length === 1) v = v + ':'
                setPopup({ ...popup, time: v })
              }}
              maxLength={5}
              className="w-full border border-card-border rounded-xl p-3 text-2xl font-bold text-center mb-3"
            />
            <p className="text-xs text-gray-500 mb-1.5">🚌 Navetta</p>
            <div className="flex gap-1.5 mb-4">
              {([['', 'Da definire'], ['si', 'Sì'], ['no', 'No']] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setPopup({ ...popup, shuttle: v })}
                  className={`flex-1 rounded-full text-sm font-semibold py-2 ${popup.shuttle === v ? 'text-white' : 'border border-card-border bg-white text-stone'}`}
                  style={popup.shuttle === v ? { background: '#2D6A4F' } : undefined}>
                  {label}
                </button>
              ))}
            </div>
            {/* Memoria: "arriviamo come sempre" — cosa significa davvero.
                Solo consultazione: niente viene compilato da solo. */}
            {precedenti.length > 0 && (
              <div className="rounded-xl p-3 mb-4" style={{ background: '#F5F1E8' }}>
                {ultimoConOra ? (
                  <p className="text-sm text-green-dark">
                    Ultimo arrivo registrato: <span className="font-bold">{dataIt(ultimoConOra.check_in)} — {ultimoConOra.check_in_time}</span>{navettaTxt(ultimoConOra)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Già ospite {precedenti.length === 1 ? 'una volta' : `${precedenti.length} volte`}, ma senza orari registrati</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <button type="button" onClick={() => setShowStorico(s => !s)}
                    className="text-xs text-stone underline decoration-dotted underline-offset-2">
                    {showStorico ? 'nascondi storico' : `Vedi storico arrivi (${precedenti.length})`}
                  </button>
                  {ultimoConOra && (
                    <button type="button"
                      onClick={() => setPopup({ ...popup, time: ultimoConOra.check_in_time, shuttle: ultimoConOra.shuttle || popup.shuttle })}
                      className="text-xs font-semibold rounded-full border border-card-border bg-white px-3 py-1"
                      style={{ color: '#2D6A4F' }}>
                      Usa come l&apos;ultima volta
                    </button>
                  )}
                </div>
                {showStorico && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid #E5DCCB' }}>
                    {precedenti.map(b => (
                      <p key={b.id} className="text-xs text-green-dark mb-1 last:mb-0">
                        <span className="font-semibold">{dataIt(b.check_in)}</span>
                        {b.check_in_time ? ` — arrivo ${b.check_in_time}` : <span className="text-gray-400"> — orario non registrato</span>}
                        {navettaTxt(b)}
                        {roomNameById[b.room_id] ? <span className="text-stone"> · {roomNameById[b.room_id]}</span> : null}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => router.push(`/prenotazioni/${popup.id}`)} className="flex-1 border border-card-border text-gray-600 rounded-xl py-3 font-semibold text-sm">
                Apri prenotazione
              </button>
              <button onClick={saveTime} disabled={savingTime} className="flex-1 bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
                {savingTime ? 'Salvo...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
        )
      })()}
      </div>
      {!loading && isDesktop && (
        <div className="shrink-0 flex items-center gap-3 px-4 pb-5">
          <button type="button" onClick={() => vaiAIndice(DAYS_BEFORE - 1)}
            className="rounded-full border border-green-mid bg-white text-green-mid text-[13px] font-bold px-3.5 py-1.5 active:bg-sage">Oggi</button>
          <span className="text-[13px] text-stone">arrivi dei prossimi {DAYS_TOTAL - DAYS_BEFORE} giorni</span>
        </div>
      )}

      {/* Niente legenda in Arrivi (richiesta di Ania, 04/09/2026): i simboli si spiegano da soli */}
    </div>
  )
}
