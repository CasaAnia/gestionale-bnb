'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const RATING_LABEL: Record<string, string> = { ottimo: '⭐ Ottimo', problematico: '⚠️ Problematico', vuole_ricevuta: '🧾 Vuole ricevuta', normale: '👤 Normale' }
const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

function formatDateIT(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function bagnoDesc(room: any) {
  if (room?.bathroom_type === 'privato_interno') return "privato, all'interno della camera"
  if (room?.bathroom_type === 'privato_esterno') return room?.bathroom_note ? `privato esterno (${room.bathroom_note})` : 'privato esterno'
  return ''
}

function buildWhatsappMsg(b: any, type: 'conferma' | 'modifica' | 'annullamento') {
  const name = b.guests?.full_name || 'Ospite'
  const room = b.rooms?.name || ''
  const cin = b.check_in
  const cout = b.check_out
  const notti = Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
  const totale = Number(b.total_amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const numOspiti = b.num_guests || 1
  const ospiti = `${numOspiti} ${numOspiti === 1 ? 'adulto' : 'adulti'}`
  const cinF = formatDateIT(cin)
  const coutF = formatDateIT(cout)
  const bagno = bagnoDesc(b.rooms)

  const isLena = room.includes('Lena')

  if (type === 'conferma') {
    return `CONFERMA DI PRENOTAZIONE – Casa Granata Humanitas

Gentile *${name}*,
grazie per aver scelto Casa Granata. Sono lieta di confermarle il soggiorno e la aspetto con piacere!

RIEPILOGO SOGGIORNO
📅 Check-in: *${cinF}* (dalle ore 15:00 alle 20:00)
📅 Check-out: *${coutF}* (entro le ore 10:00)
👥 Ospiti: ${ospiti}
🛏️ Camera: ${room}${b.extra_bed ? ' + letto aggiuntivo' : ''}
${bagno ? (isLena ? `*🚿 Bagno: ${bagno}*` : `🚿 Bagno: ${bagno}`) : ''}
Notti: *${notti}*

💶 Importo totale: *€ ${totale}* – pagamento all'arrivo. Alla consegna delle chiavi verrà chiesto pagamento per l'intera prenotazione in contante oppure tramite bonifico bancario istantaneo.

*Appena le sarà possibile, la preghiamo di comunicarci l'orario di arrivo in struttura, per organizzare al meglio la sua accoglienza.*

📍 COME RAGGIUNGERCI
Via Liguria 26 – Fizzonasco, Pieve Emanuele (MI) 20072
*(A 140 metri dalla palazzina 8 di Humanitas di Rozzano – ortopedia)*

• WiFi gratuito (credenziali in camera)
• Ricordarsi documento d'identità valido
• Fumo solo all'esterno

📞 CONTATTI
Per qualsiasi necessità sono sempre disponibile:
📱 342 700 4345 (anche WhatsApp)

POLITICA DI CANCELLAZIONE
Cancellazione gratuita fino a 3 giorni prima dell'arrivo.

Sarà un piacere accoglierla! 🏡

A presto,
Ania
Casa Granata Humanitas`
  }

  if (type === 'modifica') {
    return `Buongiorno ${name}! ✏️\nLa sua prenotazione è stata modificata:\n📍 ${room}\n📅 Check-in: ${cinF}\n📅 Check-out: ${coutF} (${notti} notti)\n💶 Totale: €${totale}\nCasa Granata Humanitas`
  }
  return `Buongiorno ${name}.\nCi dispiace informarla che la prenotazione del ${cinF} presso ${room} è stata annullata.\nResti a disposizione per eventuali chiarimenti.\nCasa Granata Humanitas`
}

export default function BookingDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [conflitto, setConflitto] = useState<string | null>(null)

  async function checkDisponibilita(room_id: string, check_in: string, check_out: string) {
    if (!room_id || !check_in || !check_out) return
    const { data } = await supabase.from('bookings')
      .select('id, check_in, check_out, rooms(name), guests(full_name)')
      .eq('room_id', room_id)
      .neq('status', 'annullata')
      .neq('id', id)
      .lt('check_in', check_out)
      .gt('check_out', check_in)
    if (data && data.length > 0) {
      const b = data[0] as any
      const roomName = b.rooms?.name || 'Camera'
      setConflitto(`⚠️ ${roomName} già occupata dal ${b.check_in} al ${b.check_out} (${b.guests?.full_name || 'altro cliente'})`)
    } else {
      setConflitto(null)
    }
  }

  useEffect(() => {
    Promise.all([
      supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single(),
      supabase.from('rooms').select('*').eq('active', true),
    ]).then(([{ data: b }, { data: r }]) => {
      setBooking(b)
      setEditForm(b ? {
        room_id: b.room_id, check_in: b.check_in, check_out: b.check_out,
        check_in_time: b.check_in_time || '',
        num_guests: b.num_guests, extra_bed: b.extra_bed, price_per_night: Number(b.price_per_night),
        notes: b.notes || '',
        guest_name: b.guests?.full_name || '',
        guest_phone: b.guests?.phone || '',
        guest_email: b.guests?.email || '',
      } : {})
      const sorted = (r || []).sort((a, b) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      setLoading(false)
    })
  }, [id])

  function calcNotti(cin: string, cout: string) {
    if (!cin || !cout) return 0
    return Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
  }

  function calcTotal() {
    const n = calcNotti(editForm.check_in, editForm.check_out)
    if (n <= 0) return 0
    const room = rooms.find(r => r.id === editForm.room_id)
    const extraBedTotal = editForm.extra_bed && room ? Number(room.extra_bed_price) * n : 0
    return Number(editForm.price_per_night) * n + extraBedTotal
  }

  async function saveEdit() {
    setSaving(true)
    const n = calcNotti(editForm.check_in, editForm.check_out)
    const room = rooms.find(r => r.id === editForm.room_id)
    const extraBedTotal = editForm.extra_bed && room ? Number(room.extra_bed_price) * n : 0
    const total = calcTotal()
    const updates = {
      room_id: editForm.room_id,
      check_in: editForm.check_in,
      check_out: editForm.check_out,
      num_guests: editForm.num_guests,
      extra_bed: editForm.extra_bed,
      price_per_night: editForm.price_per_night,
      extra_bed_total: extraBedTotal,
      total_amount: total,
      check_in_time: editForm.check_in_time || null,
      notes: editForm.notes || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('bookings').update(updates).eq('id', id)
    const guestId = booking.guest_id || booking.guests?.id
    if (guestId) {
      await supabase.from('guests').update({
        full_name: editForm.guest_name || booking.guests?.full_name || null,
        phone: editForm.guest_phone || booking.guests?.phone || null,
        email: editForm.guest_email || booking.guests?.email || null,
      }).eq('id', guestId)
    }
    const { data: updated } = await supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single()
    setBooking(updated)
    setEditing(false)
    setSaving(false)
  }

  async function markComplete() {
    await supabase.from('bookings').update({ status: 'completata' }).eq('id', id)
    setBooking({ ...booking, status: 'completata' })
  }

  async function cancelBooking() {
    await supabase.from('bookings').update({ status: 'annullata', cancelled_at: new Date().toISOString(), cancelled_reason: cancelReason }).eq('id', id)
    const msg = buildWhatsappMsg(booking, 'annullamento')
    await supabase.from('booking_whatsapp_log').insert({ booking_id: id, message_type: 'annullamento', message_text: msg, sent: false })
    setBooking({ ...booking, status: 'annullata' })
    setShowCancel(false)
  }

  function sendWhatsapp(type: 'conferma' | 'modifica' | 'annullamento') {
    const phone = booking.guests?.phone?.replace(/\D/g, '')
    const msg = buildWhatsappMsg(booking, type)
    supabase.from('booking_whatsapp_log').insert({ booking_id: id, message_type: type, message_text: msg, sent: false })
    const a = document.createElement('a')
    a.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (loading) return <div className="p-4 text-center py-10 text-gray-400">Caricamento...</div>
  if (!booking) return <div className="p-4 text-center py-10 text-gray-400">Prenotazione non trovata</div>

  const notti = calcNotti(booking.check_in, booking.check_out)
  const guest = booking.guests
  const selectedRoom = rooms.find(r => r.id === editForm.room_id)

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-blue-600 text-sm">← Indietro</button>
        <h1 className="text-xl font-bold flex-1">Prenotazione</h1>
        {editing && (
          <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annulla</button>
        )}
      </div>

      {/* MODALITÀ MODIFICA */}
      {editing ? (
        <div className="bg-white rounded-xl p-4 border border-blue-200 mb-4">
          <p className="font-semibold mb-3 text-blue-700">✏️ Modifica prenotazione</p>

          <p className="text-xs text-gray-500 mb-1">Nome cliente</p>
          <input value={editForm.guest_name} onChange={e => setEditForm({ ...editForm, guest_name: e.target.value })}
            placeholder="Nome e cognome" className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-sm" />

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Telefono</p>
              <input value={editForm.guest_phone} onChange={e => setEditForm({ ...editForm, guest_phone: e.target.value })}
                placeholder="+39..." className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <input value={editForm.guest_email} onChange={e => setEditForm({ ...editForm, guest_email: e.target.value })}
                placeholder="email@..." className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-1">Camera</p>
          <select value={editForm.room_id} onChange={e => {
            const room = rooms.find(r => r.id === e.target.value)
            const newRoomId = e.target.value
            setEditForm({ ...editForm, room_id: newRoomId, price_per_night: room ? Number(room.base_price) : editForm.price_per_night })
            checkDisponibilita(newRoomId, editForm.check_in, editForm.check_out)
          }} className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-sm">
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Check-in</p>
              <input type="date" value={editForm.check_in} onChange={e => {
                setEditForm({ ...editForm, check_in: e.target.value })
                checkDisponibilita(editForm.room_id, e.target.value, editForm.check_out)
              }} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Check-out</p>
              <input type="date" value={editForm.check_out} onChange={e => {
                setEditForm({ ...editForm, check_out: e.target.value })
                checkDisponibilita(editForm.room_id, editForm.check_in, e.target.value)
              }} className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">🕐 Orario arrivo (opzionale)</p>
            <input type="time" value={editForm.check_in_time} onChange={e => setEditForm({ ...editForm, check_in_time: e.target.value })}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">N° ospiti</p>
              <input type="number" min={1} max={4} value={editForm.num_guests} onChange={e => setEditForm({ ...editForm, num_guests: parseInt(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Tariffa/notte €</p>
              <input type="number" min={0} value={editForm.price_per_night} onChange={e => setEditForm({ ...editForm, price_per_night: parseFloat(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>
          </div>

          {selectedRoom?.has_extra_bed && (
            <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3 mb-3 border border-orange-100">
              <div>
                <p className="text-sm font-semibold text-orange-800">🛏 Letto aggiuntivo</p>
                <p className="text-xs text-orange-600">+€{selectedRoom.extra_bed_price}/notte</p>
              </div>
              <button onClick={() => setEditForm({ ...editForm, extra_bed: !editForm.extra_bed })}
                className={`w-12 h-6 rounded-full transition-colors ${editForm.extra_bed ? 'bg-orange-500' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.extra_bed ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          )}

          {selectedRoom?.matrimoniale_price != null && (
            <div className="flex items-center justify-between bg-pink-50 rounded-lg p-3 mb-3 border border-pink-100">
              <div>
                <p className="text-sm font-semibold text-pink-800">💑 Uso matrimoniale</p>
                <p className="text-xs text-pink-600">€{selectedRoom.matrimoniale_price}/notte</p>
              </div>
              <button onClick={() => {
                const isMatr = editForm.price_per_night === Number(selectedRoom.matrimoniale_price)
                setEditForm({ ...editForm, price_per_night: isMatr ? Number(selectedRoom.base_price) : Number(selectedRoom.matrimoniale_price) })
              }}
                className={`w-12 h-6 rounded-full transition-colors ${editForm.price_per_night === Number(selectedRoom.matrimoniale_price) ? 'bg-pink-500' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.price_per_night === Number(selectedRoom.matrimoniale_price) ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          )}

          <input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
            placeholder="Note (opzionale)" className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-3" />

          {calcNotti(editForm.check_in, editForm.check_out) > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 mb-3 text-sm">
              <p className="text-gray-600">{calcNotti(editForm.check_in, editForm.check_out)} notti × €{editForm.price_per_night}</p>
              <p className="font-bold text-blue-700 text-lg">Totale: €{calcTotal().toFixed(0)}</p>
            </div>
          )}

          {conflitto && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-700 font-semibold">
              {conflitto}
            </div>
          )}

          <button onClick={saveEdit} disabled={saving || !!conflitto}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
            {saving ? 'Salvataggio...' : '💾 Salva modifiche'}
          </button>
        </div>
      ) : (
        /* VISUALIZZAZIONE NORMALE */
        <div className={`rounded-xl p-4 border mb-4 ${booking.extra_bed ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-bold text-lg">{guest?.full_name || guest?.phone}</p>
              <p className="text-gray-500">{booking.rooms?.name}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${booking.status === 'confermata' ? 'bg-green-100 text-green-700' : booking.status === 'annullata' ? 'bg-red-100 text-red-700' : booking.status === 'completata' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
              {booking.status}
            </span>
          </div>
          {booking.check_in_time && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
              <span className="text-2xl">🕐</span>
              <div>
                <p className="text-xs text-blue-500 font-medium">Orario arrivo previsto</p>
                <p className="text-xl font-bold text-blue-700">{booking.check_in_time}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div><span className="text-gray-500">Check-in</span><p className="font-semibold">{booking.check_in}</p></div>
            <div><span className="text-gray-500">Check-out</span><p className="font-semibold">{booking.check_out}</p></div>
            <div><span className="text-gray-500">Notti</span><p className="font-semibold">{notti}</p></div>
            <div><span className="text-gray-500">Ospiti</span><p className="font-semibold">{booking.num_guests}</p></div>
            <div><span className="text-gray-500">Tariffa/notte</span><p className="font-semibold">€{Number(booking.price_per_night).toFixed(0)}</p></div>
            <div><span className="text-gray-500">Totale</span><p className="font-bold text-blue-600">€{Number(booking.total_amount).toFixed(0)}</p></div>
          </div>
          {booking.extra_bed && (
            <div className="bg-orange-100 rounded-lg p-2 text-sm text-orange-800 mb-2">
              🛏 Letto aggiuntivo: +€{Number(booking.extra_bed_total).toFixed(0)} totale
            </div>
          )}
          {booking.notes && <p className="text-sm text-gray-600 italic">📝 {booking.notes}</p>}
          {booking.status === 'annullata' && booking.cancelled_reason && (
            <p className="text-sm text-red-500 mt-2">Motivo: {booking.cancelled_reason}</p>
          )}
        </div>
      )}

      {/* Bottone Modifica prenotazione */}
      {!editing && booking.status !== 'annullata' && (
        <button onClick={() => setEditing(true)} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold mb-4">
          ✏️ Modifica prenotazione
        </button>
      )}

      {/* Dati cliente */}
      {!editing && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold">Cliente</p>
            <div className="flex gap-3">
              <Link href={`/clienti/${guest?.id}?edit=1`} className="text-blue-600 text-sm">✏️ Modifica</Link>
              <Link href={`/clienti/${guest?.id}`} className="text-blue-600 text-sm">Storico →</Link>
            </div>
          </div>
          <p className="text-sm text-gray-600">📞 {guest?.phone}</p>
          {guest?.email && <p className="text-sm text-gray-600">✉️ {guest.email}</p>}
          {guest?.rating && guest.rating !== 'normale' && (
            <p className="text-sm font-semibold mt-1">{RATING_LABEL[guest.rating]}</p>
          )}
        </div>
      )}

      {/* Azioni */}
      {!editing && booking.status === 'confermata' && (
        <div className="flex flex-col gap-2 mb-4">
          <button onClick={markComplete} className="bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold">✓ Segna come completata</button>
          <button onClick={() => setShowCancel(true)} className="bg-red-50 text-red-500 rounded-xl py-3 font-semibold">Annulla prenotazione</button>
        </div>
      )}

      {/* WhatsApp */}
      {!editing && booking.guests?.phone && (() => {
        const phone = booking.guests.phone.replace(/\D/g, '')
        const waLink = (type: 'conferma' | 'modifica' | 'annullamento') =>
          `whatsapp://send?phone=${phone}&text=${encodeURIComponent(buildWhatsappMsg(booking, type))}`
        return (
          <div className="bg-green-50 rounded-xl p-4 border border-green-100 mb-4">
            <p className="font-semibold text-green-800 mb-2">💬 Invia WhatsApp</p>
            <div className="flex flex-col gap-2">
              <a href={waLink('conferma')} target="_blank" rel="noopener noreferrer" className="block text-center bg-green-500 text-white rounded-lg py-2 text-sm font-semibold">✅ Conferma prenotazione</a>
              <a href={waLink('modifica')} target="_blank" rel="noopener noreferrer" className="block text-center bg-blue-500 text-white rounded-lg py-2 text-sm font-semibold">✏️ Modifica prenotazione</a>
              <a href={waLink('annullamento')} target="_blank" rel="noopener noreferrer" className="block text-center bg-red-400 text-white rounded-lg py-2 text-sm font-semibold">❌ Annullamento</a>
            </div>
            <p className="text-xs text-green-700 mt-2">Il messaggio si apre in WhatsApp — sei tu a decidere se inviarlo</p>
          </div>
        )
      })()}

      {showCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowCancel(false)}>
          <div className="bg-white rounded-t-2xl p-4 w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Motivo annullamento</h2>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Es. cliente ha cancellato..." className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-sm" />
            <button onClick={cancelBooking} className="w-full bg-red-500 text-white rounded-xl py-3 font-semibold mb-2">Conferma annullamento</button>
            <button onClick={() => setShowCancel(false)} className="w-full text-gray-500 py-2 text-sm">Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}
