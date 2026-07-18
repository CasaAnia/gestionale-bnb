'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

const RATING_LABEL: Record<string, string> = { ottimo: '⭐ Ottimo', problematico: '⚠️ Problematico', vuole_ricevuta: '🧾 Vuole ricevuta', normale: '👤 Normale' }
const RATING_COLOR: Record<string, string> = { ottimo: 'bg-sage text-green-dark', problematico: 'bg-[#F6E4DE] text-[#8C3B2E]', vuole_ricevuta: 'bg-sage text-green-mid', normale: 'bg-gray-100 text-gray-600' }

export default function NuovaPrenotazionePage() {
  return <Suspense><NuovaPrenotazione /></Suspense>
}

function NuovaPrenotazione() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedRoomId = searchParams.get('room_id') || ''
  function getTodayStr() {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }
  const preselectedCheckIn = searchParams.get('check_in') || getTodayStr()
  const preselectedGuestId = searchParams.get('guest_id') || ''
  const preselectedGroupId = searchParams.get('group_id') || ''
  function addOneDay(dateStr: string) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  }

  const [step, setStep] = useState<'telefono' | 'cliente' | 'dettagli'>('telefono')
  const [phone, setPhone] = useState('')
  const [searchName, setSearchName] = useState('')
  const [nameResults, setNameResults] = useState<any[]>([])
  const [guest, setGuest] = useState<any>(null)
  const [guestHistory, setGuestHistory] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [form, setForm] = useState({ room_id: preselectedRoomId, check_in: preselectedCheckIn, check_out: addOneDay(preselectedCheckIn), check_in_time: '', num_guests: 1, extra_bed: false, extra_bed_dates: [] as string[], use_matrimoniale: false, price_per_night: 0, notes: '', bonifico: false, extra_phone_1_name: '', chi_e: '' })
  const [guestForm, setGuestForm] = useState({ full_name: '', email: '', rating: 'normale' as string })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedGroupId, setSavedGroupId] = useState<string | null>(null)
  const [savedCheckOut, setSavedCheckOut] = useState<string | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set())
  const [conflitto, setConflitto] = useState<string | null>(null)
  const [lettiOccupati, setLettiOccupati] = useState(0)
  const [extraBedsPerDay, setExtraBedsPerDay] = useState<Record<string, number>>({})
  const checkOutRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'

  function getDaysBetween(checkIn: string, checkOut: string): string[] {
    if (!checkIn || !checkOut) return []
    const days: string[] = []
    const [sy, sm, sd] = checkIn.split('-').map(Number)
    const [ey, em, ed] = checkOut.split('-').map(Number)
    const d = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)
    while (d < end) {
      days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
      d.setDate(d.getDate() + 1)
    }
    return days
  }

  useEffect(() => {
    supabase.from('rooms').select('*').eq('active', true).then(({ data }) => {
      const ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
      const sorted = (data || []).sort((a, b) => {
        const ai = ORDER.findIndex(o => a.name.includes(o))
        const bi = ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      if (preselectedRoomId) {
        const room = (data || []).find((r: any) => r.id === preselectedRoomId)
        if (room) setForm(f => ({ ...f, price_per_night: Number(room.base_price) }))
        if (preselectedCheckIn) checkDisponibilita(preselectedRoomId, preselectedCheckIn, addOneDay(preselectedCheckIn))
      }
    })
    if (preselectedGuestId) loadGuestById(preselectedGuestId)
  }, [])

  async function loadGuestById(guestId: string) {
    const { data: g } = await supabase.from('guests').select('*').eq('id', guestId).single()
    if (g) {
      setGuest(g)
      setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: g.rating })
      const { data: history } = await supabase.from('bookings').select('*, rooms(name)').eq('guest_id', g.id).order('check_in', { ascending: false })
      setGuestHistory(history || [])
      setStep('cliente')
    }
  }

  async function searchByName() {
    if (!searchName.trim()) return
    setSearchLoading(true)
    const q = searchName.trim()

    // cerca tra i clienti principali
    const { data: guestMatches } = await supabase.from('guests').select('*').ilike('full_name', `%${q}%`).order('created_at', { ascending: false }).limit(10)

    // cerca tra i nomi secondari nelle prenotazioni
    const { data: extraMatches } = await supabase.from('bookings')
      .select('*, guests(*)')
      .or(`extra_phone_1_name.ilike.%${q}%,extra_phone_2_name.ilike.%${q}%`)
      .neq('status', 'annullata')
      .order('check_in', { ascending: false })
      .limit(5)

    // unisci i risultati (evita duplicati per id)
    const seen = new Set<string>()
    const combined: any[] = []
    for (const g of guestMatches || []) { if (!seen.has(g.id)) { seen.add(g.id); combined.push(g) } }
    for (const b of extraMatches || []) { if (b.guests && !seen.has(b.guests.id)) { seen.add(b.guests.id); combined.push(b.guests) } }

    if (combined.length === 1) {
      const g = combined[0]
      setGuest(g)
      setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: g.rating })
      const { data: history } = await supabase.from('bookings').select('*, rooms(name)').eq('guest_id', g.id).order('check_in', { ascending: false })
      setGuestHistory(history || [])
      setNameResults([])
      setStep('cliente')
    } else if (combined.length > 1) {
      setNameResults(combined)
    } else {
      setGuest(null)
      setGuestForm({ full_name: q, email: '', rating: 'normale' })
      setGuestHistory([])
      setNameResults([])
      setStep('cliente')
    }
    setSearchLoading(false)
  }

  async function selectGuestFromList(g: any) {
    setGuest(g)
    setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: g.rating })
    const { data: history } = await supabase.from('bookings').select('*, rooms(name)').eq('guest_id', g.id).order('check_in', { ascending: false })
    setGuestHistory(history || [])
    setNameResults([])
    setStep('cliente')
  }

  async function searchPhone() {
    if (!phone.trim()) return
    setSearchLoading(true)
    const raw = phone.trim().replace(/\D/g, '')
    const t = raw.startsWith('39') ? raw : `39${raw}`
    const { data: existingGuest } = await supabase.from('guests').select('*').eq('phone', t).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (existingGuest) {
      setGuest(existingGuest)
      setGuestForm({ full_name: existingGuest.full_name || '', email: existingGuest.email || '', rating: existingGuest.rating })
      const { data: history } = await supabase.from('bookings').select('*, rooms(name)').eq('guest_id', existingGuest.id).order('check_in', { ascending: false })
      setGuestHistory(history || [])
    } else {
      // cerca nei contatti extra (prova sia con che senza prefisso 39)
      const tShort = t.startsWith('39') ? t.slice(2) : t
      const { data: extraMatch } = await supabase.from('bookings')
        .select('*, guests(*)')
        .or(`extra_phone_1.eq.${t},extra_phone_2.eq.${t},extra_phone_1.eq.${tShort},extra_phone_2.eq.${tShort}`)
        .neq('status', 'annullata')
        .order('check_in', { ascending: false })
        .limit(1)
        .single()
      if (extraMatch?.guests) {
        const g = extraMatch.guests
        setGuest(g)
        setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: g.rating })
        const { data: history } = await supabase.from('bookings').select('*, rooms(name)').eq('guest_id', g.id).order('check_in', { ascending: false })
        setGuestHistory(history || [])
      } else {
        setGuest(null)
        setGuestForm({ full_name: '', email: '', rating: 'normale' })
        setGuestHistory([])
      }
    }
    setSearchLoading(false)
    setStep('cliente')
  }

  function calcTotal() {
    if (!form.check_in || !form.check_out) return 0
    const notti = Math.round((parseDate(form.check_out).getTime() - parseDate(form.check_in).getTime()) / 86400000)
    if (notti <= 0) return 0
    const room = rooms.find(r => r.id === form.room_id)
    const extraBedTotal = form.extra_bed && room ? Number(room.extra_bed_price) * notti : 0
    return Number(form.price_per_night) * notti + extraBedTotal
  }

  function extraBedTotal() {
    if (!form.extra_bed) return 0
    const room = rooms.find(r => r.id === form.room_id)
    return room ? Number(room.extra_bed_price) * form.extra_bed_dates.length : 0
  }

  function parseDate(s: string) { return new Date(s.replace(/-/g, '/')) }

  function fmtRange(ci: string, co: string) {
    if (!ci || !co) return ''
    const a = parseDate(ci), b = parseDate(co)
    const short: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    const left = sameMonth ? String(a.getDate()) : a.toLocaleDateString('it-IT', short)
    return `${left}–${b.toLocaleDateString('it-IT', short)} ${b.getFullYear()}`
  }

  function statusBadge(h: any) {
    if (h.status === 'annullata') return { label: 'Annullata', bg: '#F6E4DE', fg: '#8C3B2E' }
    if (h.pagato) return { label: 'Pagato', bg: '#7D9DB0', fg: 'white' }
    if (h.bonifico) return { label: 'Bonifico', bg: '#9B8EC4', fg: 'white' }
    return { label: 'Prenotazione', bg: '#6C9A7C', fg: 'white' }
  }

  function toggleHistory(id: string) {
    setOpenHistory(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function notti() {
    if (!form.check_in || !form.check_out) return 0
    return Math.round((parseDate(form.check_out).getTime() - parseDate(form.check_in).getTime()) / 86400000)
  }

  async function checkDisponibilita(room_id: string, check_in: string, check_out: string) {
    if (!room_id || !check_in || !check_out) return
    const [{ data: conf }, { data: letti }] = await Promise.all([
      supabase.from('bookings')
        .select('id, check_in, check_out, rooms(name), guests(full_name)')
        .eq('room_id', room_id).neq('status', 'annullata')
        .lt('check_in', check_out).gt('check_out', check_in),
      supabase.from('bookings')
        .select('id, room_id, num_guests, extra_bed_dates, check_in, check_out').eq('extra_bed', true).neq('status', 'annullata')
        .lt('check_in', check_out).gt('check_out', check_in),
    ])
    if (conf && conf.length > 0) {
      const b = conf[0] as any
      setConflitto(`⚠️ ${b.rooms?.name || 'Camera'} già occupata dal ${b.check_in} al ${b.check_out} (${b.guests?.full_name || 'altro cliente'})`)
    } else {
      setConflitto(null)
    }
    const perDay: Record<string, number> = {}
    for (const b of letti || []) {
      const bDays = b.extra_bed_dates?.length > 0 ? b.extra_bed_dates : getDaysBetween(b.check_in, b.check_out)
      const contrib = b.room_id === LENA_ID && b.num_guests >= 4 ? 2 : 1
      for (const day of bDays) perDay[day] = (perDay[day] || 0) + contrib
    }
    setExtraBedsPerDay(perDay)
    setLettiOccupati(Math.max(0, ...Object.values(perDay), 0))
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    let guestId = guest?.id
    if (!guestId) {
      const rawP = phone.trim().replace(/\D/g, '')
      const formattedPhone = rawP ? (rawP.startsWith('39') ? rawP : `39${rawP}`) : null
      const { data: newGuest, error: guestError } = await supabase.from('guests').insert({ phone: formattedPhone, full_name: guestForm.full_name || null, email: guestForm.email || null, rating: guestForm.rating }).select().single()
      if (guestError || !newGuest) {
        setSaveError(`Errore creazione cliente: ${guestError?.message || 'sconosciuto'}`)
        setSaving(false)
        return
      }
      guestId = newGuest.id
    } else {
      await supabase.from('guests').update({ full_name: guestForm.full_name || null, email: guestForm.email || null, rating: guestForm.rating }).eq('id', guestId)
    }
    const ebt = extraBedTotal()
    // Se è un cambio camera usa il group_id esistente, altrimenti ne crea uno nuovo
    const groupId = savedGroupId || preselectedGroupId || crypto.randomUUID()
    const { error: bookingError } = await supabase.from('bookings').insert({
      room_id: form.room_id, guest_id: guestId, check_in: form.check_in, check_out: form.check_out,
      check_in_time: form.check_in_time || null,
      num_guests: form.num_guests, extra_bed: form.extra_bed_dates.length > 0, extra_bed_dates: form.extra_bed_dates, price_per_night: Number(form.price_per_night),
      extra_bed_total: ebt, total_amount: calcTotal(), notes: form.notes || null, status: 'confermata', source: 'diretta',
      bonifico: form.bonifico, pagato: false, group_id: groupId,
      extra_phone_1_name: form.extra_phone_1_name || null,
      // chi_e incluso solo se valorizzato: così il salvataggio funziona anche se la colonna non è ancora stata creata su Supabase
      ...(form.chi_e ? { chi_e: form.chi_e } : {}),
    })
    setSaving(false)
    if (bookingError) {
      setSaveError(`Errore salvataggio prenotazione: ${bookingError.message}`)
      return
    }
    setSavedGroupId(groupId)
    setSavedCheckOut(form.check_out)
  }

  // Schermata post-salvataggio: propone cambio camera o fine
  if (savedGroupId && savedCheckOut) {
    const room = rooms.find(r => r.id === form.room_id)
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="bg-sage border border-[#C9DDD0] rounded-2xl p-6 text-center mb-6">
          <p className="text-3xl mb-2">✓</p>
          <p className="font-bold text-green-dark text-lg">Prenotazione salvata</p>
          <p className="text-green-dark text-sm mt-1">{room?.name} · check-out {savedCheckOut}</p>
        </div>
        <p className="text-center text-gray-600 font-semibold mb-4">Vuoi aggiungere un cambio camera?</p>
        <button
          onClick={() => {
            setStep('dettagli')
            setForm(f => ({
              ...f,
              room_id: '',
              check_in: savedCheckOut,
              check_out: addOneDay(savedCheckOut),
              check_in_time: '',
              extra_bed: false,
              extra_bed_dates: [],
              price_per_night: 0,
              notes: '',
            }))
            setSavedCheckOut(null)
          }}
          className="w-full bg-green-mid text-white font-bold py-4 rounded-2xl text-base mb-3"
        >
          ➕ Aggiungi cambio camera
        </button>
        <button
          onClick={() => router.push('/prenotazioni')}
          className="w-full border border-gray-300 text-gray-700 font-semibold py-4 rounded-2xl text-base"
        >
          Fine — vai alle prenotazioni
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => step === 'telefono' ? router.back() : setStep(step === 'dettagli' ? 'cliente' : 'telefono')} className="text-green-mid text-sm">← Indietro</button>
        <h1 className="font-serif text-xl text-green-dark">Nuova prenotazione</h1>
      </div>

      {/* Step 1: telefono o nome */}
      {step === 'telefono' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-4 border border-card-border">
            <p className="font-semibold mb-3">📞 Cerca per telefono</p>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPhone()}
              placeholder="+39 333 1234567"
              className="w-full border border-card-border rounded-lg p-3 text-lg mb-3 focus:outline-none focus:border-green-mid"
              autoFocus
            />
            <button onClick={searchPhone} disabled={!phone.trim() || searchLoading}
              className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
              {searchLoading ? 'Ricerca...' : 'Cerca →'}
            </button>
          </div>

          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">oppure</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="bg-white rounded-xl p-4 border border-card-border">
            <p className="font-semibold mb-3">👤 Cerca per nome</p>
            <input
              type="text" value={searchName} onChange={e => { setSearchName(e.target.value); setNameResults([]) }}
              onKeyDown={e => e.key === 'Enter' && searchByName()}
              placeholder="Nome e cognome"
              className="w-full border border-card-border rounded-lg p-3 text-lg mb-3 focus:outline-none focus:border-green-mid"
            />
            <button onClick={searchByName} disabled={!searchName.trim() || searchLoading}
              className="w-full bg-gray-700 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
              {searchLoading ? 'Ricerca...' : 'Cerca →'}
            </button>
            {nameResults.length > 1 && (
              <div className="mt-3 border-t border-card-border pt-3">
                <p className="text-sm text-gray-500 mb-2">Più clienti trovati — seleziona:</p>
                {nameResults.map(g => (
                  <button key={g.id} onClick={() => selectGuestFromList(g)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-card-border mb-1.5 hover:bg-sage active:bg-sage">
                    <p className="font-semibold text-sm">{g.full_name}</p>
                    <p className="text-xs text-gray-400">📞 {g.phone || '—'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: dati cliente + storico */}
      {step === 'cliente' && (
        <div>
          {guest ? (
            <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-green-dark">✅ Cliente trovato</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RATING_COLOR[guest.rating]}`}>{RATING_LABEL[guest.rating]}</span>
              </div>
              <p className="font-semibold">{guest.full_name || phone}</p>
              <p className="text-sm text-gray-500">📞 {guest.phone}</p>
              {guest.email && <p className="text-sm text-gray-500">✉️ {guest.email}</p>}
              {guestHistory.length > 0 && (
                <div className="mt-3 border-t border-card-border pt-3">
                  <p className="text-sm font-semibold text-gray-600 mb-2">Storico soggiorni ({guestHistory.length})</p>
                  <p className="text-sm font-semibold text-green-mid mb-2">Totale speso: €{guestHistory.filter(h => h.status !== 'annullata').reduce((s: number, h: any) => s + Number(h.total_amount), 0).toFixed(0)}</p>
                  {guestHistory.map(h => {
                    const open = openHistory.has(h.id)
                    const badge = statusBadge(h)
                    const notti = h.check_in && h.check_out ? Math.round((parseDate(h.check_out).getTime() - parseDate(h.check_in).getTime()) / 86400000) : 0
                    return (
                    <div key={h.id} className="border-b border-[#ECE8DD] last:border-0">
                      <button onClick={() => toggleHistory(h.id)} className="w-full flex items-center gap-2 py-2 text-left">
                        <span className="text-[#2D6A4F] text-xs shrink-0 transition-transform duration-150" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${h.status === 'annullata' ? 'line-through text-gray-400' : 'text-[#1F3D2F]'}`}>
                            {fmtRange(h.check_in, h.check_out)} · {h.rooms?.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {h.extra_phone_1_name || '—'}
                            {h.chi_e && <span className="ml-1.5 px-2 py-px rounded-full bg-[#EDE6D6] text-[#5a6b3f] text-[10px] font-medium">{h.chi_e}</span>}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                      </button>
                      {open && (
                        <div className="bg-[#F6F2EA] rounded-lg p-3 mb-2 ml-5 text-xs space-y-1">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#1F3D2F]">
                            <span>👥 {h.num_guests} {h.num_guests === 1 ? 'ospite' : 'ospiti'}</span>
                            <span className="font-semibold">€{Number(h.total_amount).toFixed(0)} <span className="font-normal text-gray-500">({notti}n × €{Number(h.price_per_night).toFixed(0)})</span></span>
                            {h.extra_bed && <span className="px-2 py-px rounded-full text-white font-medium" style={{ background: '#C58A67' }}>🛏 Letto extra</span>}
                          </div>
                          {h.notes
                            ? <p className="text-[#1F3D2F] whitespace-pre-wrap">📝 {h.notes}</p>
                            : <p className="text-gray-400 italic">📝 Nessuna nota</p>}
                          {h.status === 'annullata' && h.cancelled_reason && (
                            <p className="text-[#8C3B2E] italic">↳ {h.cancelled_reason}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-sage rounded-xl p-4 border border-card-border mb-4">
              <p className="font-semibold text-green-mid mb-1">➕ Nuovo cliente</p>
              <p className="text-sm text-green-mid">📞 {phone}</p>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
            <p className="font-semibold mb-3">{guest ? 'Aggiorna dati' : 'Dati cliente'}</p>
            <input value={guestForm.full_name} onChange={e => setGuestForm({...guestForm, full_name: e.target.value})}
              placeholder="Nome e cognome" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" />
            <input value={guestForm.email} onChange={e => setGuestForm({...guestForm, email: e.target.value})}
              placeholder="Email (opzionale)" className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" type="email" />
            <p className="text-sm font-semibold mb-2">Valutazione cliente</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(RATING_LABEL).map(([k, v]) => (
                <button key={k} onClick={() => setGuestForm({...guestForm, rating: k})}
                  className={`text-xs py-2 px-3 rounded-lg font-medium border transition-colors ${guestForm.rating === k ? 'bg-green-mid text-white border-green-mid' : 'bg-white text-gray-600 border-card-border'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep('dettagli')} className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold">
            Continua →
          </button>
        </div>
      )}

      {/* Step 3: dettagli prenotazione */}
      {step === 'dettagli' && (
        <div>
          <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
            <p className="font-semibold mb-3">Dettagli prenotazione</p>

            <p className="text-sm text-gray-500 mb-1">Camera</p>
            <select value={form.room_id} onChange={e => {
              const room = rooms.find(r => r.id === e.target.value)
              const newRoomId = e.target.value
              setForm({...form, room_id: newRoomId, use_matrimoniale: false, price_per_night: room ? Number(room.base_price) : 0})
              checkDisponibilita(newRoomId, form.check_in, form.check_out)
            }} className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm">
              <option value="">Seleziona camera</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name} — €{r.base_price}/notte{r.bathroom_type === 'privato_esterno' ? ' (bagno esterno)' : ''}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Check-in</p>
                <input type="date" defaultValue={form.check_in}
                  onChange={e => {
                    const newCheckIn = e.target.value
                    if (!newCheckIn) return
                    const newCheckOut = addOneDay(newCheckIn)
                    if (checkOutRef.current) checkOutRef.current.value = newCheckOut
                    setForm(f => ({ ...f, check_in: newCheckIn, check_out: newCheckOut }))
                    checkDisponibilita(form.room_id, newCheckIn, newCheckOut)
                  }}
                  className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Check-out</p>
                <input type="date" ref={checkOutRef} defaultValue={form.check_out} onChange={e => {
                  setForm({...form, check_out: e.target.value})
                  checkDisponibilita(form.room_id, form.check_in, e.target.value)
                }} className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-1">🕐 Orario arrivo (opzionale)</p>
              <input type="text" inputMode="numeric" placeholder="HH:MM"
                value={form.check_in_time}
                onChange={e => {
                  let v = e.target.value.replace(/[^0-9:]/g, '')
                  if (v.length === 2 && !v.includes(':') && form.check_in_time.length === 1) v = v + ':'
                  setForm({...form, check_in_time: v})
                }}
                maxLength={5}
                className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">N° ospiti</p>
                <input type="number" min={1} max={4} value={form.num_guests} onChange={e => {
                  const n = parseInt(e.target.value)
                  const room = rooms.find(r => r.id === form.room_id)
                  const nativeCapacity = room?.name === 'Amelia' ? 1 : room?.name === 'Lena' ? 3 : 2
                  const autoLetto = room?.has_extra_bed && n > nativeCapacity
                  const autoPrice = room?.double_price
                    ? (room.has_extra_bed ? (n >= 3 ? Number(room.double_price) : Number(room.base_price)) : (n >= 2 ? Number(room.double_price) : Number(room.base_price)))
                    : (room ? Number(room.base_price) : form.price_per_night)
                  const autoDates = autoLetto ? getDaysBetween(form.check_in, form.check_out) : []
                  setForm({...form, num_guests: n, extra_bed: autoLetto, extra_bed_dates: autoDates, price_per_night: autoPrice})
                }}
                  className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Tariffa/notte €</p>
                <input type="number" min={0} value={form.price_per_night} onChange={e => setForm({...form, price_per_night: parseFloat(e.target.value)})}
                  className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
            </div>

            {(() => {
              const room = rooms.find(r => r.id === form.room_id)
              return <>
                {room?.has_extra_bed && (
                  <>
                    <div className="flex items-center justify-between bg-[#F1E0CE] rounded-lg p-3 mb-1 border border-[#E7CDAE]">
                      <div>
                        <p className="text-sm font-semibold text-[#7A4B22]">🛏 Letto aggiuntivo</p>
                        <p className="text-xs text-[#7A4B22]">+€{room.extra_bed_price}/notte</p>
                      </div>
                      <button onClick={() => {
                        const newVal = !form.extra_bed
                        setForm({...form, extra_bed: newVal, extra_bed_dates: newVal ? getDaysBetween(form.check_in, form.check_out) : []})
                      }}
                        className={`w-12 h-6 rounded-full transition-colors ${form.extra_bed ? 'bg-[#C58A67]' : 'bg-gray-200'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.extra_bed ? 'translate-x-6' : ''}`} />
                      </button>
                    </div>
                    {form.extra_bed && form.check_in && form.check_out && (
                      <div className="mt-2 mb-1">
                        <p className="text-xs text-gray-500 mb-1.5">Seleziona i giorni con letto extra:</p>
                        <div className="flex flex-wrap gap-1">
                          {getDaysBetween(form.check_in, form.check_out).map(day => {
                            const [y, m, d] = day.split('-').map(Number)
                            const date = new Date(y, m - 1, d)
                            const isSelected = form.extra_bed_dates.includes(day)
                            const thisContrib = form.room_id === LENA_ID && form.num_guests >= 4 ? 2 : 1
                            const othersOnDay = extraBedsPerDay[day] || 0
                            const isBlocked = othersOnDay + thisContrib > 2
                            return (
                              <button key={day} disabled={isBlocked && !isSelected}
                                onClick={() => {
                                  const dates = isSelected
                                    ? form.extra_bed_dates.filter(x => x !== day)
                                    : [...form.extra_bed_dates, day]
                                  setForm({ ...form, extra_bed_dates: dates })
                                }}
                                className="px-2 py-1 rounded text-xs font-semibold border transition-colors"
                                style={{ background: isBlocked ? '#1f2937' : isSelected ? '#ef4444' : 'white', color: isBlocked || isSelected ? 'white' : '#6b7280', borderColor: isBlocked ? '#1f2937' : isSelected ? '#ef4444' : '#e5e7eb', opacity: isBlocked && !isSelected ? 0.6 : 1 }}>
                                {date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {lettiOccupati >= 2 && !form.extra_bed && (
                      <p className="text-xs text-[#8C3B2E] font-semibold mb-3 px-1">⚠️ Entrambi i letti aggiuntivi sono già occupati in queste date</p>
                    )}
                    {lettiOccupati === 1 && !form.extra_bed && (
                      <p className="text-xs text-[#7A4B22] mb-3 px-1">⚠️ 1 letto aggiuntivo già occupato in queste date</p>
                    )}
                    {<div className="mb-3" />}
                  </>
                )}
                {room?.matrimoniale_price != null && (
                  <div className="flex items-center justify-between bg-[#EFEAF7] rounded-lg p-3 mb-3 border border-[#D9D0EA]">
                    <div>
                      <p className="text-sm font-semibold text-[#5B4E82]">💑 Uso matrimoniale</p>
                      <p className="text-xs text-[#5B4E82]">€{room.matrimoniale_price}/notte</p>
                    </div>
                    <button onClick={() => {
                      const useM = !form.use_matrimoniale
                      setForm({...form, use_matrimoniale: useM, price_per_night: useM ? Number(room.matrimoniale_price) : Number(room.base_price)})
                    }}
                      className={`w-12 h-6 rounded-full transition-colors ${form.use_matrimoniale ? 'bg-[#9B8EC4]' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.use_matrimoniale ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>
                )}
              </>
            })()}

            <div onClick={() => setForm({...form, bonifico: !form.bonifico})}
              className="flex items-center justify-between bg-sage rounded-lg p-3 mb-3 border border-card-border cursor-pointer active:opacity-70">
              <div>
                <p className="text-sm font-semibold text-green-dark">🏦 Pagamento tramite bonifico</p>
                <p className="text-xs text-green-mid">La conferma includerà l'IBAN</p>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors flex items-center ${form.bonifico ? 'bg-green-mid' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.bonifico ? 'translate-x-6' : ''}`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Nome aggiuntivo</p>
                <input value={form.extra_phone_1_name} onChange={e => setForm({...form, extra_phone_1_name: e.target.value})}
                  placeholder="Nome" className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Chi è</p>
                <input value={form.chi_e} onChange={e => setForm({...form, chi_e: e.target.value})}
                  placeholder="mamma, collega..." className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
            </div>

            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Note (opzionale)" className="w-full border border-card-border rounded-lg p-2 text-sm mb-3" />
          </div>

          {conflitto && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-4 text-sm text-[#8C3B2E] font-semibold">
              {conflitto}
            </div>
          )}

          {lettiOccupati >= 2 && !form.extra_bed && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-4 text-sm text-[#8C3B2E] font-semibold">
              ⚠️ Entrambi i letti aggiuntivi sono già occupati in queste date
            </div>
          )}

          {notti() > 0 && form.price_per_night > 0 && (
            <div className={`rounded-xl p-4 border mb-4 ${form.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-sage border-card-border'}`}>
              <p className="font-semibold text-gray-700 mb-1">Riepilogo</p>
              <p className="text-sm text-gray-600">{notti()} notti × €{form.price_per_night}</p>
              {form.extra_bed && <p className="text-sm text-[#7A4B22]">+ Letto agg.: €{extraBedTotal().toFixed(0)}</p>}
              <p className="font-serif text-2xl text-green-dark mt-1">Totale: €{calcTotal().toFixed(0)}</p>
            </div>
          )}

          {saveError && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-4 text-sm text-[#8C3B2E] font-semibold">
              ❌ {saveError}
            </div>
          )}

          <button onClick={save} disabled={saving || !form.room_id || !form.check_in || !form.check_out || notti() <= 0 || !!conflitto || (form.extra_bed && form.extra_bed_dates.some(day => { const contrib = form.room_id === LENA_ID && form.num_guests >= 4 ? 2 : 1; return (extraBedsPerDay[day] || 0) + contrib > 2 }))}
            className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
            {saving ? 'Salvataggio...' : '✅ Salva prenotazione'}
          </button>
        </div>
      )}
    </div>
  )
}
