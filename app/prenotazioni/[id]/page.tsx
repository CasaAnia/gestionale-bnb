'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const RATING_LABEL: Record<string, string> = { ottimo: '⭐ Ottimo', problematico: '⚠️ Problematico', vuole_ricevuta: '🧾 Vuole ricevuta', normale: '👤 Normale' }
const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

function normalizePhone(p: string) {
  const raw = p.trim().replace(/\D/g, '')
  return raw.startsWith('39') ? raw : `39${raw}`
}

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

function roomPageLink(roomName: string): string | null {
  if (roomName.includes('Amelia')) return 'https://www.casaaniarozzano.it/camere/singola'
  if (roomName.includes('Allegra')) return 'https://www.casaaniarozzano.it/camere/allegra'
  if (roomName.includes('Ambra')) return 'https://www.casaaniarozzano.it/camere/ambra'
  if (roomName.includes('Lena')) return 'https://www.casaaniarozzano.it/camere/lena'
  return null
}

function buildWhatsappMsg(b: any, type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto', gruppo: any[] = []) {
  const name = b.guests?.full_name || 'Ospite'
  const room = b.rooms?.name || ''
  const isGruppo = gruppo.length > 1

  // Per soggiorno con cambio camera usa il gruppo ordinato per check_in
  const segmenti = isGruppo ? [...gruppo].sort((a, z) => a.check_in.localeCompare(z.check_in)) : [b]
  const cin = segmenti[0].check_in
  const cout = segmenti[segmenti.length - 1].check_out
  const totaleNum = isGruppo ? segmenti.reduce((s, x) => s + Number(x.total_amount), 0) : Number(b.total_amount)
  const notti = Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
  const totale = totaleNum.toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const numOspiti = b.num_guests || 1
  const ospiti = `${numOspiti} ${numOspiti === 1 ? 'adulto' : 'adulti'}`
  const cinF = formatDateIT(cin)
  const coutF = formatDateIT(cout)
  const bagno = bagnoDesc(b.rooms)

  const isLena = room.includes('Lena')
  const roomLink = roomPageLink(room)

  // Riepilogo camere per soggiorno con cambio camera
  const riepilogoCamere = isGruppo ? segmenti.map((s, i) => {
    const n = Math.round((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 86400000)
    return `   ${i + 1}. *${s.rooms?.name || 'Camera'}*: ${formatDateIT(s.check_in)} → ${formatDateIT(s.check_out)} (${n} notti) – €${Number(s.price_per_night).toFixed(0)}/notte`
  }).join('\n') : ''

  const paymentLine = b.bonifico
    ? `💶 Importo totale: *€ ${totale}* – pagamento tramite bonifico bancario.

Per completare la prenotazione, la prego di effettuare il bonifico con i seguenti dati:
Intestatario: *SAWICKA ANNA JANINA*
Banca: *BANCO BPM*
IBAN: *IT32P0503401753000000159653*
Causale: Soggiorno Casa Granata Humanitas – ${name} – dal ${cin} al ${cout}`
    : `💶 Importo totale: *€ ${totale}* – pagamento all'arrivo. Alla consegna delle chiavi verrà chiesto pagamento per l'intera prenotazione in contante oppure tramite bonifico bancario istantaneo.`

  if (type === 'conferma') {
    return `CONFERMA DI PRENOTAZIONE – Casa Granata Humanitas

Gentile *${name}*,
grazie per aver scelto Casa Granata. Sono lieta di confermarle il soggiorno e la aspetto con piacere!

ℹ️ Info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

RIEPILOGO SOGGIORNO
📅 Check-in: *${cinF}* (dalle ore 15:00 alle 20:00)
📅 Check-out: *${coutF}* (entro le ore 10:00)
👥 Ospiti: ${ospiti}
${isGruppo ? `🛏️ Camere (cambio camera durante il soggiorno):\n${riepilogoCamere}` : `🛏️ Camera: ${room}${b.extra_bed && (!isLena || b.num_guests >= 4) ? ' + letto aggiuntivo' : ''}\n${isLena ? '🚿 Bagno: *privato esterno, chiuso a chiave, a circa 1 metro dalla camera*' : (bagno ? `🚿 Bagno: ${bagno}` : '')}${roomLink ? `\n👁 Vedi la tua camera: ${roomLink}` : ''}`}
Notti totali: *${notti}*

${paymentLine}

*Appena le sarà possibile, la prego di farmi sapere l'orario di arrivo in struttura, per organizzare al meglio la sua accoglienza.*

📍 COME RAGGIUNGERCI
Via Liguria 26 – Fizzonasco, Pieve Emanuele (MI) 20072
*A 140 metri dalla palazzina 8 di Humanitas di Rozzano – ortopedia*

• WiFi gratuito (credenziali in camera)
• Ricordarsi documento d'identità valido
• Fumo solo all'esterno

📞 CONTATTI
Per qualsiasi necessità sono sempre disponibile:
📱 342 700 4354 (anche WhatsApp)

POLITICA DI CANCELLAZIONE
Cancellazione gratuita fino a 3 giorni prima dell'arrivo.

Sarà un piacere accoglierla! 🏡

A presto,
Ania
Casa Granata Humanitas`
  }

  if (type === 'modifica') {
    return `MODIFICA PRENOTAZIONE – Casa Granata Humanitas

Gentile *${name}*,
la informo che la sua prenotazione presso Casa Granata Humanitas è stata modificata. Ecco il riepilogo aggiornato:

RIEPILOGO SOGGIORNO
📅 Check-in: *${cinF}* (dalle ore 15:00 alle 20:00)
📅 Check-out: *${coutF}* (entro le ore 10:00)
👥 Ospiti: ${ospiti}
🛏️ Camera: ${room}${b.extra_bed && (!isLena || b.num_guests >= 4) ? ' + letto aggiuntivo' : ''}
${isLena ? '🚿 Bagno: *privato esterno, chiuso a chiave, a circa 1 metro dalla camera*' : (bagno ? `🚿 Bagno: ${bagno}` : '')}
Notti: *${notti}*

${paymentLine}

Per qualsiasi domanda resto a Sua disposizione.

📱 342 700 4354 (anche WhatsApp)

Tutte le info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

A presto,
Ania
Casa Granata Humanitas`
  }
  if (type === 'dati_bonifico') {
    return `Gentile *${name}*,
come da sua richiesta, le invio i dati per effettuare il pagamento tramite bonifico bancario:

Intestatario: *SAWICKA ANNA JANINA*
Banca: *BANCO BPM*
IBAN: *IT32P0503401753000000159653*
Causale: Soggiorno Casa Granata Humanitas – ${name} – dal ${cin} al ${cout}

Importo: *€ ${totale}*

Non appena ricevuto il bonifico le darò conferma. Per qualsiasi necessità sono sempre a disposizione.

Tutte le info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

A presto,
Ania
Casa Granata Humanitas`
  }

  if (type === 'pagamento_ricevuto') {
    return `Gentile *${name}*,
ho ricevuto il suo pagamento. La aspetto con piacere il *${cinF}*!

Per qualsiasi necessità sono sempre a disposizione.

Tutte le info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

A presto,
Ania
Casa Granata Humanitas`
  }

  return `CANCELLAZIONE PRENOTAZIONE – Casa Granata Humanitas

Gentile *${name}*,
la informo che la sua prenotazione presso Casa Granata Humanitas è stata annullata.

PRENOTAZIONE ANNULLATA
📅 Check-in: *${cinF}* (dalle ore 15:00 alle 20:00)
📅 Check-out: *${coutF}* (entro le ore 10:00)
👥 Ospiti: ${ospiti}
🛏️ Camera: ${room}
Notti: *${notti}*

💶 Importo totale: *€ ${totale}* – pagamento all'arrivo. Alla consegna delle chiavi verrà chiesto pagamento per l'intera prenotazione in contante oppure tramite bonifico bancario istantaneo.

Per qualsiasi chiarimento resto a Sua completa disposizione e sarò lieta di accoglierla in futuro.

📱 342 700 4354 (anche WhatsApp)

Cordiali saluti,
Ania
Casa Granata Humanitas`
}

// Prova ad aprire l'app WhatsApp (desktop o mobile) tramite lo schema whatsapp://,
// e ricade su wa.me (WhatsApp Web) se l'app non risponde entro 1 secondo.
function openWhatsApp(phone: string, text: string) {
  const encoded = encodeURIComponent(text)
  const appUrl = `whatsapp://send?phone=${phone}&text=${encoded}`
  const webUrl = `https://wa.me/${phone}?text=${encoded}`

  let handedOff = false
  const markHandedOff = () => { handedOff = true }
  document.addEventListener('visibilitychange', markHandedOff)
  window.addEventListener('blur', markHandedOff)

  window.location.href = appUrl

  setTimeout(() => {
    document.removeEventListener('visibilitychange', markHandedOff)
    window.removeEventListener('blur', markHandedOff)
    if (!handedOff) {
      window.open(webUrl, '_blank', 'noopener,noreferrer')
    }
  }, 1000)
}

export default function BookingDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [groupBookings, setGroupBookings] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const timeRef = useRef<HTMLInputElement>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [conflitto, setConflitto] = useState<string | null>(null)
  const [lettiOccupati, setLettiOccupati] = useState(0)
  const [extraBedsPerDay, setExtraBedsPerDay] = useState<Record<string, number>>({})
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

  async function checkDisponibilita(room_id: string, check_in: string, check_out: string) {
    if (!room_id || !check_in || !check_out) return
    const [{ data: conf }, { data: letti }] = await Promise.all([
      supabase.from('bookings')
        .select('id, check_in, check_out, rooms(name), guests(full_name)')
        .eq('room_id', room_id).neq('status', 'annullata').neq('id', id)
        .lt('check_in', check_out).gt('check_out', check_in),
      supabase.from('bookings')
        .select('id, room_id, num_guests, extra_bed_dates, check_in, check_out').eq('extra_bed', true).neq('status', 'annullata').neq('id', id)
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

  useEffect(() => {
    Promise.all([
      supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single(),
      supabase.from('rooms').select('*').eq('active', true),
    ]).then(([{ data: b }, { data: r }]) => {
      setBooking(b)
      setEditForm(b ? {
        room_id: b.room_id, check_in: b.check_in, check_out: b.check_out,
        check_in_time: b.check_in_time || '',
        num_guests: b.num_guests, extra_bed: b.extra_bed, extra_bed_dates: b.extra_bed_dates || (b.extra_bed ? getDaysBetween(b.check_in, b.check_out) : []), price_per_night: Number(b.price_per_night),
        notes: b.notes || '',
        color: b.color || '',
        bonifico: b.bonifico || false,
        pagato: b.pagato || false,
        extra_phone_1: b.extra_phone_1 || '',
        extra_phone_1_name: b.extra_phone_1_name || '',
        extra_phone_2: b.extra_phone_2 || '',
        extra_phone_2_name: b.extra_phone_2_name || '',
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
      // Carica le altre prenotazioni del gruppo (cambio camera)
      if (b?.group_id) {
        supabase.from('bookings')
          .select('*, rooms(*)')
          .eq('group_id', b.group_id)
          .neq('status', 'annullata')
          .order('check_in', { ascending: true })
          .then(({ data: grp }) => setGroupBookings(grp || []))
      }
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
    const ebDays = editForm.extra_bed_dates?.length || 0
    const extraBedTotal = room && ebDays > 0 ? Number(room.extra_bed_price) * ebDays : 0
    return Number(editForm.price_per_night) * n + extraBedTotal
  }

  async function saveEdit() {
    setSaving(true)
    const room = rooms.find(r => r.id === editForm.room_id)
    const ebDays = editForm.extra_bed_dates?.length || 0
    const extraBedTotal = room && ebDays > 0 ? Number(room.extra_bed_price) * ebDays : 0
    const total = calcTotal()
    const updates = {
      room_id: editForm.room_id,
      check_in: editForm.check_in,
      check_out: editForm.check_out,
      num_guests: editForm.num_guests,
      extra_bed: (editForm.extra_bed_dates?.length || 0) > 0,
      extra_bed_dates: editForm.extra_bed_dates || [],
      price_per_night: editForm.price_per_night,
      extra_bed_total: extraBedTotal,
      total_amount: total,
      check_in_time: editForm.check_in_time || null,
      notes: editForm.notes || null,
      color: editForm.color || null,
      bonifico: editForm.bonifico || false,
      pagato: editForm.pagato || false,
      extra_phone_1: editForm.extra_phone_1 ? normalizePhone(editForm.extra_phone_1) : null,
      extra_phone_1_name: editForm.extra_phone_1_name || null,
      extra_phone_2: editForm.extra_phone_2 ? normalizePhone(editForm.extra_phone_2) : null,
      extra_phone_2_name: editForm.extra_phone_2_name || null,
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

  async function addRoomChange() {
    let groupId = booking.group_id
    if (!groupId) {
      groupId = crypto.randomUUID()
      await supabase.from('bookings').update({ group_id: groupId }).eq('id', id)
      setBooking({ ...booking, group_id: groupId })
    }
    const lastCheckOut = groupBookings.length > 0
      ? [...groupBookings].sort((a, z) => z.check_out.localeCompare(a.check_out))[0].check_out
      : booking.check_out
    const guestId = booking.guest_id || booking.guests?.id
    router.push(`/nuova?guest_id=${guestId}&group_id=${groupId}&check_in=${lastCheckOut}`)
  }

  async function markComplete() {
    await supabase.from('bookings').update({ status: 'completata' }).eq('id', id)
    setBooking({ ...booking, status: 'completata' })
  }

  async function cancelBooking() {
    await supabase.from('bookings').update({ status: 'annullata', cancelled_at: new Date().toISOString(), cancelled_reason: cancelReason }).eq('id', id)
    const msg = buildWhatsappMsg(booking, 'annullamento', groupBookings)
    await supabase.from('booking_whatsapp_log').insert({ booking_id: id, message_type: 'annullamento', message_text: msg, sent: false })
    setBooking({ ...booking, status: 'annullata' })
    setShowCancel(false)
  }

  function sendWhatsapp(type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto') {
    const rawPhone = booking.guests?.phone?.replace(/\D/g, '')
    const phone = rawPhone?.startsWith('39') ? rawPhone : `39${rawPhone}`
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
        <button onClick={() => router.back()} className="text-green-mid text-sm">← Indietro</button>
        <h1 className="font-serif text-xl text-green-dark flex-1">Prenotazione</h1>
        {editing && (
          <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annulla</button>
        )}
      </div>

      {/* MODALITÀ MODIFICA */}
      {editing ? (
        <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
          <p className="font-semibold mb-3 text-green-mid">✏️ Modifica prenotazione</p>

          <p className="text-xs text-gray-500 mb-1">Nome cliente</p>
          <input value={editForm.guest_name} onChange={e => setEditForm({ ...editForm, guest_name: e.target.value })}
            placeholder="Nome e cognome" className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" />

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Telefono</p>
              <input value={editForm.guest_phone} onChange={e => setEditForm({ ...editForm, guest_phone: e.target.value })}
                placeholder="+39..." className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <input value={editForm.guest_email} onChange={e => setEditForm({ ...editForm, guest_email: e.target.value })}
                placeholder="email@..." className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-1">📞 Contatto 2 (ospite in struttura)</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={editForm.extra_phone_1} onChange={e => setEditForm({ ...editForm, extra_phone_1: e.target.value })}
              placeholder="+39..." className="w-full border border-card-border rounded-lg p-2 text-sm" type="tel" />
            <input value={editForm.extra_phone_1_name} onChange={e => setEditForm({ ...editForm, extra_phone_1_name: e.target.value })}
              placeholder="Nome (es. papà)" className="w-full border border-card-border rounded-lg p-2 text-sm" />
          </div>

          <p className="text-xs text-gray-500 mb-1">📞 Contatto 3</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input value={editForm.extra_phone_2} onChange={e => setEditForm({ ...editForm, extra_phone_2: e.target.value })}
              placeholder="+39..." className="w-full border border-card-border rounded-lg p-2 text-sm" type="tel" />
            <input value={editForm.extra_phone_2_name} onChange={e => setEditForm({ ...editForm, extra_phone_2_name: e.target.value })}
              placeholder="Nome (opzionale)" className="w-full border border-card-border rounded-lg p-2 text-sm" />
          </div>

          <p className="text-xs text-gray-500 mb-1">Camera</p>
          <select value={editForm.room_id} onChange={e => {
            const room = rooms.find(r => r.id === e.target.value)
            const newRoomId = e.target.value
            setEditForm({ ...editForm, room_id: newRoomId, price_per_night: room ? Number(room.base_price) : editForm.price_per_night })
            checkDisponibilita(newRoomId, editForm.check_in, editForm.check_out)
          }} className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm">
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Check-in</p>
              <input type="date" value={editForm.check_in} onChange={e => {
                setEditForm({ ...editForm, check_in: e.target.value })
                checkDisponibilita(editForm.room_id, e.target.value, editForm.check_out)
              }} className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Check-out</p>
              <input type="date" value={editForm.check_out} onChange={e => {
                setEditForm({ ...editForm, check_out: e.target.value })
                checkDisponibilita(editForm.room_id, editForm.check_in, e.target.value)
              }} className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">🕐 Orario arrivo (es. 15:30)</p>
            <input type="text" inputMode="numeric" placeholder="HH:MM"
              value={editForm.check_in_time}
              onChange={e => {
                let v = e.target.value.replace(/[^0-9:]/g, '')
                if (v.length === 2 && !v.includes(':') && editForm.check_in_time.length === 1) v = v + ':'
                setEditForm({ ...editForm, check_in_time: v })
              }}
              maxLength={5}
              className="w-full border border-card-border rounded-lg p-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">N° ospiti</p>
              <input type="number" min={1} max={4} value={editForm.num_guests} onChange={e => {
                const n = parseInt(e.target.value)
                const room = rooms.find(r => r.id === editForm.room_id)
                const nativeCapacity = room?.name === 'Amelia' ? 1 : 2
                const autoLetto = room?.has_extra_bed && n > nativeCapacity
                const autoPrice = room?.double_price
                  ? (room.has_extra_bed ? (n >= 3 ? Number(room.double_price) : Number(room.base_price)) : (n >= 2 ? Number(room.double_price) : Number(room.base_price)))
                  : (room ? Number(room.base_price) : editForm.price_per_night)
                const autoDates = autoLetto ? getDaysBetween(editForm.check_in, editForm.check_out) : []
                setEditForm({ ...editForm, num_guests: n, extra_bed: autoLetto, extra_bed_dates: autoDates, price_per_night: autoPrice })
              }} className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Tariffa/notte €</p>
              <input type="number" min={0} value={editForm.price_per_night} onChange={e => setEditForm({ ...editForm, price_per_night: parseFloat(e.target.value) })}
                className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
          </div>

          {selectedRoom?.has_extra_bed && (
            <>
              <div className="flex items-center justify-between bg-[#F1E0CE] rounded-lg p-3 mb-1 border border-[#E7CDAE]">
                <div>
                  <p className="text-sm font-semibold text-[#7A4B22]">🛏 Letto aggiuntivo</p>
                  <p className="text-xs text-[#7A4B22]">+€{selectedRoom.extra_bed_price}/notte</p>
                </div>
                <button onClick={() => {
                  const newVal = !editForm.extra_bed
                  setEditForm({ ...editForm, extra_bed: newVal, extra_bed_dates: newVal ? getDaysBetween(editForm.check_in, editForm.check_out) : [] })
                }}
                  className={`w-12 h-6 rounded-full transition-colors ${editForm.extra_bed ? 'bg-[#C58A67]' : 'bg-gray-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.extra_bed ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              {editForm.extra_bed && editForm.check_in && editForm.check_out && (
                <div className="mt-2 mb-1">
                  <p className="text-xs text-gray-500 mb-1.5">Seleziona i giorni con letto extra:</p>
                  <div className="flex flex-wrap gap-1">
                    {getDaysBetween(editForm.check_in, editForm.check_out).map((day: string) => {
                      const [y, m, d] = day.split('-').map(Number)
                      const date = new Date(y, m - 1, d)
                      const isSelected = (editForm.extra_bed_dates || []).includes(day)
                      const thisContrib = editForm.room_id === LENA_ID && editForm.num_guests >= 4 ? 2 : 1
                      const othersOnDay = extraBedsPerDay[day] || 0
                      const isBlocked = othersOnDay + thisContrib > 2
                      return (
                        <button key={day} disabled={isBlocked && !isSelected}
                          onClick={() => {
                            const dates = isSelected
                              ? (editForm.extra_bed_dates || []).filter((x: string) => x !== day)
                              : [...(editForm.extra_bed_dates || []), day]
                            setEditForm({ ...editForm, extra_bed_dates: dates })
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
              <div className="mb-3" />
            </>
          )}

          {selectedRoom?.matrimoniale_price != null && (
            <div className="flex items-center justify-between bg-[#EFEAF7] rounded-lg p-3 mb-3 border border-[#D9D0EA]">
              <div>
                <p className="text-sm font-semibold text-[#5B4E82]">💑 Uso matrimoniale</p>
                <p className="text-xs text-[#5B4E82]">€{selectedRoom.matrimoniale_price}/notte</p>
              </div>
              <button onClick={() => {
                const isMatr = editForm.price_per_night === Number(selectedRoom.matrimoniale_price)
                setEditForm({ ...editForm, price_per_night: isMatr ? Number(selectedRoom.base_price) : Number(selectedRoom.matrimoniale_price) })
              }}
                className={`w-12 h-6 rounded-full transition-colors ${editForm.price_per_night === Number(selectedRoom.matrimoniale_price) ? 'bg-[#9B8EC4]' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.price_per_night === Number(selectedRoom.matrimoniale_price) ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          )}

          <input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
            placeholder="Note (opzionale)" className="w-full border border-card-border rounded-lg p-2 text-sm mb-3" />

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Colore sul calendario</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: '', label: 'Auto', bg: '#22c55e' },
                { value: '#1f2937', label: 'Nero', bg: '#1f2937' },
                { value: '#3b82f6', label: 'Blu', bg: '#3b82f6' },
                { value: '#a855f7', label: 'Viola', bg: '#a855f7' },
                { value: '#f97316', label: '🔒 Esclusiva', bg: '#f97316' },
                { value: '#ec4899', label: 'Rosa', bg: '#ec4899' },
                { value: '#eab308', label: 'Giallo', bg: '#eab308' },
              ].map(c => (
                <button key={c.value} onClick={() => setEditForm({ ...editForm, color: c.value })}
                  title={c.label}
                  style={{ background: c.bg, width: 28, height: 28, borderRadius: '50%', border: editForm.color === c.value ? '3px solid #1f2937' : '2px solid transparent', outline: editForm.color === c.value ? '2px solid white' : 'none', outlineOffset: -4 }} />
              ))}
            </div>
          </div>

          <div onClick={() => setEditForm({ ...editForm, bonifico: !editForm.bonifico })}
            className="flex items-center justify-between bg-sage rounded-lg p-3 mb-2 border border-card-border cursor-pointer active:opacity-70">
            <div>
              <p className="text-sm font-semibold text-green-dark">🏦 Pagamento tramite bonifico</p>
              <p className="text-xs text-green-mid">La conferma includerà l'IBAN</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center ${editForm.bonifico ? 'bg-green-mid' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.bonifico ? 'translate-x-6' : ''}`} />
            </div>
          </div>

          <div onClick={() => setEditForm({ ...editForm, pagato: !editForm.pagato })}
            className="flex items-center justify-between bg-[#EAF0F3] rounded-lg p-3 mb-3 border border-[#D7E3E8] cursor-pointer active:opacity-70">
            <div>
              <p className="text-sm font-semibold text-[#3D5A66]">✅ Pagato</p>
              <p className="text-xs text-[#3D5A66]">Segna come pagamento ricevuto</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center ${editForm.pagato ? 'bg-[#7D9DB0]' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.pagato ? 'translate-x-6' : ''}`} />
            </div>
          </div>

          {calcNotti(editForm.check_in, editForm.check_out) > 0 && (
            <div className="bg-sage rounded-lg p-3 mb-3 text-sm">
              <p className="text-gray-600">{calcNotti(editForm.check_in, editForm.check_out)} notti × €{editForm.price_per_night}</p>
              <p className="font-bold text-green-mid text-lg">Totale: €{calcTotal().toFixed(0)}</p>
            </div>
          )}

          {conflitto && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-3 text-sm text-[#8C3B2E] font-semibold">
              {conflitto}
            </div>
          )}

          <button onClick={saveEdit} disabled={saving || !!conflitto || ((editForm.extra_bed_dates?.length > 0) && (editForm.extra_bed_dates || []).some((day: string) => { const contrib = editForm.room_id === LENA_ID && editForm.num_guests >= 4 ? 2 : 1; return (extraBedsPerDay[day] || 0) + contrib > 2 }))}
            className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50 mb-3">
            {saving ? 'Salvataggio...' : '💾 Salva modifiche'}
          </button>
          <button onClick={() => setEditing(false)}
            className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 font-semibold">
            Annulla modifiche
          </button>
        </div>
      ) : (
        /* VISUALIZZAZIONE NORMALE */
        <div className={`rounded-xl p-4 border mb-4 ${booking.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-white border-card-border'}`}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-bold text-lg">{guest?.full_name || guest?.phone}</p>
              <p className="text-gray-500">{booking.rooms?.name}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${booking.status === 'confermata' ? 'bg-sage text-green-dark' : booking.status === 'annullata' ? 'bg-[#F6E4DE] text-[#8C3B2E]' : booking.status === 'completata' ? 'bg-gray-100 text-gray-600' : 'bg-[#F1E0CE] text-[#7A4B22]'}`}>
              {booking.status}
            </span>
          </div>
          {booking.check_in_time && (
            <div className="bg-sage border border-card-border rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
              <span className="text-2xl">🕐</span>
              <div>
                <p className="text-xs text-green-mid font-medium">Orario arrivo previsto</p>
                <p className="font-serif text-xl text-green-dark">{booking.check_in_time}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div><span className="text-gray-500">Check-in</span><p className="font-semibold">{booking.check_in}</p></div>
            <div><span className="text-gray-500">Check-out</span><p className="font-semibold">{booking.check_out}</p></div>
            <div><span className="text-gray-500">Notti</span><p className="font-semibold">{notti}</p></div>
            <div><span className="text-gray-500">Ospiti</span><p className="font-semibold">{booking.num_guests}</p></div>
            <div><span className="text-gray-500">Tariffa/notte</span><p className="font-semibold">€{Number(booking.price_per_night).toFixed(0)}</p></div>
            <div><span className="text-gray-500">Totale</span><p className="font-bold text-green-mid">€{Number(booking.total_amount).toFixed(0)}</p></div>
          </div>
          {booking.extra_bed && (
            <div className="bg-[#F1E0CE] rounded-lg p-2 text-sm text-[#7A4B22] mb-2">
              🛏 Letto aggiuntivo: +€{Number(booking.extra_bed_total).toFixed(0)} totale
            </div>
          )}
          {booking.bonifico && (
            <div className={`rounded-lg p-2 text-sm mb-2 ${booking.pagato ? 'bg-[#EAF0F3] text-[#3D5A66]' : 'bg-sage text-green-dark'}`}>
              🏦 Bonifico{booking.pagato ? ' – ✅ Pagato' : ' – in attesa di pagamento'}
            </div>
          )}
          {booking.notes && <p className="text-sm text-gray-600 italic">📝 {booking.notes}</p>}
          {groupBookings.length > 1 && (
            <div className="mt-3 bg-[#EFEAF7] border border-[#D9D0EA] rounded-xl p-3">
              <p className="text-xs font-bold text-[#5B4E82] mb-2">🔄 SOGGIORNO CON CAMBIO CAMERA</p>
              {[...groupBookings].sort((a, z) => a.check_in.localeCompare(z.check_in)).map((gb, i) => {
                const isCurrent = gb.id === id
                const n = Math.round((new Date(gb.check_out).getTime() - new Date(gb.check_in).getTime()) / 86400000)
                return (
                  <div key={gb.id} className={`flex items-center gap-2 py-1 ${i > 0 ? 'border-t border-[#D9D0EA]' : ''}`}>
                    <span className="text-[#5B4E82] text-xs">{i + 1}.</span>
                    <div className="flex-1">
                      <span className={`text-sm font-semibold ${isCurrent ? 'text-[#4A3F6B]' : 'text-[#5B4E82]'}`}>{gb.rooms?.name}</span>
                      <span className="text-xs text-[#5B4E82] ml-2">{gb.check_in} → {gb.check_out} ({n} notti) · €{Number(gb.price_per_night).toFixed(0)}/notte</span>
                    </div>
                    {isCurrent
                      ? <span className="text-xs bg-[#EFEAF7] text-[#4A3F6B] px-2 py-0.5 rounded-full font-bold">qui</span>
                      : <button onClick={() => router.push(`/prenotazioni/${gb.id}`)} className="text-xs text-[#5B4E82] underline">apri</button>
                    }
                  </div>
                )
              })}
              <p className="text-xs text-[#5B4E82] font-semibold mt-2 pt-2 border-t border-[#D9D0EA]">
                Totale soggiorno: €{groupBookings.reduce((s, x) => s + Number(x.total_amount), 0).toFixed(0)}
              </p>
            </div>
          )}
          {(booking.status === 'confermata' || booking.status === 'in_attesa') && (
            <button onClick={addRoomChange} className="w-full mt-3 bg-[#9B8EC4] text-white font-semibold text-sm py-2 rounded-xl">
              ➕ Aggiungi cambio camera
            </button>
          )}
          {booking.status === 'annullata' && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Motivo annullamento</p>
              <div className="flex gap-2">
                <input
                  defaultValue={booking.cancelled_reason || ''}
                  id="cancel-reason-input"
                  placeholder="Aggiungi motivo..."
                  className="flex-1 border border-card-border rounded-lg p-2 text-sm text-[#8C3B2E]"
                />
                <button onClick={async () => {
                  const val = (document.getElementById('cancel-reason-input') as HTMLInputElement)?.value
                  await supabase.from('bookings').update({ cancelled_reason: val }).eq('id', id)
                  setBooking({ ...booking, cancelled_reason: val })
                }} className="bg-[#F6E4DE] text-[#8C3B2E] px-3 py-2 rounded-lg text-sm font-semibold">
                  Salva
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottone Modifica prenotazione */}
      {!editing && booking.status !== 'annullata' && (
        <button onClick={() => setEditing(true)} className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold mb-4">
          ✏️ Modifica prenotazione
        </button>
      )}

      {/* Dati cliente */}
      {!editing && (
        <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold">Cliente</p>
            <div className="flex gap-3">
              <Link href={`/clienti/${guest?.id}?edit=1`} className="text-green-mid text-sm">✏️ Modifica</Link>
              <Link href={`/clienti/${guest?.id}`} className="text-green-mid text-sm">Storico →</Link>
            </div>
          </div>
          <p className="text-sm text-gray-600">📞 {guest?.phone}</p>
          {guest?.email && <p className="text-sm text-gray-600">✉️ {guest.email}</p>}
          {guest?.rating && guest.rating !== 'normale' && (
            <p className="text-sm font-semibold mt-1">{RATING_LABEL[guest.rating]}</p>
          )}
          {booking.extra_phone_1 && (
            <p className="text-sm text-gray-600 mt-1">📞 {booking.extra_phone_1}{booking.extra_phone_1_name ? ` – ${booking.extra_phone_1_name}` : ''}</p>
          )}
          {booking.extra_phone_2 && (
            <p className="text-sm text-gray-600">📞 {booking.extra_phone_2}{booking.extra_phone_2_name ? ` – ${booking.extra_phone_2_name}` : ''}</p>
          )}
        </div>
      )}

      {/* Quick pagato toggle */}
      {!editing && booking.bonifico && !booking.pagato && booking.status !== 'annullata' && (
        <button onClick={async () => {
          await supabase.from('bookings').update({ pagato: true }).eq('id', id)
          setBooking({ ...booking, pagato: true })
        }} className="w-full bg-[#7D9DB0] text-white rounded-xl py-3 font-semibold mb-4">
          ✅ Segna come pagato
        </button>
      )}

      {/* Azioni */}
      {!editing && (booking.status === 'confermata' || booking.status === 'completata' || booking.status === 'in_attesa') && (
        <div className="flex flex-col gap-2 mb-4">
          {booking.status === 'confermata' && (
            <button onClick={markComplete} className="bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold">✓ Segna come completata</button>
          )}
          <button onClick={() => setShowCancel(true)} className="bg-[#F6E4DE] text-[#8C3B2E] rounded-xl py-3 font-semibold">Annulla prenotazione</button>
        </div>
      )}

      {/* WhatsApp */}
      {!editing && booking.guests?.phone && (() => {
        const rawPhone = booking.guests.phone.replace(/\D/g, '')
        const phone = rawPhone.startsWith('39') ? rawPhone : `39${rawPhone}`
        const waHref = (type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto') =>
          `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsappMsg(booking, type, groupBookings))}`
        const waClick = (type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto') =>
          (e: React.MouseEvent) => {
            e.preventDefault()
            openWhatsApp(phone, buildWhatsappMsg(booking, type, groupBookings))
          }
        const buttons = (
          <div className="flex flex-col gap-2">
            <a href={waHref('conferma')} onClick={waClick('conferma')} target="_blank" rel="noopener noreferrer" className="block text-center bg-green-mid text-white rounded-lg py-2 text-sm font-semibold">✅ Conferma prenotazione</a>
            <a href={waHref('modifica')} onClick={waClick('modifica')} target="_blank" rel="noopener noreferrer" className="block text-center bg-green-mid text-white rounded-lg py-2 text-sm font-semibold">✏️ Modifica prenotazione</a>
            <a href={waHref('dati_bonifico')} onClick={waClick('dati_bonifico')} target="_blank" rel="noopener noreferrer" className="block text-center bg-green-mid text-white rounded-lg py-2 text-sm font-semibold">🏦 Dati bonifico</a>
            <a href={waHref('pagamento_ricevuto')} onClick={waClick('pagamento_ricevuto')} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-2 text-sm font-semibold">💸 Pagamento ricevuto</a>
            <a href={waHref('annullamento')} onClick={waClick('annullamento')} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#B5502F] text-white rounded-lg py-2 text-sm font-semibold">❌ Annullamento</a>
          </div>
        )
        return (
          <>
            <div className="bg-sage rounded-xl p-4 border border-[#C9DDD0] mb-3">
              <p className="font-semibold text-green-dark mb-2">💬 WhatsApp Ania</p>
              {buttons}
            </div>
            <div className="bg-[#F4E6DF] rounded-xl p-4 border border-[#E9D3C8] mb-4">
              <p className="font-semibold text-[#7A3B22] mb-2">💼 WhatsApp Business</p>
              {buttons}
            </div>
          </>
        )
      })()}

      {showCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowCancel(false)}>
          <div className="bg-white rounded-t-2xl p-4 w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Motivo annullamento</h2>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Es. cliente ha cancellato..." className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" />
            <button onClick={cancelBooking} className="w-full bg-[#B5502F] text-white rounded-xl py-3 font-semibold mb-2">Conferma annullamento</button>
            <button onClick={() => setShowCancel(false)} className="w-full text-gray-500 py-2 text-sm">Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}
