'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { roomWithType, lettoInclusoNellaCamera } from '@/lib/roomTypes'
import { tariffaCamera, lettoDaComunicare } from '@/lib/tariffe'
import { prezzoPrenotazione, riallineaTariffa, tariffaFormDaSalvato, testoDettaglioNotti, dettaglioNottiSalvato } from '@/lib/prezzoNotti'
import { righeCostiSegmenti } from '@/lib/riepilogoCosti'
import ConfermaWhatsApp from '@/components/ConfermaWhatsApp'
import { openWhatsApp } from '@/lib/whatsapp'
import BackBar from '@/components/BackBar'
import { RigaDocumentiPrenotazione } from '@/components/DocumentiCliente'
import { nomeOspite, nomeDiverso, nomiPrecedenti, nomePerMessaggio } from '@/lib/guestName'
import { causaleBonifico } from '@/lib/causale'
import { contoSoggiorno, residuoDaPagare } from '@/lib/conto'
import { smartBack } from '@/lib/navHistory'
import { scriviPoiAggiorna, messaggioNonSalvato } from '@/lib/scritturaSicura'
import { salvaInSequenza, leggiConEsito, MESSAGGIO_RILETTURA } from '@/lib/prenotazioneScritture'
import AvvisoAzione from '@/components/AvvisoAzione'

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

// Data breve per il cliente: 20/08/2026 (mai il formato interno 2026-08-20)
function formatDateShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
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

// I template sono condivisi tra i due WhatsApp (personale Ania e Business): il testo è
// identico da entrambi i mittenti. Durante la transizione del nome, i messaggi formali
// usano la formula ufficiale "CASA ANIA / precedentemente Casa Granata Humanitas".
// La causale del bonifico è quella corta condivisa con la locandina (lib/causale.ts).
function buildWhatsappMsg(b: any, type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto' | 'promemoria_bonifico' | 'richiesta_orario' | 'ringraziamento' | 'libero', gruppo: any[] = [], acconti: any[] = []) {
  const name = nomePerMessaggio(nomeOspite(b))
  const room = b.rooms?.name || ''
  // Nome con tipologia (es. "Amelia – Singola"): solo nei messaggi al cliente
  const roomFull = roomWithType(room)
  const isGruppo = gruppo.length > 1

  // Per soggiorno con cambio camera usa il gruppo ordinato per check_in
  const segmenti = isGruppo ? [...gruppo].sort((a, z) => a.check_in.localeCompare(z.check_in)) : [b]
  const cin = segmenti[0].check_in
  const cout = segmenti[segmenti.length - 1].check_out
  // Totale dal conto unico (LETTURA: il record salvato è autorevole per le
  // prenotazioni senza sconto, i dati storici non vengono reinterpretati)
  const totaleNum = segmenti.reduce((s, x) => s + contoSoggiorno(x).totale, 0)
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
    // Tariffa diversa fra le notti (persone che cambiano): dettaglio per notte
    // al posto di un «/notte» unico che sarebbe falso
    const dett = dettaglioNottiSalvato(s.rooms, s)
    const prezzoTesto = dett ? testoDettaglioNotti(dett, x => `€${x}`) : `€${prezzoNotte.toFixed(0)}/notte`
    return `   ${i + 1}. *${roomWithType(s.rooms?.name) || 'Camera'}*: ${formatDateIT(s.check_in)} → ${formatDateIT(s.check_out)} (${n} ${n === 1 ? 'notte' : 'notti'}) – ${prezzoTesto}`
  }).join('\n') : ''

  // Riepilogo costi dal conto unico: righe di dettaglio a prezzo pieno e, solo
  // se esiste uno sconto SALVATO, la riga "Sconto a lei riservato". Se per un
  // dato storico il dettaglio non torna col totale autorevole, si rinuncia
  // allo spezzettamento e si mostra una riga unica: tutte le schermate devono
  // dire lo stesso totale.
  // Righe dal conto unico (lib/riepilogoCosti, la stessa funzione dell'immagine
  // WhatsApp e della proposta): «etichetta: importo», sconto fra le linee
  const fmtEuro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const { righe: righeConto, totale: totaleRighe } = righeCostiSegmenti(segmenti, isGruppo)
  const righeCosti = righeConto.map(r => r.sconto
    ? `━━━━━━━━━━━━━━\n*Sconto a lei riservato: −${fmtEuro(-r.amount)}*\n━━━━━━━━━━━━━━`
    : `${r.label}: ${fmtEuro(r.amount)}`)
  const riepilogoCosti = `💶 RIEPILOGO COSTI
${righeCosti.join('\n')}
*Totale soggiorno: ${fmtEuro(totaleRighe)}*`

  const causale = causaleBonifico(segmenti, name)

  // Blocco dati bonifico condiviso da conferma (variante bonifico), "Dati bonifico" e promemoria.
  // Con acconti già registrati l'importo da bonificare è il RESIDUO, non il
  // totale: al cliente non si chiedono soldi già consegnati.
  const ricevutoNum = (acconti || []).reduce((s, a) => s + Number(a.amount || 0), 0)
  const residuoNum = residuoDaPagare(totaleNum, acconti)
  const fmtIt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const importoBlocco = ricevutoNum > 0
    ? `Totale soggiorno: ${fmtIt(totaleNum)} €
Già ricevuto: ${fmtIt(ricevutoNum)} €

Importo da bonificare:
*${fmtIt(residuoNum)} €*`
    : `Importo:
*${totale} €*`
  const datiBonifico = `Intestatario: *SAWICKA ANNA JANINA*
Banca: *BANCO BPM*

IBAN:
*IT32P0503401753000000159653*

${importoBlocco}

Causale:
${causale}`

  const ricevutaWhatsApp = `Una volta effettuato il bonifico, può inviarmi la ricevuta direttamente qui su WhatsApp. Le confermerò la ricezione appena possibile.`

  const pagamentoInfo = b.bonifico
    ? `💳 PAGAMENTO
Il soggiorno si salda in anticipo con bonifico bancario.

${datiBonifico}

${ricevutaWhatsApp}`
    : `💳 PAGAMENTO
Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo.`

  // Formula ufficiale della transizione, identica da entrambi i WhatsApp
  const SOTTOTITOLO_STRUTTURA = 'precedentemente Casa Granata Humanitas'
  const firmaFormale = `A presto,
Ania
Casa Ania`

  // Blocco camera/bagno/link condiviso da conferma e modifica
  const cameraBlock = `${isGruppo ? `${intestazioneSegmenti}\n${riepilogoCamere}` : `Camera: ${roomFull}${lettoDaComunicare(b) ? ' + letto aggiuntivo' : ''}\n${isLena ? '🚿 Bagno: *privato esterno, chiuso a chiave, a circa 1 metro dalla camera*' : (bagno ? `🚿 Bagno: ${bagno}` : '')}`}${!isGruppo && roomLink ? `\n\nLa sua camera:\n${roomLink}` : ''}`

  if (type === 'conferma') {
    // Titoli di sezione in grassetto SOLO nella conferma: i blocchi restano condivisi
    // con la modifica, che mantiene i suoi titoli semplici
    const riepilogoCostiBold = riepilogoCosti.replace('💶 RIEPILOGO COSTI', '💶 *RIEPILOGO COSTI*')
    const pagamentoInfoBold = pagamentoInfo.replace('💳 PAGAMENTO', '💳 *PAGAMENTO*')
    return `CONFERMA DI PRENOTAZIONE – CASA ANIA
${SOTTOTITOLO_STRUTTURA}

Gentile ${name},

grazie per averci scelto. Sono felice di confermarle il soggiorno e sarà un piacere accoglierla. 🌿

📅 *IL SUO SOGGIORNO*
Check-in: *${cinF}* (dalle 15:00 alle 20:00)
Check-out: *${coutF}* (entro le 10:00)
Notti: *${notti}*
Ospiti: ${ospiti}
${cameraBlock}

${riepilogoCostiBold}

${pagamentoInfoBold}

💬 *Appena le sarà possibile, le chiedo di comunicarmi l'orario di arrivo, così potrò organizzare al meglio la sua accoglienza.*

📍 *DOVE SIAMO*
Via Liguria 26 – Fizzonasco, Pieve Emanuele (MI) 20072
*A 140 metri dalla palazzina 8 di Humanitas (ortopedia)*

Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

📞 *CONTATTI*
Per qualsiasi necessità sono a sua disposizione:
342 700 4354 (anche WhatsApp)

*CANCELLAZIONE*
Cancellazione gratuita fino a 3 giorni prima dell'arrivo.

A presto,
*Ania*
*Casa Ania*`
  }

  if (type === 'modifica') {
    return `MODIFICA PRENOTAZIONE – CASA ANIA
${SOTTOTITOLO_STRUTTURA}

Gentile ${name},

la sua prenotazione è stata modificata.
Di seguito trova il riepilogo aggiornato del soggiorno.

📅 SOGGIORNO AGGIORNATO
Check-in: *${cinF}* (dalle 15:00 alle 20:00)
Check-out: *${coutF}* (entro le 10:00)
Notti: *${notti}*
Ospiti: ${ospiti}
${cameraBlock}

${riepilogoCosti}

${pagamentoInfo}

🏠 Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

Per qualsiasi domanda sono a sua disposizione:
📞 342 700 4354 (anche WhatsApp)

${firmaFormale}`
  }
  if (type === 'dati_bonifico') {
    return `Gentile ${name},

come da accordi, le invio i dati per il pagamento tramite bonifico bancario.

💳 DATI PER IL BONIFICO

${datiBonifico}

${ricevutaWhatsApp}

Per qualsiasi necessità sono a sua disposizione.

A presto,
Ania`
  }

  if (type === 'promemoria_bonifico') {
    return `Gentile ${name},

le scrivo solo per ricordarle che non ho ancora ricevuto il bonifico relativo al soggiorno dal *${formatDateShort(cin)}* al *${formatDateShort(cout)}*.

Le lascio di nuovo i dati:

💳 DATI PER IL BONIFICO

${datiBonifico}

Quando avrà effettuato il bonifico, può inviarmi la ricevuta direttamente qui su WhatsApp.

Se invece ha già provveduto in queste ore, ignori pure questo messaggio. Grazie.

A presto,
Ania`
  }

  if (type === 'richiesta_orario') {
    return `Gentile ${name},

il suo arrivo si avvicina e vorrei organizzare al meglio la sua accoglienza. 😊

Quando le sarà possibile, può indicarmi anche indicativamente a che ora pensa di arrivare?

Le ricordo che il check-in è previsto dalle 15:00 alle 20:00.

Se pensa di arrivare prima delle 15:00 o dopo le 20:00, mi avvisi pure per tempo, così possiamo organizzarci.

🏠 Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

A presto,
Ania`
  }

  if (type === 'libero') {
    return ''
  }

  if (type === 'ringraziamento') {
    return `Gentile ${name},

grazie per aver soggiornato da noi. È stato un piacere averla come nostra ospite e spero che si sia trovata bene. 🌿

Se ha un momento e le fa piacere, può raccontare la sua esperienza lasciandoci una recensione su Google.

Per noi è davvero importante e può essere utile anche a chi sta cercando un posto dove soggiornare vicino a Humanitas.

⭐ Lascia una recensione:
https://maps.google.com/?cid=12687762198889638693

Grazie ancora per averci scelto.

E se dovesse tornare da queste parti, sarà un piacere accoglierla di nuovo.

Un caro saluto,
Ania`
  }

  if (type === 'pagamento_ricevuto') {
    return `Gentile ${name},

ho ricevuto il suo pagamento. Grazie. ✓

È tutto confermato e la aspetto con piacere *${cinF}*.

🏠 Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

Per qualsiasi necessità sono a sua disposizione.

A presto,
Ania`
  }

  return `ANNULLAMENTO PRENOTAZIONE – CASA ANIA
${SOTTOTITOLO_STRUTTURA}

Gentile ${name},

le confermo che la sua prenotazione è stata annullata.

📅 PRENOTAZIONE ANNULLATA
Check-in: ${formatDateShort(cin)}
Check-out: ${formatDateShort(cout)}
Camera: ${roomFull}
Ospiti: ${ospiti}

Mi dispiace non poterla accogliere questa volta. Se in futuro dovesse averne bisogno, sarà un piacere ospitarla.

Per qualsiasi necessità sono a sua disposizione:
📞 342 700 4354 (anche WhatsApp)

${firmaFormale}`
}

// openWhatsApp vive in lib/whatsapp.ts (condiviso con la proposta alle richieste)

export default function BookingDetail() {
  // Arrivo dalla conferma di una richiesta (?da=richiesta): toast discreto per qualche secondo
  const searchParams = useSearchParams()
  const [toastRichiesta, setToastRichiesta] = useState(() => searchParams.get('da') === 'richiesta')
  // Traccia: la richiesta da cui è nata questa prenotazione (pezzo 4), se c'è
  const [richiestaOrigine, setRichiestaOrigine] = useState<{ id: string; created_at: string; canale: string } | null>(null)
  useEffect(() => {
    if (!toastRichiesta) return
    const t = setTimeout(() => setToastRichiesta(false), 4000)
    return () => clearTimeout(t)
  }, [toastRichiesta])
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [groupBookings, setGroupBookings] = useState<any[]>([])
  // Altre prenotazioni dello stesso ospite (anche annullate): se ha mandato
  // più richieste dal sito, magari una sbagliata, da qui si ritrovano tutte
  const [otherBookings, setOtherBookings] = useState<any[]>([])
  // Conferma della richiesta dal sito: un solo tocco, poi il bottone sparisce
  const [confirming, setConfirming] = useState(false)
  const [erroreConferma, setErroreConferma] = useState<string | null>(null)
  const [segnandoPagato, setSegnandoPagato] = useState(false)
  const [errorePagato, setErrorePagato] = useState<string | null>(null)
  // Parte 2 (05/09/2026): avvisi delle altre azioni della scheda. avvisoScheda
  // sta in cima alla scheda (rilettura fallita dopo un salvataggio riuscito,
  // cliente non aggiornato, log WhatsApp non registrato); gli altri stanno
  // accanto alla loro azione.
  const [avvisoScheda, setAvvisoScheda] = useState<string | null>(null)
  const [erroreSoggiorno, setErroreSoggiorno] = useState<string | null>(null)
  const [erroreCambioCamera, setErroreCambioCamera] = useState<string | null>(null)
  const [erroreAnnulla, setErroreAnnulla] = useState<string | null>(null)
  const [annullando, setAnnullando] = useState(false)
  const [erroreMotivo, setErroreMotivo] = useState<string | null>(null)
  const [salvandoMotivo, setSalvandoMotivo] = useState(false)
  // Sconto V4: un solo sconto per prenotazione (percentuale o totale
  // concordato), salvato nei campi discount_type/discount_value. La tariffa
  // a notte non viene MAI toccata dallo sconto.
  const [scontoPct, setScontoPct] = useState('')
  const [scontoTot, setScontoTot] = useState('')
  const [scontoInfo, setScontoInfo] = useState('')
  // Con un totale concordato, cambiare date/camera/ospiti/letto richiede una
  // scelta esplicita (Mantieni/Rimuovi) prima di poter salvare: mai silenzioso
  const [scontoDecisione, setScontoDecisione] = useState<'mantieni' | 'rimuovi' | null>(null)
  // Conferma a due tocchi per la rimozione dello sconto dalla scheda
  const [confermaRimuoviSconto, setConfermaRimuoviSconto] = useState(false)
  const [rimuovendoSconto, setRimuovendoSconto] = useState(false)
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saveEditError, setSaveEditError] = useState<string | null>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const [showCancel, setShowCancel] = useState(false)
  // Dopo l'annullamento la pagina si svuota e resta solo l'avviso di conferma:
  // vedere ancora la prenotazione sotto faceva dubitare che fosse andata a buon fine
  const [cancelDone, setCancelDone] = useState(false)
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
        .select('id, check_in, check_out, guest_name, rooms(name), guests(full_name)')
        .eq('room_id', room_id).neq('status', 'annullata').neq('id', id)
        .lt('check_in', check_out).gt('check_out', check_in),
      supabase.from('bookings')
        .select('id, room_id, num_guests, extra_bed_dates, check_in, check_out').eq('extra_bed', true).neq('status', 'annullata').neq('id', id)
        .lt('check_in', check_out).gt('check_out', check_in),
    ])
    if (conf && conf.length > 0) {
      const b = conf[0] as any
      setConflitto(`⚠️ ${b.rooms?.name || 'Camera'} già occupata dal ${b.check_in} al ${b.check_out} (${b.guest_name || b.guests?.full_name || 'altro cliente'})`)
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
        shuttle: b.shuttle || '',
        num_guests: b.num_guests, extra_bed: b.extra_bed, extra_bed_dates: b.extra_bed_dates || (b.extra_bed ? getDaysBetween(b.check_in, b.check_out) : []),
        // Tariffa della notte più economica (lib/prezzoNotti): le righe salvate
        // col vecchio calcolo a persone massime vengono riallineate, così il
        // salvataggio ricalcola il totale notte per notte
        price_per_night: tariffaFormDaSalvato(b.rooms, b),
        discount_type: b.discount_type || null,
        discount_value: b.discount_value ?? null,
        notes: b.notes || '',
        color: b.color || '',
        bonifico: b.bonifico || false,
        pagato: b.pagato || false,
        source: b.source || 'diretta',
        extra_phone_1: b.extra_phone_1 || '',
        extra_phone_1_name: b.extra_phone_1_name || '',
        chi_e: b.chi_e || '',
        extra_phone_2: b.extra_phone_2 || '',
        extra_phone_2_name: b.extra_phone_2_name || '',
        guest_name: b.guest_name || b.guests?.full_name || '',
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
          .select('id, check_in, check_out, status, group_id, source, guest_name, rooms(name)')
          .eq('guest_id', b.guest_id)
          .neq('id', id)
          .order('check_in', { ascending: false })
          .then(({ data: others }) => {
            setOtherBookings((others || []).filter((x: any) => !(b.group_id && x.group_id === b.group_id)))
          })
      }
      // Richiesta di prenotazione da cui è nata (prenotazione_id = primo segmento
      // del gruppo). La tabella richieste può non esistere ancora: nessun avviso.
      if (b?.id) {
        supabase.from('richieste')
          .select('id, created_at, canale')
          .eq('prenotazione_id', b.id)
          .maybeSingle()
          .then(({ data: ric }) => { if (ric) setRichiestaOrigine(ric as { id: string; created_at: string; canale: string }) })
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

  // Conto del form di modifica: sempre in modalità RICALCOLO (senza totale
  // salvato), così l'anteprima mostra il prezzo che verrebbe scritto salvando
  // Conto NOTTE PER NOTTE del form (lib/prezzoNotti): nelle notti col letto
  // ci sono num_guests persone, nelle altre la capienza base; extra_bed_total
  // è tutto ciò che supera la tariffa × notti (0 se il letto è compreso, Lena a 3)
  function contoNottiEdit() {
    const room = rooms.find(r => r.id === editForm.room_id)
    return prezzoPrenotazione(room, { ...editForm, extra_bed_dates: editForm.extra_bed ? (editForm.extra_bed_dates || []) : [] })
  }

  // Campo «Tariffa/notte» dopo una modifica di date o notti col letto: se
  // seguiva il listino continua a seguirlo, se scritto a mano resta
  function tariffaDopo(dopo: Record<string, unknown>) {
    const room = rooms.find(r => r.id === editForm.room_id)
    return riallineaTariffa(room, editForm, { ...editForm, ...dopo })
  }

  function contoEdit(senzaSconto = false) {
    const extraBedTotal = contoNottiEdit().lettoTotale
    return contoSoggiorno({
      check_in: editForm.check_in, check_out: editForm.check_out,
      price_per_night: editForm.price_per_night, extra_bed_total: extraBedTotal,
      discount_type: senzaSconto ? null : editForm.discount_type,
      discount_value: senzaSconto ? null : editForm.discount_value,
    })
  }

  function calcTotal() {
    if (calcNotti(editForm.check_in, editForm.check_out) <= 0) return 0
    return contoEdit().totale
  }

  // Un campo economico è cambiato rispetto al salvato? Solo in quel caso il
  // salvataggio ricalcola il totale: i totali storici non si reinterpretano
  // per una nota o un colore (regola lettura vs ricalcolo della V4)
  function economicoCambiato() {
    if (!booking) return false
    return editForm.check_in !== booking.check_in
      || editForm.check_out !== booking.check_out
      || editForm.room_id !== booking.room_id
      || Number(editForm.num_guests) !== Number(booking.num_guests)
      || Number(editForm.price_per_night) !== Number(booking.price_per_night)
      || JSON.stringify(editForm.extra_bed_dates || []) !== JSON.stringify(booking.extra_bed_dates || [])
      || (editForm.discount_type || null) !== (booking.discount_type || null)
      || Number(editForm.discount_value || 0) !== Number(booking.discount_value || 0)
  }

  // Il prezzo pieno è cambiato mentre c'è un totale concordato salvato:
  // serve la scelta esplicita Mantieni/Rimuovi prima di salvare
  function serveDecisioneSconto() {
    if (!booking || booking.discount_type !== 'target_total') return false
    if (editForm.discount_type !== 'target_total') return false
    if (scontoDecisione) return false
    const coreCambiato = editForm.check_in !== booking.check_in
      || editForm.check_out !== booking.check_out
      || editForm.room_id !== booking.room_id
      || Number(editForm.num_guests) !== Number(booking.num_guests)
      || JSON.stringify(editForm.extra_bed_dates || []) !== JSON.stringify(booking.extra_bed_dates || [])
    return coreCambiato
  }

  // Il totale concordato deve restare sotto il prezzo pieno, altrimenti non è uno sconto
  function targetNonValido() {
    return editForm.discount_type === 'target_total'
      && !(Number(editForm.discount_value) > 0 && Number(editForm.discount_value) < contoEdit(true).prezzoPieno)
  }

  // Conferma la richiesta (tutti i segmenti se c'è un cambio camera).
  // L'update filtra su status=in_attesa: anche premuto due volte per
  // sbaglio non tocca nulla che sia già confermato
  // Rilettura della scheda dopo un salvataggio riuscito: lo stato cambia SOLO
  // se la lettura riesce; altrimenti torna il messaggio e il chiamante applica
  // in locale quello che ha appena salvato («Prenotazione non trovata» non
  // deve mai comparire per un errore di rete dopo un salvataggio riuscito).
  async function rileggiScheda(): Promise<string | null> {
    type Riga = Record<string, unknown> & { group_id?: string | null }
    const letto = await leggiConEsito<Riga>(
      () => supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single(),
      'ricaricare la scheda')
    if (letto.errore || !letto.data) return MESSAGGIO_RILETTURA
    const scheda = letto.data
    let gruppo: Riga[] | null = null
    if (scheda.group_id) {
      const g = await leggiConEsito<Riga[]>(
        () => supabase.from('bookings').select('*, rooms(*)').eq('group_id', scheda.group_id).neq('status', 'annullata').order('check_in', { ascending: true }),
        'ricaricare la scheda')
      if (g.errore) return MESSAGGIO_RILETTURA
      gruppo = g.data || []
    }
    setBooking(scheda)
    if (gruppo) setGroupBookings(gruppo)
    return null
  }

  // Errori di salvataggio visibili (05/09/2026): lo stato «confermata» sullo
  // schermo cambia SOLO se l'update è riuscito; con un errore il bottone
  // torna attivo e compare «Non salvato, riprova» sotto di lui.
  async function confermaPrenotazione() {
    if (confirming) return
    setConfirming(true)
    setErroreConferma(null)
    try {
      const scrivi = () => booking.group_id
        ? supabase.from('bookings').update({ status: 'confermata' }).eq('group_id', booking.group_id).eq('status', 'in_attesa')
        : supabase.from('bookings').update({ status: 'confermata' }).eq('id', id).eq('status', 'in_attesa')
      const errore = await scriviPoiAggiorna(scrivi, () => {
        setBooking({ ...booking, status: 'confermata' })
        setGroupBookings(gs => gs.map((g: any) => g.status === 'in_attesa' ? { ...g, status: 'confermata' } : g))
      })
      setErroreConferma(errore)
    } finally {
      setConfirming(false)
    }
  }

  // «Segna come pagato» (bonifico ricevuto): stessa regola della conferma.
  async function segnaPagato() {
    if (segnandoPagato) return
    setSegnandoPagato(true)
    setErrorePagato(null)
    try {
      const errore = await scriviPoiAggiorna(
        () => supabase.from('bookings').update({ pagato: true }).eq('id', id),
        () => setBooking({ ...booking, pagato: true }),
      )
      setErrorePagato(errore)
    } finally {
      setSegnandoPagato(false)
    }
  }

  // Applica lo sconto SENZA toccare la tariffa a notte: si salvano solo
  // discount_type e discount_value, il totale lo deriva contoSoggiorno()
  function applicaScontoPct() {
    const p = parseFloat(scontoPct.replace(',', '.'))
    if (!p || p <= 0 || p >= 100) { setScontoInfo('❌ La percentuale deve essere tra 0 e 100 esclusi'); return }
    setEditForm({ ...editForm, discount_type: 'percentage', discount_value: p })
    setScontoInfo('')
  }

  function applicaScontoTot() {
    const t = parseFloat(scontoTot.replace(',', '.'))
    const pieno = contoEdit(true).prezzoPieno
    if (!t || t <= 0) return
    if (t >= pieno) { setScontoInfo(`❌ Il totale concordato deve essere sotto il prezzo pieno (€${pieno.toFixed(2).replace('.', ',')})`); return }
    setEditForm({ ...editForm, discount_type: 'target_total', discount_value: t })
    setScontoInfo('')
  }

  function rimuoviScontoForm() {
    setEditForm({ ...editForm, discount_type: null, discount_value: null })
    setScontoPct(''); setScontoTot(''); setScontoInfo('')
  }

  async function saveEdit() {
    // Blocco di sicurezza: non salvare mai date impossibili (check-out non successivo al check-in)
    if (!editForm.check_in || !editForm.check_out || editForm.check_out <= editForm.check_in) {
      setSaveEditError('Date non valide: il check-out deve essere almeno una notte dopo il check-in. Correggi le date prima di salvare.')
      return
    }
    // Con un totale concordato e prezzo pieno cambiato serve la scelta
    // esplicita Mantieni/Rimuovi: mai mantenere in silenzio il vecchio totale
    if (serveDecisioneSconto()) {
      setSaveEditError('C\'è un totale concordato e hai cambiato dati che influiscono sul prezzo: scegli prima "Mantieni" o "Rimuovi sconto" nel riquadro Sconto.')
      return
    }
    if (targetNonValido()) {
      setSaveEditError(`Il totale concordato (€${Number(editForm.discount_value)}) non è più sotto il prezzo pieno (€${contoEdit(true).prezzoPieno}): correggi o rimuovi lo sconto.`)
      return
    }
    setSaveEditError('')
    setSaving(true)
    // Conto notte per notte (lib/prezzoNotti): letto e differenze di tariffa
    const extraBedTotal = contoNottiEdit().lettoTotale
    // Regola lettura vs ricalcolo: il totale si ricalcola SOLO se è cambiato
    // un campo economico (o c'è uno sconto attivo). Cambiare una nota non
    // deve reinterpretare un totale storico salvato.
    const total = (economicoCambiato() || editForm.discount_type)
      ? contoEdit().totale
      : Number(booking.total_amount)
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
      // Campi sconto inclusi solo a colonne migrate (booking le riporta anche
      // se null) o se c'è uno sconto da salvare: come per chi_e, i salvataggi
      // non si bloccano prima della migrazione
      ...(booking.discount_type !== undefined || editForm.discount_type ? {
        discount_type: editForm.discount_type || null,
        discount_value: editForm.discount_type ? Number(editForm.discount_value) : null,
      } : {}),
      check_in_time: editForm.check_in_time || null,
      // navetta inclusa solo a colonna migrata o se valorizzata (come chi_e)
      ...(booking.shuttle !== undefined || editForm.shuttle ? { shuttle: editForm.shuttle || null } : {}),
      notes: editForm.notes || null,
      color: editForm.color || null,
      bonifico: editForm.bonifico || false,
      pagato: editForm.pagato || false,
      source: editForm.source || 'diretta',
      extra_phone_1: editForm.extra_phone_1 ? normalizePhone(editForm.extra_phone_1) : null,
      extra_phone_1_name: editForm.extra_phone_1_name || null,
      // chi_e incluso solo se la colonna esiste già sul DB o se è stato valorizzato: gli altri salvataggi non si bloccano prima della migrazione
      ...(booking.chi_e !== undefined || editForm.chi_e ? { chi_e: editForm.chi_e || null } : {}),
      extra_phone_2: editForm.extra_phone_2 ? normalizePhone(editForm.extra_phone_2) : null,
      extra_phone_2_name: editForm.extra_phone_2_name || null,
      // Il nome modificato qui vale per QUESTA prenotazione (bookings.guest_name),
      // non rinomina la scheda cliente. Incluso solo a colonna migrata, come chi_e.
      ...(booking.guest_name !== undefined ? { guest_name: editForm.guest_name?.trim() || null } : {}),
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
    setAvvisoScheda(null)
    const guestId = booking.guest_id || booking.guests?.id
    let avvisoCliente: string | null = null
    if (guestId) {
      const { error: erroreCliente } = await supabase.from('guests').update({
        // La scheda cliente (condivisa da tutte le prenotazioni del numero) non
        // viene più rinominata da qui: prende il nome solo se ne è senza.
        // Finché guest_name non è migrata resta il vecchio comportamento.
        full_name: booking.guest_name === undefined
          ? (editForm.guest_name || booking.guests?.full_name || null)
          : (booking.guests?.full_name || editForm.guest_name?.trim() || null),
        phone: editForm.guest_phone || booking.guests?.phone || null,
        email: editForm.guest_email || booking.guests?.email || null,
      }).eq('id', guestId)
      if (erroreCliente) avvisoCliente = 'Prenotazione salvata, ma i dati del cliente no: riprova dalla scheda cliente.'
    }
    // Prenotazione salvata: se la rilettura fallisce si mostra quello che si è
    // appena salvato, con l'avviso, mai «Prenotazione non trovata»
    const erroreRilettura = await rileggiScheda()
    if (erroreRilettura) setBooking({ ...booking, ...updates })
    setAvvisoScheda([avvisoCliente, erroreRilettura].filter(Boolean).join(' ') || null)
    setEditing(false)
    setSaving(false)
  }

  // Rimozione sconto dalla scheda, con conferma a due tocchi: azzera i campi
  // sconto e riporta il totale al prezzo pieno derivato. I pagamenti non si
  // toccano mai: il "resta da avere" si aggiorna da solo leggendo il totale
  async function rimuoviScontoDiretto() {
    if (!booking?.discount_type || rimuovendoSconto) return
    setRimuovendoSconto(true)
    const pieno = contoSoggiorno({
      check_in: booking.check_in, check_out: booking.check_out,
      price_per_night: booking.price_per_night, extra_bed_total: booking.extra_bed_total,
    }).totale
    const { error } = await supabase.from('bookings').update({
      discount_type: null, discount_value: null,
      total_amount: pieno, updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) {
      setAvvisoScheda(messaggioNonSalvato(error))
    } else {
      const erroreRilettura = await rileggiScheda()
      if (erroreRilettura) setBooking({ ...booking, discount_type: null, discount_value: null, total_amount: pieno })
      setAvvisoScheda(erroreRilettura)
      setEditForm((f: any) => ({ ...f, discount_type: null, discount_value: null }))
    }
    setConfermaRimuoviSconto(false)
    setRimuovendoSconto(false)
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
      // Conto notte per notte con le nuove date (lib/prezzoNotti): letto solo
      // dove addebitato e differenze di tariffa se le persone cambiano
      const extraBedTotal = prezzoPrenotazione(c.seg.rooms, { ...c.seg, check_in: c.s, check_out: c.e, extra_bed_dates: ebDates }).lettoTotale
      // Totale dal conto unico: la percentuale segue le nuove notti; il totale
      // concordato resta se ancora sotto il nuovo prezzo pieno, altrimenti
      // decade e lo si dice in anteprima (mai in silenzio)
      const conto = contoSoggiorno({
        check_in: c.s, check_out: c.e,
        price_per_night: c.seg.price_per_night, extra_bed_total: extraBedTotal,
        discount_type: c.seg.discount_type, discount_value: c.seg.discount_value,
      })
      const scontoDecaduto = !!c.seg.discount_type && conto.sconto === 0
      return {
        id: c.seg.id, roomName: c.seg.rooms?.name || 'Camera',
        check_in: c.s, check_out: c.e, nights: days.length,
        price_per_night: Number(c.seg.price_per_night),
        extra_bed_dates: ebDates, extra_bed_total: extraBedTotal, total: conto.totale,
        sconto: conto.sconto, scontoDecaduto,
        discount_type: scontoDecaduto ? null : (c.seg.discount_type || null),
        discount_value: scontoDecaduto ? null : (c.seg.discount_value ?? null),
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
        .select('id, check_in, check_out, guest_name, guests(full_name)')
        .eq('room_id', c.room_id).neq('status', 'annullata')
        .not('id', 'in', `(${groupIds.join(',')})`)
        .lt('check_in', c.to).gt('check_out', c.from)
      if (data && data.length > 0) {
        const b = data[0] as any
        setStayConflict(`⚠️ ${c.roomName} già occupata dal ${b.check_in} al ${b.check_out} (${b.guest_name || b.guests?.full_name || 'altro cliente'})`)
        return
      }
    }
  }

  async function saveStayEdit() {
    const plan = computeStayPlan(groupBookings, stayForm.check_in, stayForm.check_out)
    if (plan.error || stayConflict) return
    setSavingStay(true)
    setErroreSoggiorno(null)
    setAvvisoScheda(null)
    const now = new Date().toISOString()
    // Un update per segmento, uno dopo l'altro: al primo errore ci si ferma e
    // l'avviso dice se qualcosa era già stato salvato (lib/prenotazioneScritture)
    const scritture: Array<() => PromiseLike<{ error: unknown }>> = []
    for (const seg of plan.kept) {
      scritture.push(() => supabase.from('bookings').update({
        check_in: seg.check_in,
        check_out: seg.check_out,
        extra_bed: seg.extra_bed_dates.length > 0,
        extra_bed_dates: seg.extra_bed_dates,
        extra_bed_total: seg.extra_bed_total,
        total_amount: seg.total,
        // Sconto del segmento: mantenuto (o decaduto, già mostrato in anteprima).
        // Incluso solo a colonne migrate, come nel salvataggio normale
        ...(booking.discount_type !== undefined ? {
          discount_type: seg.discount_type,
          discount_value: seg.discount_value,
        } : {}),
        updated_at: now,
      }).eq('id', seg.id))
    }
    for (const seg of plan.removed) {
      scritture.push(() => supabase.from('bookings').update({
        status: 'annullata',
        cancelled_at: now,
        cancelled_reason: 'Camera non più necessaria: date del soggiorno modificate',
        updated_at: now,
      }).eq('id', seg.id))
    }
    const { errore } = await salvaInSequenza(scritture)
    if (errore) {
      // Il modulo resta aperto con le date scelte, il bottone torna attivo
      setErroreSoggiorno(errore)
      setSavingStay(false)
      return
    }
    setEditingStay(false)
    // Se il segmento aperto è stato annullato, passa al primo segmento rimasto
    if (!plan.kept.find(k => k.id === id)) {
      setSavingStay(false)
      router.replace(`/prenotazioni/${plan.kept[0].id}`)
      return
    }
    const erroreRilettura = await rileggiScheda()
    if (erroreRilettura) {
      // Salvato ma non riletto: si applica in locale il piano appena scritto
      type Segmento = { id: string; check_in: string; check_out: string; extra_bed_dates: string[]; extra_bed_total: number; total: number }
      const locale = (seg: Segmento) => ({
        ...(groupBookings.find(g => g.id === seg.id) || {}),
        check_in: seg.check_in, check_out: seg.check_out,
        extra_bed: seg.extra_bed_dates.length > 0, extra_bed_dates: seg.extra_bed_dates,
        extra_bed_total: seg.extra_bed_total, total_amount: seg.total,
      })
      setGroupBookings(plan.kept.map(locale))
      const mio = plan.kept.find(k => k.id === id)
      if (mio) setBooking({ ...booking, ...locale(mio) })
      setAvvisoScheda(erroreRilettura)
    }
    setSavingStay(false)
  }

  async function addRoomChange() {
    let groupId = booking.group_id
    setErroreCambioCamera(null)
    if (!groupId) {
      const nuovo = crypto.randomUUID()
      const errore = await scriviPoiAggiorna(
        () => supabase.from('bookings').update({ group_id: nuovo }).eq('id', id),
        () => setBooking({ ...booking, group_id: nuovo }),
      )
      if (errore) { setErroreCambioCamera(errore); return }
      groupId = nuovo
    }
    const lastCheckOut = groupBookings.length > 0
      ? [...groupBookings].sort((a, z) => z.check_out.localeCompare(a.check_out))[0].check_out
      : booking.check_out
    const guestId = booking.guest_id || booking.guests?.id
    router.push(`/nuova?guest_id=${guestId}&group_id=${groupId}&check_in=${lastCheckOut}&returnTo=/prenotazioni/${id}`)
  }

  async function markComplete() {
    const errore = await scriviPoiAggiorna(
      () => supabase.from('bookings').update({ status: 'completata' }).eq('id', id),
      () => setBooking({ ...booking, status: 'completata' }),
    )
    setAvvisoScheda(errore)
  }

  // Annullamento: con un errore la finestra resta aperta con l'avviso (niente
  // alert del browser) e la prenotazione resta com'è. Il log WhatsApp è
  // secondario: se non si scrive lo si dice nella schermata di conferma.
  async function cancelBooking() {
    if (annullando) return
    setAnnullando(true)
    setErroreAnnulla(null)
    try {
      const errore = await scriviPoiAggiorna(
        () => supabase.from('bookings').update({ status: 'annullata', cancelled_at: new Date().toISOString(), cancelled_reason: cancelReason }).eq('id', id),
        () => setBooking({ ...booking, status: 'annullata' }),
      )
      if (errore) { setErroreAnnulla(errore); return }
      const msg = buildWhatsappMsg(booking, 'annullamento', groupBookings, acconti)
      const { error: erroreLog } = await supabase.from('booking_whatsapp_log').insert({ booking_id: id, message_type: 'annullamento', message_text: msg, sent: false })
      setAvvisoScheda(erroreLog ? 'Prenotazione annullata, ma il messaggio non è stato registrato nello storico WhatsApp.' : null)
      setShowCancel(false)
      window.scrollTo({ top: 0 })
      setCancelDone(true)
    } finally {
      setAnnullando(false)
    }
  }

  function sendWhatsapp(type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto') {
    const rawPhone = booking.guests?.phone?.replace(/\D/g, '')
    const phone = rawPhone?.startsWith('39') ? rawPhone : `39${rawPhone}`
    const msg = buildWhatsappMsg(booking, type, groupBookings, acconti)
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
    `https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsappMsg(booking, type, groupBookings, acconti))}`
  const waClick = (type: WaTipo, preferBusiness: boolean = false) => (e: React.MouseEvent) => {
    e.preventDefault()
    openWhatsApp(waPhone!, buildWhatsappMsg(booking, type, groupBookings, acconti), preferBusiness)
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

  // Dopo l'annullamento la pagina si svuota: resta solo l'avviso di conferma
  if (cancelDone) return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="scheda-in bg-[#DCE8DD] text-[#2f6a4d] rounded-2xl px-8 py-8 shadow-lg text-center w-full max-w-xs">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-white/70 flex items-center justify-center text-2xl font-bold">✓</div>
        <p className="font-semibold text-lg leading-snug">La prenotazione è stata cancellata</p>
        {avvisoScheda && <AvvisoAzione testo={avvisoScheda} className="mt-3 text-left" />}
        {/* Torna alla pagina vera di provenienza (calendario, arrivi, elenco…),
            come il pulsante Indietro; l'elenco è solo la riserva */}
        <button type="button" onClick={() => smartBack(router, '/calendario')} className="inline-block mt-5 rounded-lg px-4 py-2 text-sm font-semibold bg-white/80 transition-transform duration-100 active:scale-[0.97]">
          Torna indietro
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4">
      {/* Riserva sul calendario: Ania entra quasi sempre da lì e non vuole mai
          finire sull'elenco prenotazioni quando il ritorno vero non è possibile */}
      <BackBar href="/calendario" />
      {avvisoScheda && !cancelDone && <AvvisoAzione testo={avvisoScheda} className="mb-3" />}
      {toastRichiesta && (
        <div role="status" className="chip-in fixed left-4 right-4 top-14 lg:top-4 lg:left-auto lg:w-80 z-[60] bg-green-dark text-cream-text text-sm rounded-xl px-4 py-2.5 shadow-lg">
          Prenotazione creata da richiesta
        </div>
      )}
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
      {richiestaOrigine && (
        <p className="text-xs -mt-2 mb-3" style={{ color: '#6b6b60' }}>
          Nata dalla richiesta del {new Date(richiestaOrigine.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} via {richiestaOrigine.canale === 'web' ? 'sito' : richiestaOrigine.canale === 'whatsapp' ? 'WhatsApp' : 'telefono'}
          {' · '}<Link href={`/richieste?apri=${richiestaOrigine.id}`} className="underline underline-offset-2">vedi in archivio</Link>
        </p>
      )}

      {/* Su desktop: contenuto a sinistra, pannello Azioni a destra. Su mobile tutto in colonna come prima. */}
      <div className={editing ? 'lg:max-w-2xl' : 'lg:flex lg:items-start lg:gap-5'}>
      <div className={editing ? '' : 'lg:flex-[1.6] lg:min-w-0'}>
      {/* MODALITÀ MODIFICA */}
      {editing ? (
        <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
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
          }} className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 mb-3 text-sm">
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          {/* min-w-0 ovunque: i campi data su iPhone hanno una larghezza
              minima propria e senza questo sfondano le due colonne */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 mb-1">Check-in</p>
              <input type="date" value={editForm.check_in} onChange={e => {
                const newIn = e.target.value
                // Se il check-out manca o cadrebbe prima/uguale al nuovo check-in, spostalo a una notte dopo
                const newOut = newIn && (!editForm.check_out || editForm.check_out <= newIn) ? nextDay(newIn) : editForm.check_out
                setEditForm({ ...editForm, check_in: newIn, check_out: newOut, price_per_night: tariffaDopo({ check_in: newIn, check_out: newOut }) })
                checkDisponibilita(editForm.room_id, newIn, newOut)
              }} className="w-full min-w-0 appearance-none bg-white border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 mb-1">Check-out</p>
              <input type="date" value={editForm.check_out} min={editForm.check_in ? nextDay(editForm.check_in) : undefined} onChange={e => {
                setEditForm({ ...editForm, check_out: e.target.value, price_per_night: tariffaDopo({ check_out: e.target.value }) })
                checkDisponibilita(editForm.room_id, editForm.check_in, e.target.value)
              }} className="w-full min-w-0 appearance-none bg-white border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
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
              className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">🚌 Navetta</p>
            <div className="flex gap-1.5">
              {([['', 'Da definire'], ['si', 'Sì'], ['no', 'No']] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setEditForm({ ...editForm, shuttle: v })}
                  className={`rounded-full text-sm font-semibold px-4 py-1.5 ${editForm.shuttle === v ? 'text-white' : 'border border-[#C9BFA8] bg-white text-stone'}`}
                  style={editForm.shuttle === v ? { background: '#2D6A4F' } : undefined}>
                  {label}
                </button>
              ))}
            </div>
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
              }} className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Tariffa/notte €</p>
              <input type="number" min={0} value={editForm.price_per_night} onChange={e => setEditForm({ ...editForm, price_per_night: parseFloat(e.target.value) })}
                className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
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
                  const dates = newVal ? getDaysBetween(editForm.check_in, editForm.check_out) : []
                  setEditForm({ ...editForm, extra_bed: newVal, extra_bed_dates: dates, price_per_night: tariffaDopo({ extra_bed: newVal, extra_bed_dates: dates }) })
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
                            setEditForm({ ...editForm, extra_bed_dates: dates, price_per_night: tariffaDopo({ extra_bed_dates: dates }) })
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

          {/* Sconto V4: un solo sconto (percentuale O totale concordato), la
              tariffa a notte non si tocca mai. Visibile solo a colonne migrate */}
          {booking.discount_type !== undefined && calcNotti(editForm.check_in, editForm.check_out) > 0 && (
            <div className="border border-[#C9BFA8] shadow-sm rounded-lg p-3 mb-3">
              <p className="text-xs text-gray-500 mb-2">Sconto {editForm.discount_type && <span className="font-semibold" style={{ color: '#2D6A4F' }}>(attivo: {editForm.discount_type === 'percentage' ? `−${editForm.discount_value}%` : `totale concordato €${editForm.discount_value}`})</span>}</p>
              <div className="flex gap-2 items-center mb-2">
                <input type="number" inputMode="decimal" min={1} max={99} placeholder="%"
                  value={scontoPct} onChange={e => setScontoPct(e.target.value)}
                  className="w-20 border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
                <button type="button" onClick={applicaScontoPct}
                  className="bg-green-mid text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  disabled={!parseFloat(scontoPct.replace(',', '.'))}>
                  Applica %
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <input type="number" inputMode="decimal" min={1} placeholder="Porta il totale a €"
                  value={scontoTot} onChange={e => setScontoTot(e.target.value)}
                  className="w-40 border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
                <button type="button" onClick={applicaScontoTot}
                  className="bg-green-mid text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  disabled={!parseFloat(scontoTot.replace(',', '.'))}>
                  Applica
                </button>
              </div>
              {editForm.discount_type && (() => {
                const c = contoEdit()
                return (
                  <p className="text-xs rounded-lg px-2 py-1.5 mt-2 font-semibold" style={{ background: '#E7EFE9', color: '#2D6A4F' }}>
                    €{c.prezzoPieno.toLocaleString('it-IT')} − €{c.sconto.toLocaleString('it-IT')} = €{c.totale.toLocaleString('it-IT')}
                  </p>
                )
              })()}
              {targetNonValido() && (
                <p className="text-xs rounded-lg px-2 py-1.5 mt-2 font-semibold" style={{ background: '#F6E4DE', color: '#8C3B2E' }}>
                  ❌ Il totale concordato non è più sotto il prezzo pieno (€{contoEdit(true).prezzoPieno.toLocaleString('it-IT')}): correggi o rimuovi lo sconto.
                </p>
              )}
              {/* Totale concordato + dati economici cambiati: scelta obbligatoria, mai silenzioso */}
              {serveDecisioneSconto() && (
                <div className="rounded-lg px-2.5 py-2 mt-2 text-xs" style={{ background: '#F3ECD8', color: '#8a4f2f' }}>
                  <p className="font-semibold mb-1.5">⚠️ Totale concordato €{Number(booking.discount_value).toLocaleString('it-IT')}, ma hai cambiato dati che influiscono sul prezzo. Nuovo prezzo pieno: €{contoEdit(true).prezzoPieno.toLocaleString('it-IT')}.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setScontoDecisione('mantieni')}
                      className="bg-green-mid text-white rounded-lg px-3 py-1.5 font-semibold">
                      Mantieni €{Number(booking.discount_value).toLocaleString('it-IT')}
                    </button>
                    <button type="button" onClick={() => { rimuoviScontoForm(); setScontoDecisione('rimuovi') }}
                      className="bg-white rounded-lg px-3 py-1.5 font-semibold" style={{ color: '#8C3B2E' }}>
                      Rimuovi sconto
                    </button>
                  </div>
                </div>
              )}
              {scontoInfo && (
                <p className="text-xs rounded-lg px-2 py-1.5 mt-2" style={{ background: '#F3ECD8', color: '#8a4f2f' }}>{scontoInfo}</p>
              )}
              {editForm.discount_type && (
                <button type="button" onClick={rimuoviScontoForm}
                  className="w-full mt-2 rounded-lg py-2 text-sm font-semibold bg-sage" style={{ color: '#8C3B2E' }}>
                  ✕ Rimuovi sconto (torna a €{contoEdit(true).prezzoPieno.toLocaleString('it-IT')})
                </button>
              )}
            </div>
          )}

          <div onClick={() => setEditForm({ ...editForm, bonifico: !editForm.bonifico })}
            className="flex items-center justify-between bg-white rounded-lg p-3 mb-3 border border-[#C9BFA8] shadow-sm cursor-pointer active:opacity-70">
            <div>
              <p className="text-sm font-semibold text-green-dark">🏦 Pagamento tramite bonifico</p>
              <p className="text-xs text-green-mid">La conferma includerà l'IBAN</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center ${editForm.bonifico ? 'bg-green-mid' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${editForm.bonifico ? 'translate-x-6' : ''}`} />
            </div>
          </div>

          {/* Provenienza del cliente: con "Sito" la prenotazione mostra il
              pallino 🌐 sul calendario anche se inserita a mano */}
          <div className="mb-3">
            <p className="text-sm text-gray-500 mb-1">Il cliente è arrivato da</p>
            <div className="flex gap-2">
              {([['diretta', 'Diretta'], ['sito_web', '🌐 Sito'], ['whatsapp', 'WhatsApp']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setEditForm({ ...editForm, source: val })}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${editForm.source === val ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-[#C9BFA8]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

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

          {calcNotti(editForm.check_in, editForm.check_out) > 0 && (() => {
            const c = contoEdit()
            const totaleSalvato = Number(booking.total_amount)
            // Il salvataggio ricalcolerà solo se è cambiato un dato economico:
            // se il nuovo totale differisce da quello storico va detto PRIMA
            const ricalcolo = economicoCambiato() || editForm.discount_type
            const nuovoTotale = ricalcolo ? c.totale : totaleSalvato
            return (
              <div className="bg-sage rounded-lg p-3 mb-3 text-sm">
                <p className="text-gray-600">{(() => {
                  // Tariffa diversa fra le notti: dettaglio per notte tutto compreso
                  const cn = contoNottiEdit()
                  return cn.tariffaUniforme ? `${c.notti} notti × €${editForm.price_per_night}` : testoDettaglioNotti(cn.notti, n => `€${n}`)
                })()}{c.sconto > 0 ? ` − sconto €${c.sconto.toLocaleString('it-IT')}` : ''}</p>
                <p className="font-bold text-green-mid text-lg">Totale: €{nuovoTotale.toLocaleString('it-IT')}</p>
                {ricalcolo && Math.abs(nuovoTotale - totaleSalvato) > 0.005 && (
                  <p className="text-xs mt-1" style={{ color: '#8a4f2f' }}>
                    Da €{totaleSalvato.toLocaleString('it-IT')} a €{nuovoTotale.toLocaleString('it-IT')} (ricalcolato dai nuovi dati)
                  </p>
                )}
              </div>
            )
          })()}

          {/* Pagato per ultimo: è la spunta finale, dopo tutti i conti */}
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

          <button onClick={saveEdit} disabled={saving || !!conflitto || serveDecisioneSconto() || targetNonValido() || ((editForm.extra_bed_dates?.length > 0) && (editForm.extra_bed_dates || []).some((day: string) => { const contrib = editForm.room_id === LENA_ID && editForm.num_guests >= 4 ? 2 : 1; return (extraBedsPerDay[day] || 0) + contrib > 2 }))}
            className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50 mb-3">
            {saving ? 'Salvataggio...' : '💾 Salva modifiche'}
          </button>
          <button onClick={() => setEditing(false)}
            className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 font-semibold">
            Annulla modifiche
          </button>
        </div>
      ) : (
        /* Tutti i riquadri bianchi col bordo del campo «Cerca nome» (#C9BFA8), stessa intensità
           ovunque (Ania, 05/09/2026); il letto aggiuntivo resta segnalato dalla sua riga marroncina */
        /* VISUALIZZAZIONE NORMALE */
        <div className={`rounded-xl p-5 border mb-4 border-[#C9BFA8] shadow-sm bg-white`}>
          {/* Cliente in testa: nome, telefono con chiamata diretta, poi camera */}
          <div className="flex justify-between items-start gap-2 mb-2">
            <p className="font-bold text-lg min-w-0">{nomeOspite(booking)}</p>
            <Link href={`/clienti/${guest?.id}?edit=1`} className="text-green-mid text-sm shrink-0 pt-1">✏️ Modifica</Link>
          </div>
          {guest?.phone && (
            <a href={`tel:${(guest.phone || '').replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold py-1 mb-1" style={{ color: '#2D6A4F' }}>
              📞 {guest.phone}
            </a>
          )}
          {guest?.email && <p className="text-sm text-gray-600 mb-1">✉️ {guest.email}</p>}
          {/* Documenti del cliente: riga discreta, apre la scheda cliente;
              dopo il telefono sta sulla stessa riga, con un po' d'aria (Ania, 05/09/2026) */}
          <RigaDocumentiPrenotazione guestId={guest?.id} className={guest?.phone ? 'ml-4' : ''} />
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
          {/* Stesso numero, nominativo diverso: avviso persistente, ricalcolato
              dai dati salvati a ogni apertura. Solo informativo, non blocca nulla. */}
          {nomeDiverso(booking) && (
            <div className="rounded-xl px-3.5 py-3 mt-3 mb-1" style={{ background: '#FBE7E4', border: '2px solid #C0392B' }}>
              <p className="text-xs font-extrabold tracking-wider mb-1.5" style={{ color: '#C0392B' }}>⚠️ NUMERO GIÀ USATO CON UN ALTRO NOMINATIVO</p>
              <p className="text-[12.5px]" style={{ color: '#8a5049' }}>Questa prenotazione</p>
              <p className="text-sm font-bold text-green-dark mb-1.5">{nomeOspite(booking)}</p>
              <p className="text-[12.5px]" style={{ color: '#8a5049' }}>Con lo stesso numero in passato</p>
              <p className="text-sm font-bold" style={{ color: '#C0392B' }}>{nomiPrecedenti(booking, otherBookings).join(' · ')}</p>
            </div>
          )}
          <p className="text-gray-500 mt-4 mb-1.5">{booking.rooms?.name}</p>
          {booking.check_in_time && (
            <div className="bg-sage border border-[#C9BFA8] shadow-sm rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
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
            {!booking.discount_type && (<>
              {(() => {
                // Persone diverse fra le notti: il dettaglio al posto di una tariffa unica
                const dett = dettaglioNottiSalvato(booking.rooms, booking)
                return dett
                  ? <div className="col-span-2"><span className="text-gray-500">Tariffa</span><p className="font-semibold">{testoDettaglioNotti(dett, n => `€${n}`)}</p></div>
                  : <div><span className="text-gray-500">Tariffa/notte</span><p className="font-semibold">€{Number(booking.price_per_night).toFixed(0)}</p></div>
              })()}
              <div><span className="text-gray-500">Totale</span><p className="font-bold text-green-mid">€{Number(booking.total_amount).toFixed(0)}</p></div>
            </>)}
          </div>
          {/* Sconto attivo: prezzo pieno, sconto e totale sempre in chiaro,
              con la rimozione a portata di mano (conferma a due tocchi) */}
          {booking.discount_type && (() => {
            const c = contoSoggiorno(booking)
            return (
              <div className="bg-white border border-[#C9BFA8] shadow-sm rounded-xl p-3 mb-3 text-sm">
                <div className="flex justify-between items-baseline py-0.5">
                  <span className="text-gray-500">Prezzo pieno <span className="text-xs">({(() => {
                    const dett = dettaglioNottiSalvato(booking.rooms, booking)
                    return dett ? testoDettaglioNotti(dett, n => `€${n}`) : `${c.notti} × €${Number(booking.price_per_night).toFixed(0)}${Number(booking.extra_bed_total) > 0 ? ' + letto' : ''}`
                  })()})</span></span>
                  <span className="font-semibold">€{c.prezzoPieno.toLocaleString('it-IT')}</span>
                </div>
                <div className="flex justify-between items-baseline rounded-lg px-2 py-1 my-1" style={{ background: '#E7EFE9' }}>
                  <span className="font-semibold" style={{ color: '#2D6A4F' }}>Sconto a lei riservato</span>
                  <span className="font-bold" style={{ color: '#2D6A4F' }}>−€{c.sconto.toLocaleString('it-IT')}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-card-border">
                  <span className="font-semibold">Totale soggiorno</span>
                  <span className="font-bold text-green-mid text-base">€{c.totale.toLocaleString('it-IT')}</span>
                </div>
                {!confermaRimuoviSconto ? (
                  <button onClick={() => setConfermaRimuoviSconto(true)}
                    className="w-full mt-2 rounded-lg py-2 text-sm font-semibold bg-sage" style={{ color: '#8C3B2E' }}>
                    ✕ Rimuovi sconto
                  </button>
                ) : (
                  <div className="mt-2 rounded-lg p-2 text-xs" style={{ background: '#F3ECD8', color: '#8a4f2f' }}>
                    <p className="font-semibold mb-1.5">Il totale torna a €{c.prezzoPieno.toLocaleString('it-IT')}. I pagamenti ricevuti non cambiano.</p>
                    <div className="flex gap-2">
                      <button onClick={rimuoviScontoDiretto} disabled={rimuovendoSconto}
                        className="bg-[#B5502F] text-white rounded-lg px-3 py-1.5 font-semibold disabled:opacity-60">
                        {rimuovendoSconto ? 'Rimuovo…' : 'Sì, rimuovi'}
                      </button>
                      <button onClick={() => setConfermaRimuoviSconto(false)}
                        className="bg-white rounded-lg px-3 py-1.5 font-semibold text-gray-600">
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
          {/* Spia discreta: totale salvato diverso dal derivato (dato storico).
              Solo informativa: il salvato resta autorevole, nulla viene toccato */}
          {!booking.discount_type && (() => {
            const derivato = contoSoggiorno({
              check_in: booking.check_in, check_out: booking.check_out,
              price_per_night: booking.price_per_night, extra_bed_total: booking.extra_bed_total,
            }).totale
            return Math.abs(derivato - Number(booking.total_amount)) > 0.005 ? (
              <p className="text-[11px] text-gray-400 -mt-2 mb-3">Totale salvato personalizzato (il calcolo dai dati darebbe €{derivato.toLocaleString('it-IT')}): resta valido quello salvato.</p>
            ) : null
          })()}
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
          {/* Nota scritta dal cliente nel modulo del sito (o da Ania): deve
              saltare all'occhio, non nascondersi in fondo alla card */}
          {booking.notes && (
            <div className="rounded-r-xl px-3.5 py-2.5" style={{ background: '#FDF2EF', borderLeft: '4px solid #C0392B' }}>
              <p className="text-[11px] font-extrabold tracking-widest mb-1" style={{ color: '#C0392B' }}>NOTA DEL CLIENTE</p>
              <p className="text-[15px] text-green-dark leading-relaxed whitespace-pre-wrap">{booking.notes}</p>
            </div>
          )}

          {/* Conto del soggiorno: acconti ricevuti e residuo */}
          {accontiOk && booking.status !== 'annullata' && (() => {
            const totaleDovuto = groupBookings.length > 1
              ? groupBookings.reduce((s: number, x: any) => s + Number(x.total_amount), 0)
              : Number(booking.total_amount)
            const ricevuto = acconti.reduce((s, a) => s + Number(a.amount), 0)
            const residuo = totaleDovuto - ricevuto
            return (
              <div className="mt-3 bg-white border border-[#C9BFA8] shadow-sm rounded-xl p-3">
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
                    className="w-20 border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                  <select value={accontoForm.method} onChange={e => setAccontoForm({ ...accontoForm, method: e.target.value })}
                    className="border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm bg-white">
                    <option value="contanti">💵 Contanti</option>
                    <option value="bonifico">🏦 Bonifico</option>
                  </select>
                  <input type="date" value={accontoForm.paid_on}
                    onChange={e => setAccontoForm({ ...accontoForm, paid_on: e.target.value })}
                    className="basis-full sm:basis-0 sm:flex-1 sm:min-w-0 border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm bg-white" />
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
                      <span className="text-xs text-[#5B4E82] ml-2">{gb.check_in} → {gb.check_out} ({n} notti) · {(() => {
                        const dett = dettaglioNottiSalvato(gb.rooms, gb)
                        return dett ? testoDettaglioNotti(dett, x => `€${x}`) : `€${Number(gb.price_per_night).toFixed(0)}/notte`
                      })()}</span>
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
                    <div className="min-w-0">
                      <p className="text-xs text-[#5B4E82] mb-1">Arrivo</p>
                      <input type="date" value={stayForm.check_in} onChange={e => {
                        setStayForm({ ...stayForm, check_in: e.target.value })
                        checkStayConflict(e.target.value, stayForm.check_out)
                      }} className="w-full min-w-0 appearance-none border border-[#D9D0EA] rounded-lg p-2 text-sm bg-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[#5B4E82] mb-1">Partenza</p>
                      <input type="date" value={stayForm.check_out} onChange={e => {
                        setStayForm({ ...stayForm, check_out: e.target.value })
                        checkStayConflict(stayForm.check_in, e.target.value)
                      }} className="w-full min-w-0 appearance-none border border-[#D9D0EA] rounded-lg p-2 text-sm bg-white" />
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
                                {i + 1}. {k.roomName}: {k.check_in} → {k.check_out} ({k.nights} {k.nights === 1 ? 'notte' : 'notti'}) · €{k.total.toFixed(0)}{k.extra_bed_total > 0 ? ` (incl. €${k.extra_bed_total.toFixed(0)} letto extra)` : ''}{k.sconto > 0 ? ` · sconto mantenuto −€${k.sconto.toLocaleString('it-IT')}` : ''}{k.scontoDecaduto ? ' · ⚠️ sconto rimosso: il totale concordato non è più sotto il prezzo pieno' : ''}
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
                        {erroreSoggiorno && <AvvisoAzione testo={erroreSoggiorno} className="mb-1" />}
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
              {erroreCambioCamera && <AvvisoAzione testo={erroreCambioCamera} className="mt-2" />}
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
                  className="flex-1 border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm text-[#8C3B2E]"
                />
                <button disabled={salvandoMotivo} onClick={async () => {
                  const val = (document.getElementById('cancel-reason-input') as HTMLInputElement)?.value
                  setSalvandoMotivo(true)
                  setErroreMotivo(null)
                  try {
                    setErroreMotivo(await scriviPoiAggiorna(
                      () => supabase.from('bookings').update({ cancelled_reason: val }).eq('id', id),
                      () => setBooking({ ...booking, cancelled_reason: val }),
                    ))
                  } finally {
                    setSalvandoMotivo(false)
                  }
                }} className="bg-[#F6E4DE] text-[#8C3B2E] px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
                  {salvandoMotivo ? 'Salvo...' : 'Salva'}
                </button>
              </div>
              {erroreMotivo && <AvvisoAzione testo={erroreMotivo} className="mt-2" />}
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
          {booking.status === 'in_attesa' && erroreConferma && (
            <AvvisoAzione testo={erroreConferma} />
          )}
          <button onClick={() => { setScontoDecisione(null); setScontoPct(''); setScontoTot(''); setScontoInfo(''); setEditing(true) }}
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
        <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
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

      {/* Quick pagato toggle. Errori di salvataggio visibili (05/09/2026):
          «pagato» sullo schermo solo se l'update è riuscito; altrimenti il
          bottone torna attivo con «Non salvato, riprova» sotto. La logica
          pagato/movimenti non cambia. */}
      {!editing && booking.bonifico && !booking.pagato && booking.status !== 'annullata' && (
        <div className="mb-4 space-y-2">
          <button onClick={segnaPagato} disabled={segnandoPagato}
            className="w-full bg-[#7D9DB0] text-white lg:bg-[#EAF0F3] lg:text-[#3D5A66] rounded-xl py-3 font-semibold disabled:opacity-60">
            {segnandoPagato ? 'Salvo...' : '✅ Segna come pagato'}
          </button>
          {errorePagato && <AvvisoAzione testo={errorePagato} />}
        </div>
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
            <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm mb-2">
              <p className="font-semibold text-green-dark mb-1.5 text-sm">💬 WhatsApp Ania</p>
              {renderButtons(false)}
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm mb-4">
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
          <div className="bg-white rounded-xl border border-[#C9BFA8] shadow-sm p-4">
            <p className="text-[11px] uppercase mb-3" style={{ color: 'var(--color-brass)', letterSpacing: '2px' }}>Messaggi</p>
            {/* Verde pieno come «+ Nuova richiesta» nelle Richieste (Ania, 05/09/2026) */}
            <button onClick={() => setShowConferma(true)}
              className="w-full inline-flex items-center justify-center bg-green-mid text-cream-text rounded-xl px-5 py-3 font-semibold text-[15px] active:opacity-80 transition-opacity mb-2">
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
        <ConfermaWhatsApp booking={booking} groupBookings={groupBookings} payments={acconti} onClose={() => setShowConferma(false)} />
      )}

      {showCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCancel(false)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Motivo annullamento</h2>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Es. cliente ha cancellato..." className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" />
            <button onClick={cancelBooking} disabled={annullando} className="w-full bg-[#B5502F] text-white rounded-xl py-3 font-semibold mb-2 disabled:opacity-60">{annullando ? 'Annullo...' : 'Conferma annullamento'}</button>
            {erroreAnnulla && <AvvisoAzione testo={erroreAnnulla} className="mb-2" />}
            <button onClick={() => setShowCancel(false)} className="w-full text-gray-500 py-2 text-sm">Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}
