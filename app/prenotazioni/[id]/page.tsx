'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { roomWithType, lettoInclusoNellaCamera } from '@/lib/roomTypes'
import { tariffaCamera, totaleLetto, lettoDaComunicare } from '@/lib/tariffe'
import ConfermaWhatsApp from '@/components/ConfermaWhatsApp'
import BackBar from '@/components/BackBar'

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

function buildWhatsappMsg(b: any, type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto' | 'promemoria_bonifico' | 'richiesta_orario' | 'ringraziamento' | 'libero', gruppo: any[] = []) {
  const name = b.guests?.full_name || 'Ospite'
  const room = b.rooms?.name || ''
  // Nome con tipologia (es. "Amelia – Singola"): solo nei messaggi al cliente
  const roomFull = roomWithType(room)
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

  // Un soggiorno può essere spezzato in più periodi o perché l'ospite cambia camera,
  // oppure perché resta nella stessa camera a una tariffa diversa: l'intestazione deve
  // dire la cosa giusta, altrimenti al cliente annunciamo un cambio camera che non c'è.
  const camereDiverse = new Set(segmenti.map((s: any) => s.rooms?.name)).size > 1
  const intestazioneSegmenti = camereDiverse
    ? 'Camere (cambio camera durante il soggiorno):'
    : 'Periodi del soggiorno:'
  const riepilogoCamere = isGruppo ? segmenti.map((s, i) => {
    const n = Math.round((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 86400000)
    // Per Lena con 3 ospiti il prezzo a notte mostrato è quello tutto compreso (letto incluso)
    const prezzoNotte = lettoInclusoNellaCamera(s, n)
      ? Number(s.price_per_night) + Number(s.rooms?.extra_bed_price || 0)
      : Number(s.price_per_night)
    return `   ${i + 1}. *${roomWithType(s.rooms?.name) || 'Camera'}*: ${formatDateIT(s.check_in)} → ${formatDateIT(s.check_out)} (${n} ${n === 1 ? 'notte' : 'notti'}) – €${prezzoNotte.toFixed(0)}/notte`
  }).join('\n') : ''

  // Riepilogo costi: una riga per camera (+ letto supplementare se presente), totale = somma delle righe
  const fmtEuro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  let totaleRighe = 0
  const righeCosti: string[] = []
  for (const s of segmenti) {
    const n = Math.round((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 86400000)
    const prezzo = Number(s.price_per_night)
    const nomeCamera = `Camera ${roomWithType(s.rooms?.name) || ''}`.trim()
    // Lena con 3 ospiti: il terzo letto è parte della tripla, una riga sola tutto compreso
    if (lettoInclusoNellaCamera(s, n)) {
      const totCamera = prezzo * n + Number(s.extra_bed_total || 0)
      totaleRighe += totCamera
      righeCosti.push(n > 1
        ? `${nomeCamera} (${n} notti × ${fmtEuro(totCamera / n)}): ${fmtEuro(totCamera)}`
        : `${nomeCamera}: ${fmtEuro(totCamera)}`)
      continue
    }
    const subCamera = prezzo * n
    totaleRighe += subCamera
    // Prezzo sotto il listino della camera = sconto fatto da Ania: il
    // cliente lo deve vedere nero su bianco, non un prezzo basso e muto
    const listino = Number(s.rooms?.base_price || 0)
    const scontoCamera = listino > prezzo ? (listino - prezzo) * n : 0
    if (scontoCamera > 0.005) {
      righeCosti.push(n > 1
        ? `${nomeCamera} (${n} notti × ${fmtEuro(listino)}): ${fmtEuro(listino * n)}`
        : `${nomeCamera}: ${fmtEuro(listino)}`)
      righeCosti.push(`━━━━━━━━━━━━━━\n*Sconto a lei riservato: −${fmtEuro(scontoCamera)}*\n━━━━━━━━━━━━━━`)
    } else {
      righeCosti.push(n > 1
        ? `${nomeCamera} (${n} notti × ${fmtEuro(prezzo)}): ${fmtEuro(subCamera)}`
        : `${nomeCamera}: ${fmtEuro(subCamera)}`)
    }
    const ebTot = Number(s.extra_bed_total || 0)
    if (s.extra_bed && ebTot > 0) {
      const ebNotti = s.extra_bed_dates?.length > 0 ? s.extra_bed_dates.length : n
      const ebPrezzo = Number(s.rooms?.extra_bed_price || 0)
      const label = isGruppo ? `Letto supplementare – ${s.rooms?.name || ''}`.trim() : 'Letto supplementare'
      // La moltiplicazione si mostra solo se torna con il totale salvato
      righeCosti.push(ebNotti > 1 && Math.abs(ebNotti * ebPrezzo - ebTot) < 0.005
        ? `${label} (${ebNotti} notti × ${fmtEuro(ebPrezzo)}): ${fmtEuro(ebTot)}`
        : `${label}: ${fmtEuro(ebTot)}`)
      totaleRighe += ebTot
    }
  }
  const riepilogoCosti = `RIEPILOGO COSTI
${righeCosti.join('\n')}
*Totale soggiorno: ${fmtEuro(totaleRighe)}*`

  const pagamentoInfo = b.bonifico
    ? `Pagamento tramite bonifico bancario. Per completare la prenotazione, la prego di effettuare il bonifico con i seguenti dati:
Intestatario: *SAWICKA ANNA JANINA*
Banca: *BANCO BPM*
IBAN: *IT32P0503401753000000159653*
Causale: Soggiorno Casa Granata Humanitas – ${name} – dal ${cin} al ${cout}`
    : `Pagamento all'arrivo: alla consegna delle chiavi verrà chiesto il pagamento per l'intera prenotazione in contante oppure tramite bonifico bancario istantaneo.`

  if (type === 'conferma') {
    return `CONFERMA DI PRENOTAZIONE – Casa Granata Humanitas

Gentile *${name}*,
grazie per aver scelto Casa Granata. Sono lieta di confermarle il soggiorno e la aspetto con piacere!

Info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

RIEPILOGO SOGGIORNO
Check-in: *${cinF}* (dalle ore 15:00 alle 20:00)
Check-out: *${coutF}* (entro le ore 10:00)
Notti totali: *${notti}*
Ospiti: ${ospiti}
${isGruppo ? `${intestazioneSegmenti}\n${riepilogoCamere}` : `Camera: ${roomFull}${lettoDaComunicare(b) ? ' + letto aggiuntivo' : ''}\n${isLena ? '🚿 Bagno: *privato esterno, chiuso a chiave, a circa 1 metro dalla camera*' : (bagno ? `🚿 Bagno: ${bagno}` : '')}`}${!isGruppo && roomLink ? `\n\nVedi la tua camera: ${roomLink}` : ''}

${riepilogoCosti}

${pagamentoInfo}

💬 *Appena le sarà possibile, la prego di farmi sapere l'orario di arrivo in struttura, per organizzare al meglio la sua accoglienza.*

DOVE SIAMO
Via Liguria 26 – Fizzonasco, Pieve Emanuele (MI) 20072
*A 140 metri dalla palazzina 8 di Humanitas di Rozzano – ortopedia*

• WiFi gratuito (credenziali in camera)
• Ricordarsi documento d'identità valido
• Fumo solo all'esterno

📞 CONTATTI
Per qualsiasi necessità sono sempre disponibile:
💬 342 700 4354 (anche WhatsApp)

POLITICA DI CANCELLAZIONE
Cancellazione gratuita fino a 3 giorni prima dell'arrivo.

Sarà un piacere accoglierla!

A presto,
Ania
Casa Granata Humanitas`
  }

  if (type === 'modifica') {
    return `MODIFICA PRENOTAZIONE – Casa Granata Humanitas

Gentile *${name}*,
la informo che la sua prenotazione presso Casa Granata Humanitas è stata modificata. Ecco il riepilogo aggiornato:

Info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

RIEPILOGO SOGGIORNO
Check-in: *${cinF}* (dalle ore 15:00 alle 20:00)
Check-out: *${coutF}* (entro le ore 10:00)
Notti totali: *${notti}*
Ospiti: ${ospiti}
${isGruppo ? `${intestazioneSegmenti}\n${riepilogoCamere}` : `Camera: ${roomFull}${lettoDaComunicare(b) ? ' + letto aggiuntivo' : ''}\n${isLena ? '🚿 Bagno: *privato esterno, chiuso a chiave, a circa 1 metro dalla camera*' : (bagno ? `🚿 Bagno: ${bagno}` : '')}`}${!isGruppo && roomLink ? `\n\nVedi la tua camera: ${roomLink}` : ''}

${riepilogoCosti}

${pagamentoInfo}

Per qualsiasi domanda resto a Sua disposizione.

💬 342 700 4354 (anche WhatsApp)

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

  if (type === 'promemoria_bonifico') {
    return `Gentile *${name}*,
le scrivo per ricordarle gentilmente che non ho ancora ricevuto il bonifico per il soggiorno dal *${cinF}* al *${coutF}*.

Intestatario: *SAWICKA ANNA JANINA*
Banca: *BANCO BPM*
IBAN: *IT32P0503401753000000159653*
Causale: Soggiorno Casa Granata Humanitas – ${name} – dal ${cin} al ${cout}
Importo: *€ ${totale}*

Quando ha effettuato il bonifico, mi mandi pure la ricevuta qui su WhatsApp. Se l'ha già fatto in queste ore, ignori questo messaggio e mi scusi il disturbo!

Tutte le info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

A presto,
Ania
Casa Granata Humanitas`
  }

  if (type === 'richiesta_orario') {
    return `Gentile *${name}*,
il suo arrivo si avvicina e vorrei organizzare al meglio la sua accoglienza: mi può indicare, anche in modo approssimativo, l'orario in cui pensa di arrivare?

Le ricordo che il check-in è dalle ore 15:00 alle 20:00. Se prevede di arrivare prima o dopo questi orari, mi avvisi pure per tempo, così mi organizzo per accoglierla al meglio.

Tutte le info utili per il tuo soggiorno: https://www.casaaniarozzano.it/info?v=7

A presto,
Ania
Casa Granata Humanitas`
  }

  if (type === 'libero') {
    return ''
  }

  if (type === 'ringraziamento') {
    return `Gentile *${name}*,
grazie per aver soggiornato a Casa Granata Humanitas, è stato un piacere ospitarla.
Spero che tutto sia andato bene. Se trova un momento per lasciare una recensione, per me vorrebbe dire moltissimo: https://maps.google.com/?cid=12687762198889638693

E se dovesse ripassare da queste parti, saremo sempre felici di ospitarla di nuovo!

Un caro saluto,
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
Check-in: *${cinF}* (dalle ore 15:00 alle 20:00)
Check-out: *${coutF}* (entro le ore 10:00)
Ospiti: ${ospiti}
Camera: ${roomFull}
Notti: *${notti}*

Importo totale: *€ ${totale}* – pagamento all'arrivo. Alla consegna delle chiavi verrà chiesto pagamento per l'intera prenotazione in contante oppure tramite bonifico bancario istantaneo.

Per qualsiasi chiarimento resto a Sua completa disposizione e sarò lieta di accoglierla in futuro.

💬 342 700 4354 (anche WhatsApp)

I nostri contatti e dove siamo: https://www.casaaniarozzano.it/info?v=7

Cordiali saluti,
Ania
Casa Granata Humanitas`
}

// Prova ad aprire l'app WhatsApp (desktop o mobile) tramite lo schema whatsapp://,
// e ricade su wa.me (WhatsApp Web) se l'app non risponde entro 1 secondo.
function openWhatsApp(phone: string, text: string, preferBusiness: boolean = false) {
  const encoded = encodeURIComponent(text)
  // whatsapp:// e whatsapp-consumer:// non sono schemi documentati ufficialmente da Meta:
  // quando sul telefono sono installate sia WhatsApp che WhatsApp Business, è iOS a decidere
  // da solo quale app apre ciascuno scheme, e la scelta può cambiare da sola con gli aggiornamenti.
  // Proviamo prima lo scheme "preferito", poi l'altro, poi il link web come ultima spiaggia.
  // Sul telefono di Ania questi due schemi risultano assegnati al contrario
  // di quanto documentato altrove: whatsapp:// apre la sua app personale,
  // whatsapp-consumer:// apre WhatsApp Business.
  const schemeA = preferBusiness
    ? `whatsapp-consumer://send?phone=${phone}&text=${encoded}`
    : `whatsapp://send?phone=${phone}&text=${encoded}`
  const schemeB = preferBusiness
    ? `whatsapp://send?phone=${phone}&text=${encoded}`
    : `whatsapp-consumer://send?phone=${phone}&text=${encoded}`
  const webUrl = `https://wa.me/${phone}?text=${encoded}`

  let handedOff = false
  const markHandedOff = () => { handedOff = true }
  document.addEventListener('visibilitychange', markHandedOff)
  window.addEventListener('blur', markHandedOff)

  window.location.href = schemeA

  setTimeout(() => {
    if (handedOff) {
      document.removeEventListener('visibilitychange', markHandedOff)
      window.removeEventListener('blur', markHandedOff)
      return
    }
    window.location.href = schemeB
    setTimeout(() => {
      document.removeEventListener('visibilitychange', markHandedOff)
      window.removeEventListener('blur', markHandedOff)
      if (!handedOff) {
        window.open(webUrl, '_blank', 'noopener,noreferrer')
      }
    }, 800)
  }, 800)
}

export default function BookingDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [groupBookings, setGroupBookings] = useState<any[]>([])
  // Altre prenotazioni dello stesso ospite (anche annullate): se ha mandato
  // più richieste dal sito, magari una sbagliata, da qui si ritrovano tutte
  const [otherBookings, setOtherBookings] = useState<any[]>([])
  // Conferma della richiesta dal sito: un solo tocco, poi il bottone sparisce
  const [confirming, setConfirming] = useState(false)
  // Sconto in modifica: percentuale libera o totale deciso a mano.
  // Non tocca il database: ricalcola solo il prezzo a notte già esistente
  const [scontoPct, setScontoPct] = useState('')
  const [scontoTot, setScontoTot] = useState('')
  const [scontoInfo, setScontoInfo] = useState('')
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saveEditError, setSaveEditError] = useState<string | null>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [showConferma, setShowConferma] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [conflitto, setConflitto] = useState<string | null>(null)
  const [lettiOccupati, setLettiOccupati] = useState(0)
  const [extraBedsPerDay, setExtraBedsPerDay] = useState<Record<string, number>>({})
  const [editingStay, setEditingStay] = useState(false)
  const [stayForm, setStayForm] = useState<{ check_in: string; check_out: string }>({ check_in: '', check_out: '' })
  const [stayConflict, setStayConflict] = useState<string | null>(null)
  const [savingStay, setSavingStay] = useState(false)
  // Conto del soggiorno (acconti). accontiOk=false se la tabella payments non è ancora migrata
  const [acconti, setAcconti] = useState<any[]>([])
  const [accontiOk, setAccontiOk] = useState(true)
  const [accontoForm, setAccontoForm] = useState({ amount: '', method: 'contanti', paid_on: new Date().toISOString().split('T')[0] })
  const [savingAcconto, setSavingAcconto] = useState(false)
  const [accontoError, setAccontoError] = useState<string | null>(null)
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
        chi_e: b.chi_e || '',
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
      // Altre prenotazioni dello stesso ospite, escluse quelle del gruppo
      // (i segmenti del cambio camera sono lo stesso soggiorno)
      if (b?.guest_id) {
        supabase.from('bookings')
          .select('id, check_in, check_out, status, group_id, source, rooms(name)')
          .eq('guest_id', b.guest_id)
          .neq('id', id)
          .order('check_in', { ascending: false })
          .then(({ data: others }) => {
            setOtherBookings((others || []).filter((x: any) => !(b.group_id && x.group_id === b.group_id)))
          })
      }
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

  // Carica gli acconti del soggiorno (tutti i segmenti se c'è un cambio camera)
  useEffect(() => {
    if (!booking) return
    const ids = groupBookings.length > 1 ? groupBookings.map((b: any) => b.id) : [booking.id]
    supabase.from('payments').select('*').in('booking_id', ids).order('paid_on').then(({ data, error }) => {
      if (error) { setAccontiOk(false); return }
      setAccontiOk(true)
      setAcconti(data || [])
    })
  }, [booking?.id, groupBookings.length])

  async function aggiungiAcconto() {
    const amount = parseFloat(accontoForm.amount)
    if (!amount || amount <= 0 || savingAcconto) return
    setSavingAcconto(true)
    const { data, error } = await supabase.from('payments')
      .insert({ booking_id: booking.id, amount, method: accontoForm.method, paid_on: accontoForm.paid_on })
      .select().single()
    if (!error && data) {
      setAcconti([...acconti, data].sort((a, b) => a.paid_on.localeCompare(b.paid_on)))
      setAccontoForm({ amount: '', method: 'contanti', paid_on: new Date().toISOString().split('T')[0] })
      setAccontoError(null)
    } else {
      setAccontoError(error?.message || 'Errore di salvataggio')
    }
    setSavingAcconto(false)
  }

  async function eliminaAcconto(pid: string) {
    if (!confirm('Eliminare questo acconto?')) return
    const { error } = await supabase.from('payments').delete().eq('id', pid)
    if (!error) setAcconti(acconti.filter(a => a.id !== pid))
  }

  function calcNotti(cin: string, cout: string) {
    if (!cin || !cout) return 0
    return Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
  }

  // Giorno successivo (YYYY-MM-DD): serve per spostare il check-out di almeno una notte
  function nextDay(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d + 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  function calcTotal() {
    const n = calcNotti(editForm.check_in, editForm.check_out)
    if (n <= 0) return 0
    const room = rooms.find(r => r.id === editForm.room_id)
    const ebDays = editForm.extra_bed_dates?.length || 0
    // Il letto non si addebita quando è già compreso nella tariffa (Lena fino a 3 ospiti)
    const extraBedTotal = totaleLetto(room, editForm.num_guests, ebDays)
    return Number(editForm.price_per_night) * n + extraBedTotal
  }

  // Conferma la richiesta (tutti i segmenti se c'è un cambio camera).
  // L'update filtra su status=in_attesa: anche premuto due volte per
  // sbaglio non tocca nulla che sia già confermato
  async function confermaPrenotazione() {
    if (confirming) return
    setConfirming(true)
    try {
      if (booking.group_id) {
        await supabase.from('bookings').update({ status: 'confermata' })
          .eq('group_id', booking.group_id).eq('status', 'in_attesa')
      } else {
        await supabase.from('bookings').update({ status: 'confermata' })
          .eq('id', id).eq('status', 'in_attesa')
      }
      setBooking({ ...booking, status: 'confermata' })
      setGroupBookings(gs => gs.map((g: any) => g.status === 'in_attesa' ? { ...g, status: 'confermata' } : g))
    } finally {
      setConfirming(false)
    }
  }

  // Porta il totale del soggiorno a un valore voluto ricalcolando il prezzo
  // a notte (il letto aggiuntivo non si sconta: si scala solo la camera)
  function applicaTotale(target: number, label: string) {
    const n = calcNotti(editForm.check_in, editForm.check_out)
    if (n <= 0 || !isFinite(target)) return
    const room = rooms.find(r => r.id === editForm.room_id)
    const extraBedTotal = totaleLetto(room, editForm.num_guests, editForm.extra_bed_dates?.length || 0)
    const nuovoPrezzo = Math.round(((target - extraBedTotal) / n) * 100) / 100
    if (nuovoPrezzo <= 0) { setScontoInfo('❌ Totale troppo basso per queste notti'); return }
    const vecchioTotale = calcTotal()
    setEditForm({ ...editForm, price_per_night: nuovoPrezzo })
    const risparmio = Math.round(vecchioTotale - (nuovoPrezzo * n + extraBedTotal))
    setScontoInfo(`Sconto ${label}: −€${risparmio} · nuovo totale €${Math.round(nuovoPrezzo * n + extraBedTotal)} (€${nuovoPrezzo}/notte)`)
  }

  function applicaScontoPct() {
    const p = parseFloat(scontoPct.replace(',', '.'))
    if (!p || p <= 0 || p >= 100) return
    applicaTotale(calcTotal() * (1 - p / 100), `−${p}%`)
  }

  function applicaScontoTot() {
    const t = parseFloat(scontoTot.replace(',', '.'))
    if (!t || t <= 0) return
    applicaTotale(t, 'personalizzato')
  }

  async function saveEdit() {
    // Blocco di sicurezza: non salvare mai date impossibili (check-out non successivo al check-in)
    if (!editForm.check_in || !editForm.check_out || editForm.check_out <= editForm.check_in) {
      setSaveEditError('Date non valide: il check-out deve essere almeno una notte dopo il check-in. Correggi le date prima di salvare.')
      return
    }
    setSaveEditError('')
    setSaving(true)
    const room = rooms.find(r => r.id === editForm.room_id)
    const ebDays = editForm.extra_bed_dates?.length || 0
    // Il letto non si addebita quando è già compreso nella tariffa (Lena fino a 3 ospiti)
    const extraBedTotal = totaleLetto(room, editForm.num_guests, ebDays)
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
      // chi_e incluso solo se la colonna esiste già sul DB o se è stato valorizzato: gli altri salvataggi non si bloccano prima della migrazione
      ...(booking.chi_e !== undefined || editForm.chi_e ? { chi_e: editForm.chi_e || null } : {}),
      extra_phone_2: editForm.extra_phone_2 ? normalizePhone(editForm.extra_phone_2) : null,
      extra_phone_2_name: editForm.extra_phone_2_name || null,
      updated_at: new Date().toISOString(),
    }
    // Se il DB rifiuta l'update (es. colonna mancante) il salvataggio NON deve sembrare riuscito
    const { error: updateError } = await supabase.from('bookings').update(updates).eq('id', id)
    if (updateError) {
      setSaveEditError(`Salvataggio non riuscito: ${updateError.message}`)
      setSaving(false)
      return
    }
    setSaveEditError(null)
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
    if (updated?.group_id) {
      const { data: grp } = await supabase.from('bookings')
        .select('*, rooms(*)')
        .eq('group_id', updated.group_id)
        .neq('status', 'annullata')
        .order('check_in', { ascending: true })
      setGroupBookings(grp || [])
    }
    setEditing(false)
    setSaving(false)
  }

  // Nuovo piano dei segmenti del soggiorno per le date [newIn, newOut):
  // ogni segmento viene ritagliato sull'intervallo, quelli rimasti vuoti vanno annullati,
  // il primo/ultimo si estendono fino alle nuove date (le date dei cambi camera restano invariate).
  function computeStayPlan(segments: any[], newIn: string, newOut: string) {
    const sorted = [...segments].sort((a, z) => a.check_in.localeCompare(z.check_in))
    if (!newIn || !newOut || newIn >= newOut) {
      return { kept: [] as any[], removed: sorted, total: 0, error: "La data di partenza deve essere successiva all'arrivo" }
    }
    const clipped = sorted.map(seg => ({
      seg,
      s: seg.check_in < newIn ? newIn : seg.check_in,
      e: seg.check_out > newOut ? newOut : seg.check_out,
    }))
    const kept = clipped.filter(c => c.s < c.e)
    const removed = clipped.filter(c => c.s >= c.e).map(c => c.seg)
    if (kept.length === 0) {
      return { kept: [] as any[], removed: sorted, total: 0, error: 'Le nuove date non coprono nessuna camera del soggiorno' }
    }
    kept[0].s = newIn
    kept[kept.length - 1].e = newOut
    const plan = kept.map(c => {
      const days = getDaysBetween(c.s, c.e)
      const ebDates = (c.seg.extra_bed_dates || []).filter((d: string) => days.includes(d))
      const extraBedTotal = ebDates.length * Number(c.seg.rooms?.extra_bed_price || 0)
      const total = Number(c.seg.price_per_night) * days.length + extraBedTotal
      return {
        id: c.seg.id, roomName: c.seg.rooms?.name || 'Camera',
        check_in: c.s, check_out: c.e, nights: days.length,
        price_per_night: Number(c.seg.price_per_night),
        extra_bed_dates: ebDates, extra_bed_total: extraBedTotal, total,
      }
    })
    return { kept: plan, removed, total: plan.reduce((s, x) => s + x.total, 0), error: null as string | null }
  }

  // Se il soggiorno viene allungato, verifica che la camera del primo/ultimo segmento sia libera nei giorni aggiunti
  async function checkStayConflict(newIn: string, newOut: string) {
    setStayConflict(null)
    const sorted = [...groupBookings].sort((a, z) => a.check_in.localeCompare(z.check_in))
    if (sorted.length === 0) return
    const groupIds = sorted.map(s => s.id)
    const checks: { room_id: string; roomName: string; from: string; to: string }[] = []
    const first = sorted[0], last = sorted[sorted.length - 1]
    if (newIn && newIn < first.check_in) checks.push({ room_id: first.room_id, roomName: first.rooms?.name || 'Camera', from: newIn, to: first.check_in })
    if (newOut && newOut > last.check_out) checks.push({ room_id: last.room_id, roomName: last.rooms?.name || 'Camera', from: last.check_out, to: newOut })
    for (const c of checks) {
      const { data } = await supabase.from('bookings')
        .select('id, check_in, check_out, guests(full_name)')
        .eq('room_id', c.room_id).neq('status', 'annullata')
        .not('id', 'in', `(${groupIds.join(',')})`)
        .lt('check_in', c.to).gt('check_out', c.from)
      if (data && data.length > 0) {
        const b = data[0] as any
        setStayConflict(`⚠️ ${c.roomName} già occupata dal ${b.check_in} al ${b.check_out} (${b.guests?.full_name || 'altro cliente'})`)
        return
      }
    }
  }

  async function saveStayEdit() {
    const plan = computeStayPlan(groupBookings, stayForm.check_in, stayForm.check_out)
    if (plan.error || stayConflict) return
    setSavingStay(true)
    const now = new Date().toISOString()
    for (const seg of plan.kept) {
      await supabase.from('bookings').update({
        check_in: seg.check_in,
        check_out: seg.check_out,
        extra_bed: seg.extra_bed_dates.length > 0,
        extra_bed_dates: seg.extra_bed_dates,
        extra_bed_total: seg.extra_bed_total,
        total_amount: seg.total,
        updated_at: now,
      }).eq('id', seg.id)
    }
    for (const seg of plan.removed) {
      await supabase.from('bookings').update({
        status: 'annullata',
        cancelled_at: now,
        cancelled_reason: 'Camera non più necessaria: date del soggiorno modificate',
        updated_at: now,
      }).eq('id', seg.id)
    }
    setEditingStay(false)
    // Se il segmento aperto è stato annullato, passa al primo segmento rimasto
    if (!plan.kept.find(k => k.id === id)) {
      setSavingStay(false)
      router.replace(`/prenotazioni/${plan.kept[0].id}`)
      return
    }
    const [{ data: updated }, { data: grp }] = await Promise.all([
      supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single(),
      supabase.from('bookings').select('*, rooms(*)').eq('group_id', booking.group_id).neq('status', 'annullata').order('check_in', { ascending: true }),
    ])
    setBooking(updated)
    setGroupBookings(grp || [])
    setSavingStay(false)
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

  // Link WhatsApp condivisi tra la versione mobile e il pannello Azioni desktop
  type WaTipo = 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto' | 'promemoria_bonifico' | 'richiesta_orario' | 'ringraziamento' | 'libero'
  const rawPhone = (booking.guests?.phone || '').replace(/\D/g, '')
  const waPhone = rawPhone ? (rawPhone.startsWith('39') ? rawPhone : `39${rawPhone}`) : null
  const waHref = (type: WaTipo) =>
    `https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsappMsg(booking, type, groupBookings))}`
  const waClick = (type: WaTipo, preferBusiness: boolean = false) => (e: React.MouseEvent) => {
    e.preventDefault()
    openWhatsApp(waPhone!, buildWhatsappMsg(booking, type, groupBookings), preferBusiness)
  }
  // Bottoni WhatsApp in versione tenue per il pannello Azioni desktop
  const renderWaChips = (preferBusiness: boolean) => (
    <div className="grid grid-cols-2 gap-1.5">
      <a href={waHref('conferma')} onClick={waClick('conferma', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EAF0F3', color: '#3D5A66' }}>Conferma</a>
      <a href={waHref('modifica')} onClick={waClick('modifica', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EAF0F3', color: '#3D5A66' }}>Modifica</a>
      <a href={waHref('dati_bonifico')} onClick={waClick('dati_bonifico', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EAF0F3', color: '#3D5A66' }}>Dati bonifico</a>
      <a href={waHref('pagamento_ricevuto')} onClick={waClick('pagamento_ricevuto', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EAF0F3', color: '#3D5A66' }}>Pagamento</a>
      <a href={waHref('promemoria_bonifico')} onClick={waClick('promemoria_bonifico', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EAF0F3', color: '#3D5A66' }}>Promemoria bonifico</a>
      <a href={waHref('libero')} onClick={waClick('libero', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EDEDED', color: '#444444' }}>Messaggio libero</a>
      <a href={waHref('richiesta_orario')} onClick={waClick('richiesta_orario', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EAF0F3', color: '#3D5A66' }}>Richiesta orario</a>
      <a href={waHref('ringraziamento')} onClick={waClick('ringraziamento', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#EAF0F3', color: '#3D5A66' }}>Ringraziamento</a>
      <a href={waHref('annullamento')} onClick={waClick('annullamento', preferBusiness)} target="_blank" rel="noopener noreferrer" className="col-span-2 block text-center rounded-lg py-1.5 text-xs font-semibold" style={{ background: '#F6E4DE', color: '#8C3B2E' }}>Annullamento</a>
    </div>
  )
  const waChipsAnia = renderWaChips(false)
  const waChipsBusiness = renderWaChips(true)

  return (
    <div className="p-4">
      <BackBar href="/prenotazioni" />
      <div className="flex items-center gap-3 mb-4">
        <h1 className="font-serif text-xl text-green-dark">Prenotazione</h1>
        {booking.source === 'sito_web' && (
          <span className="text-xs font-bold rounded-full px-3 py-1 shadow-sm" style={{ background: '#2D6A4F', color: '#fff' }}>🌐 Dal sito</span>
        )}
        <span className="flex-1" />
        {editing && (
          <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annulla</button>
        )}
      </div>

      {/* Su desktop: contenuto a sinistra, pannello Azioni a destra. Su mobile tutto in colonna come prima. */}
      <div className={editing ? 'lg:max-w-2xl' : 'lg:flex lg:items-start lg:gap-5'}>
      <div className={editing ? '' : 'lg:flex-[1.6] lg:min-w-0'}>
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
          <input value={editForm.extra_phone_1} onChange={e => setEditForm({ ...editForm, extra_phone_1: e.target.value })}
            placeholder="+39..." className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" type="tel" />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Nome aggiuntivo</p>
              <input value={editForm.extra_phone_1_name} onChange={e => setEditForm({ ...editForm, extra_phone_1_name: e.target.value })}
                placeholder="Nome" className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Chi è</p>
              <input value={editForm.chi_e} onChange={e => setEditForm({ ...editForm, chi_e: e.target.value })}
                placeholder="mamma, collega..." className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
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
            // Cambiando camera si riapplica la regola con gli ospiti già inseriti
            const { prezzoNotte, lettiPool } = tariffaCamera(room, editForm.num_guests)
            const letto = lettiPool > 0
            setEditForm({ ...editForm, room_id: newRoomId,
              price_per_night: room ? prezzoNotte : editForm.price_per_night,
              extra_bed: letto,
              extra_bed_dates: letto ? getDaysBetween(editForm.check_in, editForm.check_out) : [] })
            checkDisponibilita(newRoomId, editForm.check_in, editForm.check_out)
          }} className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm">
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Check-in</p>
              <input type="date" value={editForm.check_in} onChange={e => {
                const newIn = e.target.value
                // Se il check-out manca o cadrebbe prima/uguale al nuovo check-in, spostalo a una notte dopo
                const newOut = newIn && (!editForm.check_out || editForm.check_out <= newIn) ? nextDay(newIn) : editForm.check_out
                setEditForm({ ...editForm, check_in: newIn, check_out: newOut })
                checkDisponibilita(editForm.room_id, newIn, newOut)
              }} className="w-full border border-card-border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Check-out</p>
              <input type="date" value={editForm.check_out} min={editForm.check_in ? nextDay(editForm.check_in) : undefined} onChange={e => {
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
                // Regola unica (lib/tariffe): prezzo e letti impegnati dal pool
                const { prezzoNotte, lettiPool } = tariffaCamera(room, n)
                const autoLetto = lettiPool > 0
                const autoDates = autoLetto ? getDaysBetween(editForm.check_in, editForm.check_out) : []
                setEditForm({ ...editForm, num_guests: n, extra_bed: autoLetto, extra_bed_dates: autoDates, price_per_night: room ? prezzoNotte : editForm.price_per_night })
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

          {/* Sconto: percentuale a mano o totale deciso da Ania */}
          {calcNotti(editForm.check_in, editForm.check_out) > 0 && (
            <div className="border border-card-border rounded-lg p-3 mb-3">
              <p className="text-xs text-gray-500 mb-2">Sconto</p>
              <div className="flex gap-2 items-center mb-2">
                <input type="number" inputMode="decimal" min={1} max={99} placeholder="%"
                  value={scontoPct} onChange={e => setScontoPct(e.target.value)}
                  className="w-20 border border-card-border rounded-lg p-2 text-sm" />
                <button type="button" onClick={applicaScontoPct}
                  className="bg-green-mid text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  disabled={!parseFloat(scontoPct.replace(',', '.'))}>
                  Applica %
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <input type="number" inputMode="decimal" min={1} placeholder="€ totale"
                  value={scontoTot} onChange={e => setScontoTot(e.target.value)}
                  className="w-28 border border-card-border rounded-lg p-2 text-sm" />
                <button type="button" onClick={applicaScontoTot}
                  className="bg-green-mid text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  disabled={!parseFloat(scontoTot.replace(',', '.'))}>
                  Porta il totale
                </button>
              </div>
              {scontoInfo && (
                <p className="text-xs rounded-lg px-2 py-1.5 mt-2" style={{ background: '#F3ECD8', color: '#8a4f2f' }}>{scontoInfo}</p>
              )}
            </div>
          )}

          {conflitto && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-3 text-sm text-[#8C3B2E] font-semibold">
              {conflitto}
            </div>
          )}

          {saveEditError && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-3 text-sm text-[#8C3B2E] font-semibold">
              ❌ {saveEditError}
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
        <div className={`rounded-xl p-5 border mb-4 ${booking.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-white border-card-border'}`}>
          {/* Cliente in testa: nome, telefono con chiamata diretta, poi camera */}
          <div className="flex justify-between items-start gap-2 mb-2">
            <p className="font-bold text-lg min-w-0">{guest?.full_name || guest?.phone}</p>
            <Link href={`/clienti/${guest?.id}?edit=1`} className="text-green-mid text-sm shrink-0 pt-1">✏️ Modifica</Link>
          </div>
          {guest?.phone && (
            <a href={`tel:${(guest.phone || '').replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold py-1 mb-1" style={{ color: '#2D6A4F' }}>
              📞 {guest.phone}
            </a>
          )}
          {guest?.email && <p className="text-sm text-gray-600 mb-1">✉️ {guest.email}</p>}
          {guest?.rating && guest.rating !== 'normale' && (
            <p className="text-sm font-semibold mb-1">{RATING_LABEL[guest.rating]}</p>
          )}
          {(booking.extra_phone_1 || booking.extra_phone_1_name) && (
            <p className="text-sm text-gray-600 mb-1">
              {booking.extra_phone_1 ? `📞 ${booking.extra_phone_1}` : '👤'}{booking.extra_phone_1_name ? ` – ${booking.extra_phone_1_name}` : ''}
              {booking.chi_e && <span className="ml-1.5 text-xs px-2 py-0.5 rounded-full bg-[#EDE6D6] text-[#5a6b3f] font-medium align-middle">{booking.chi_e}</span>}
            </p>
          )}
          {booking.extra_phone_2 && (
            <p className="text-sm text-gray-600 mb-1">📞 {booking.extra_phone_2}{booking.extra_phone_2_name ? ` – ${booking.extra_phone_2_name}` : ''}</p>
          )}
          <p className="text-gray-500 mt-4 mb-1.5">{booking.rooms?.name}</p>
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

          {/* Conto del soggiorno: acconti ricevuti e residuo */}
          {accontiOk && booking.status !== 'annullata' && (() => {
            const totaleDovuto = groupBookings.length > 1
              ? groupBookings.reduce((s: number, x: any) => s + Number(x.total_amount), 0)
              : Number(booking.total_amount)
            const ricevuto = acconti.reduce((s, a) => s + Number(a.amount), 0)
            const residuo = totaleDovuto - ricevuto
            return (
              <div className="mt-3 bg-white border border-card-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase" style={{ color: 'var(--color-brass)', letterSpacing: '2px' }}>Conto del soggiorno</p>
                  {ricevuto > 0 && (residuo <= 0
                    ? <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={{ background: '#EAF0F3', color: '#3D5A66' }}>saldato</span>
                    : <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={{ background: '#EDE6D6', color: '#5a6b3f' }}>acconto ricevuto</span>
                  )}
                </div>
                {acconti.map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-card-border text-sm">
                    <span>{a.method === 'bonifico' ? '🏦' : '💵'}</span>
                    <span className="text-gray-500">{new Date(a.paid_on + 'T00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                    <span className="flex-1 font-semibold text-green-dark">€{Number(a.amount).toFixed(0)}</span>
                    <button onClick={() => eliminaAcconto(a.id)} className="text-gray-400 text-xs px-1">✕</button>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-1.5">
                  <span className="text-gray-500">Ricevuti</span>
                  <span className="font-semibold">€{ricevuto.toFixed(0)} su €{totaleDovuto.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-sm rounded-lg px-2 py-1.5 mb-2" style={{ background: residuo > 0 ? '#F3ECD8' : '#EAF0F3' }}>
                  <span className="font-semibold" style={{ color: residuo > 0 ? '#8a4f2f' : '#3D5A66' }}>{residuo > 0 ? 'Resta da avere' : 'Saldato'}</span>
                  <span className="font-bold" style={{ color: residuo > 0 ? '#8a4f2f' : '#3D5A66' }}>€{Math.max(0, residuo).toFixed(0)}{residuo < 0 ? ` (+€${(-residuo).toFixed(0)} in più)` : ''}</span>
                </div>
                {accontoError && (
                  <p className="text-xs text-[#8C3B2E] bg-[#F6E4DE] rounded-lg px-2 py-1.5 mb-2">❌ {accontoError}</p>
                )}
                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                  <input type="number" inputMode="decimal" min={0} placeholder="€"
                    value={accontoForm.amount}
                    onChange={e => setAccontoForm({ ...accontoForm, amount: e.target.value })}
                    className="w-20 border border-card-border rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                  <select value={accontoForm.method} onChange={e => setAccontoForm({ ...accontoForm, method: e.target.value })}
                    className="border border-card-border rounded-lg p-2 text-sm bg-white">
                    <option value="contanti">💵 Contanti</option>
                    <option value="bonifico">🏦 Bonifico</option>
                  </select>
                  <input type="date" value={accontoForm.paid_on}
                    onChange={e => setAccontoForm({ ...accontoForm, paid_on: e.target.value })}
                    className="basis-full sm:basis-0 sm:flex-1 sm:min-w-0 border border-card-border rounded-lg p-2 text-sm bg-white" />
                  <button onClick={aggiungiAcconto} disabled={savingAcconto || !parseFloat(accontoForm.amount)}
                    className="basis-full sm:basis-auto sm:shrink-0 bg-green-mid text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40">
                    {savingAcconto ? '...' : (<>+<span className="sm:hidden"> Aggiungi</span></>)}
                  </button>
                </div>
              </div>
            )
          })()}

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
              {(booking.status === 'confermata' || booking.status === 'in_attesa') && !editingStay && (
                <button onClick={() => {
                  const sorted = [...groupBookings].sort((a, z) => a.check_in.localeCompare(z.check_in))
                  setStayForm({ check_in: sorted[0].check_in, check_out: sorted[sorted.length - 1].check_out })
                  setStayConflict(null)
                  setEditingStay(true)
                }} className="w-full mt-2 bg-[#9B8EC4] text-white text-sm font-semibold py-2 rounded-xl">
                  Modifica date soggiorno
                </button>
              )}
              {editingStay && (
                <div className="mt-2 pt-2 border-t border-[#D9D0EA]">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <p className="text-xs text-[#5B4E82] mb-1">Arrivo</p>
                      <input type="date" value={stayForm.check_in} onChange={e => {
                        setStayForm({ ...stayForm, check_in: e.target.value })
                        checkStayConflict(e.target.value, stayForm.check_out)
                      }} className="w-full border border-[#D9D0EA] rounded-lg p-2 text-sm bg-white" />
                    </div>
                    <div>
                      <p className="text-xs text-[#5B4E82] mb-1">Partenza</p>
                      <input type="date" value={stayForm.check_out} onChange={e => {
                        setStayForm({ ...stayForm, check_out: e.target.value })
                        checkStayConflict(stayForm.check_in, e.target.value)
                      }} className="w-full border border-[#D9D0EA] rounded-lg p-2 text-sm bg-white" />
                    </div>
                  </div>
                  {(() => {
                    const plan = computeStayPlan(groupBookings, stayForm.check_in, stayForm.check_out)
                    const oldTotal = groupBookings.reduce((s, x) => s + Number(x.total_amount), 0)
                    return (
                      <>
                        {plan.error ? (
                          <p className="text-xs text-[#8C3B2E] font-semibold mb-2">{plan.error}</p>
                        ) : (
                          <div className="bg-white rounded-lg p-2 mb-2 border border-[#D9D0EA]">
                            <p className="text-xs font-bold text-[#5B4E82] mb-1">Anteprima nuovo soggiorno:</p>
                            {plan.kept.map((k, i) => (
                              <p key={k.id} className="text-xs text-[#5B4E82]">
                                {i + 1}. {k.roomName}: {k.check_in} → {k.check_out} ({k.nights} {k.nights === 1 ? 'notte' : 'notti'}) · €{k.total.toFixed(0)}{k.extra_bed_total > 0 ? ` (incl. €${k.extra_bed_total.toFixed(0)} letto extra)` : ''}
                              </p>
                            ))}
                            {plan.removed.map((r: any) => (
                              <p key={r.id} className="text-xs text-[#8C3B2E]">
                                <span className="line-through">{r.rooms?.name}: {r.check_in} → {r.check_out}</span> — verrà annullata
                              </p>
                            ))}
                            <p className="text-xs font-bold text-[#4A3F6B] mt-1 pt-1 border-t border-[#D9D0EA]">
                              Nuovo totale: €{plan.total.toFixed(0)}{plan.total !== oldTotal ? <span className="font-normal"> (prima: €{oldTotal.toFixed(0)})</span> : null}
                            </p>
                          </div>
                        )}
                        {stayConflict && (
                          <p className="text-xs text-[#8C3B2E] font-semibold mb-2">{stayConflict}</p>
                        )}
                        <button onClick={saveStayEdit} disabled={savingStay || !!plan.error || !!stayConflict}
                          className="w-full bg-green-mid text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 mb-1">
                          {savingStay ? 'Salvataggio...' : '💾 Conferma nuove date'}
                        </button>
                        <button onClick={() => setEditingStay(false)} className="w-full text-[#5B4E82] py-1.5 text-xs">
                          Annulla
                        </button>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
          {(booking.status === 'confermata' || booking.status === 'in_attesa') && (
            <>
              <button onClick={addRoomChange} className="w-full bg-[#9B8EC4] text-white font-semibold text-xs py-2 px-1 rounded-xl mt-3">
                ➕ Cambio camera
              </button>
              <p className="text-[11px] text-gray-500 mt-1.5 px-1 leading-snug">
                Per cambiare la tariffa di questo soggiorno usa &quot;Modifica&quot; qui sopra, campo &quot;Tariffa/notte&quot;.
              </p>
            </>
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

      {/* Conferma, Modifica e Annulla insieme, tutti della stessa grandezza.
          Conferma: un tocco solo — appena confermata il bottone sparisce,
          il calendario cambia colore e la richiesta esce da barra e popup */}
      {!editing && booking.status !== 'annullata' && (
        <div className="space-y-2 mb-4">
          {booking.status === 'in_attesa' && (
            <button onClick={confermaPrenotazione} disabled={confirming}
              className="w-full text-white rounded-xl py-3 font-semibold disabled:opacity-60"
              style={{ background: '#2D6A4F' }}>
              {confirming ? 'Confermo...' : '✅ Conferma prenotazione'}
            </button>
          )}
          <button onClick={() => setEditing(true)}
            className="w-full bg-green-mid text-white lg:bg-transparent lg:border lg:border-green-mid lg:text-green-mid rounded-xl py-3 font-semibold">
            ✏️ Modifica prenotazione
          </button>
          <button onClick={() => setShowCancel(true)}
            className="w-full bg-[#B5502F] text-white rounded-xl py-3 font-semibold">
            Annulla prenotazione
          </button>
        </div>
      )}


      {/* Altre prenotazioni dello stesso ospite: per ritrovare al volo
          tutte le richieste fatte con lo stesso numero */}
      {!editing && otherBookings.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
          <p className="font-semibold mb-1">Altre prenotazioni di questo ospite</p>
          {otherBookings.map((ob: any) => {
            // "In attesa" = riga intera rosso mattone: il bollino da solo
            // rischiava di sfuggire all'occhio
            const pending = ob.status === 'in_attesa'
            const st = pending
              ? { label: '⏳ In attesa', bg: '#fff', fg: '#B5502F' }
              : ob.status === 'annullata'
                ? { label: 'Annullata', bg: '#EDEDED', fg: '#777777' }
                : ob.status === 'completata'
                  ? { label: 'Completata', bg: '#EAF0F3', fg: '#3D5A66' }
                  : { label: 'Confermata', bg: '#E7EFE9', fg: '#2D6A4F' }
            const d = (s: string) => new Date(s + 'T00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
            return (
              <Link key={ob.id} href={`/prenotazioni/${ob.id}`}
                className={pending
                  ? 'flex items-center justify-between gap-2 py-2.5 px-3 -mx-1 my-1 rounded-lg shadow-sm'
                  : 'flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-b-0'}
                style={pending ? { background: '#B5502F' } : undefined}>
                <span className="text-sm min-w-0" style={pending ? { color: '#fff' } : undefined}>
                  <span className="font-medium">{ob.rooms?.name}</span>
                  <span style={pending ? { color: 'rgba(255,255,255,0.85)' } : undefined} className={pending ? '' : 'text-gray-500'}> · {d(ob.check_in)} → {d(ob.check_out)}</span>
                  {ob.source === 'sito_web' && <span className={pending ? '' : 'text-gray-400'} style={{ fontSize: '0.75rem' }}> · 🌐</span>}
                </span>
                <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Quick pagato toggle */}
      {!editing && booking.bonifico && !booking.pagato && booking.status !== 'annullata' && (
        <button onClick={async () => {
          await supabase.from('bookings').update({ pagato: true }).eq('id', id)
          setBooking({ ...booking, pagato: true })
        }} className="w-full bg-[#7D9DB0] text-white lg:bg-[#EAF0F3] lg:text-[#3D5A66] rounded-xl py-3 font-semibold mb-4">
          ✅ Segna come pagato
        </button>
      )}

      {/* WhatsApp (mobile; su desktop sta nel pannello Azioni) */}
      {!editing && waPhone && (() => {
        const renderButtons = (preferBusiness: boolean) => (
          <div className="grid grid-cols-2 gap-1.5">
            <a href={waHref('conferma')} onClick={waClick('conferma', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-1.5 text-xs font-semibold">Conferma</a>
            <a href={waHref('modifica')} onClick={waClick('modifica', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-1.5 text-xs font-semibold">Modifica</a>
            <a href={waHref('dati_bonifico')} onClick={waClick('dati_bonifico', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-1.5 text-xs font-semibold">Dati bonifico</a>
            <a href={waHref('pagamento_ricevuto')} onClick={waClick('pagamento_ricevuto', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-1.5 text-xs font-semibold">Pagamento</a>
            <a href={waHref('promemoria_bonifico')} onClick={waClick('promemoria_bonifico', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-1.5 text-xs font-semibold">Promemoria bonifico</a>
            <a href={waHref('libero')} onClick={waClick('libero', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#8A8A8A] text-white rounded-lg py-1.5 text-xs font-semibold">Messaggio libero</a>
            <a href={waHref('richiesta_orario')} onClick={waClick('richiesta_orario', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-1.5 text-xs font-semibold">Richiesta orario</a>
            <a href={waHref('ringraziamento')} onClick={waClick('ringraziamento', preferBusiness)} target="_blank" rel="noopener noreferrer" className="block text-center bg-[#7D9DB0] text-white rounded-lg py-1.5 text-xs font-semibold">Ringraziamento</a>
            <a href={waHref('annullamento')} onClick={waClick('annullamento', preferBusiness)} target="_blank" rel="noopener noreferrer" className="col-span-2 block text-center bg-[#B5502F] text-white rounded-lg py-1.5 text-xs font-semibold">Annullamento</a>
          </div>
        )
        return (
          <div className="lg:hidden">
            <button onClick={() => setShowConferma(true)}
              className="w-full bg-green-dark text-white rounded-xl py-3 font-semibold mb-3">
              Conferma WhatsApp (immagine + testo)
            </button>
            <div className="bg-sage rounded-xl p-3 border border-[#C9DDD0] mb-2">
              <p className="font-semibold text-green-dark mb-1.5 text-sm">💬 WhatsApp Ania</p>
              {renderButtons(false)}
            </div>
            <div className="bg-[#F4E6DF] rounded-xl p-3 border border-[#E9D3C8] mb-4">
              <p className="font-semibold text-[#7A3B22] mb-1.5 text-sm">💼 WhatsApp Business</p>
              {renderButtons(true)}
            </div>
          </div>
        )
      })()}
      </div>

      {/* Pannello Comunicazioni (solo desktop): tutto ciò che si manda al cliente, in colori tenui */}
      {!editing && waPhone && (
        <aside className="hidden lg:block lg:flex-1 lg:sticky lg:top-6">
          <div className="bg-white rounded-xl border border-card-border p-4">
            <p className="text-[11px] uppercase mb-3" style={{ color: 'var(--color-brass)', letterSpacing: '2px' }}>Messaggi</p>
            <button onClick={() => setShowConferma(true)}
              className="w-full rounded-xl py-2 text-sm font-semibold mb-2" style={{ background: '#DCE8DD', color: '#2f6a4d' }}>
              Conferma WhatsApp (immagine + testo)
            </button>
            <p className="font-semibold text-green-dark mt-4 mb-1.5 text-sm">💬 WhatsApp Ania</p>
            {waChipsAnia}
            <p className="font-semibold text-[#7A3B22] mt-4 mb-1.5 text-sm">💼 WhatsApp Business</p>
            {waChipsBusiness}
          </div>
        </aside>
      )}
      </div>

      {showConferma && (
        <ConfermaWhatsApp booking={booking} groupBookings={groupBookings} onClose={() => setShowConferma(false)} />
      )}

      {showCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCancel(false)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-lg" onClick={e => e.stopPropagation()}>
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
