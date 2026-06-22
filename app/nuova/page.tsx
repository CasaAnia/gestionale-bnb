'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

const RATING_LABEL: Record<string, string> = { ottimo: '⭐ Ottimo', problematico: '⚠️ Problematico', vuole_ricevuta: '🧾 Vuole ricevuta', normale: '👤 Normale' }
const RATING_COLOR: Record<string, string> = { ottimo: 'bg-green-100 text-green-700', problematico: 'bg-red-100 text-red-700', vuole_ricevuta: 'bg-blue-100 text-blue-700', normale: 'bg-gray-100 text-gray-600' }

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
  function addOneDay(dateStr: string) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  }

  const [step, setStep] = useState<'telefono' | 'cliente' | 'dettagli'>('telefono')
  const [phone, setPhone] = useState('')
  const [guest, setGuest] = useState<any>(null)
  const [guestHistory, setGuestHistory] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [form, setForm] = useState({ room_id: preselectedRoomId, check_in: preselectedCheckIn, check_out: addOneDay(preselectedCheckIn), check_in_time: '', num_guests: 1, extra_bed: false, extra_bed_dates: [] as string[], use_matrimoniale: false, price_per_night: 0, notes: '', bonifico: false })
  const [guestForm, setGuestForm] = useState({ full_name: '', email: '', rating: 'normale' as string })
  const [saving, setSaving] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
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
  }, [])

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
      // cerca nei contatti extra delle prenotazioni
      const { data: extraMatch } = await supabase.from('bookings')
        .select('*, guests(*)')
        .or(`extra_phone_1.eq.${t},extra_phone_2.eq.${t}`)
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
    let guestId = guest?.id
    if (!guestId) {
      const rawP = phone.trim().replace(/\D/g, '')
      const formattedPhone = rawP.startsWith('39') ? rawP : `39${rawP}`
      const { data: newGuest } = await supabase.from('guests').insert({ phone: formattedPhone, full_name: guestForm.full_name || null, email: guestForm.email || null, rating: guestForm.rating }).select().single()
      guestId = newGuest?.id
    } else {
      await supabase.from('guests').update({ full_name: guestForm.full_name || null, email: guestForm.email || null, rating: guestForm.rating }).eq('id', guestId)
    }
    const room = rooms.find(r => r.id === form.room_id)
    const ebt = extraBedTotal()
    await supabase.from('bookings').insert({
      room_id: form.room_id, guest_id: guestId, check_in: form.check_in, check_out: form.check_out,
      check_in_time: (timeRef.current?.value || form.check_in_time) || null,
      num_guests: form.num_guests, extra_bed: form.extra_bed_dates.length > 0, extra_bed_dates: form.extra_bed_dates, price_per_night: Number(form.price_per_night),
      extra_bed_total: ebt, total_amount: calcTotal(), notes: form.notes || null, status: 'confermata', source: 'diretta',
      bonifico: form.bonifico, pagato: false,
    })
    setSaving(false)
    router.push('/prenotazioni')
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => step === 'telefono' ? router.back() : setStep(step === 'dettagli' ? 'cliente' : 'telefono')} className="text-blue-600 text-sm">← Indietro</button>
        <h1 className="text-xl font-bold">Nuova prenotazione</h1>
      </div>

      {/* Step 1: telefono */}
      {step === 'telefono' && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="font-semibold mb-3">📞 Numero di telefono cliente</p>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPhone()}
            placeholder="+39 333 1234567"
            className="w-full border border-gray-200 rounded-lg p-3 text-lg mb-3 focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <button onClick={searchPhone} disabled={!phone.trim() || searchLoading}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
            {searchLoading ? 'Ricerca...' : 'Cerca cliente →'}
          </button>
        </div>
      )}

      {/* Step 2: dati cliente + storico */}
      {step === 'cliente' && (
        <div>
          {guest ? (
            <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-green-700">✅ Cliente trovato</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RATING_COLOR[guest.rating]}`}>{RATING_LABEL[guest.rating]}</span>
              </div>
              <p className="font-semibold">{guest.full_name || phone}</p>
              <p className="text-sm text-gray-500">📞 {guest.phone}</p>
              {guest.email && <p className="text-sm text-gray-500">✉️ {guest.email}</p>}
              {guestHistory.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-sm font-semibold text-gray-600 mb-2">Storico soggiorni ({guestHistory.length})</p>
                  <p className="text-sm font-semibold text-blue-600 mb-2">Totale speso: €{guestHistory.filter(h => h.status !== 'annullata').reduce((s: number, h: any) => s + Number(h.total_amount), 0).toFixed(0)}</p>
                  {guestHistory.slice(0, 4).map(h => (
                    <div key={h.id} className="py-1 border-b border-gray-50 last:border-0">
                      <div className="flex justify-between text-xs">
                        <span className={h.status === 'annullata' ? 'line-through text-gray-400' : ''}>{h.check_in} — {h.rooms?.name}</span>
                        <span className={h.status === 'annullata' ? 'text-red-400' : 'text-gray-600'}>€{Number(h.total_amount).toFixed(0)}</span>
                      </div>
                      {h.status === 'annullata' && h.cancelled_reason && (
                        <p className="text-xs text-red-400 italic mt-0.5">↳ {h.cancelled_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-4">
              <p className="font-semibold text-blue-700 mb-1">➕ Nuovo cliente</p>
              <p className="text-sm text-blue-600">📞 {phone}</p>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
            <p className="font-semibold mb-3">{guest ? 'Aggiorna dati' : 'Dati cliente'}</p>
            <input value={guestForm.full_name} onChange={e => setGuestForm({...guestForm, full_name: e.target.value})}
              placeholder="Nome e cognome" className="w-full border border-gray-200 rounded-lg p-2 mb-2 text-sm" />
            <input value={guestForm.email} onChange={e => setGuestForm({...guestForm, email: e.target.value})}
              placeholder="Email (opzionale)" className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-sm" type="email" />
            <p className="text-sm font-semibold mb-2">Valutazione cliente</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(RATING_LABEL).map(([k, v]) => (
                <button key={k} onClick={() => setGuestForm({...guestForm, rating: k})}
                  className={`text-xs py-2 px-3 rounded-lg font-medium border transition-colors ${guestForm.rating === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep('dettagli')} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold">
            Continua →
          </button>
        </div>
      )}

      {/* Step 3: dettagli prenotazione */}
      {step === 'dettagli' && (
        <div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
            <p className="font-semibold mb-3">Dettagli prenotazione</p>

            <p className="text-sm text-gray-500 mb-1">Camera</p>
            <select value={form.room_id} onChange={e => {
              const room = rooms.find(r => r.id === e.target.value)
              const newRoomId = e.target.value
              setForm({...form, room_id: newRoomId, use_matrimoniale: false, price_per_night: room ? Number(room.base_price) : 0})
              checkDisponibilita(newRoomId, form.check_in, form.check_out)
            }} className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-sm">
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
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Check-out</p>
                <input type="date" ref={checkOutRef} defaultValue={form.check_out} onChange={e => {
                  setForm({...form, check_out: e.target.value})
                  checkDisponibilita(form.room_id, form.check_in, e.target.value)
                }} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-1">🕐 Orario arrivo (opzionale)</p>
              <input type="time" ref={timeRef} defaultValue={form.check_in_time}
                onChange={e => setForm({...form, check_in_time: e.target.value})}
                onInput={e => setForm({...form, check_in_time: (e.target as HTMLInputElement).value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">N° ospiti</p>
                <input type="number" min={1} max={4} value={form.num_guests} onChange={e => {
                  const n = parseInt(e.target.value)
                  const room = rooms.find(r => r.id === form.room_id)
                  const nativeCapacity = room?.name?.includes('Singola') ? 1 : 2
                  const autoLetto = room?.has_extra_bed && n > nativeCapacity
                  const autoPrice = room?.double_price
                    ? (room.has_extra_bed ? (n >= 3 ? Number(room.double_price) : Number(room.base_price)) : (n >= 2 ? Number(room.double_price) : Number(room.base_price)))
                    : (room ? Number(room.base_price) : form.price_per_night)
                  const autoDates = autoLetto ? getDaysBetween(form.check_in, form.check_out) : []
                  setForm({...form, num_guests: n, extra_bed: autoLetto, extra_bed_dates: autoDates, price_per_night: autoPrice})
                }}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Tariffa/notte €</p>
                <input type="number" min={0} value={form.price_per_night} onChange={e => setForm({...form, price_per_night: parseFloat(e.target.value)})}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
              </div>
            </div>

            {(() => {
              const room = rooms.find(r => r.id === form.room_id)
              return <>
                {room?.has_extra_bed && (
                  <>
                    <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3 mb-1 border border-orange-100">
                      <div>
                        <p className="text-sm font-semibold text-orange-800">🛏 Letto aggiuntivo</p>
                        <p className="text-xs text-orange-600">+€{room.extra_bed_price}/notte</p>
                      </div>
                      <button onClick={() => {
                        const newVal = !form.extra_bed
                        setForm({...form, extra_bed: newVal, extra_bed_dates: newVal ? getDaysBetween(form.check_in, form.check_out) : []})
                      }}
                        className={`w-12 h-6 rounded-full transition-colors ${form.extra_bed ? 'bg-orange-500' : 'bg-gray-200'}`}>
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
                      <p className="text-xs text-red-600 font-semibold mb-3 px-1">⚠️ Entrambi i letti aggiuntivi sono già occupati in queste date</p>
                    )}
                    {lettiOccupati === 1 && !form.extra_bed && (
                      <p className="text-xs text-orange-600 mb-3 px-1">⚠️ 1 letto aggiuntivo già occupato in queste date</p>
                    )}
                    {<div className="mb-3" />}
                  </>
                )}
                {room?.matrimoniale_price != null && (
                  <div className="flex items-center justify-between bg-pink-50 rounded-lg p-3 mb-3 border border-pink-100">
                    <div>
                      <p className="text-sm font-semibold text-pink-800">💑 Uso matrimoniale</p>
                      <p className="text-xs text-pink-600">€{room.matrimoniale_price}/notte</p>
                    </div>
                    <button onClick={() => {
                      const useM = !form.use_matrimoniale
                      setForm({...form, use_matrimoniale: useM, price_per_night: useM ? Number(room.matrimoniale_price) : Number(room.base_price)})
                    }}
                      className={`w-12 h-6 rounded-full transition-colors ${form.use_matrimoniale ? 'bg-pink-500' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.use_matrimoniale ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>
                )}
              </>
            })()}

            <div onClick={() => setForm({...form, bonifico: !form.bonifico})}
              className="flex items-center justify-between bg-blue-50 rounded-lg p-3 mb-3 border border-blue-100 cursor-pointer active:opacity-70">
              <div>
                <p className="text-sm font-semibold text-blue-800">🏦 Pagamento tramite bonifico</p>
                <p className="text-xs text-blue-600">La conferma includerà l'IBAN</p>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors flex items-center ${form.bonifico ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.bonifico ? 'translate-x-6' : ''}`} />
              </div>
            </div>

            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Note (opzionale)" className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-3" />
          </div>

          {conflitto && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 font-semibold">
              {conflitto}
            </div>
          )}

          {lettiOccupati >= 2 && !form.extra_bed && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 font-semibold">
              ⚠️ Entrambi i letti aggiuntivi sono già occupati in queste date
            </div>
          )}

          {notti() > 0 && form.price_per_night > 0 && (
            <div className={`rounded-xl p-4 border mb-4 ${form.extra_bed ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-100'}`}>
              <p className="font-semibold text-gray-700 mb-1">Riepilogo</p>
              <p className="text-sm text-gray-600">{notti()} notti × €{form.price_per_night}</p>
              {form.extra_bed && <p className="text-sm text-orange-600">+ Letto agg.: €{extraBedTotal().toFixed(0)}</p>}
              <p className="text-2xl font-bold text-blue-700 mt-1">Totale: €{calcTotal().toFixed(0)}</p>
            </div>
          )}

          <button onClick={save} disabled={saving || !form.room_id || !form.check_in || !form.check_out || notti() <= 0 || !!conflitto || (form.extra_bed && form.extra_bed_dates.some(day => { const contrib = form.room_id === LENA_ID && form.num_guests >= 4 ? 2 : 1; return (extraBedsPerDay[day] || 0) + contrib > 2 }))}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
            {saving ? 'Salvataggio...' : '✅ Salva prenotazione'}
          </button>
        </div>
      )}
    </div>
  )
}
