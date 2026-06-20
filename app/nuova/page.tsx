'use client'
import { useEffect, useState, Suspense } from 'react'
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
  const preselectedCheckIn = searchParams.get('check_in') || ''

  const [step, setStep] = useState<'telefono' | 'cliente' | 'dettagli'>('telefono')
  const [phone, setPhone] = useState('')
  const [guest, setGuest] = useState<any>(null)
  const [guestHistory, setGuestHistory] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [form, setForm] = useState({ room_id: preselectedRoomId, check_in: preselectedCheckIn, check_out: '', check_in_time: '', num_guests: 1, extra_bed: false, use_matrimoniale: false, price_per_night: 0, notes: '' })
  const [guestForm, setGuestForm] = useState({ full_name: '', email: '', rating: 'normale' as string })
  const [saving, setSaving] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

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
      }
    })
  }, [])

  async function searchPhone() {
    if (!phone.trim()) return
    setSearchLoading(true)
    const { data: existingGuest } = await supabase.from('guests').select('*').eq('phone', phone.trim()).single()
    if (existingGuest) {
      setGuest(existingGuest)
      setGuestForm({ full_name: existingGuest.full_name || '', email: existingGuest.email || '', rating: existingGuest.rating })
      const { data: history } = await supabase.from('bookings').select('*, rooms(name)').eq('guest_id', existingGuest.id).order('check_in', { ascending: false })
      setGuestHistory(history || [])
    } else {
      setGuest(null)
      setGuestForm({ full_name: '', email: '', rating: 'normale' })
      setGuestHistory([])
    }
    setSearchLoading(false)
    setStep('cliente')
  }

  function calcTotal() {
    if (!form.check_in || !form.check_out) return 0
    const notti = Math.round((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000)
    if (notti <= 0) return 0
    const room = rooms.find(r => r.id === form.room_id)
    const extraBedTotal = form.extra_bed && room ? Number(room.extra_bed_price) * notti : 0
    return Number(form.price_per_night) * notti + extraBedTotal
  }

  function extraBedTotal() {
    if (!form.extra_bed || !form.check_in || !form.check_out) return 0
    const notti = Math.round((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000)
    const room = rooms.find(r => r.id === form.room_id)
    return room ? Number(room.extra_bed_price) * notti : 0
  }

  function notti() {
    if (!form.check_in || !form.check_out) return 0
    return Math.round((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000)
  }

  async function save() {
    setSaving(true)
    let guestId = guest?.id
    if (!guestId) {
      const { data: newGuest } = await supabase.from('guests').insert({ phone: phone.trim(), full_name: guestForm.full_name || null, email: guestForm.email || null, rating: guestForm.rating }).select().single()
      guestId = newGuest?.id
    } else {
      await supabase.from('guests').update({ full_name: guestForm.full_name || null, email: guestForm.email || null, rating: guestForm.rating }).eq('id', guestId)
    }
    const room = rooms.find(r => r.id === form.room_id)
    const ebt = extraBedTotal()
    await supabase.from('bookings').insert({
      room_id: form.room_id, guest_id: guestId, check_in: form.check_in, check_out: form.check_out,
      check_in_time: form.check_in_time || null,
      num_guests: form.num_guests, extra_bed: form.extra_bed, price_per_night: Number(form.price_per_night),
      extra_bed_total: ebt, total_amount: calcTotal(), notes: form.notes || null, status: 'confermata', source: 'diretta',
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
                    <div key={h.id} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                      <span className={h.status === 'annullata' ? 'line-through text-gray-400' : ''}>{h.check_in} — {h.rooms?.name}</span>
                      <span className={h.status === 'annullata' ? 'text-red-400' : 'text-gray-600'}>€{Number(h.total_amount).toFixed(0)}</span>
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
              setForm({...form, room_id: e.target.value, use_matrimoniale: false, price_per_night: room ? Number(room.base_price) : 0})
            }} className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-sm">
              <option value="">Seleziona camera</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name} — €{r.base_price}/notte{r.bathroom_type === 'privato_esterno' ? ' (bagno esterno)' : ''}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Check-in</p>
                <input type="date" value={form.check_in} onChange={e => setForm({...form, check_in: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Check-out</p>
                <input type="date" value={form.check_out} onChange={e => setForm({...form, check_out: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-1">🕐 Orario arrivo (opzionale)</p>
              <input type="time" value={form.check_in_time} onChange={e => setForm({...form, check_in_time: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">N° ospiti</p>
                <input type="number" min={1} max={4} value={form.num_guests} onChange={e => {
                  const n = parseInt(e.target.value)
                  const room = rooms.find(r => r.id === form.room_id)
                  const autoLetto = room?.has_extra_bed && n >= 3
                  const autoPrice = room?.double_price && n >= 2 ? Number(room.double_price) : (room ? Number(room.base_price) : form.price_per_night)
                  setForm({...form, num_guests: n, extra_bed: autoLetto, price_per_night: autoPrice})
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
                  <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3 mb-3 border border-orange-100">
                    <div>
                      <p className="text-sm font-semibold text-orange-800">🛏 Letto aggiuntivo</p>
                      <p className="text-xs text-orange-600">+€{room.extra_bed_price}/notte</p>
                    </div>
                    <button onClick={() => setForm({...form, extra_bed: !form.extra_bed})}
                      className={`w-12 h-6 rounded-full transition-colors ${form.extra_bed ? 'bg-orange-500' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.extra_bed ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>
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

            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Note (opzionale)" className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-3" />
          </div>

          {notti() > 0 && form.price_per_night > 0 && (
            <div className={`rounded-xl p-4 border mb-4 ${form.extra_bed ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-100'}`}>
              <p className="font-semibold text-gray-700 mb-1">Riepilogo</p>
              <p className="text-sm text-gray-600">{notti()} notti × €{form.price_per_night}</p>
              {form.extra_bed && <p className="text-sm text-orange-600">+ Letto agg.: €{extraBedTotal().toFixed(0)}</p>}
              <p className="text-2xl font-bold text-blue-700 mt-1">Totale: €{calcTotal().toFixed(0)}</p>
            </div>
          )}

          <button onClick={save} disabled={saving || !form.room_id || !form.check_in || !form.check_out || notti() <= 0}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
            {saving ? 'Salvataggio...' : '✅ Salva prenotazione'}
          </button>
        </div>
      )}
    </div>
  )
}
