'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { prezzoPrenotazione } from '@/lib/prezzoNotti'
import { useRouter } from 'next/navigation'
import { buildChangeGroups, chainClipPath } from '@/lib/roomChanges'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { nomeOspite, nomeDiverso } from '@/lib/guestName'
import { matchPrenotazione } from '@/lib/ricerca'
import { EXTRA_BED_MAX } from '@/lib/tariffe'
import { lettiPoolPrenotazione } from '@/lib/lettiAggiuntivi'
import type { Booking, Guest, Room } from '@/lib/types'
import {
  COLORE_LETTO_PARZIALE,
  COLORE_LETTI_ESAURITI,
  coloreLettiPerGiorno,
  statoLettiAggiuntivi,
} from '@/lib/calendarioLetti'
import BackLink from '@/components/BackLink'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

// Fattore di ingrandimento della griglia (1 = originale). Scala misure e testi.
const GRID_SCALE = 1.2
function gs(n: number) { return Math.round(n * GRID_SCALE) }
const CELL_W_MOBILE = gs(56)
const CELL_W_DESKTOP = gs(84)
const ROW_H_MOBILE = gs(64)
// Dal Mac (blocco 5, 04/09/2026, mockup approvato da Ania): griglia LEGGERA
// come il calendario delle Richieste — righe 54 px, colonna camere 116 px senza
// descrizione (resta nel tooltip), barre col solo nome e icone piccole in linea,
// intestazione compatta. Sopra la griglia la barra «‹ 2 settimane › · Mese ·
// Oggi · mesi cliccabili». Lo scorrimento continuo su tutto l'anno resta.
// Sul telefono le misure sono quelle di sempre.
const ROW_H_DESKTOP = 54
const HEADER_MONTH_H_MOBILE = gs(40)
const HEADER_MONTH_H_DESKTOP = 26
const HEADER_DAY_H_MOBILE = gs(50)
const HEADER_DAY_H_DESKTOP = 48
const NAME_W_MOBILE = gs(110)
const NAME_W_DESKTOP = 116
const GIORNI_SALTO_FRECCE = 14   // le frecce ‹ › spostano di due settimane
const MESI_CLICCABILI = 12       // striscia dei mesi: da quello corrente in avanti
const DAYS_TOTAL = 365
const DAYS_BEFORE = 180
// Colori delle barre per stato di pagamento (attenuati)
const COLOR_PRENOTAZIONE = '#7D9DB0' // blu — prenotazione normale (paga in contanti all'arrivo)
const COLOR_BONIFICO = '#9B8EC4'     // viola — bonifico in attesa
const COLOR_PAGATO = '#6C9A7C'       // verde — già pagato
const HEADER_BG = '#ffffff'

type CalendarBooking = Omit<Booking, 'guests' | 'rooms'> & {
  guests?: Guest | null
  rooms?: Room | null
  extra_bed_dates?: string[] | null
  pagato?: boolean | null
  bonifico?: boolean | null
  color?: string | null
}

type PaymentRow = {
  booking_id: string
  amount: number | string
}

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

// "2026-09-15","2026-09-16" -> "15–16 set"; a cavallo di mese "27 set – 2 ott"
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
function lblDate(ci: string, co: string) {
  const [, m1, g1] = ci.split('-').map(Number)
  const [, m2, g2] = co.split('-').map(Number)
  return m1 === m2 ? `${g1}–${g2} ${MESI_BREVI[m1 - 1]}` : `${g1} ${MESI_BREVI[m1 - 1]} – ${g2} ${MESI_BREVI[m2 - 1]}`
}

export default function Calendario() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)

  // Catene di cambio camera (per group_id o per stesso ospite/date contigue) e relative transizioni
  const changeGroups = useMemo(() => buildChangeGroups(bookings), [bookings])

  // Richieste arrivate dal sito, ancora da confermare: hanno un avviso sticky
  // in alto e la barra tratteggiata sulle loro date.
  const webRequests = useMemo(
    () => bookings
      .filter(b => b.status === 'in_attesa' && b.source === 'sito_web')
      .sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [bookings]
  )

  // Per ogni prenotazione: esce verso un'altra camera (taglio a destra) e/o arriva da un'altra camera (taglio a sinistra)
  const { outgoingIds, incomingIds } = useMemo(() => {
    const outgoing = new Set<string>()
    const incoming = new Set<string>()
    changeGroups.edges.forEach(e => { outgoing.add(e.fromId); incoming.add(e.toId) })
    return { outgoingIds: outgoing, incomingIds: incoming }
  }, [changeGroups])

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // ── Ricerca nel calendario ──
  // La ricerca evidenzia la prenotazione trovata e attenua le altre, senza
  // mai nasconderle: serve a ragionare su prolungamenti e camere libere.
  const [query, setQuery] = useState('')
  const [matchIdx, setMatchIdx] = useState(0)
  const [menuAperto, setMenuAperto] = useState(false)   // elenco a comparsa dei risultati
  const [wrAperto, setWrAperto] = useState(false)       // richieste dal sito riaperte durante la ricerca
  // Intervallo disegnato: parte dai valori fissi e si estende solo quando un
  // risultato selezionato sta fuori; con ✕ torna quello normale.
  const [daysBefore, setDaysBefore] = useState(DAYS_BEFORE)
  const [daysTotal, setDaysTotal] = useState(DAYS_TOTAL)
  // Data da raggiungere dopo il prossimo render (così lo scroll usa gli
  // indici dell'intervallo già esteso, mai tentativi)
  const [scrollTarget, setScrollTarget] = useState<string | null>(null)
  // Quante colonne lasciare a sinistra della data raggiunta: 1,5 (un po' di
  // contesto) per ricerca e «Oggi», 0 per i mesi cliccabili, così il 1° del
  // mese è la prima colonna e l'etichetta sopra dice proprio quel mese.
  const margineScroll = useRef(1.5)

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
  const HEADER_MONTH_H = isDesktop ? HEADER_MONTH_H_DESKTOP : HEADER_MONTH_H_MOBILE
  const HEADER_DAY_H = isDesktop ? HEADER_DAY_H_DESKTOP : HEADER_DAY_H_MOBILE
  const HEADER_H = HEADER_MONTH_H + HEADER_DAY_H
  const NAME_W = isDesktop ? NAME_W_DESKTOP : NAME_W_MOBILE
  const EXTRA_ROW_H = isDesktop ? gs(28) : gs(22)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -daysBefore)
  const endDate = addDays(startDate, daysTotal)
  const days: Date[] = Array.from({ length: daysTotal }, (_, i) => addDays(startDate, i))
  const todayStr = toStr(today)

  // Somma acconti per prenotazione (vuota se la tabella payments non è ancora migrata)
  const [accontiByBooking, setAccontiByBooking] = useState<Record<string, number>>({})

  // Notti coperte dagli acconti per prenotazione (-1 = tutte). Nei soggiorni con
  // cambio camera i soldi ricevuti "scorrono" lungo tutta la catena in ordine di
  // data, qualunque sia il segmento su cui l'acconto è stato registrato.
  const paidNightsByBooking = useMemo(() => {
    const map: Record<string, number> = {}
    const groups: Record<string, CalendarBooking[]> = {}
    bookings.forEach(b => { const k = b.group_id || b.id; (groups[k] = groups[k] || []).push(b) })
    Object.values(groups).forEach(segs => {
      let money = segs.reduce((s, b) => s + (accontiByBooking[b.id] || 0), 0)
      if (money <= 0) return
      const totale = segs.reduce((s, b) => s + Number(b.total_amount), 0)
      const ordinati = [...segs].sort((a, b) => a.check_in.localeCompare(b.check_in))
      if (money >= totale) { ordinati.forEach(b => { map[b.id] = -1 }); return }
      for (const b of ordinati) {
        // Tariffa di ogni notte (lib/prezzoNotti): con persone che cambiano da
        // una notte all'altra ogni notte ha il suo prezzo, non una media
        const tariffe = prezzoPrenotazione(rooms.find(r => r.id === b.room_id) ?? b.rooms, b).notti.map(x => x.tariffa)
        const notti = tariffe.length
        if (notti === 0 || tariffe.some(t => t <= 0)) continue
        let coperte = 0
        while (coperte < notti && money >= tariffe[coperte]) { money -= tariffe[coperte]; coperte++ }
        if (coperte > 0) map[b.id] = coperte
        if (coperte < notti) break
      }
    })
    return map
  }, [bookings, accontiByBooking, rooms])

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(id, full_name, phone, rating)').neq('status', 'annullata'),
      supabase.from('payments').select('booking_id, amount'),
    ]).then(([{ data: r }, { data: b }, { data: p }]) => {
      const sorted = ([...(r || [])] as Room[]).sort((a, b) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      setBookings((b || []) as CalendarBooking[])
      const sums: Record<string, number> = {}
      for (const x of (p || []) as PaymentRow[]) sums[x.booking_id] = (sums[x.booking_id] || 0) + Number(x.amount)
      setAccontiByBooking(sums)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = DAYS_BEFORE * CELL_W - 80
    }
  }, [loading, CELL_W])

  // Risultati della ricerca: TUTTE le prenotazioni corrispondenti in archivio,
  // anche lontane mesi, in ordine di arrivo. Stessa logica della pagina
  // Prenotazioni (lib/ricerca.ts): nome, scheda cliente e telefono.
  const matches = useMemo(() => {
    const t = query.trim()
    if (!t) return []
    return bookings
      .filter(b => matchPrenotazione(b, t))
      .sort((a, b) => a.check_in.localeCompare(b.check_in))
  }, [bookings, query])
  const matchedIds = useMemo(() => new Set(matches.map(m => m.id)), [matches])
  const cercando = query.trim() !== ''
  const searchAttiva = matches.length > 0
  const currentMatch: CalendarBooking | null = searchAttiva ? matches[Math.min(matchIdx, matches.length - 1)] : null
  const clientiDiversi = useMemo(
    () => new Set(matches.map(m => m.guests?.id || m.id)).size,
    [matches]
  )

  function dayIndex(dateStr: string) {
    const d = strToDate(dateStr)
    return Math.round((d.getTime() - startDate.getTime()) / 86400000)
  }

  // Va al risultato i: estende l'intervallo se la prenotazione sta fuori,
  // poi fa scorrere il calendario alla sua data (dopo il render, via effect)
  function vaiA(i: number) {
    const m = matches[i]
    if (!m) return
    setMatchIdx(i)
    setMenuAperto(false)
    const inIdx = dayIndex(m.check_in)
    const outIdx = dayIndex(m.check_out)
    if (inIdx < 0) {
      const extra = -inIdx + 10
      setDaysBefore(v => v + extra)
      setDaysTotal(v => v + extra)
    } else if (outIdx + 3 > daysTotal) {
      setDaysTotal(outIdx + 10)
    }
    setScrollTarget(m.check_in)
  }
  // Salto a una data (striscia dei mesi, «Oggi»): come vaiA, ma senza ricerca.
  // Se la data sta fuori dall'intervallo disegnato lo estende, poi scorre.
  function vaiAData(iso: string, margine = 1.5) {
    margineScroll.current = margine
    const idx = dayIndex(iso)
    if (idx < 0) {
      const extra = -idx + 10
      setDaysBefore(v => v + extra)
      setDaysTotal(v => v + extra)
    } else if (idx + 35 > daysTotal) {
      setDaysTotal(idx + 45)
    }
    setScrollTarget(iso)
  }
  function scorriDiGiorni(n: number) {
    scrollRef.current?.scrollBy({ left: n * CELL_W, behavior: 'smooth' })
  }
  // I 12 mesi cliccabili: da quello corrente in avanti, con l'anno quando cambia
  // (12 voci: si ricalcolano a ogni disegno, costa nulla)
  const mesiCliccabili: { iso: string; label: string; anno: number; nuovoAnno: boolean }[] = []
  for (let i = 0; i < MESI_CLICCABILI; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    mesiCliccabili.push({ iso: toStr(d), label: MESI_BREVI[d.getMonth()], anno: d.getFullYear(), nuovoAnno: i > 0 && d.getMonth() === 0 })
  }

  const vaiARef = useRef(vaiA)
  useEffect(() => {
    vaiARef.current = vaiA
  })

  // Nuova ricerca: salto automatico al primo risultato
  useEffect(() => {
    if (matches.length > 0) vaiARef.current(0)
  }, [matches])

  // Lo scroll parte solo a intervallo già ridisegnato: posizione esatta, mai tentativi
  useEffect(() => {
    if (!scrollTarget || !scrollRef.current) return
    scrollRef.current.scrollTo({ left: Math.max(0, dayIndex(scrollTarget) * CELL_W - Math.round(CELL_W * margineScroll.current)), behavior: 'smooth' })
    margineScroll.current = 1.5
    setScrollTarget(null)
  }, [scrollTarget, daysBefore, daysTotal, CELL_W]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambio testo nel campo: query vuota = tutto torna normale
  function cambiaRicerca(v: string) {
    setQuery(v)
    setMatchIdx(0)
    setMenuAperto(false)
    if (!v.trim()) {
      setWrAperto(false)
      if (daysBefore !== DAYS_BEFORE || daysTotal !== DAYS_TOTAL) {
        setDaysBefore(DAYS_BEFORE)
        setDaysTotal(DAYS_TOTAL)
        setScrollTarget(todayStr)
      }
    }
  }

  function updateVisibleMonth() {
    const sl = scrollRef.current?.scrollLeft ?? 0
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor(sl / CELL_W)))
    const label = fmtMonth(days[idx])
    setVisibleMonth(prev => (prev === label ? prev : label))
  }

  function bookingsForRoom(roomId: string) {
    return bookings.filter(b =>
      b.room_id === roomId &&
      b.check_out > toStr(startDate) &&
      b.check_in < toStr(endDate)
    )
  }

  function getExtraBedDays(booking: CalendarBooking): Set<string> {
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
    const contrib = lettiPoolPrenotazione(b)
    for (const day of extraDays) extraBedsMap.set(day, (extraBedsMap.get(day) || 0) + contrib)
  }

  function getDayColor(booking: CalendarBooking, dateStr: string): string {
    const extraDays = getExtraBedDays(booking)
    const hasExtra = extraDays.has(dateStr)
    const bedColor = coloreLettiPerGiorno(extraBedsMap, dateStr)

    if (booking.pagato) {
      if (!hasExtra) return COLOR_PAGATO
      return `repeating-linear-gradient(45deg, ${bedColor} 0px, ${bedColor} 8px, ${COLOR_PAGATO} 8px, ${COLOR_PAGATO} 16px)`
    }
    // Acconti: le notti interamente coperte dai soldi ricevuti diventano blu
    // (da sinistra, lungo tutta la catena); a saldo raggiunto è tutta blu.
    const coperte = paidNightsByBooking[booking.id]
    if (coperte !== undefined) {
      const giorno = Math.round((strToDate(dateStr).getTime() - strToDate(booking.check_in).getTime()) / 86400000)
      if (coperte === -1 || giorno < coperte) {
        if (!hasExtra) return COLOR_PAGATO
        return `repeating-linear-gradient(45deg, ${bedColor} 0px, ${bedColor} 8px, ${COLOR_PAGATO} 8px, ${COLOR_PAGATO} 16px)`
      }
    }
    if (booking.bonifico) {
      if (!hasExtra) return COLOR_BONIFICO
      return `repeating-linear-gradient(45deg, ${bedColor} 0px, ${bedColor} 8px, ${COLOR_BONIFICO} 8px, ${COLOR_BONIFICO} 16px)`
    }
    if (hasExtra) return bedColor
    return booking.color || COLOR_PRENOTAZIONE
  }

  const totalW = NAME_W + daysTotal * CELL_W
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
    <div className="flex flex-col h-[calc(100dvh-3rem-5.5rem-env(safe-area-inset-bottom))] lg:h-screen lg:pb-0">
      {/* sticky: qui la pagina è più alta dello schermo, quindi scorre anche la finestra */}
      <div className="shrink-0 sticky top-12 lg:top-0 z-40 px-4 pt-3 pb-2 bg-cream/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <BackLink href="/" />
          {/* Ricerca compatta: una riga sola quando non si cerca */}
          <div className="flex items-center gap-2 flex-1 min-w-0 bg-white border border-card-border rounded-full px-3 py-1.5">
            <span aria-hidden className="text-[13px]">🔎</span>
            <input
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={e => cambiaRicerca(e.target.value)}
              placeholder="Cerca nome o telefono…"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-green-dark placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
            />
            {query !== '' && (
              <button
                onClick={() => cambiaRicerca('')}
                aria-label="Chiudi ricerca"
                className="shrink-0 w-6 h-6 rounded-full bg-cream text-green-dark text-[12px] font-bold leading-none transition-transform duration-100 active:scale-[0.9]">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Nessun risultato: messaggio semplice, calendario normale */}
        {cercando && matches.length === 0 && (
          <div className="mt-2 text-[13.5px] font-bold" style={{ color: '#8c6a52' }}>Nessuna prenotazione trovata</div>
        )}

        {/* Risultati della ricerca */}
        {searchAttiva && (() => {
          if (!currentMatch) return null
          const m = currentMatch
          const stessoCliente = clientiDiversi === 1
          const roomShort = (id: string) => (rooms.find(r => r.id === id)?.name || '').split(' ').slice(-1)[0]
          const tel4 = (x: CalendarBooking) => (x.guests?.phone || '').replace(/\D/g, '').slice(-4)
          const voce = (x: CalendarBooking) => `${lblDate(x.check_in, x.check_out)} · ${roomShort(x.room_id)}`
          return (
            <div className="mt-2">
              {matches.length === 1 ? (
                // Un solo risultato: UNA riga compatta
                <div className="text-[13px] font-bold text-green-dark truncate">
                  🔎 {nomeOspite(m)} · {voce(m)}
                </div>
              ) : (
                <>
                  {/* Riga 1: quante prenotazioni, ben chiaro (tocco = elenco a comparsa) */}
                  <button onClick={() => setMenuAperto(o => !o)} className="flex items-center gap-1.5 text-[13px] text-green-dark max-w-full">
                    <span aria-hidden>🔎</span>
                    <span className="truncate">
                      <b>{matches.length} prenotazioni trovate</b> · {stessoCliente ? nomeOspite(matches[0]) : `${clientiDiversi} clienti diversi`}
                    </span>
                    <span className="text-green-mid text-[11px]" aria-hidden>▾</span>
                  </button>

                  {/* Mobile: navigatore ‹ [1 di N · data · camera] › */}
                  <div className="flex items-center gap-2 mt-1 lg:hidden">
                    <button
                      onClick={() => vaiA((matchIdx - 1 + matches.length) % matches.length)}
                      aria-label="Risultato precedente"
                      className="shrink-0 w-11 h-11 rounded-[10px] border border-card-border bg-white text-green-mid text-xl font-bold leading-none transition-transform duration-100 active:scale-[0.95]">
                      ‹
                    </button>
                    <button
                      onClick={() => setScrollTarget(m.check_in)}
                      className="flex-1 min-w-0 rounded-[10px] bg-green-mid text-white px-2 py-1 text-center transition-transform duration-100 active:scale-[0.98]">
                      <span className="block text-[11px] font-extrabold tracking-[1.5px] uppercase opacity-90">{matchIdx + 1} di {matches.length}</span>
                      <span className="block text-[13.5px] font-extrabold truncate">{voce(m)}</span>
                      {!stessoCliente && (
                        <span className="block text-[10.5px] font-semibold opacity-85 truncate">{nomeOspite(m)} · …{tel4(m)}</span>
                      )}
                    </button>
                    <button
                      onClick={() => vaiA((matchIdx + 1) % matches.length)}
                      aria-label="Risultato successivo"
                      className="shrink-0 w-11 h-11 rounded-[10px] border border-card-border bg-white text-green-mid text-xl font-bold leading-none transition-transform duration-100 active:scale-[0.95]">
                      ›
                    </button>
                  </div>

                  {/* Desktop: riquadri in fila */}
                  <div className="hidden lg:flex gap-1.5 mt-1.5 overflow-x-auto pb-1">
                    {matches.map((x, i) => (
                      <button
                        key={x.id}
                        onClick={() => vaiA(i)}
                        className={`shrink-0 rounded-[10px] border px-3 py-1 text-left ${i === matchIdx ? 'bg-green-mid border-green-mid text-white' : 'bg-white border-card-border text-green-dark'}`}>
                        <span className="block text-[13px] font-extrabold whitespace-nowrap">{voce(x)}</span>
                        {!stessoCliente && (
                          <span className={`block text-[11px] whitespace-nowrap ${i === matchIdx ? 'text-white/85' : 'text-gray-400'}`}>{nomeOspite(x)} · …{tel4(x)}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Elenco a comparsa: sta SOPRA il calendario, non lo spinge in basso */}
                  {menuAperto && (
                    <div className="absolute left-4 right-4 z-50 mt-1 bg-white border border-card-border rounded-xl shadow-lg p-1">
                      {matches.map((x, i) => (
                        <button
                          key={x.id}
                          onClick={() => vaiA(i)}
                          className={`flex flex-col items-start w-full text-left px-2.5 py-2 rounded-lg ${i === matchIdx ? 'bg-cream' : ''}`}>
                          <span className="text-[13.5px] font-extrabold text-green-dark">{voce(x)}</span>
                          {!stessoCliente && <span className="text-[11px] text-gray-400">{nomeOspite(x)} · …{tel4(x)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {webRequests.length > 0 && (
          // Una riga per richiesta, ognuna col suo Apri: il tocco sulla riga
          // porta il calendario sulla data, il bottone apre la prenotazione.
          // Durante una ricerca con più richieste il blocco si compatta in una
          // riga sola (il calendario deve restare visibile); un tocco lo riapre
          // e con ✕ torna comunque tutto com'era.
          <div className="chip-in mt-2 bg-white rounded-lg px-3 py-1 shadow-sm">
            {searchAttiva && webRequests.length > 1 && !wrAperto ? (
              <div
                onClick={() => setWrAperto(true)}
                className="flex items-center gap-2 py-1.5 cursor-pointer transition-transform duration-100 active:scale-[0.98]">
                <span aria-hidden>🌐</span>
                <span className="text-[13px] font-bold text-green-dark">{webRequests.length} richieste dal sito</span>
                <span className="ml-auto text-[11px] text-gray-400 font-semibold">tocca per vedere</span>
              </div>
            ) : webRequests.map(b => (
              <div key={b.id}
                onClick={() => {
                  if (!scrollRef.current) return
                  scrollRef.current.scrollTo({ left: Math.max(0, dayIndex(b.check_in) * CELL_W - Math.round(CELL_W * 1.5)), behavior: 'smooth' })
                }}
                className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-b-0 cursor-pointer transition-transform duration-100 active:scale-[0.97]">
                <span aria-hidden>🌐</span>
                <span className="text-[13px] text-green-dark min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="font-semibold">{nomeOspite(b)}</span>
                    {' · '}
                    {b.check_in?.slice(5).split('-').reverse().join('/')} → {b.check_out?.slice(5).split('-').reverse().join('/')}
                    {rooms.find(r => r.id === b.room_id)?.name ? ` · ${rooms.find(r => r.id === b.room_id)?.name}` : ''}
                  </span>
                  {/* Numero già in archivio con un altro nominativo: avviso rosso su
                      riga propria, mai troncato (su mobile lo spazio è poco) */}
                  {nomeDiverso(b) && (
                    <span className="block font-bold text-[12px]" style={{ color: '#C0392B' }}>⚠️ Numero già usato · in archivio: {b.guests?.full_name}</span>
                  )}
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    router.push(`/prenotazioni/${b.id}`)
                  }}
                  className="shrink-0 text-[12.5px] font-semibold text-white bg-green-mid rounded-full px-3 py-1 transition-transform duration-100 active:scale-[0.97]">
                  Apri
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dal Mac la griglia sta in un riquadro bianco arrotondato come il calendario
          delle Richieste, con la barra di navigazione come prima riga del riquadro */}
      <div className="flex flex-col flex-1 min-h-0 lg:flex-none lg:mx-4 lg:mb-3 lg:bg-white lg:rounded-xl lg:border lg:border-card-border lg:overflow-hidden">
      {!loading && isDesktop && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-card-border">
          <button type="button" onClick={() => scorriDiGiorni(-GIORNI_SALTO_FRECCE)} aria-label="Due settimane prima"
            className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-card-border bg-white text-green-mid text-lg leading-none active:bg-sage">‹</button>
          <span className="text-[11px] text-stone">2 settimane</span>
          <button type="button" onClick={() => scorriDiGiorni(GIORNI_SALTO_FRECCE)} aria-label="Due settimane dopo"
            className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-card-border bg-white text-green-mid text-lg leading-none active:bg-sage">›</button>
          <span className="font-serif text-[22px] text-green-dark ml-2 whitespace-nowrap">{visibleMonth}</span>
          <button type="button" onClick={() => vaiAData(todayStr)}
            className="ml-2 rounded-full border border-green-mid bg-white text-green-mid text-xs font-bold px-3 py-1.5 active:bg-sage">Oggi</button>
          {/* Striscia dei mesi: un clic e il calendario scorre lì; il mese acceso segue lo scorrimento */}
          <div className="ml-auto flex items-center gap-0.5 bg-white border border-card-border rounded-full p-1 overflow-x-auto no-scrollbar">
            {mesiCliccabili.map(m => {
              const attivo = visibleMonth === fmtMonth(strToDate(m.iso))
              return (
                <span key={m.iso} className="inline-flex items-center">
                  {m.nuovoAnno && <span className="font-serif text-[10px] text-brass px-1.5 pt-0.5 tracking-wider">{m.anno}</span>}
                  <button type="button" onClick={() => vaiAData(m.iso, 0)} aria-pressed={attivo}
                    className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${attivo ? 'bg-green-mid text-cream-text' : 'text-stone'}`}>{m.label}</button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div ref={scrollRef} onScroll={updateVisibleMonth} className="overflow-auto flex-1 lg:flex-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ width: totalW, position: 'relative', height: totalH }} onClick={() => setSelectedGroupId(null)}>

            {/* ── HEADER MESI: titolo sticky + nome del mese nuovo in ottone al 1° del mese ── */}
            <div style={{ position: 'sticky', top: 0, zIndex: 31, display: 'flex', height: HEADER_MONTH_H, background: HEADER_BG }}>
              {monthGroups.map((mg, i) => i === 0 ? null : (
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
                    width: CELL_W, minWidth: CELL_W, textAlign: 'center',
                    paddingTop: 4,
                    background: isToday ? '#F3ECD8' : 'transparent',
                    borderLeft: '1px solid #ECE8DD',
                  }}>
                    <div style={{ fontSize: isDesktop ? 10 : gs(8), fontWeight: 600, color: isSun ? '#C58A67' : '#5c6b60', marginBottom: 2 }}>
                      {d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, isDesktop ? 3 : 2)}
                    </div>
                    <div style={{
                      fontSize: isDesktop ? 13 : gs(12), fontWeight: 700,
                      color: isToday ? 'white' : (isSun ? '#C58A67' : '#1F3D2F'),
                      background: isToday ? '#2D6A4F' : 'transparent',
                      borderRadius: '50%',
                      width: isDesktop ? 24 : gs(20), height: isDesktop ? 24 : gs(20),
                      lineHeight: isDesktop ? '24px' : `${gs(20)}px`,
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
                    <div title={isDesktop ? (ROOM_DESC_BY_NAME[shortName] || '') : undefined} style={{
                      width: NAME_W, minWidth: NAME_W, position: 'sticky', left: 0, zIndex: 10,
                      background: 'white', borderRight: '2px solid #D6CFBD',
                      display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
                    }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 12 : gs(10), color: 'var(--color-brass)', flexShrink: 0 }}>
                        {ROOM_NUMBER_BY_NAME[shortName] || ''}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: isDesktop ? 15 : gs(13), fontWeight: 600, color: '#1F3D2F', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shortName}
                        </span>
                        {/* Sul Mac la descrizione sta nel tooltip: la griglia resta leggera */}
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
                          onClick={() => router.push(`/nuova?room_id=${room.id}&check_in=${dateStr}&returnTo=/calendario`)}
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
                  {bookingsForRoom(room.id).flatMap(booking => {
                    const startIdx = Math.max(0, dayIndex(booking.check_in))
                    const endIdx = Math.min(daysTotal, dayIndex(booking.check_out))
                    if (endIdx - startIdx <= 0) return []
                    const guestName = booking.guest_name || booking.guests?.full_name || booking.guests?.phone || ''
                    const isOttimo = booking.guests?.rating === 'ottimo'
                    const isEsclusiva = booking.color === '#f97316'
                    const vuoleRicevuta = booking.guests?.rating === 'vuole_ricevuta'
                    const hasExtraBed = booking.extra_bed || (booking.extra_bed_dates && booking.extra_bed_dates.length > 0)
                    const chainKey = changeGroups.chainKeyOf[booking.id]
                    const isMultiRoom = !!chainKey
                    const hasIncoming = incomingIds.has(booking.id)
                    const hasOutgoing = outgoingIds.has(booking.id)
                    const isSelected = isMultiRoom && selectedGroupId === chainKey
                    // Ricerca attiva: risultato selezionato a colore pieno con
                    // ombra, gli altri risultati pieni, tutto il resto attenuato
                    // ma leggibile. I colori di stato non cambiano mai.
                    const isMatch = matchedIds.has(booking.id)
                    const isCurrent = searchAttiva && currentMatch?.id === booking.id
                    const isDimmed = searchAttiva
                      ? !isMatch
                      : (selectedGroupId !== null && !isSelected)
                    // Richiesta dal sito da confermare: barra bianca tratteggiata
                    const isWebPending = booking.status === 'in_attesa' && booking.source === 'sito_web'
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
                            // Con la ricerca attiva vince la ricerca: il tocco
                            // apre direttamente la scheda, senza il passaggio
                            // di evidenziazione della catena
                            if (isMultiRoom && !searchAttiva) {
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
                            background: isWebPending ? '#FFFFFF' : seg.color,
                            border: isWebPending ? '2px dashed #2D6A4F' : undefined,
                            borderRadius: `${leftRounded ? 6 : 0}px ${rightRounded ? 6 : 0}px ${rightRounded ? 6 : 0}px ${leftRounded ? 6 : 0}px`,
                            clipPath,
                            cursor: 'pointer',
                            display: isFirst ? 'flex' : 'block',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            zIndex: isCurrent ? 16 : isSelected ? 15 : 5,
                            opacity: isDimmed ? 0.3 : 1,
                            boxShadow: isCurrent
                              ? '0 3px 10px rgba(31,61,47,0.45)'
                              : isSelected ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'opacity 0.15s, box-shadow 0.15s',
                          }}>
                          {isFirst && (
                            <>
                              {/* Pallino di provenienza: il cliente è arrivato dal sito.
                                  Resta anche dopo la conferma (il colore della barra
                                  continua a dire solo lo STATO) e si vede pure sulle
                                  barre da 1 notte, dove la scritta non ci sta.
                                  Sulla richiesta ancora da confermare parla già la
                                  scritta «dal sito»: lì il pallino non si mostra */}
                              {booking.source === 'sito_web' && !isWebPending && (
                                <span style={{ position: 'absolute', top: 1.5, left: 1.5, width: isDesktop ? gs(13) : gs(11), height: isDesktop ? gs(13) : gs(11), borderRadius: '50%', background: '#1F3D2F', border: '1px solid rgba(255,255,255,0.9)', color: '#fff', fontSize: isDesktop ? gs(7) : gs(6), lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'none' }}>🌐</span>
                              )}
                              <span style={{ color: isWebPending ? '#2D6A4F' : 'white', fontSize: isDesktop ? 13 : gs(10), fontWeight: 600, paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                                {hasIncoming ? '⇄ ' : ''}{guestName}{hasOutgoing ? ' ⇄' : ''}
                                {/* Sul Mac le icone stanno in coda al nome, piccole: la barra resta su una riga */}
                                {isDesktop && (isEsclusiva || isOttimo || vuoleRicevuta || hasExtraBed) && (
                                  <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.95 }}>{isEsclusiva ? '🔒 ' : ''}{isOttimo ? '⭐ ' : ''}{vuoleRicevuta ? '🧾 ' : ''}{hasExtraBed ? '🛏' : ''}</span>
                                )}
                              </span>
                              {/* La scritta resta solo sulla richiesta da confermare
                                  (barra bianca): sulle confermate parla il pallino */}
                              {isWebPending && (
                                <span style={{ color: '#2D6A4F', fontSize: isDesktop ? gs(10) : gs(8), fontWeight: 600, paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1.3 }}>
                                  🌐 dal sito
                                </span>
                              )}
                              {!isDesktop && (isEsclusiva || isOttimo || vuoleRicevuta || hasExtraBed) && (
                                <span style={{ fontSize: gs(9), paddingLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1.3 }}>
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
                    <span style={{ fontSize: isDesktop ? gs(10) : gs(8), fontWeight: 700, color: '#7A4B22', background: '#F1E0CE', borderRadius: 4, padding: '1px 5px' }}>
                      🛏 extra
                    </span>
                  </div>
                  {days.map((d, i) => {
                    const dateStr = toStr(d)
                    const count = extraBedsMap.get(dateStr) || 0
                    const isFull = statoLettiAggiuntivi(count) === 'esauriti'
                    const isToday = dateStr === todayStr
                    return (
                      <div key={i} style={{ width: CELL_W, minWidth: CELL_W, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isFull ? COLORE_LETTI_ESAURITI : isToday ? '#F3ECD8' : 'white', borderLeft: isToday && !isFull ? '2px solid #F3ECD8' : '1px solid #ECE8DD' }}>
                        {count > 0 && (
                          <span style={{ fontSize: isDesktop ? gs(11) : gs(8), fontWeight: 700, color: isFull ? 'white' : '#7A4B22' }}>
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
      </div>

      {/* Legenda: solo su desktop — sul telefono ruba spazio al calendario */}
      <div className="shrink-0 px-4 pb-2 hidden lg:flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_PRENOTAZIONE }} />
          <span className="text-xs text-gray-500">Prenotazione</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_BONIFICO }} />
          <span className="text-xs text-gray-500">Bonifico attesa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_PAGATO }} />
          <span className="text-xs text-gray-500">Pagato</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORE_LETTO_PARZIALE }} />
          <span className="text-xs text-gray-500">1 letto extra occupato</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORE_LETTI_ESAURITI }} />
          <span className="text-xs text-gray-500">2/2 letti occupati</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '1.5px dashed #2D6A4F' }} />
          <span className="text-xs text-gray-500">Dal sito (da confermare)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ position: 'relative', width: 32, height: 16, flexShrink: 0 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 16, height: 16, background: COLOR_PRENOTAZIONE, clipPath: 'polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }} />
            <div style={{ position: 'absolute', left: 16, top: 0, width: 16, height: 16, background: COLOR_PRENOTAZIONE, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 6px 100%)' }} />
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 8, fontWeight: 700, color: 'white' }}>⇄</span>
          </div>
          <span className="text-xs text-gray-500">Cambio camera (1° tocco: abbina · 2° tocco: apri)</span>
        </div>
        <span className="ml-auto text-[9px] text-gray-300">v. {process.env.NEXT_PUBLIC_BUILD_TAG}</span>
      </div>
    </div>
  )
}
