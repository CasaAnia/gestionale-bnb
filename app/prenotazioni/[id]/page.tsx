'use client'
import { chiavePrenotazione, filtroPrenotazione, periodiCamera, leggiPrenotazioneUnica, contoPrenotazione, accordoPrenotazione, haCamereParallele, ERRORE_CONTO_INCOMPLETO, type RigaPrenotazione } from '@/lib/prenotazioneUnica'
import { conInizialiONull, maiuscoleNelCampo } from '@/lib/maiuscole'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { roomWithType, lettoInclusoNellaCamera } from '@/lib/roomTypes'
import { tariffaCamera, lettoDaComunicare } from '@/lib/tariffe'
import { prezzoPrenotazione, riallineaTariffa, tariffaFormDaSalvato, testoDettaglioNotti, dettaglioNottiSalvato } from '@/lib/prezzoNotti'
import { righeCostiSegmenti } from '@/lib/riepilogoCosti'
import ConfermaWhatsApp from '@/components/ConfermaWhatsApp'
import { MessageCircle, Phone, Pencil } from 'lucide-react'
import v from '@/app/nuova/nuova.module.css'
import { openWhatsApp } from '@/lib/whatsapp'
import { messaggioRichiestaOrario, numeroWhatsAppPrenotazione, waHrefTesto } from '@/lib/messaggiWhatsApp'
import BackBar from '@/components/BackBar'
import { RigaDocumentiPrenotazione } from '@/components/DocumentiCliente'
import { nomeOspite, nomeDiverso, nomiPrecedenti, nomePerMessaggio } from '@/lib/guestName'
import { causaleBonifico } from '@/lib/causale'
import { dataItaliana, periodoCompatto } from '@/lib/dateItaliane'
import { GIORNI_PREAVVISO_CANCELLAZIONE } from '@/lib/condizioniPrenotazione'
import { contoSoggiorno, residuoDaPagare } from '@/lib/conto'
import { smartBack } from '@/lib/navHistory'
import { scriviPoiAggiorna, messaggioNonSalvato } from '@/lib/scritturaSicura'
import { salvaInSequenza, leggiConEsito, MESSAGGIO_RILETTURA } from '@/lib/prenotazioneScritture'
import { leggiMemoria, scriviMemoria } from '@/lib/memoriaBrowser'
import { oggiARoma } from '@/lib/spese/adattatore'
import { saldoMancanteCent, METODI_PAGAMENTO, eseguiSegnaPagato, eseguiRegistraAcconto, rpcMancante, validaEsitoSegnaPagato, ErroreRispostaMalformata, type MetodoPagamento, type MovimentoSaldo, type AccontoPendente } from '@/lib/statistiche'
import AvvisoAzione from '@/components/AvvisoAzione'
import CambiaCliente from '@/components/CambiaCliente'
import type { ClienteBreve } from '@/lib/cambiaCliente'
import CampoProvenienza from '@/components/CampoProvenienza'
import { campiProvenienza, provenienzaDi, testoProvenienza, clienteConProvenienza, normalizzaProvenienza, ETICHETTA_PROVENIENZA, type StrutturaNota } from '@/lib/provenienza'
import { leggiStrutture, ricordaStruttura, salvaProvenienzaCliente } from '@/lib/provenienzaDati'
import { soggiorniPrecedenti, etichettaGiaStato, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { righeStorico } from '@/lib/storicoCliente'
import { rigaDaSalvare, lettoProposto, type PeriodoComposto } from '@/lib/prenotazioneComposta'
import { oraDigitata, oraCompleta } from '@/lib/ora'
import { righeCronologia, AVVISO_0042 } from '@/lib/cronologia'
import { leggiCronologia, type LetturaCronologia } from '@/lib/cronologiaDati'

import { valutazioneDi, vuoleRicevuta, ETICHETTA_VALUTAZIONE } from '@/lib/valutazione'
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

// Data breve per il cliente: 20/08/2026 (mai il formato interno 2026-08-20).
// Il conto lo fa lib/dateItaliane, uguale per tutto il gestionale.
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const formatDateShort = (dateStr: string) => dataItaliana(dateStr)

// Un comando solo per sezione (Ania, 10/09/2026): discreto ma riconoscibile,
// sempre in fondo alla sezione che cambia, e mai doppio. Aperto diventa
// «Chiudi», così non resta il dubbio su quale riquadro si stia toccando.
// Il colore è l'azzurro scuro già in casa (#3D5A66, quello di «Completata» e
// del riquadro dei pagamenti): si distingue dal testo senza urlare e si
// riconosce come comando (Ania, 10/09/2026: «non nero, facciamo blu»).
const BLU_COMANDO = '#3D5A66'

function ComandoModifica({ aperto, onClick, etichetta = 'Modifica', nome }: { aperto: boolean; onClick: () => void; etichetta?: string; nome: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" onClick={onClick} data-modifica={nome} aria-expanded={aperto}
        className={v.azione} style={{ gap: 6, fontSize: 13, minHeight: 40, color: BLU_COMANDO, textDecorationColor: 'rgba(61, 90, 102, 0.4)' }}>
        <Pencil size={14} strokeWidth={1.9} aria-hidden />{aperto ? 'Chiudi' : etichetta}
      </button>
    </div>
  )
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
  const cout = segmenti.reduce((fine, s) => s.check_out > fine ? s.check_out : fine, segmenti[0].check_out)
  // Totale dal conto unico (LETTURA: il record salvato è autorevole per le
  // prenotazioni senza sconto, i dati storici non vengono reinterpretati)
  const totaleNum = segmenti.reduce((s, x) => s + contoSoggiorno(x).totale, 0)
  const notti = Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
  const totale = totaleNum.toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const numOspiti = [...new Set(segmenti.map(s => s.group_id || s.id))].reduce((somma, gruppo) => somma + Math.max(...segmenti.filter(s => (s.group_id || s.id) === gruppo).map(s => Number(s.num_guests) || 1)), 0)
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
  const intestazioneSegmenti = haCamereParallele(segmenti) ? 'Camere della prenotazione:' : camereDiverse
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
Cancellazione gratuita fino a ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni prima dell'arrivo.

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
    // Testo unico con la Home «Da controllare» (lib/messaggiWhatsApp)
    return messaggioRichiestaOrario(name)
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
  const [richiestaOrigine, setRichiestaOrigine] = useState<{ id: string; created_at: string; canale: string; proposta_inviata_at?: string | null } | null>(null)
  // «Cambia cliente» (06/09/2026): finestra aperta e conferma dopo il cambio
  const [showCambiaCliente, setShowCambiaCliente] = useState(false)
  const [toastCambioCliente, setToastCambioCliente] = useState<string | null>(null)
  useEffect(() => {
    if (!toastRichiesta) return
    const t = setTimeout(() => setToastRichiesta(false), 4000)
    return () => clearTimeout(t)
  }, [toastRichiesta])
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [groupBookings, setGroupBookings] = useState<any[]>([])
  const [reservationBookings, setReservationBookings] = useState<RigaPrenotazione[]>([])
  const [errorePrenotazione, setErrorePrenotazione] = useState<string | null>(null)
  // Gli editor di camera aggiornano soltanto il segmento scelto: il conto lo
  // riconcilia con le altre camere senza sostituire i gruppi del cambio camera.
  const righePrenotazione = reservationBookings.map(r => r.id === booking?.id ? booking : groupBookings.find(g => g.id === r.id) || r)
  const prenotazioneOk = booking?.id === id && !errorePrenotazione && righePrenotazione.some(r => r.id === booking?.id)
  const chiaveCamere = prenotazioneOk ? righePrenotazione.map(r => r.id).sort().join(',') : ''
  const accordoComune = accordoPrenotazione(righePrenotazione) || booking
  // Altre prenotazioni dello stesso ospite (anche annullate): se ha mandato
  // più richieste dal sito, magari una sbagliata, da qui si ritrovano tutte
  const [otherBookings, setOtherBookings] = useState<any[]>([])
  // Cliente che torna (08/09/2026): soggiorni conclusi dello stesso telefono
  // o dello stesso nome e cognome, anche su un'altra scheda cliente
  const [omonimi, setOmonimi] = useState<SoggiornoStorico[]>([])
  // Conferma della richiesta dal sito: un solo tocco, poi il bottone sparisce
  const [confirming, setConfirming] = useState(false)
  const [erroreConferma, setErroreConferma] = useState<string | null>(null)
  const [segnandoPagato, setSegnandoPagato] = useState(false)
  const [errorePagato, setErrorePagato] = useState<string | null>(null)
  // Statistiche, numeri corretti — pezzo 4 (05/09/2026): «Segna come pagato»
  // registra PRIMA il movimento del saldo mancante (totale del soggiorno meno
  // i movimenti già registrati, data di oggi, metodo scelto qui), POI il flag.
  // Da controllare in Home (06/09/2026): «Registra saldo» arriva con
  // ?azione=pagato e trova «Segna come pagato» già aperto, anche se il
  // soggiorno è già segnato pagato o non è un bonifico: il saldo mancante
  // lo ricalcola la scheda dai movimenti riletti (stesso contratto).
  const daHomePagato = searchParams.get('azione') === 'pagato'
  const [finestraPagato, setFinestraPagato] = useState(daHomePagato)
  useEffect(() => {
    if (!daHomePagato || !booking?.id) return
    document.getElementById('segna-pagato')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [daHomePagato, booking?.id])
  const [metodoPagato, setMetodoPagato] = useState<MetodoPagamento>('bonifico')
  // Parte 2 (05/09/2026): avvisi delle altre azioni della scheda. avvisoScheda
  // sta in cima alla scheda (rilettura fallita dopo un salvataggio riuscito,
  // cliente non aggiornato, log WhatsApp non registrato); gli altri stanno
  // accanto alla loro azione.
  // ?avviso= arriva dalla conferma di una richiesta (provenienza non copiata, 0036)
  const [avvisoScheda, setAvvisoScheda] = useState<string | null>(() => searchParams.get('avviso'))
  // Strutture note per «Come ci ha trovato» (0036)
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  useEffect(() => {
    let vivo = true
    leggiStrutture().then(r => { if (vivo) setStrutture({ disponibile: r.disponibile, lista: r.strutture }) })
    return () => { vivo = false }
  }, [])
  const [erroreSoggiorno, setErroreSoggiorno] = useState<string | null>(null)
  const [erroreCambioCamera, setErroreCambioCamera] = useState<string | null>(null)
  const [erroreAnnulla, setErroreAnnulla] = useState<string | null>(null)
  const [annullando, setAnnullando] = useState(false)
  const [erroreMotivo, setErroreMotivo] = useState<string | null>(null)
  const [salvandoMotivo, setSalvandoMotivo] = useState(false)
  const [storicoArrivi, setStoricoArrivi] = useState(false)
  // La cronologia resta, ma chiusa: si apre solo se serve (Ania, 09/09/2026)
  const [cronologiaAperta, setCronologiaAperta] = useState(false)
  // Letto aggiuntivo modificabile dalla scheda (Ania, 09/09/2026): si accendono
  // e si spengono le singole notti senza passare da «Modifica prenotazione».
  const [lettoAperto, setLettoAperto] = useState(false)
  const [lettoNotti, setLettoNotti] = useState<string[]>([])
  const [lettoImporto, setLettoImporto] = useState<number | null>(null)
  const [lettoCriterio, setLettoCriterio] = useState<'notte' | 'ogni4' | 'totale'>('notte')
  const [salvandoLetto, setSalvandoLetto] = useState(false)
  const [erroreLetto, setErroreLetto] = useState<string | null>(null)
  // true quando l'accordo del letto non era stato registrato: il criterio va scelto
  const [lettoAccordoVecchio, setLettoAccordoVecchio] = useState(false)
  // Date modificabili dalla scheda (Ania, 10/09/2026): arrivo e partenza si
  // cambiano qui sotto il letto aggiuntivo, senza aprire «Modifica
  // prenotazione». Il totale si rifà dalle notti nuove (tariffa già
  // concordata) e l'anteprima lo mostra prima di salvare.
  // Arrivo: orario e navetta si cambiano dal riquadro azzurro, senza aprire
  // tutta la prenotazione (Ania, 10/09/2026).
  const [arrivoAperto, setArrivoAperto] = useState(false)
  const [arrivoForm, setArrivoForm] = useState<{ ora: string; navetta: string }>({ ora: '', navetta: '' })
  const [salvandoArrivo, setSalvandoArrivo] = useState(false)
  const [erroreArrivo, setErroreArrivo] = useState<string | null>(null)
  // Un solo comando in fondo a «Il soggiorno»: dentro ci stanno le modifiche
  // già esistenti (date, letto, cambio camera), nessun comando doppio.
  const [soggiornoAperto, setSoggiornoAperto] = useState(false)
  const [dateAperte, setDateAperte] = useState(false)
  const [dateForm, setDateForm] = useState<{ check_in: string; check_out: string }>({ check_in: '', check_out: '' })
  const [salvandoDate, setSalvandoDate] = useState(false)
  const [erroreDate, setErroreDate] = useState<string | null>(null)
  const [conflittoDate, setConflittoDate] = useState<string | null>(null)
  // Accordo di pagamento modificabile dalla scheda (Ania, 09/09/2026)
  // Quale WhatsApp usare: un interruttore come «Mese | 2 settimane» del
  // calendario (Ania, 09/09/2026), invece di due griglie una sotto l'altra.
  const [waBusiness, setWaBusiness] = useState(false)
  const [accordoAperto, setAccordoAperto] = useState(false)
  const [accordoModo, setAccordoModo] = useState('contanti')
  const [accordoImporto, setAccordoImporto] = useState<number | null>(null)
  const [accordoData, setAccordoData] = useState('')
  const [accordoOra, setAccordoOra] = useState('')
  const [salvandoAccordo, setSalvandoAccordo] = useState(false)
  const [erroreAccordo, setErroreAccordo] = useState<string | null>(null)
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
  const [chiavePagamentiLetti, setChiavePagamentiLetti] = useState('')
  const contoPronto = accontiOk && Boolean(chiaveCamere) && chiavePagamentiLetti === chiaveCamere
  const [accontoForm, setAccontoForm] = useState({ amount: '', method: 'contanti', paid_on: oggiARoma() })
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
      setConflitto(`⚠️ ${b.rooms?.name || 'Camera'} già occupata dal ${dataItaliana(b.check_in)} al ${dataItaliana(b.check_out)} (${b.guest_name || b.guests?.full_name || 'altro cliente'})`)
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
    let vivo = true
    Promise.all([
      supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single(),
      supabase.from('rooms').select('*').eq('active', true),
    ]).then(async ([{ data: b, error }, { data: r }]) => {
      if (!vivo) return
      if (error) { setBooking(null); setErrorePrenotazione(ERRORE_CONTO_INCOMPLETO); setLoading(false); return }
      setBooking(b)
      setReservationBookings([]); setGroupBookings([]); setErrorePrenotazione(null); setAccontiOk(false)
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
        source: b.source || 'diretta',
        // Provenienza del CLIENTE (0037), con ripiego sul valore vecchio della prenotazione (0036)
        provenienza: provenienzaDi(b).provenienza, struttura: provenienzaDi(b).struttura_nome || '',
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
      // Stesso nome e cognome su un'altra scheda cliente (lettura tollerante: se fallisce resta solo il telefono)
      const nomeIntero = (b?.guest_name || b?.guests?.full_name || '').trim()
      if (nomeIntero) {
        supabase.from('bookings').select('*, guests!inner(full_name, phone)')
          .ilike('guests.full_name', nomeIntero)
          .then(({ data: om }) => setOmonimi((om || []) as unknown as SoggiornoStorico[]))
      }
      if (b?.guest_id) {
        supabase.from('bookings')
          .select('*, rooms(name)')
          .eq('guest_id', b.guest_id)
          .neq('id', id)
          .order('check_in', { ascending: false })
          .then(({ data: others }) => {
            setOtherBookings((others || []).filter((x: any) => chiavePrenotazione(x) !== chiavePrenotazione(b)))
          })
      }
      // Richiesta di prenotazione da cui è nata (prenotazione_id = primo segmento
      // del gruppo). La tabella richieste può non esistere ancora: nessun avviso.
      if (b?.id) {
        supabase.from('richieste')
          .select('id, created_at, canale, proposta_inviata_at')
          .eq('prenotazione_id', b.id)
          .maybeSingle()
          .then(({ data: ric }) => { if (ric) setRichiestaOrigine(ric as { id: string; created_at: string; canale: string; proposta_inviata_at?: string | null }) })
      }
      if (b) {
        const conto = await leggiPrenotazioneUnica(b, f => supabase.from('bookings').select('*, rooms(*)').eq(f.colonna, f.valore).order('check_in'))
        if (!vivo) return
        setReservationBookings(conto.righe)
        setGroupBookings(periodiCamera(b, conto.righe))
        setErrorePrenotazione(conto.errore)
      }
      setLoading(false)
    }).catch(() => { if (vivo) { setBooking(null); setErrorePrenotazione(ERRORE_CONTO_INCOMPLETO); setLoading(false) } })
    return () => { vivo = false }
  }, [id])

  // Rilettura su appartenenza effettiva, anche se cambia una camera a parità
  // di numero di righe. Una risposta tardiva non sostituisce il conto corrente.
  useEffect(() => {
    let vivo = true
    if (!chiaveCamere) return
    const ids = chiaveCamere.split(',')
    supabase.from('payments').select('*').in('booking_id', ids).order('paid_on').then(({ data, error }) => {
      if (!vivo) return
      if (error || !data) { setAccontiOk(false); return }
      setAccontiOk(true)
      setChiavePagamentiLetti(chiaveCamere)
      setAcconti(data)
    })
    return () => { vivo = false }
  }, [chiaveCamere])

  // Cronologia delle modifiche (07/09/2026): righe scritte dai trigger della
  // proposta 0042 per tutti i segmenti del soggiorno; si rilegge dopo ogni
  // salvataggio riuscito (la scheda rilegge la prenotazione → cambia tentativo)
  const [cronologia, setCronologia] = useState<LetturaCronologia | null>(null)
  const [tentativoCronologia, setTentativoCronologia] = useState(0)
  // Chiave di rilettura: segmenti del soggiorno + ultimo salvataggio + numero di acconti
  const chiaveCronologia = booking ? `${chiaveCamere}|${booking.updated_at ?? ''}|${acconti.length}|${tentativoCronologia}` : ''
  useEffect(() => {
    if (!chiaveCronologia) return
    let vivo = true
    const ids = chiaveCronologia.split('|')[0].split(',').filter(Boolean)
    leggiCronologia(ids).then(r => { if (vivo) setCronologia(r) })
    return () => { vivo = false }
  }, [chiaveCronologia])

  // Acconto a mano — stesso contratto di «Segna come pagato» (R10): chiave
  // custodita prima dell'invio, rilettura, RPC registra_acconto (idempotente)
  // o INSERT; un pendente con risposta persa viene riconosciuto fra i riletti.
  async function aggiungiAcconto() {
    const amount = parseFloat(accontoForm.amount)
    if (!Number.isFinite(amount) || amount <= 0 || savingAcconto || !prenotazioneOk || !contoPronto) return
    setSavingAcconto(true)
    const chiaveMemoria = `ca_acconto_pendente_${chiavePrenotazione(booking)}`
    const ids: string[] = segmentiSoggiorno().map((b: { id: string }) => b.id)
    try {
      const esito = await eseguiRegistraAcconto(booking.id, amount, accontoForm.method, accontoForm.paid_on, {
        leggiPendente: () => { const t = leggiMemoria(() => localStorage, chiaveMemoria); try { return t ? JSON.parse(t) as AccontoPendente : null } catch { return null } },
        custodisci: p => scriviMemoria(() => localStorage, chiaveMemoria, JSON.stringify(p)),
        dimentica: () => { try { localStorage.removeItem(chiaveMemoria) } catch { /* niente */ } },
        rileggiPagamenti: () => supabase.from('payments').select('*').in('booking_id', ids).order('paid_on'),
        scrivi: async (p: AccontoPendente, bookingId: string) => {
          const nomeRpc = booking.prenotazione_id ? 'registra_acconto_prenotazione' : 'registra_acconto'
          const rpc = await supabase.rpc(nomeRpc, { p_booking_id: bookingId, p_chiave: p.chiave, p_amount: p.amount, p_metodo: p.method, p_paid_on: p.paid_on })
          if (!rpc.error) {
            const r = rpc.data as { movimento_id?: unknown; importo?: unknown; soggiorno?: string; contratto?: string; booking_id?: string } | null
            if (!r || typeof r.movimento_id !== 'string' || !Number.isFinite(Number(r.importo)) || Number(r.importo) !== p.amount || (booking.prenotazione_id && (r.contratto !== 'prenotazione_v1' || r.soggiorno !== chiavePrenotazione(booking)))) return { data: null, error: new ErroreRispostaMalformata() }
            return { data: { id: r.movimento_id, booking_id: r.booking_id || bookingId, amount: Number(r.importo), method: p.method, paid_on: p.paid_on }, error: null }
          }
          if (booking.prenotazione_id || !rpcMancante(rpc.error, 'registra_acconto')) return { data: null, error: rpc.error }
          const { data, error } = await supabase.from('payments').insert({ booking_id: bookingId, amount: p.amount, method: p.method, paid_on: p.paid_on }).select().single()
          return { data, error }
        },
        adesso: () => new Date().toISOString(),
        nuovaChiave: () => crypto.randomUUID(),
      })
      if (esito.esito === 'errore') { setAccontoError(esito.messaggio); return }
      setAcconti([...esito.pagamenti].sort((a, b) => String(a.paid_on).localeCompare(String(b.paid_on))))
      setAccontoForm({ amount: '', method: 'contanti', paid_on: oggiARoma() })
      setAccontoError(null)
    } finally {
      setSavingAcconto(false)
    }
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
  // Dopo «Cambia cliente» (scrittura già riuscita): la scheda passa al cliente
  // nuovo, poi si rileggono altre prenotazioni e omonimi del cliente nuovo.
  function dopoCambioCliente(cliente: ClienteBreve) {
    setShowCambiaCliente(false)
    const aggiornata = { ...booking, guest_id: cliente.id, ...('guest_name' in booking ? { guest_name: null } : {}), guests: { ...(booking.guests || {}), ...cliente } }
    setBooking(aggiornata)
    type Riga = Record<string, unknown>
    setReservationBookings(rs => rs.map(r => ({ ...r, guest_id: cliente.id })))
    setGroupBookings(gs => gs.map((g: Riga) => ({ ...g, guest_id: cliente.id, ...('guest_name' in g ? { guest_name: null } : {}) })))
    setEditForm((f: Riga) => ({ ...f, guest_name: cliente.full_name || '', guest_phone: cliente.phone || '', guest_email: (cliente as { email?: string | null }).email || '', provenienza: provenienzaDi(aggiornata).provenienza, struttura: provenienzaDi(aggiornata).struttura_nome || '' }))
    setOmonimi([])
    supabase.from('bookings')
      .select('*, rooms(name)')
      .eq('guest_id', cliente.id).neq('id', id).order('check_in', { ascending: false })
      .then(({ data: others }) => setOtherBookings((others || []).filter((x: RigaPrenotazione) => chiavePrenotazione(x) !== chiavePrenotazione(booking))))
    setToastCambioCliente(`Prenotazione passata a ${cliente.full_name || 'un altro cliente'}`)
    setTimeout(() => setToastCambioCliente(null), 4000)
    rileggiScheda().then(e => { if (e) setAvvisoScheda(e) })
  }

  async function rileggiScheda(): Promise<string | null> {
    // R4 (revisione 07/09/2026): ogni salvataggio riuscito passa da qui (modifica,
    // sconto, date, cambio cliente): la cronologia si rilegge SEMPRE, anche
    // quando updated_at non cambia (il cambio cliente scrive solo guest_id)
    setTentativoCronologia(t => t + 1)
    const letto = await leggiConEsito<RigaPrenotazione>(
      () => supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single(),
      'ricaricare la scheda')
    if (letto.errore || !letto.data) { setErrorePrenotazione(ERRORE_CONTO_INCOMPLETO); return MESSAGGIO_RILETTURA }
    const scheda = letto.data
    const conto = await leggiPrenotazioneUnica(scheda, f => supabase.from('bookings').select('*, rooms(*)').eq(f.colonna, f.valore).order('check_in'))
    if (conto.errore) { setErrorePrenotazione(conto.errore); return MESSAGGIO_RILETTURA }
    setBooking(scheda)
    setReservationBookings(conto.righe)
    setGroupBookings(periodiCamera(scheda, conto.righe))
    setErrorePrenotazione(null)
    return null
  }

  // Errori di salvataggio visibili (05/09/2026): lo stato «confermata» sullo
  // schermo cambia SOLO se l'update è riuscito; con un errore il bottone
  // torna attivo e compare «Non salvato, riprova» sotto di lui.
  async function confermaPrenotazione() {
    if (confirming || !prenotazioneOk) return
    setConfirming(true)
    setErroreConferma(null)
    try {
      const f = filtroPrenotazione(booking)
      const scrivi = () => supabase.from('bookings').update({ status: 'confermata' }).eq(f.colonna, f.valore).eq('status', 'in_attesa')
      const errore = await scriviPoiAggiorna(scrivi, () => {
        setBooking({ ...booking, status: 'confermata' })
        setTentativoCronologia(t => t + 1)
        setReservationBookings(rs => rs.map(r => r.status === 'in_attesa' ? { ...r, status: 'confermata' } : r))
        setGroupBookings(gs => gs.map((g: any) => g.status === 'in_attesa' ? { ...g, status: 'confermata' } : g))
      })
      setErroreConferma(errore)
    } finally {
      setConfirming(false)
    }
  }

  // Segmenti del soggiorno (cambio camera = più righe) per il conto del saldo
  const segmentiSoggiorno = () => righePrenotazione.map(r => r.status === 'annullata' ? { ...r, total_amount: 0 } : r)

  // «Segna come pagato» — contratto unico dei movimenti (lib/statistiche/pagato,
  // revisioni R1/R8/R10): chiave custodita PRIMA dell'invio, rilettura dei
  // pagamenti prima di ogni tentativo, RPC segna_pagato della 0033 (atomica,
  // ricalcola il saldo e scrive il flag: nessun secondo PATCH) oppure, senza
  // RPC, INSERT + flag su TUTTI i segmenti con verifica delle righe toccate.
  async function segnaPagato() {
    if (segnandoPagato || !prenotazioneOk || !contoPronto) return
    setSegnandoPagato(true)
    setErrorePagato(null)
    const ids: string[] = segmentiSoggiorno().map((b: { id: string }) => b.id)
    try {
      const esito = await eseguiSegnaPagato(segmentiSoggiorno(), oggiARoma(), metodoPagato, booking.id, {
        custodisciChiave: chiavePagatoStabile,
        rileggiPagamenti: () => supabase.from('payments').select('*').in('booking_id', ids).order('paid_on'),
        scrivi: async (chiave: string, m: MovimentoSaldo | null) => {
          const nomeRpc = booking.prenotazione_id ? 'segna_pagato_prenotazione' : 'segna_pagato'
          const rpc = await supabase.rpc(nomeRpc, { p_booking_id: booking.id, p_chiave: chiave, p_metodo: metodoPagato, p_paid_on: oggiARoma() })
          if (!rpc.error) {
            const valido = validaEsitoSegnaPagato(rpc.data)
            if (!valido || valido.soggiorno !== chiavePrenotazione(booking) || (booking.prenotazione_id && (rpc.data?.contratto !== 'prenotazione_v1' || valido.segmenti_aggiornati !== righePrenotazione.filter(r => ['confermata','completata'].includes(r.status)).length))) return { data: null, error: new ErroreRispostaMalformata(), flagScritto: false }
            const riga = valido.movimento_id ? { id: valido.movimento_id, booking_id: rpc.data?.booking_id || booking.id, amount: valido.importo, method: metodoPagato, paid_on: oggiARoma() } : null
            return { data: riga, error: null, flagScritto: true }
          }
          if (booking.prenotazione_id || !rpcMancante(rpc.error, 'segna_pagato')) return { data: null, error: rpc.error, flagScritto: false }
          // Ripiego senza la 0033: INSERT semplice (la protezione è la rilettura prima di ogni tentativo)
          if (!m) return { data: null, error: null, flagScritto: false }
          const { data, error } = await supabase.from('payments').insert({ booking_id: m.booking_id, amount: m.amount, method: m.method, paid_on: m.paid_on }).select().single()
          return { data, error, flagScritto: false }
        },
        segnaFlag: async () => {
          const { data, error } = await supabase.from('bookings').update({ pagato: true }).in('id', ids).select('id')
          return { error: error || (data?.length !== ids.length ? new Error('Non tutte le camere sono state aggiornate') : null), righe: data?.length ?? 0 }
        },
      })
      if (esito.pagamenti) setAcconti(esito.pagamenti)
      if (esito.esito === 'errore') { setErrorePagato(esito.messaggio); return }
      dimenticaChiavePagato()
      setBooking({ ...booking, pagato: true })
      setReservationBookings(rs => rs.map(r => ({ ...r, pagato: true })))
      setGroupBookings(gs => gs.map((g: { pagato?: boolean }) => ({ ...g, pagato: true })))
      setFinestraPagato(false)
      // Il server può aver ricalcolato dopo un incasso da un altro dispositivo.
      const riletti = await supabase.from('payments').select('*').in('booking_id', ids).order('paid_on')
      if (riletti.error || !riletti.data) { setAccontiOk(false); setErrorePagato('Salvataggio riuscito, ma non riesco a rileggere il conto. Ricarica la scheda.') }
      else setAcconti(riletti.data)
      const erroreScheda = await rileggiScheda()
      if (erroreScheda) setAvvisoScheda(erroreScheda)
    } finally {
      setSegnandoPagato(false)
    }
  }

  // Chiave stabile del tentativo di «Segna come pagato» per questa
  // prenotazione: custodita nella memoria del telefono PRIMA dell'invio e
  // riusata finché l'operazione non riesce (anche dopo WhatsApp o una
  // riapertura con la richiesta ancora in volo). Memoria negata → null →
  // nessuna richiesta parte.
  function chiavePagatoStabile(): string | null {
    const k = `ca_pagato_chiave_${chiavePrenotazione(booking)}`
    const salvata = leggiMemoria(() => localStorage, k)
    if (salvata) return salvata
    const nuova = crypto.randomUUID()
    return scriviMemoria(() => localStorage, k, nuova) ? nuova : null
  }
  function dimenticaChiavePagato() {
    try { localStorage.removeItem(`ca_pagato_chiave_${chiavePrenotazione(booking)}`) } catch { /* senza memoria non c'è nulla da togliere */ }
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
      source: editForm.source || 'diretta',
      extra_phone_1: editForm.extra_phone_1 ? normalizePhone(editForm.extra_phone_1) : null,
      extra_phone_1_name: conInizialiONull(editForm.extra_phone_1_name),
      // chi_e incluso solo se la colonna esiste già sul DB o se è stato valorizzato: gli altri salvataggi non si bloccano prima della migrazione
      ...(booking.chi_e !== undefined || editForm.chi_e ? { chi_e: editForm.chi_e || null } : {}),
      extra_phone_2: editForm.extra_phone_2 ? normalizePhone(editForm.extra_phone_2) : null,
      extra_phone_2_name: conInizialiONull(editForm.extra_phone_2_name),
      // Il nome modificato qui vale per QUESTA prenotazione (bookings.guest_name),
      // non rinomina la scheda cliente. Incluso solo a colonna migrata, come chi_e.
      ...(booking.guest_name !== undefined ? { guest_name: conInizialiONull(editForm.guest_name) } : {}),
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
    // La provenienza è del CLIENTE (0037): vale per tutti i suoi soggiorni, passati e futuri
    if (clienteConProvenienza(booking.guests) && booking.guest_id && strutture.disponibile) {
      const campi = campiProvenienza(editForm.provenienza, editForm.struttura)
      const errCliente = await salvaProvenienzaCliente(booking.guest_id, campi, () => setBooking({ ...booking, guests: { ...booking.guests, ...campi } }))
      if (errCliente) setAvvisoScheda(`Salvato, ma la provenienza del cliente non è stata aggiornata: ${errCliente}`)
      else if (editForm.provenienza === 'altra_struttura') {
        const errStruttura = await ricordaStruttura(editForm.struttura, strutture.lista)
        if (errStruttura) setAvvisoScheda(`Salvato, ma il nome della struttura non è stato aggiunto all'elenco: ${errStruttura}`)
      }
    }
    const guestId = booking.guest_id || booking.guests?.id
    let avvisoCliente: string | null = null
    if (guestId) {
      const { error: erroreCliente } = await supabase.from('guests').update({
        // La scheda cliente (condivisa da tutte le prenotazioni del numero) non
        // viene più rinominata da qui: prende il nome solo se ne è senza.
        // Finché guest_name non è migrata resta il vecchio comportamento.
        full_name: booking.guest_name === undefined
          ? (conInizialiONull(editForm.guest_name) || booking.guests?.full_name || null)
          : (booking.guests?.full_name || conInizialiONull(editForm.guest_name)),
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
        setStayConflict(`⚠️ ${c.roomName} già occupata dal ${dataItaliana(b.check_in)} al ${dataItaliana(b.check_out)} (${b.guest_name || b.guests?.full_name || 'altro cliente'})`)
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
    chiudiSoggiorno()
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
        () => { setBooking({ ...booking, group_id: nuovo }); setTentativoCronologia(t => t + 1) },
      )
      if (errore) { setErroreCambioCamera(errore); return }
      groupId = nuovo
    }
    const lastCheckOut = groupBookings.length > 0
      ? [...groupBookings].sort((a, z) => z.check_out.localeCompare(a.check_out))[0].check_out
      : booking.check_out
    const guestId = booking.guest_id || booking.guests?.id
    // Il periodo aggiunto resta nella STESSA prenotazione: senza questo si
    // creava una prenotazione nuova col vecchio gruppo dentro (09/09/2026).
    const prenotazione = (booking as unknown as { prenotazione_id?: string | null }).prenotazione_id ?? groupId
    router.push(`/nuova?guest_id=${guestId}&group_id=${groupId}&prenotazione=${prenotazione}&check_in=${lastCheckOut}&returnTo=/prenotazioni/${id}`)
  }

  // Annullamento: con un errore la finestra resta aperta con l'avviso (niente
  // alert del browser) e la prenotazione resta com'è. Il log WhatsApp è
  // secondario: se non si scrive lo si dice nella schermata di conferma.
  async function cancelBooking() {
    if (annullando || !prenotazioneOk) return
    if (!cancelReason.trim()) { setErroreAnnulla('Scrivi il motivo dell’annullamento.'); return }
    setAnnullando(true)
    setErroreAnnulla(null)
    const f = filtroPrenotazione(booking)
    const campiAnnulla = { status: 'annullata', cancelled_at: new Date().toISOString(), cancelled_reason: cancelReason.trim() }
    try {
      const errore = await scriviPoiAggiorna(
        async () => {
          const r = await supabase.from('bookings').update(campiAnnulla).eq(f.colonna, f.valore).neq('status', 'annullata').select('id')
          return { error: r.error || (r.data?.length !== righePrenotazione.filter(x => x.status !== 'annullata').length ? new Error('Ricarica per verificare quali camere sono state annullate') : null) }
        },
        () => { setBooking({ ...booking, ...campiAnnulla }); setReservationBookings(rs => rs.map(r => r.status === 'annullata' ? r : { ...r, ...campiAnnulla })); setGroupBookings([]); setTentativoCronologia(t => t + 1) },
      )
      if (errore) { setErroreAnnulla(errore); return }
      const msg = buildWhatsappMsg({ ...booking, bonifico: accordoComune.bonifico }, 'annullamento', righePrenotazione.filter(r => r.status !== 'annullata'), acconti)
      const { error: erroreLog } = await supabase.from('booking_whatsapp_log').insert({ booking_id: id, message_type: 'annullamento', message_text: msg, sent: false })
      setAvvisoScheda(erroreLog ? 'Prenotazione annullata, ma il messaggio non è stato registrato nello storico WhatsApp.' : null)
      setShowCancel(false)
      window.scrollTo({ top: 0 })
      setCancelDone(true)
    } finally {
      setAnnullando(false)
    }
  }


  if (loading || (booking && booking.id !== id)) return <div className="p-4 text-center py-10 text-gray-400">Caricamento...</div>
  if (!booking) return <div className="p-4 text-center py-10 text-gray-400">{errorePrenotazione || 'Prenotazione non trovata'}</div>

  const notti = calcNotti(booking.check_in, booking.check_out)
  const guest = booking.guests
  const selectedRoom = rooms.find(r => r.id === editForm.room_id)

  // ── accordo di pagamento, modifica mirata ────────────────────────────────
  const ACCORDI = [
    ['contanti', "Contanti all'arrivo"],
    ['bonifico_arrivo', "Bonifico all'arrivo"],
    ['bonifico_intero', 'Bonifico · intero importo'],
    ['caparra_meta', 'Bonifico · caparra del 50%'],
    ['caparra_libera', 'Bonifico · caparra personalizzata'],
  ] as const

  function apriAccordo(totale: number) {
    const b = accordoComune as unknown as { accordo_pagamento?: string | null; caparra_centesimi?: number | null; caparra_entro?: string | null }
    setAccordoModo(b.accordo_pagamento ?? (booking.bonifico ? 'bonifico_arrivo' : 'contanti'))
    setAccordoImporto(b.caparra_centesimi ? b.caparra_centesimi / 100 : Math.round(totale * 50) / 100)
    if (b.caparra_entro) {
      const d = new Date(b.caparra_entro)
      setAccordoData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      setAccordoOra(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    } else { setAccordoData(''); setAccordoOra('') }
    setErroreAccordo(null)
    setAccordoAperto(true)
  }

  async function salvaAccordo(totale: number) {
    if (salvandoAccordo || !prenotazioneOk || !contoPronto) return
    const conCaparra = accordoModo === 'caparra_meta' || accordoModo === 'caparra_libera'
    const caparra = accordoModo === 'caparra_meta' ? Math.round(totale * 50) / 100 : accordoImporto
    if (conCaparra && (caparra == null || !Number.isFinite(caparra) || caparra <= 0)) { setErroreAccordo("Scrivi l'importo della caparra."); return }
    if (conCaparra && caparra && caparra > totale) { setErroreAccordo('La caparra non può superare il totale.'); return }
    if (Boolean(accordoData) !== Boolean(accordoOra)) { setErroreAccordo('Della scadenza servono data e ora, oppure nessuna delle due.'); return }
    if (accordoOra && !oraCompleta(accordoOra)) { setErroreAccordo("L'ora è incompleta: scrivi per esempio 18:00."); return }
    setSalvandoAccordo(true); setErroreAccordo(null)
    const campi: Record<string, unknown> = {
      bonifico: accordoModo !== 'contanti',
      accordo_pagamento: accordoModo,
      caparra_centesimi: conCaparra && caparra ? Math.round(caparra * 100) : null,
      caparra_entro: conCaparra && accordoData && accordoOra ? `${accordoData}T${accordoOra}:00` : null,
    }
    try {
      const rpc = await supabase.rpc('salva_accordo_prenotazione', {
        p_booking_id: booking.id, p_modo: accordoModo,
        p_caparra_centesimi: campi.caparra_centesimi,
        p_entro: campi.caparra_entro ? new Date(String(campi.caparra_entro)).toISOString() : null,
      })
      if (!rpc.error) {
        if (rpc.data?.contratto !== 'prenotazione_v1' || rpc.data?.soggiorno !== chiavePrenotazione(booking)) {
          setErroreAccordo('Risposta non riconosciuta: ricarica per verificare l’accordo.'); return
        }
        const errore = await rileggiScheda()
        if (errore) { setErroreAccordo('Accordo salvato, ma non riesco a rileggerlo. Ricarica prima di altre modifiche.'); return }
        setAccordoAperto(false)
        return
      }
      // Solo la vecchia prenotazione a riga unica ha un ripiego sicuro.
      if (booking.prenotazione_id || righePrenotazione.length !== 1 || !rpcMancante(rpc.error, 'salva_accordo_prenotazione')) {
        setErroreAccordo('Accordo non salvato. Il conto unico deve essere attivato anche nel database, oppure la lettura va riprovata.'); return
      }
      const { error } = await supabase.from('bookings').update(campi).eq('id', id)
      if (error) { setErroreAccordo(`Accordo non salvato: ${error.message}`); return }
      setBooking({ ...booking, ...campi })
      setReservationBookings(rs => rs.map(r => r.id === booking.id ? { ...r, ...campi } : r))
      setTentativoCronologia(t => t + 1)
      setAccordoAperto(false)
    } catch { setErroreAccordo('Accordo non salvato o risposta non ricevuta: ricarica per verificarlo.') }
    finally { setSalvandoAccordo(false) }
  }


  // ── letto aggiuntivo, modifica mirata ────────────────────────────────────
  function apriLetto() {
    const giorni = getDaysBetween(booking.check_in, booking.check_out)
    const notti = (booking.extra_bed_dates?.length ?? 0) > 0 ? booking.extra_bed_dates as string[] : (booking.extra_bed ? giorni : [])
    // L'accordo salvato si rilegge com'è stato preso (proposta 0048): 20 €
    // «totale concordato» tornano 20 € totali, non 5 € a notte. Solo per le
    // prenotazioni più vecchie, che non hanno l'accordo scritto, si ricava
    // l'importo per notte dal totale e lo si dice.
    const b = booking as unknown as { extra_bed_importo?: number | string | null; extra_bed_criterio?: string | null }
    const accordoSalvato = b.extra_bed_importo != null && b.extra_bed_criterio != null
    const perNotte = notti.length > 0 && Number(booking.extra_bed_total) > 0
      ? Math.round((Number(booking.extra_bed_total) / notti.length) * 100) / 100
      : lettoProposto(booking.rooms as never, Number(booking.num_guests) || 1)
    setLettoNotti(notti)
    setLettoImporto(accordoSalvato ? Number(b.extra_bed_importo) : perNotte)
    setLettoCriterio(accordoSalvato ? (b.extra_bed_criterio as 'notte' | 'ogni4' | 'totale') : 'notte')
    setLettoAccordoVecchio(!accordoSalvato && notti.length > 0 && Number(booking.extra_bed_total) > 0)
    setErroreLetto(null)
    setLettoAperto(true)
    void checkDisponibilita(booking.room_id, booking.check_in, booking.check_out)
  }

  async function salvaLetto() {
    if (salvandoLetto) return
    if (lettoNotti.length > 0 && (lettoImporto === null || !Number.isFinite(lettoImporto) || lettoImporto < 0)) {
      setErroreLetto('Scrivi un importo valido per il letto, anche zero se è compreso.')
      return
    }
    setSalvandoLetto(true)
    setErroreLetto(null)
    // I due letti della casa: contando anche le altre prenotazioni
    const contrib = booking.room_id === LENA_ID && Number(booking.num_guests) >= 4 ? 2 : 1
    const piene = lettoNotti.filter(n => (extraBedsPerDay[n] || 0) + contrib > 2)
    if (piene.length > 0) {
      setErroreLetto(`In casa ci sono due letti aggiuntivi: la notte del ${piene.map(n => `${n.slice(8)}/${n.slice(5, 7)}`).join(', ')} sono già impegnati.`)
      setSalvandoLetto(false)
      return
    }
    const periodo: PeriodoComposto = {
      id: booking.id, gruppo: booking.group_id || booking.id, roomId: booking.room_id,
      checkIn: booking.check_in, checkOut: booking.check_out, ospiti: Number(booking.num_guests) || 1,
      nottiLetto: lettoNotti, letto: lettoNotti.length > 0 && lettoImporto !== null ? { importo: lettoImporto, criterio: lettoCriterio } : null,
      tariffa: Number(booking.price_per_night),
    }
    const camera = { ...(booking.rooms as Record<string, unknown>), id: booking.room_id } as unknown as Parameters<typeof rigaDaSalvare>[1]
    const riga = rigaDaSalvare(periodo, camera, periodo.gruppo)
    // La modifica riguarda solo il letto. Nei vecchi conti senza uno sconto
    // esplicito conserviamo il resto del prezzo concordato, applicando solo
    // la differenza del supplemento. Gli sconti registrati seguono invece
    // il calcolo condiviso; salvare solo il criterio non cambia il totale.
    const vecchioLetto = Number(booking.extra_bed_total || 0)
    const nuovoLetto = Number(riga.extra_bed_total)
    const costoCambiato = vecchioLetto !== nuovoLetto
    const totaleStorico = booking.total_amount == null ? NaN : Number(booking.total_amount)
    const conto = contoSoggiorno({
      ...booking,
      extra_bed_total: riga.extra_bed_total,
      total_amount: costoCambiato
        ? (!booking.discount_type && Number.isFinite(totaleStorico) ? totaleStorico - vecchioLetto + nuovoLetto : undefined)
        : booking.total_amount,
    })
    if (!Number.isFinite(conto.totale) || conto.totale < 0) {
      setErroreLetto('Il nuovo supplemento porterebbe il totale sotto zero. Rivedi il prezzo concordato prima di salvare.')
      setSalvandoLetto(false)
      return
    }
    let campiSalvati: Record<string, unknown> = {
      extra_bed: lettoNotti.length > 0,
      extra_bed_dates: lettoNotti,
      extra_bed_total: riga.extra_bed_total,
      total_amount: conto.totale,
      extra_bed_importo: lettoNotti.length > 0 ? lettoImporto : null,
      extra_bed_criterio: lettoNotti.length > 0 ? lettoCriterio : null,
    }
    let accordoNonRegistrato = false
    const errore = await scriviPoiAggiorna(
      async () => {
        const esito = await supabase.from('bookings').update(campiSalvati).eq('id', id)
        // colonne 0048 non ancora aggiunte: si salva il resto e lo si dice
        if (esito.error && (esito.error.code === '42703' || esito.error.code === 'PGRST204') && /extra_bed_(importo|criterio)/.test(esito.error.message || '')) {
          accordoNonRegistrato = true
          campiSalvati = Object.fromEntries(Object.entries(campiSalvati).filter(([k]) => k !== 'extra_bed_importo' && k !== 'extra_bed_criterio'))
          return await supabase.from('bookings').update(campiSalvati).eq('id', id)
        }
        return esito
      },
      () => {
        setBooking({ ...booking, ...campiSalvati })
        setGroupBookings(righe => righe.map(r => r.id === booking.id ? { ...r, ...campiSalvati } : r))
        setTentativoCronologia(t => t + 1)
      },
    )
    setSalvandoLetto(false)
    if (errore) { setErroreLetto(errore); return }
    if (accordoNonRegistrato) {
      setErroreLetto('Salvate notti e importo totale. Il criterio non è stato registrato: serve la proposta 0048 applicata su Supabase.')
      setLettoAccordoVecchio(true)
      return
    }
    setLettoAccordoVecchio(false)
    chiudiSoggiorno()
  }

  // ── date del soggiorno, modifica mirata ──────────────────────────────────
  // Con quale accordo era stato deciso il letto: serve anche qui, perché
  // spostando le date le notti col letto vanno rifatte con lo stesso criterio.
  // Se l'accordo non è registrato (prenotazioni vecchie) si ricava l'importo
  // per notte dal totale salvato, come fa la modifica del letto.
  function accordoLettoSalvato(nottiLetto: string[]) {
    if (nottiLetto.length === 0) return null
    const b = booking as unknown as { extra_bed_importo?: number | string | null; extra_bed_criterio?: string | null }
    if (b.extra_bed_importo != null && b.extra_bed_criterio != null) {
      return { importo: Number(b.extra_bed_importo), criterio: b.extra_bed_criterio as 'notte' | 'ogni4' | 'totale' }
    }
    const vecchie = (booking.extra_bed_dates?.length ?? 0) > 0
      ? (booking.extra_bed_dates as string[]).length
      : calcNotti(booking.check_in, booking.check_out)
    const perNotte = vecchie > 0 && Number(booking.extra_bed_total) > 0
      ? Math.round((Number(booking.extra_bed_total) / vecchie) * 100) / 100
      : lettoProposto(booking.rooms as never, Number(booking.num_guests) || 1)
    return { importo: perNotte, criterio: 'notte' as const }
  }

  // Come resterebbe la prenotazione con le date nuove: notti del letto
  // ripulite, tariffa riallineata e conto rifatto dalle notti nuove.
  // null quando le date non stanno in piedi (partenza non dopo l'arrivo).
  function pianoDate(nuovoIn: string, nuovoOut: string) {
    if (!nuovoIn || !nuovoOut || nuovoOut <= nuovoIn) return null
    const giorni = getDaysBetween(nuovoIn, nuovoOut)
    const vecchie = (booking.extra_bed_dates?.length ?? 0) > 0
      ? booking.extra_bed_dates as string[]
      : (booking.extra_bed ? getDaysBetween(booking.check_in, booking.check_out) : [])
    // Accorciando o allungando restano le notti col letto ancora dentro il
    // periodo; spostando il soggiorno altrove non ne resta nessuna e il letto
    // torna su tutte le notti nuove (l'anteprima lo dice sempre).
    const dentro = vecchie.filter(n => giorni.includes(n))
    const nottiLetto = vecchie.length === 0 ? [] : (dentro.length > 0 ? dentro : giorni)
    const dopo = { ...booking, check_in: nuovoIn, check_out: nuovoOut, extra_bed: nottiLetto.length > 0, extra_bed_dates: nottiLetto }
    const periodo: PeriodoComposto = {
      id: booking.id, gruppo: booking.group_id || booking.id, roomId: booking.room_id,
      checkIn: nuovoIn, checkOut: nuovoOut, ospiti: Number(booking.num_guests) || 1,
      nottiLetto, letto: accordoLettoSalvato(nottiLetto),
      tariffa: riallineaTariffa(booking.rooms, booking, dopo),
    }
    const camera = { ...(booking.rooms as Record<string, unknown>), id: booking.room_id } as unknown as Parameters<typeof rigaDaSalvare>[1]
    const riga = rigaDaSalvare(periodo, camera, periodo.gruppo)
    // RICALCOLO: senza total_amount il conto si deriva dalle notti nuove,
    // com'è stato deciso (Ania, 10/09/2026). Lo sconto salvato resta.
    const conto = contoSoggiorno({
      check_in: nuovoIn, check_out: nuovoOut,
      price_per_night: riga.price_per_night, extra_bed_total: riga.extra_bed_total,
      discount_type: booking.discount_type, discount_value: booking.discount_value,
    })
    const pieno = Number(riga.price_per_night) * giorni.length + Number(riga.extra_bed_total)
    const scontoDecaduto = booking.discount_type === 'target_total' && !(Number(booking.discount_value) > 0 && Number(booking.discount_value) < pieno)
    return { giorni, nottiLetto, riga, conto, pieno: Math.round(pieno * 100) / 100, scontoDecaduto }
  }

  // Camera libera in quelle date? E i due letti della casa sono liberi nelle
  // notti col letto? Le altre righe di QUESTA prenotazione non contano.
  async function verificaDate(nuovoIn: string, nuovoOut: string, nottiLetto: string[]): Promise<string | null> {
    if (!nuovoIn || !nuovoOut || nuovoOut <= nuovoIn) return null
    const miei = new Set<string>([booking.id, ...righePrenotazione.map(r => r.id), ...groupBookings.map(r => r.id)])
    const [{ data: occupate, error: e1 }, { data: letti, error: e2 }] = await Promise.all([
      supabase.from('bookings')
        .select('id, check_in, check_out, guest_name, rooms(name), guests(full_name)')
        .eq('room_id', booking.room_id).neq('status', 'annullata')
        .lt('check_in', nuovoOut).gt('check_out', nuovoIn),
      supabase.from('bookings')
        .select('id, room_id, num_guests, extra_bed_dates, check_in, check_out')
        .eq('extra_bed', true).neq('status', 'annullata')
        .lt('check_in', nuovoOut).gt('check_out', nuovoIn),
    ])
    if (e1 || e2) return 'Non riesco a controllare se la camera è libera in quelle date: riprova.'
    type RigaOccupata = { id: string; check_in: string; check_out: string; guest_name?: string | null; guests?: { full_name?: string | null } | null }
    type RigaLetto = { id: string; room_id: string; num_guests: number; extra_bed_dates?: string[] | null; check_in: string; check_out: string }
    const scontro = ((occupate || []) as unknown as RigaOccupata[]).find(r => !miei.has(r.id))
    if (scontro) {
      return `${booking.rooms?.name || 'La camera'} è già occupata dal ${formatDateShort(scontro.check_in)} al ${formatDateShort(scontro.check_out)} (${scontro.guest_name || scontro.guests?.full_name || 'altro cliente'}).`
    }
    if (nottiLetto.length === 0) return null
    const perDay: Record<string, number> = {}
    for (const r of (letti || []) as unknown as RigaLetto[]) {
      if (miei.has(r.id)) continue
      const giorni = (r.extra_bed_dates?.length ?? 0) > 0 ? r.extra_bed_dates as string[] : getDaysBetween(r.check_in, r.check_out)
      const contrib = r.room_id === LENA_ID && r.num_guests >= 4 ? 2 : 1
      for (const g of giorni) perDay[g] = (perDay[g] || 0) + contrib
    }
    const mio = booking.room_id === LENA_ID && Number(booking.num_guests) >= 4 ? 2 : 1
    const piene = nottiLetto.filter(n => (perDay[n] || 0) + mio > 2)
    if (piene.length > 0) {
      return `In casa ci sono due letti aggiuntivi: la notte del ${piene.map(n => `${n.slice(8)}/${n.slice(5, 7)}`).join(', ')} sono già impegnati.`
    }
    return null
  }

  function apriDate() {
    setDateForm({ check_in: booking.check_in, check_out: booking.check_out })
    setErroreDate(null)
    setConflittoDate(null)
    setDateAperte(true)
  }

  function cambiaDate(nuovoIn: string, nuovoOut: string) {
    setDateForm({ check_in: nuovoIn, check_out: nuovoOut })
    setConflittoDate(null)
    setErroreDate(null)
    const piano = pianoDate(nuovoIn, nuovoOut)
    if (!piano) return
    void verificaDate(nuovoIn, nuovoOut, piano.nottiLetto).then(msg => setConflittoDate(msg))
  }

  async function salvaDate() {
    if (salvandoDate) return
    const piano = pianoDate(dateForm.check_in, dateForm.check_out)
    if (!piano) { setErroreDate('La partenza deve essere dopo l’arrivo.'); return }
    if (piano.scontoDecaduto) {
      setErroreDate(`Con queste date il prezzo pieno scende a €${piano.pieno.toLocaleString('it-IT')}: il totale concordato (€${Number(booking.discount_value).toLocaleString('it-IT')}) non è più uno sconto. Rivedi lo sconto da «Modifica prenotazione» prima di cambiare le date.`)
      return
    }
    setSalvandoDate(true)
    setErroreDate(null)
    const scontro = await verificaDate(dateForm.check_in, dateForm.check_out, piano.nottiLetto)
    if (scontro) { setConflittoDate(scontro); setSalvandoDate(false); return }
    const campiSalvati: Record<string, unknown> = {
      check_in: dateForm.check_in,
      check_out: dateForm.check_out,
      extra_bed: piano.nottiLetto.length > 0,
      extra_bed_dates: piano.nottiLetto,
      extra_bed_total: piano.riga.extra_bed_total,
      price_per_night: piano.riga.price_per_night,
      total_amount: piano.conto.totale,
    }
    const errore = await scriviPoiAggiorna(
      () => supabase.from('bookings').update(campiSalvati).eq('id', id),
      () => {
        setBooking({ ...booking, ...campiSalvati })
        setGroupBookings(righe => righe.map(r => r.id === booking.id ? { ...r, ...campiSalvati } : r))
        setTentativoCronologia(t => t + 1)
      },
    )
    setSalvandoDate(false)
    if (errore) { setErroreDate(errore); return }
    chiudiSoggiorno()
  }

  // ── arrivo: orario e navetta ─────────────────────────────────────────────
  function apriArrivo() {
    setArrivoForm({ ora: booking.check_in_time || '', navetta: booking.shuttle || '' })
    setErroreArrivo(null)
    setArrivoAperto(true)
  }

  async function salvaArrivo() {
    if (salvandoArrivo) return
    if (arrivoForm.ora && !oraCompleta(arrivoForm.ora)) {
      setErroreArrivo('L\u2019orario si scrive con quattro cifre, per esempio 1830 diventa 18:30. Lascia vuoto se non lo sai ancora.')
      return
    }
    setSalvandoArrivo(true)
    setErroreArrivo(null)
    // La navetta è una colonna arrivata dopo (come chi_e): se manca ancora si
    // salva l'orario e lo si dice, invece di perdere tutto il salvataggio.
    let campiSalvati: Record<string, unknown> = {
      check_in_time: arrivoForm.ora || null,
      shuttle: arrivoForm.navetta || null,
    }
    let navettaNonRegistrata = false
    const errore = await scriviPoiAggiorna(
      async () => {
        const esito = await supabase.from('bookings').update(campiSalvati).eq('id', id)
        if (esito.error && (esito.error.code === '42703' || esito.error.code === 'PGRST204') && /shuttle/.test(esito.error.message || '')) {
          navettaNonRegistrata = true
          campiSalvati = { check_in_time: arrivoForm.ora || null }
          return await supabase.from('bookings').update(campiSalvati).eq('id', id)
        }
        return esito
      },
      () => {
        setBooking({ ...booking, ...campiSalvati })
        setGroupBookings(righe => righe.map(r => r.id === booking.id ? { ...r, ...campiSalvati } : r))
        setTentativoCronologia(t => t + 1)
      },
    )
    setSalvandoArrivo(false)
    if (errore) { setErroreArrivo(errore); return }
    if (navettaNonRegistrata) {
      setErroreArrivo('Orario salvato. La navetta non è stata registrata: manca la colonna shuttle su Supabase.')
      return
    }
    setArrivoAperto(false)
  }

  // Il comando in fondo a «Il soggiorno» apre insieme le modifiche già
  // esistenti: date, letto aggiuntivo e cambio camera. Chiudendolo si chiude
  // tutto, così non restano moduli aperti fuori vista.
  function apriSoggiorno() {
    if (booking.status !== 'annullata') {
      if (groupBookings.length <= 1 && !haCamereParallele(righePrenotazione)) {
        apriDate()
      } else if (groupBookings.length > 1 && (booking.status === 'confermata' || booking.status === 'in_attesa')) {
        // Cambio camera: le date sono quelle di TUTTO il soggiorno, che il
        // piano ridistribuisce fra le camere (computeStayPlan).
        const ordinati = [...groupBookings].sort((a, z) => a.check_in.localeCompare(z.check_in))
        setStayForm({ check_in: ordinati[0].check_in, check_out: ordinati[ordinati.length - 1].check_out })
        setStayConflict(null)
        setEditingStay(true)
      }
      apriLetto()
    }
    setSoggiornoAperto(true)
  }

  function chiudiSoggiorno() {
    setDateAperte(false)
    setLettoAperto(false)
    setEditingStay(false)
    setSoggiornoAperto(false)
  }

  // Soggiorni CONCLUSI del cliente, uno per gruppo: li usano sia il blocco in
  // alto sia lo storico degli arrivi. Fuori: annullate, futuri e questa stessa
  // prenotazione (un cambio camera non è una visita in più).
  // Le annullate restano nell'elenco (Ania, 09/09/2026: «le vorrei vedere, e
  // perché sono state annullate»), ma non entrano nei conteggi né nel totale.
  function conclusiDelCliente() {
    const oggi = oggiARoma()
    return righeStorico(otherBookings as never[])
      .filter(r => r.chiave !== chiavePrenotazione(booking))
      .filter(r => r.status === 'annullata' || r.segmenti.filter(s => s.status !== 'annullata').every(s => ['confermata','completata'].includes(s.status) && s.check_out <= oggi))
      .sort((a, z) => z.check_in.localeCompare(a.check_in))
  }
  const periodoBreve = (dal: string, al: string) => {
    const [ya, ma, da] = dal.split('-').map(Number)
    const [yz, mz, dz] = al.split('-').map(Number)
    return ma === mz && ya === yz
      ? `${da}→${dz} ${MESI_BREVI[mz - 1]} ${String(yz).slice(2)}`
      : `${da} ${MESI_BREVI[ma - 1]}→${dz} ${MESI_BREVI[mz - 1]} ${String(yz).slice(2)}`
  }

  // Link WhatsApp condivisi tra la versione mobile e il pannello Azioni desktop
  type WaTipo = 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto' | 'promemoria_bonifico' | 'richiesta_orario' | 'ringraziamento' | 'libero'
  const waPhone = numeroWhatsAppPrenotazione(booking.guests?.phone)
  const waHref = (type: WaTipo) => waHrefTesto(waPhone ?? '', buildWhatsappMsg({ ...booking, bonifico: accordoComune.bonifico }, type, righePrenotazione.filter(r => r.status !== 'annullata'), acconti))
  const waClick = (type: WaTipo, preferBusiness: boolean = false) => (e: React.MouseEvent) => {
    e.preventDefault()
    openWhatsApp(waPhone!, buildWhatsappMsg({ ...booking, bonifico: accordoComune.bonifico }, type, righePrenotazione.filter(r => r.status !== 'annullata'), acconti), preferBusiness)
  }
  // Messaggi al cliente: stesso disegno sul telefono e nella colonna desktop
  // (Ania, 09/09/2026: interruttore «WhatsApp Ania | Business» e pillole a filo,
  // niente bottoni pieni azzurri). Comandi e testi identici nelle due viste.
  const bloccoMessaggi = (
    <>
      <div role="group" aria-label="Quale WhatsApp" className="inline-flex rounded-full border p-0.5"
        style={{ borderColor: '#C9BFA8', marginTop: 10 }}>
        {([[false, 'WhatsApp Ania'], [true, 'Business']] as const).map(([val, label]) => (
          <button key={label} type="button" onClick={() => setWaBusiness(val)} aria-pressed={waBusiness === val}
            className={`rounded-full whitespace-nowrap font-semibold transition-colors px-3 py-1.5 text-xs ${waBusiness === val ? 'bg-green-mid text-cream-text' : 'text-green-dark'}`}>
            {label}
          </button>
        ))}
      </div>
      <button onClick={() => setShowConferma(true)}
        className={v.pil} style={{ width: '100%', minHeight: 44, margin: '12px 0 12px' }}>
        Conferma · immagine e testo
      </button>
      <div className="grid grid-cols-2 gap-2">
        {([['conferma', 'Conferma'], ['modifica', 'Modifica'], ['dati_bonifico', 'Dati bonifico'], ['pagamento_ricevuto', 'Pagamento ricevuto'], ['promemoria_bonifico', 'Promemoria bonifico'], ['libero', 'Messaggio libero'], ['richiesta_orario', 'Richiesta orario'], ['ringraziamento', 'Ringraziamento']] as const).map(([tipo, testo]) => (
          <a key={tipo} href={waHref(tipo)} onClick={waClick(tipo, waBusiness)} target="_blank" rel="noopener noreferrer"
            className={v.pilC} style={{ minHeight: 40 }}>{testo}</a>
        ))}
        <a href={waHref('annullamento')} onClick={waClick('annullamento', waBusiness)} target="_blank" rel="noopener noreferrer"
          className={v.pilT} style={{ gridColumn: 'span 2', minHeight: 40, color: '#8C3B2E', borderColor: '#8C3B2E' }}>Annullamento</a>
      </div>
    </>
  )

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
      {/* Dallo storico della scheda cliente (?da=cliente&cliente=<id>) «← Indietro» torna al cliente (08/09/2026) */}
      <BackBar href={searchParams.get('da') === 'cliente' && /^[\w-]{1,64}$/.test(searchParams.get('cliente') || '') ? `/clienti/${searchParams.get('cliente')}` : '/calendario'} />
      {avvisoScheda && !cancelDone && <AvvisoAzione testo={avvisoScheda} className="mb-3" />}
      {toastRichiesta && (
        <div role="status" className="chip-in fixed left-4 right-4 top-14 lg:top-4 lg:left-auto lg:w-80 z-[60] bg-green-dark text-cream-text text-sm rounded-xl px-4 py-2.5 shadow-lg">
          Prenotazione creata da richiesta
        </div>
      )}
      {toastCambioCliente && (
        <div role="status" className="chip-in fixed left-4 right-4 top-14 lg:top-4 lg:left-auto lg:w-80 z-[60] bg-green-dark text-cream-text text-sm rounded-xl px-4 py-2.5 shadow-lg">
          {toastCambioCliente}
        </div>
      )}
      <div className="flex items-center gap-3" style={{ alignItems: 'center' }}>
        <h1 className={v.titolo} style={{ lineHeight: 1 }}>Prenotazione</h1>
        {(() => {
          const persona = { guest_id: booking.guest_id, telefono: booking.guests?.phone, full_name: booking.guest_name || booking.guests?.full_name }
          const storico: SoggiornoStorico[] = [...otherBookings.map(x => ({ ...x, guest_id: booking.guest_id })), ...omonimi]
          const testo = etichettaGiaStato(soggiorniPrecedenti(persona, storico, oggiARoma(), chiavePrenotazione(booking)))
          return testo ? <span data-gia-stato className={`${v.badge} ${v.badgeOttone}`} style={{ alignSelf: 'center', marginTop: 3, padding: '4px 12px' }}>{testo}</span> : null
        })()}
        {booking.source === 'sito_web' && (
          <span className="text-xs font-bold rounded-full px-3 py-1 shadow-sm" style={{ background: '#2D6A4F', color: '#fff' }}>🌐 Dal sito</span>
        )}
        <span className="flex-1" />
        {editing && (
          <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annulla</button>
        )}
      </div>
      {/* La provenienza si legge accanto al telefono del cliente (09/09/2026):
          qui restava scritta due volte. Il segnaposto serve alle prove. */}
      {!editing && (clienteConProvenienza(booking.guests) || booking.provenienza !== undefined) && (
        <span className="hidden" data-provenienza-scheda>{testoProvenienza(provenienzaDi(booking))}</span>
      )}
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
        <div className="ed-riga py-4 mb-4">
          <p className="font-semibold mb-3 text-green-mid">✏️ Modifica prenotazione</p>

          <p className="text-xs text-gray-500 mb-1">Nome cliente</p>
          <input value={editForm.guest_name} onChange={e => setEditForm({ ...editForm, guest_name: maiuscoleNelCampo(e.target) })}
            placeholder="Nome e cognome" autoCapitalize="words" autoComplete="off" className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" />

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
          }} className="w-full ed-campo p-2 mb-3 text-sm">
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
              }} className="w-full min-w-0 appearance-none ed-campo p-2 text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 mb-1">Check-out</p>
              <input type="date" value={editForm.check_out} min={editForm.check_in ? nextDay(editForm.check_in) : undefined} onChange={e => {
                setEditForm({ ...editForm, check_out: e.target.value, price_per_night: tariffaDopo({ check_out: e.target.value }) })
                checkDisponibilita(editForm.room_id, editForm.check_in, e.target.value)
              }} className="w-full min-w-0 appearance-none ed-campo p-2 text-sm" />
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
              className="w-full ed-campo p-2 text-sm" />
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">🚌 Navetta</p>
            <div className="flex gap-1.5">
              {([['', 'Da definire'], ['si', 'Sì'], ['no', 'No']] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setEditForm({ ...editForm, shuttle: v })}
                  className={`rounded-full text-sm font-semibold px-4 py-1.5 ${editForm.shuttle === v ? 'text-white' : 'border border-[#C9BFA8] text-stone'}`}
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
              }} className="w-full ed-campo p-2 text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Tariffa/notte €</p>
              <input type="number" min={0} value={editForm.price_per_night} onChange={e => setEditForm({ ...editForm, price_per_night: parseFloat(e.target.value) })}
                className="w-full ed-campo p-2 text-sm" />
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
            <div className="ed-riga py-3 mb-3">
              <p className="text-xs text-gray-500 mb-2">Sconto {editForm.discount_type && <span className="font-semibold" style={{ color: '#2D6A4F' }}>(attivo: {editForm.discount_type === 'percentage' ? `−${editForm.discount_value}%` : `totale concordato €${editForm.discount_value}`})</span>}</p>
              <div className="flex gap-2 items-center mb-2">
                <input type="number" inputMode="decimal" min={1} max={99} placeholder="%"
                  value={scontoPct} onChange={e => setScontoPct(e.target.value)}
                  className="w-20 ed-campo p-2 text-sm" />
                <button type="button" onClick={applicaScontoPct}
                  className="bg-green-mid text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  disabled={!parseFloat(scontoPct.replace(',', '.'))}>
                  Applica %
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <input type="number" inputMode="decimal" min={1} placeholder="Porta il totale a €"
                  value={scontoTot} onChange={e => setScontoTot(e.target.value)}
                  className="w-40 ed-campo p-2 text-sm" />
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
            className="flex items-center justify-between ed-riga py-3 mb-3 cursor-pointer active:opacity-70">
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
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${editForm.source === val ? 'bg-green-mid text-white' : 'text-stone border border-[#C9BFA8]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <CampoProvenienza compatto valore={{ provenienza: editForm.provenienza || 'non_so', struttura: editForm.struttura || '' }}
              onChange={x => setEditForm({ ...editForm, provenienza: x.provenienza, struttura: x.struttura })}
              strutture={strutture.lista} disponibile={clienteConProvenienza(booking.guests) && strutture.disponibile} />
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

          {/* R2 (revisione di f4d5474): da qui «pagato» NON si cambia più. L'unico
              modo per dichiarare un soggiorno pagato è «Segna come pagato», che
              registra il movimento (importo, data, metodo) prima del flag. */}
          <div className="flex items-center justify-between bg-[#EAF0F3] rounded-lg p-3 mb-3 border border-[#D7E3E8]">
            <div>
              <p className="text-sm font-semibold text-[#3D5A66]">{booking.pagato ? '✅ Pagato' : 'Non ancora pagato'}</p>
              <p className="text-xs text-[#3D5A66]">{booking.pagato ? 'i movimenti stanno nel conto del soggiorno' : 'si segna dalla scheda con «Segna come pagato», che registra il pagamento'}</p>
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
        <div className="pt-1 mb-4">
          {/* Cliente in testa: nome, telefono con chiamata diretta, poi camera */}
          {/* Prima di tutto i suoi soggiorni (Ania, 09/09/2026): se chiama dopo
              mesi, basta un'occhiata per sapere quanto vale. Righe minute, così
              la pagina non si allunga. */}
          {(() => {
            const tutte = conclusiDelCliente()
            const concluse = tutte.filter(r => r.status !== 'annullata')
            const totale = concluse.reduce((t, r) => t + r.totaleCent, 0) / 100
            return (
              <div style={{ marginBottom: 12 }}>
                <p className={v.sezione} style={{ marginTop: 10, marginBottom: 0 }}>Soggiorni precedenti</p>
                {tutte.length === 0 && <p className={v.nota} style={{ marginTop: 4, fontSize: 11.5 }}>Nessun soggiorno prima di questo.</p>}
                {/* Stessa riga della pagina di inserimento: date, camera, ospiti,
                    quanto è costata davvero la notte, il prezzo pieno barrato se
                    c'era uno sconto, e il totale (verde quando è scontato). */}
                {tutte.slice(0, 4).map(r => {
                  const segmenti = r.segmenti as unknown as { num_guests?: number; check_in: string; check_out: string }[]
                  const notti = segmenti.reduce((t, x) => t + Math.round((new Date(x.check_out).getTime() - new Date(x.check_in).getTime()) / 86400000), 0)
                  const ospiti = Math.max(1, ...segmenti.map(x => Number(x.num_guests) || 1))
                  const totale = r.totaleCent / 100
                  const pieno = (r.segmenti as unknown as Parameters<typeof contoSoggiorno>[0][]).reduce((t, x) => t + contoSoggiorno(x).prezzoPieno, 0)
                  const scontato = pieno > totale + 0.005
                  const annullata = r.status === 'annullata'
                  return (
                    <button key={r.chiave} type="button" className={v.storico} style={{ fontSize: 10.5, lineHeight: 1.25, gap: 6, padding: '3px 0', opacity: annullata ? 0.75 : 1, flexWrap: 'wrap' }}
                      onClick={() => router.push(`/prenotazioni/${r.prenotazioneId}`)}>
                      <span className={v.storicoData}>{periodoBreve(r.check_in, r.check_out)}</span>
                      <span className={v.storicoDato}>{r.camere.join(' → ')}</span>
                      {annullata ? (
                        <span className={v.storicoDato} style={{ color: '#8C3B2E', whiteSpace: 'normal' }}>annullata · {r.cancelled_reason || 'motivo non indicato'}</span>
                      ) : (<>
                        <span className={v.storicoDato}>{ospiti} osp</span>
                        <span className={v.storicoDato}>{notti} × {Math.round(totale / Math.max(1, notti))}</span>
                      </>)}
                      {!annullata && scontato && <span className={v.storicoPieno} style={{ fontSize: 10.5 }}>{Math.round(pieno)}</span>}
                      <span className={`${v.storicoTotale} ${!annullata && scontato ? v.verde : ''}`}
                        style={{ fontSize: 11.5, ...(annullata ? { textDecoration: 'line-through', color: 'var(--color-stone)' } : {}) }}>{Math.round(totale)} €</span>
                      <span className={v.freccia} style={{ fontSize: 11 }}>›</span>
                    </button>
                  )
                })}
                {concluse.length > 0 && (
                  <button type="button" className={v.storicoTot} style={{ paddingTop: 4, marginTop: 1, borderTop: '1px solid var(--color-card-border)' }} onClick={() => router.push(`/clienti/${guest?.id}`)}>
                    <span className={v.eti} style={{ fontSize: 11 }}>{concluse.length} {concluse.length === 1 ? 'soggiorno concluso' : 'soggiorni conclusi'} <span style={{ color: 'var(--color-brass)' }}>· aprili tutti</span></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span className={v.numeroPiccolo} style={{ fontSize: 14 }}>{Math.round(totale).toLocaleString('it-IT')} €</span>
                      <span className={v.freccia} style={{ fontSize: 11 }}>›</span>
                    </span>
                  </button>
                )}
              </div>
            )
          })()}
          {/* Da dove arriva, sulla stessa riga del nome (Ania, 09/09/2026):
              il nome della struttura quando c'è («Nida», «Umana»), altrimenti
              la parola secca — Google, Passaparola, Non so. */}
          <div className="flex justify-between items-start gap-2">
            <p className={`${v.titoloMedio} min-w-0`}>
              {valutazioneDi(guest) === 'ottimo' && <span title="Cliente ottimo" style={{ color: 'var(--color-brass)', marginRight: 6 }}>★</span>}
              {nomeOspite(booking)}
              <span className={v.eti} style={{ marginLeft: 8, whiteSpace: 'normal' }}>{(() => {
                const pr = provenienzaDi(guest ?? {})
                return pr.provenienza === 'altra_struttura' && pr.struttura_nome ? pr.struttura_nome : ETICHETTA_PROVENIENZA[normalizzaProvenienza(pr.provenienza)]
              })()}</span>
            </p>
          </div>
          {/* La ricevuta si deve vedere da lontano (Ania, 09/09/2026): non un
              bollino piccolo accanto al nome ma una riga sua, ben leggibile. */}
          {vuoleRicevuta(guest) && (
            <p data-ricevuta style={{
              display: 'inline-block', marginTop: 8, padding: '6px 14px', borderRadius: 999,
              background: 'var(--color-sand)', border: '1px solid var(--color-brass)',
              color: '#7A5C1E', fontWeight: 700, fontSize: 14, letterSpacing: '0.5px',
            }}>Vuole la ricevuta</p>
          )}
          {/* Chiamare o scrivere su WhatsApp senza cercare il numero altrove;
              accanto, da dove è arrivato («Non so» se non è registrato). */}
          <div className="flex items-center gap-4 flex-wrap" style={{ paddingTop: 2 }}>
            {guest?.phone && (
              <a href={`tel:${(guest.phone || '').replace(/[^\d+]/g, '')}`} className={v.azione}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, textDecoration: 'none' }}>
                <Phone size={15} strokeWidth={1.8} aria-hidden />{guest.phone}
              </a>
            )}
            {waPhone && (
              <a href={waHref('libero')} onClick={waClick('libero', false)} target="_blank" rel="noopener noreferrer" className={v.azione}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, textDecoration: 'none' }}>
                <MessageCircle size={15} strokeWidth={1.8} aria-hidden />Scrivi
              </a>
            )}
          </div>
          {/* I documenti stanno con l'anagrafica del cliente, in alto
              (Ania, 09/09/2026), non più sulla riga della camera. */}
          <div className={v.azioni} style={{ marginTop: 6, justifyContent: 'space-between', gap: 12 }}>
            <Link href={`/clienti/${guest?.id}?edit=1`} className={v.azione}>Modifica dati</Link>
            {booking.status !== 'annullata' && (
              <button type="button" onClick={() => setShowCambiaCliente(true)} data-cambia-cliente-apri className={v.azione}>Cambia cliente</button>
            )}
            <RigaDocumentiPrenotazione guestId={guest?.id} />
          </div>
          {valutazioneDi(guest) === 'problematico' && (
            <div className={v.avviso}>
              <p>{ETICHETTA_VALUTAZIONE.problematico}</p>
              {guest?.motivo_problematico && <p>{guest.motivo_problematico}</p>}
            </div>
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
          {/* Documenti del cliente (Ania, 07/09/2026): a destra sulla riga della camera,
              non più attaccato al telefono né subito sotto «Cambia cliente» (rischio di
              toccare il link sbagliato): telefono ed email stanno in mezzo tra il link e
              «Cambia cliente». Senza documenti la riga della camera resta com'è. */}
          {/* Le due note, una sotto l'altra (Ania, 09/09/2026): prima quella
              permanente del cliente (guests.notes), poi quella di QUESTA
              prenotazione (bookings.notes) col solo testo in rosso acceso. */}
          {guest?.notes && (
            <div className={v.riga} style={{ display: 'block', marginTop: 14, borderTop: 'none' }}>
              {/* Ania, 10/09/2026: in rosso soltanto il testo della nota, non
                  l'etichetta né lo sfondo. La nota della prenotazione resta
                  com'era. */}
              <span className={v.campoEti}>Nota del cliente</span>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: '#C0392B' }}>{guest.notes}</p>
            </div>
          )}
          {booking.notes && (
            <div data-nota-cliente className={v.riga} style={{ display: 'block', borderTop: 'none', marginTop: guest?.notes ? 8 : 14 }}>
              <span className={v.campoEti}>Nota di questa prenotazione</span>
              <p className="text-[15px] font-semibold leading-relaxed whitespace-pre-wrap" style={{ color: '#C0392B' }}>{booking.notes}</p>
            </div>
          )}

          {/* Arrivo prima del soggiorno (Ania, 09/09/2026): orario, navetta e la
              possibilità di vedere com'erano andati gli arrivi precedenti.
              Dal 10/09/2026 tornano dentro il riquadro chiaro che c'era prima
              (var(--color-sage), lo stesso della foto di Ania), così l'arrivo
              si distingue subito dal resto della scheda. */}
          <p className={v.sezione} style={{ marginTop: 22 }}>Arrivo</p>
          {/* Le due voci restano sempre, ma senza «da definire» (Ania,
              09/09/2026): se il dato manca la riga resta vuota. All'orario
              mancante pensa la Home, che il giorno prima lo mette fra le cose
              da controllare (lib/daControllare). */}
          <div data-riquadro-arrivo style={{ background: 'var(--color-sage)', borderRadius: 12, padding: '12px 14px 6px', marginTop: 6 }}>
            {/* Ania, 10/09/2026: le due cose dell'arrivo affiancate, tutte e due
                grandi uguali — l'orario a sinistra con l'orologio, la navetta a
                destra col suo «sì» della stessa misura. Se un dato manca, la sua
                colonna resta vuota (niente «da definire»). */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                <span aria-hidden style={{ fontSize: 26, lineHeight: 1.1 }}>🕐</span>
                <div style={{ minWidth: 0 }}>
                  <span className={v.eti} style={{ display: 'block', color: 'var(--color-green-mid)', whiteSpace: 'normal' }}>Orario arrivo previsto</span>
                  {/* quando l'ora c'è si legge da lontano (Ania, 09/09/2026) */}
                  <span className={v.numeroGrande} style={{ display: 'block', fontSize: 32, color: 'var(--color-green-dark)' }}>{booking.check_in_time || ''}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <span className={v.eti} style={{ display: 'block', color: 'var(--color-green-mid)' }}>Navetta</span>
                <span className={v.numeroGrande} style={{ display: 'block', fontSize: 32, color: 'var(--color-green-dark)' }}>
                  {booking.shuttle === 'si' ? 'sì' : booking.shuttle === 'no' ? 'no' : ''}
                </span>
              </div>
            </div>
            {/* Ania, 10/09/2026: via la riga in mezzo; «Arrivi precedenti» e
                «Modifica» scendono un po', staccati dai due numeri grandi. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 28 }}>
              <button type="button" className={v.azione} style={{ color: 'var(--color-green-mid)', textDecorationColor: 'rgba(45, 106, 79, 0.35)' }}
                onClick={() => setStoricoArrivi(a => !a)}>
                {storicoArrivi ? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'}
              </button>
            {booking.status !== 'annullata' && (
              <ComandoModifica nome="arrivo" aperto={arrivoAperto}
                onClick={() => (arrivoAperto ? setArrivoAperto(false) : apriArrivo())} />
            )}
            </div>
            {storicoArrivi && (() => {
              const arrivi = conclusiDelCliente().filter(r => r.status !== 'annullata')
              if (arrivi.length === 0) return <p className={v.nota}>Nessun arrivo precedente registrato per questo cliente.</p>
              return (
                <div>
                  {arrivi.map(r => {
                    const primo = [...r.segmenti].sort((a, z) => a.check_in.localeCompare(z.check_in))[0]
                    const ora = primo?.check_in_time
                    const nav = primo?.shuttle
                    return (
                      <div key={r.chiave} className={v.riga} style={{ gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                        <span className={v.storicoData}>{periodoBreve(r.check_in, r.check_out)}</span>
                        <span className={v.storicoDato}>{r.camere.join(' → ')}</span>
                        <span className={v.storicoDato} style={{ marginLeft: 'auto' }}>{ora ? `arrivo ${ora}` : 'orario non registrato'}</span>
                        <span className={v.storicoDato}>{nav === 'si' ? 'navetta sì' : nav === 'no' ? 'navetta no' : 'navetta non registrata'}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            {arrivoAperto && (
              <div data-modulo-arrivo style={{ paddingBottom: 8 }}>
                <div className={v.due}>
                  <label className={v.campoBlocco}>
                    <span className={v.campoEti}>Orario previsto</span>
                    <input type="text" inputMode="numeric" maxLength={5} placeholder="es. 18:30" className={v.campo}
                      value={arrivoForm.ora} onChange={e => setArrivoForm({ ...arrivoForm, ora: oraDigitata(e.target.value) })} />
                  </label>
                  <div className={v.campoBlocco}>
                    <span className={v.campoEti}>Navetta</span>
                    <div className={v.pillole} style={{ marginTop: 2 }}>
                      {([['si', 'Sì'], ['no', 'No'], ['', 'Non so']] as const).map(([val, testoNav]) => (
                        <button key={testoNav} type="button" aria-pressed={arrivoForm.navetta === val}
                          className={arrivoForm.navetta === val ? v.pil : v.pilT}
                          onClick={() => setArrivoForm({ ...arrivoForm, navetta: val })}>{testoNav}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {erroreArrivo && <p className={v.avviso}>{erroreArrivo}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button type="button" className={v.pil} style={{ flex: 1, minHeight: 42 }} disabled={salvandoArrivo} onClick={salvaArrivo}>
                    {salvandoArrivo ? 'Salvo…' : 'Salva arrivo'}
                  </button>
                  <button type="button" className={v.pilT} style={{ minHeight: 42 }} onClick={() => setArrivoAperto(false)}>Annulla</button>
                </div>
              </div>
            )}
          </div>

          <p className={v.sezione} style={{ marginTop: 22 }}>Il soggiorno</p>
          {/* Stessa testa della pagina di inserimento: camera a sinistra,
              totale a destra e sotto le notti in grigio. */}
          <div className="flex justify-between items-baseline gap-2" data-riga-camera>
            <div>
              <p className={v.titoloMedio}>{booking.rooms?.name}</p>
              <p className={v.date}>{notti} {notti === 1 ? 'notte' : 'notti'}</p>
            </div>
            <span className={v.numero}>€{Number(booking.total_amount).toFixed(0)}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3" style={{ marginTop: 8 }}>
            <div className={v.campoBlocco}><span className={v.campoEti}>Arrivo</span><p className="font-semibold">{formatDateShort(booking.check_in)}</p></div>
            <div className={v.campoBlocco}><span className={v.campoEti}>Partenza</span><p className="font-semibold">{formatDateShort(booking.check_out)}</p></div>
            <div className={v.campoBlocco}><span className={v.campoEti}>Ospiti</span><p className="font-semibold">{booking.num_guests}</p></div>
            {(() => {
              // Persone diverse fra le notti: il dettaglio al posto di una tariffa unica
              const dett = dettaglioNottiSalvato(booking.rooms, booking)
              return dett
                ? <div className={`col-span-2 ${v.campoBlocco}`}><span className={v.campoEti}>Tariffa</span><p className="font-semibold">{testoDettaglioNotti(dett, n => `€${n}`)}</p></div>
                : <div className={v.campoBlocco}><span className={v.campoEti}>Tariffa a notte</span><p className="font-semibold">€{Number(booking.price_per_night).toFixed(0)}</p></div>
            })()}
          </div>
          {/* Sconto attivo: prezzo pieno, sconto e totale sempre in chiaro,
              con la rimozione a portata di mano (conferma a due tocchi) */}
          {booking.discount_type && (() => {
            const c = contoSoggiorno(booking)
            return (
              <div className="ed-riga py-3 mb-3 text-sm">
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
          <div className={v.riga}>
            <span className={v.eti}>Letto aggiuntivo</span>
            <span className={v.numeroPiccolo}>{booking.extra_bed ? `€${Number(booking.extra_bed_total).toFixed(0)}` : 'no'}</span>
          </div>
          {booking.bonifico && (
            <div className={v.riga}>
              <span className={v.eti}>Bonifico</span>
              <span className="font-semibold text-sm">{booking.pagato ? 'pagato' : 'in attesa di pagamento'}</span>
            </div>
          )}
          {/* Un comando solo in fondo alla sezione (Ania, 10/09/2026): apre le
              modifiche che c'erano già — arrivo e partenza, letto aggiuntivo,
              cambio camera — senza sparpagliare tanti «modifica» per le righe.
              Tocca soltanto questo soggiorno: il conto e l'arrivo hanno i loro. */}
          {booking.status !== 'annullata' && (
            <ComandoModifica nome="soggiorno" aperto={soggiornoAperto}
              onClick={() => (soggiornoAperto ? chiudiSoggiorno() : apriSoggiorno())} />
          )}
          {soggiornoAperto && (
            <div data-modulo-soggiorno style={{ paddingBottom: 8 }}>
            {/* Arrivo e partenza (Ania, 10/09/2026): il modulo è già aperto,
                senza un secondo «modifica» sulla riga. Con un cambio camera
                le date di tutto il soggiorno restano più in basso. */}
            {booking.status !== 'annullata' && groupBookings.length <= 1 && !haCamereParallele(righePrenotazione) && (
              <>
                <p className={v.campoEti} style={{ marginTop: 2 }}>Arrivo e partenza</p>
                {dateAperte && (() => {
                  const piano = pianoDate(dateForm.check_in, dateForm.check_out)
                  const cambiate = dateForm.check_in !== booking.check_in || dateForm.check_out !== booking.check_out
                  return (
                    <div style={{ paddingBottom: 8 }}>
                      <div className={v.due}>
                        <label className={v.campoBlocco}>
                          <span className={v.campoEti}>Arrivo</span>
                          <input type="date" className={v.campo} value={dateForm.check_in}
                            onChange={e => {
                              const nuovoIn = e.target.value
                              const nuovoOut = nuovoIn && dateForm.check_out <= nuovoIn ? nextDay(nuovoIn) : dateForm.check_out
                              cambiaDate(nuovoIn, nuovoOut)
                            }} />
                        </label>
                        <label className={v.campoBlocco}>
                          <span className={v.campoEti}>Partenza</span>
                          <input type="date" className={v.campo} value={dateForm.check_out}
                            min={dateForm.check_in ? nextDay(dateForm.check_in) : undefined}
                            onChange={e => cambiaDate(dateForm.check_in, e.target.value)} />
                        </label>
                      </div>
                      {piano && cambiate && (
                        <p className={v.nota}>
                          {piano.giorni.length} {piano.giorni.length === 1 ? 'notte' : 'notti'}
                          {piano.nottiLetto.length > 0 ? ` · letto aggiuntivo su ${piano.nottiLetto.length} ${piano.nottiLetto.length === 1 ? 'notte' : 'notti'}` : ''}
                          {' · nuovo totale €'}{piano.conto.totale.toLocaleString('it-IT')}
                          {piano.conto.totale !== Number(booking.total_amount) ? ` (prima €${Number(booking.total_amount).toLocaleString('it-IT')})` : ''}
                          {piano.conto.sconto > 0 ? ` · sconto mantenuto −€${piano.conto.sconto.toLocaleString('it-IT')}` : ''}
                        </p>
                      )}
                      {piano && cambiate && !booking.discount_type && (() => {
                        // Totale scritto a mano: rifacendo il conto non resta.
                        // Meglio dirlo prima di salvare, che scoprirlo dopo.
                        const primaPieno = contoSoggiorno({
                          check_in: booking.check_in, check_out: booking.check_out,
                          price_per_night: booking.price_per_night, extra_bed_total: booking.extra_bed_total,
                        }).totale
                        return Math.abs(primaPieno - Number(booking.total_amount)) > 0.005 ? (
                          <p className={v.nota}>Il totale di prima era stato scritto a mano (€{Number(booking.total_amount).toLocaleString('it-IT')} invece di €{primaPieno.toLocaleString('it-IT')}): il nuovo viene dal calcolo.</p>
                        ) : null
                      })()}
                      {!piano && <p className={v.avviso}>La partenza deve essere dopo l&apos;arrivo.</p>}
                      {conflittoDate && <p className={v.avviso}>{conflittoDate}</p>}
                      {erroreDate && <p className={v.avviso}>{erroreDate}</p>}
                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button type="button" className={v.pil} style={{ flex: 1, minHeight: 42 }}
                          disabled={salvandoDate || !piano || !cambiate || !!conflittoDate} onClick={salvaDate}>
                          {salvandoDate ? 'Salvo…' : 'Salva arrivo e partenza'}
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
            {/* Con un cambio camera le date si cambiano da qui (Ania,
                10/09/2026: «deve comprendere anche le date, è la cosa più
                importante»): stesso comando del soggiorno, un solo modulo, e
                l'anteprima dice come resterebbero le camere. */}
            {editingStay && (
              <>
                <p className={v.campoEti} style={{ marginTop: 2 }}>Arrivo e partenza di tutto il soggiorno</p>
                <div className={v.due}>
                  <label className={v.campoBlocco}>
                    <span className={v.campoEti}>Arrivo</span>
                    <input type="date" className={v.campo} value={stayForm.check_in} onChange={e => {
                      setStayForm({ ...stayForm, check_in: e.target.value })
                      checkStayConflict(e.target.value, stayForm.check_out)
                    }} />
                  </label>
                  <label className={v.campoBlocco}>
                    <span className={v.campoEti}>Partenza</span>
                    <input type="date" className={v.campo} value={stayForm.check_out} onChange={e => {
                      setStayForm({ ...stayForm, check_out: e.target.value })
                      checkStayConflict(stayForm.check_in, e.target.value)
                    }} />
                  </label>
                </div>
                {(() => {
                  const plan = computeStayPlan(groupBookings, stayForm.check_in, stayForm.check_out)
                  const oldTotal = groupBookings.reduce((s, x) => s + Number(x.total_amount), 0)
                  return (
                    <>
                      {plan.error ? (
                        <p className={v.avviso}>{plan.error}</p>
                      ) : (
                        <div style={{ marginTop: 6 }}>
                          <p className={v.campoEti}>Come resterebbe</p>
                          {plan.kept.map((k, i) => (
                            <p key={k.id} className={v.nota}>
                              {i + 1}. {k.roomName}: {periodoCompatto(k.check_in, k.check_out)} ({k.nights} {k.nights === 1 ? 'notte' : 'notti'}) · €{k.total.toFixed(0)}{k.extra_bed_total > 0 ? ` (incl. €${k.extra_bed_total.toFixed(0)} letto extra)` : ''}{k.sconto > 0 ? ` · sconto mantenuto −€${k.sconto.toLocaleString('it-IT')}` : ''}{k.scontoDecaduto ? ' · ⚠️ sconto rimosso: il totale concordato non è più sotto il prezzo pieno' : ''}
                            </p>
                          ))}
                          {plan.removed.map((r: any) => (
                            <p key={r.id} className={v.nota} style={{ color: '#8C3B2E' }}>
                              <span style={{ textDecoration: 'line-through' }}>{r.rooms?.name}: {periodoCompatto(r.check_in, r.check_out)}</span> — verrà annullata
                            </p>
                          ))}
                          <p className={v.nota} style={{ fontWeight: 700, marginTop: 2 }}>
                            Nuovo totale: €{plan.total.toFixed(0)}{plan.total !== oldTotal ? <span style={{ fontWeight: 400 }}> (prima: €{oldTotal.toFixed(0)})</span> : null}
                          </p>
                        </div>
                      )}
                      {stayConflict && <p className={v.avviso}>{stayConflict}</p>}
                      {erroreSoggiorno && <AvvisoAzione testo={erroreSoggiorno} className="mt-2" />}
                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button type="button" className={v.pil} style={{ flex: 1, minHeight: 42 }}
                          disabled={savingStay || !!plan.error || !!stayConflict} onClick={saveStayEdit}>
                          {savingStay ? 'Salvo…' : 'Salva arrivo e partenza'}
                        </button>
                      </div>
                    </>
                  )
                })()}
              </>
            )}
              <p className={v.campoEti} style={{ marginTop: 10 }}>Letto aggiuntivo</p>
            {lettoAperto && (() => {
              const giorni = getDaysBetween(booking.check_in, booking.check_out)
              return (
                <div style={{ paddingBottom: 8 }}>
                  <div className={v.notti}>
                    <button type="button" className={`${v.notte} ${lettoNotti.length === giorni.length ? v.notteOn : ''}`}
                      onClick={() => setLettoNotti(lettoNotti.length === giorni.length ? [] : giorni)}>tutte le notti</button>
                    {giorni.map(g => (
                      <button key={g} type="button" className={`${v.notte} ${lettoNotti.includes(g) ? v.notteOn : ''}`}
                        onClick={() => setLettoNotti(lettoNotti.includes(g) ? lettoNotti.filter(x => x !== g) : [...lettoNotti, g].sort())}>
                        {Number(g.slice(8))}
                      </button>
                    ))}
                  </div>
                  {lettoNotti.length > 0 && (
                    <>
                      <label className={v.campoBlocco} style={{ maxWidth: 130 }}>
                        <span className={v.campoEti}>Quanto costa</span>
                        <input type="number" inputMode="decimal" className={v.campo} placeholder="€"
                          value={lettoImporto ? lettoImporto : ''} onChange={e => setLettoImporto(e.target.value === '' ? 0 : Number(e.target.value))} />
                      </label>
                      <div className={v.pillole} style={{ marginTop: 4 }}>
                        {([['notte', 'A notte'], ['ogni4', 'Ogni 4 notti'], ['totale', 'Totale concordato']] as const).map(([k, t]) => (
                          <button key={k} type="button" className={lettoCriterio === k ? v.pil : v.pilT} onClick={() => setLettoCriterio(k)}>{t}</button>
                        ))}
                      </div>
                    </>
                  )}
                  {lettoAccordoVecchio && (
                    <p className={v.nota}>Di questa prenotazione non è registrato con quale accordo era stato deciso il letto: qui sopra c&apos;è il conto per notte ricavato dal totale. Scegli il criterio giusto prima di salvare.</p>
                  )}
                  {erroreLetto && <p className={v.avviso}>{erroreLetto}</p>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button type="button" className={v.pil} style={{ flex: 1, minHeight: 42 }} disabled={salvandoLetto} onClick={salvaLetto}>
                      {salvandoLetto ? 'Salvo…' : 'Salva letto aggiuntivo'}
                    </button>
                  </div>
                </div>
              )
            })()}
            {/* I comandi della camera stanno col soggiorno (Ania, 09/09/2026):
                cambio camera per lo spostamento a metà soggiorno, «Aggiungi
                camera» per una seconda camera dello stesso cliente, che si
                compone nella pagina di inserimento e resta fra le sue prenotazioni. */}
            {(booking.status === 'confermata' || booking.status === 'in_attesa') && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={addRoomChange} className={v.pilC} style={{ flex: 1, minHeight: 42 }}>Aggiungi cambio camera</button>
                <button type="button" className={v.pilC} style={{ flex: 1, minHeight: 42 }}
                  onClick={() => router.push(`/nuova?guest_id=${booking.guest_id}&check_in=${booking.check_in}&prenotazione=${(booking as unknown as { prenotazione_id?: string | null }).prenotazione_id ?? booking.group_id ?? id}&returnTo=/prenotazioni/${id}`)}>
                  Aggiungi camera
                </button>
              </div>
            )}
            {erroreCambioCamera && <AvvisoAzione testo={erroreCambioCamera} className="mt-2" />}
              <button type="button" className={v.pilT} style={{ width: '100%', minHeight: 42, marginTop: 14 }} onClick={chiudiSoggiorno}>
                Annulla
              </button>
            </div>
          )}

          {prenotazioneOk && haCamereParallele(righePrenotazione) && (
            <div className="mt-4">
              <p className={v.sezione}>Camere della prenotazione</p>
              {righePrenotazione.filter(r => r.status !== 'annullata').map(r => (
                <div className={v.riga} key={r.id}>
                  <span><strong>{r.rooms?.name || 'Camera'}</strong><br /><small>{formatDateShort(r.check_in)} → {formatDateShort(r.check_out)}</small></span>
                  <span className={v.numeroPiccolo}>€{Number(r.total_amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                  {r.id === booking.id ? <span className={v.eti}>Aperta</span> : <Link className={v.azione} href={`/prenotazioni/${r.id}`}>Apri camera</Link>}
                </div>
              ))}
            </div>
          )}

          {/* Conto del soggiorno: acconti ricevuti e residuo */}
          {(!prenotazioneOk || !contoPronto) && <AvvisoAzione testo={errorePrenotazione || "Lettura del conto in corso o non riuscita. Ricarica prima di registrare un pagamento."} />}
          {prenotazioneOk && contoPronto && booking.status !== 'annullata' && (() => {
            const conto = contoPrenotazione(righePrenotazione, acconti)
            const totaleDovuto = conto.totaleCent / 100
            const ricevuto = conto.ricevutiCent / 100
            const residuo = conto.residuoCent / 100
            return (
              <div className="mt-4">
                <p className={v.sezione}>Conto della prenotazione
                  {ricevuto > 0 && <small style={{ letterSpacing: 0, textTransform: 'none', fontSize: 12, color: 'var(--color-stone)' }}>{residuo <= 0 ? '— saldato' : '— acconto ricevuto'}</small>}
                </p>
                {acconti.map(a => (
                  <div key={a.id} className={`${v.riga} text-sm`} style={{ gap: 10 }}>
                    <span className={v.eti}>{new Date(a.paid_on + 'T00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {a.method === 'bonifico' ? 'bonifico' : 'contanti'}</span>
                    <span className="flex-1" />
                    <span className={v.numeroPiccolo}>€{Number(a.amount).toFixed(0)}</span>
                    <button onClick={() => eliminaAcconto(a.id)} className={v.azione} style={{ minHeight: 32, fontSize: 12 }}>rimuovi</button>
                  </div>
                ))}
                {/* Come è stato concordato il pagamento (Ania, 09/09/2026): di
                    solito all'arrivo, ma se c'è un bonifico o una caparra si
                    deve vedere qui, con quanto manca ancora alla caparra.
                    I campi dell'accordo arrivano dalla proposta 0041; senza,
                    si legge la vecchia spunta «bonifico». */}
                {(() => {
                  const b = accordoComune as unknown as { accordo_pagamento?: string | null; caparra_centesimi?: number | null; caparra_entro?: string | null }
                  const testo = {
                    contanti: 'Contanti all\'arrivo',
                    bonifico_arrivo: 'Bonifico all\'arrivo',
                    bonifico_intero: 'Bonifico · intero importo',
                    caparra_meta: 'Bonifico · caparra del 50%',
                    caparra_libera: 'Bonifico · caparra personalizzata',
                  }[b.accordo_pagamento ?? ''] ?? (booking.bonifico ? 'Bonifico' : 'Contanti all\'arrivo')
                  const caparra = b.caparra_centesimi ? b.caparra_centesimi / 100 : null
                  const attesa = caparra === null ? null : Math.max(0, Math.round((caparra - ricevuto) * 100) / 100)
                  const entro = b.caparra_entro
                    ? new Date(b.caparra_entro).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : null
                  return (
                    <>
                      <div className={`${v.riga} text-sm`}>
                        <span className={v.eti}>Pagamento</span>
                        <span className="font-semibold">{testo}</span>
                      </div>
                      {caparra !== null && (
                        <>
                          <div className={`${v.riga} text-sm`} style={{ borderTop: 'none' }}>
                            <span className={v.eti}>Caparra {totaleDovuto > 0 ? `${Math.round((caparra / totaleDovuto) * 100)}%` : ''}</span>
                            <span className="font-semibold">
                              €{caparra.toFixed(0)}{attesa && attesa > 0 ? ` · mancano €${attesa.toFixed(0)}` : ' · ricevuta'}
                            </span>
                          </div>
                          <div className={`${v.riga} text-sm`} style={{ borderTop: 'none' }}>
                            <span className={v.eti}>Entro</span>
                            <span className="font-semibold">{entro ?? 'da impostare'}</span>
                          </div>
                        </>
                      )}
                    </>
                  )
                })()}
                <div className={`${v.riga} text-sm`}>
                  <span className={v.eti}>Ricevuti</span>
                  <span className="font-semibold">€{ricevuto.toFixed(0)} su €{totaleDovuto.toFixed(0)}</span>
                </div>
                <div className={`${v.riga} text-sm`} style={{ borderTop: 'none' }}>
                  <span className="font-semibold">{residuo > 0 ? 'Resta da avere' : 'Saldato'}</span>
                  <span className={v.numeroPiccolo}>€{Math.max(0, residuo).toFixed(0)}{residuo < 0 ? ` (+€${(-residuo).toFixed(0)} in più)` : ''}</span>
                </div>
                {/* Le modifiche economiche stanno in fondo al conto (Ania,
                    10/09/2026), accordo di pagamento compreso: un comando solo,
                    lo stesso di prima. «Registra pagamento» resta un'azione a sé. */}
                {booking.status !== 'annullata' && (
                  <ComandoModifica nome="conto" aperto={accordoAperto}
                    onClick={() => (accordoAperto ? setAccordoAperto(false) : apriAccordo(totaleDovuto))} />
                )}
                {accordoAperto && (
                  <div style={{ paddingBottom: 10 }}>
                    {ACCORDI.map(([chiave, testoModo]) => (
                      <button key={chiave} type="button" className={v.scelta} onClick={() => setAccordoModo(chiave)}>
                        <span className={`${v.tondo} ${accordoModo === chiave ? v.tondoOn : ''}`} />
                        <span className={v.sceltaTitolo}>{testoModo}</span>
                      </button>
                    ))}
                    {accordoModo === 'caparra_libera' && (
                      <label className={v.campoBlocco} style={{ maxWidth: 150 }}>
                        <span className={v.campoEti}>Importo caparra</span>
                        <input type="number" inputMode="decimal" className={v.campo} placeholder="€"
                          value={accordoImporto ?? ''} onChange={e => setAccordoImporto(e.target.value === '' ? null : Number(e.target.value))} />
                      </label>
                    )}
                    {(accordoModo === 'caparra_meta' || accordoModo === 'caparra_libera') && (
                      <div className={v.due}>
                        <label className={v.campoBlocco}><span className={v.campoEti}>Entro il</span>
                          <input type="date" className={v.campo} value={accordoData} onChange={e => setAccordoData(e.target.value)} /></label>
                        <label className={v.campoBlocco}><span className={v.campoEti}>Ora</span>
                          <input type="text" inputMode="numeric" maxLength={5} placeholder="es. 18:00" className={v.campo}
                            value={accordoOra} onChange={e => setAccordoOra(oraDigitata(e.target.value))} /></label>
                      </div>
                    )}
                    {erroreAccordo && <p className={v.avviso}>{erroreAccordo}</p>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button type="button" className={v.pil} style={{ flex: 1, minHeight: 42 }} disabled={salvandoAccordo}
                        onClick={() => salvaAccordo(totaleDovuto)}>{salvandoAccordo ? 'Salvo…' : 'Salva accordo di pagamento'}</button>
                      <button type="button" className={v.pilT} style={{ minHeight: 42 }} onClick={() => setAccordoAperto(false)}>Annulla</button>
                    </div>
                  </div>
                )}
                {accontoError && (
                  <p className="text-xs text-[#8C3B2E] bg-[#F6E4DE] rounded-lg px-2 py-1.5 mb-2">❌ {accontoError}</p>
                )}
                <p className={v.campoEti} style={{ marginTop: 12 }}>Aggiungi pagamento</p>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center" style={{ marginTop: 4 }}>
                  <input type="number" inputMode="decimal" min={0} placeholder="€"
                    value={accontoForm.amount}
                    onChange={e => setAccontoForm({ ...accontoForm, amount: e.target.value })}
                    className="w-20 ed-campo p-2 text-sm focus:outline-none focus:border-green-mid" />
                  <select value={accontoForm.method} onChange={e => setAccontoForm({ ...accontoForm, method: e.target.value })}
                    className="ed-campo p-2 text-sm">
                    <option value="contanti">Contanti</option>
                    <option value="bonifico">Bonifico</option>
                  </select>
                  <input type="date" value={accontoForm.paid_on}
                    onChange={e => setAccontoForm({ ...accontoForm, paid_on: e.target.value })}
                    className="basis-full sm:basis-0 sm:flex-1 sm:min-w-0 ed-campo p-2 text-sm" />
                  <button onClick={aggiungiAcconto} disabled={savingAcconto || !parseFloat(accontoForm.amount)}
                    className={`${v.pil} basis-full sm:basis-auto sm:shrink-0`}>
                    {savingAcconto ? 'Registro…' : 'Registra pagamento'}
                  </button>
                </div>
              </div>
            )
          })()}

          {groupBookings.length > 1 && (
            <div className="mt-4">
              <p className={v.sezione}>Soggiorno con cambio camera</p>
              {/* Un periodo per blocchetto, su più righe (Ania, 10/09/2026): prima
                  la camera col suo comando, che ha uno spazio tutto suo e non copre
                  più il testo; sotto le date compatte e, in fondo, notti, prezzo a
                  notte e quanto costa QUESTO periodo — il totale di tutta la
                  prenotazione resta la riga in fondo. Il periodo aperto si riconosce
                  dal fondo chiaro e dall'etichetta; gli altri sono solo più tenui,
                  senza bordi neri. */}
              {[...groupBookings].sort((a, z) => a.check_in.localeCompare(z.check_in)).map((gb) => {
                const isCurrent = gb.id === id
                const n = Math.round((new Date(gb.check_out).getTime() - new Date(gb.check_in).getTime()) / 86400000)
                const dett = dettaglioNottiSalvato(gb.rooms, gb)
                return (
                  <div key={gb.id} data-periodo={gb.id} data-aperto={isCurrent ? 'si' : undefined}
                    className={v.riga}
                    style={{
                      display: 'block', padding: '9px 10px', marginTop: 6, borderTop: 'none', borderRadius: 10,
                      background: isCurrent ? 'var(--color-sand)' : 'transparent',
                      boxShadow: isCurrent ? '0 1px 3px rgba(31, 61, 47, 0.12)' : 'none',
                      opacity: isCurrent ? 1 : 0.78,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, minWidth: 0 }}>{gb.rooms?.name}</span>
                      {isCurrent
                        ? <span className={`${v.badge} ${v.badgeOttone}`} style={{ flex: 'none' }}>Aperta ora</span>
                        : <button type="button" onClick={() => router.push(`/prenotazioni/${gb.id}`)} className={v.azione}
                            style={{ flex: 'none', minHeight: 36, fontSize: 13 }}>Apri</button>
                      }
                    </div>
                    <p className={v.date} style={{ marginTop: 2 }}>{periodoCompatto(gb.check_in, gb.check_out)}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 2 }}>
                      <span className={v.date}>
                        {n} {n === 1 ? 'notte' : 'notti'} · {dett ? testoDettaglioNotti(dett, x => `${x} €`) : `${Number(gb.price_per_night).toFixed(0)} € a notte`}
                      </span>
                      <span className={v.numeroPiccolo}>€{Number(gb.total_amount).toFixed(0)}</span>
                    </div>
                  </div>
                )
              })}
              <div className={v.riga} style={{ borderTop: '1px solid rgba(169,136,78,.55)', marginTop: 8 }}>
                <span className={v.eti}>Totale di tutta la prenotazione</span>
                <span className={v.numeroPiccolo}>€{groupBookings.reduce((s, x) => s + Number(x.total_amount), 0).toFixed(0)}</span>
              </div>
            </div>
          )}
          {/* Chi dorme davvero in camera (Ania, 09/09/2026): se non è chi ha
              prenotato, nome e numero vanno in blu — lo stesso blu delle celle
              prenotate del calendario (lib/calendarioMobile.COLOR_PRENOTAZIONE),
              così si vede a colpo d'occhio che è un'altra persona. */}
          {(() => {
            const altri = [
              { nome: booking.extra_phone_1_name, tel: booking.extra_phone_1, chiE: booking.chi_e },
              { nome: booking.extra_phone_2_name, tel: booking.extra_phone_2, chiE: null },
            ].filter(x => x.nome || x.tel)
            const BLU = '#7D9DB0'
            return (
              <>
                <p className={v.sezione}>Persone in arrivo</p>
                {altri.length === 0 ? (
                  <div className={v.riga} style={{ borderTop: 'none', display: 'block' }}>
                    <span className={v.campoEti}>Soggiorna chi prenota</span>
                    <p className="font-semibold">{nomeOspite(booking)}</p>
                    {guest?.phone && (
                      <a href={`tel:${(guest.phone || '').replace(/[^\d+]/g, '')}`} className={v.risultatoTel}>{guest.phone}</a>
                    )}
                  </div>
                ) : (
                  <div style={{ paddingTop: 4 }}>
                    <span className={v.campoEti}>Soggiorna un&apos;altra persona</span>
                    {altri.map((x, i) => (
                      <div key={i} className={v.riga} style={{ borderTop: i === 0 ? 'none' : undefined, display: 'block', paddingTop: 6 }}>
                        <p className="font-semibold" style={{ color: BLU, fontSize: 15 }}>
                          {x.nome || 'senza nome'}
                          {x.chiE && <span style={{ color: BLU, fontWeight: 400, fontSize: 13 }}> · {x.chiE}</span>}
                        </p>
                        {x.tel && (
                          <a href={`tel:${String(x.tel).replace(/[^\d+]/g, '')}`} style={{ color: BLU, fontWeight: 600, fontSize: 14 }}>{x.tel}</a>
                        )}
                      </div>
                    ))}
                    <p className={v.nota}>La prenotazione resta intestata a {nomeOspite(booking)}, e i messaggi vanno al suo numero.</p>
                  </div>
                )}
              </>
            )
          })()}

          {booking.status === 'annullata' && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Motivo annullamento</p>
              <div className="flex gap-2">
                <input
                  defaultValue={booking.cancelled_reason || ''}
                  id="cancel-reason-input"
                  placeholder="Aggiungi motivo..."
                  className="flex-1 ed-campo p-2 text-sm text-[#8C3B2E]"
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
            className={v.pil} style={{ width: '100%', minHeight: 44, marginTop: 18 }}>
            Modifica prenotazione
          </button>
          <button onClick={() => setShowCancel(true)}
            className={v.pilT} style={{ width: '100%', minHeight: 44, marginTop: 10, color: '#8C3B2E', borderColor: '#8C3B2E' }}>
            Annulla prenotazione
          </button>
        </div>
      )}


      {/* Altre prenotazioni dello stesso ospite: per ritrovare al volo
          tutte le richieste fatte con lo stesso numero */}
      {!editing && otherBookings.length > 0 && (
        <div className="mb-4">
          <p className={v.sezione}>Altre prenotazioni di questo ospite</p>
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
      {!editing && prenotazioneOk && contoPronto && booking.status !== 'annullata' && ((accordoComune.bonifico && saldoMancanteCent(segmentiSoggiorno(), acconti) > 0) || daHomePagato) && (
        <div id="segna-pagato" className="mb-4 space-y-2">
          {!finestraPagato ? (
            <button onClick={() => { setErrorePagato(null); setFinestraPagato(true) }}
              className={v.pilC} style={{ width: '100%', minHeight: 44 }}>
              Segna come pagato
            </button>
          ) : (() => {
            const mancante = saldoMancanteCent(segmentiSoggiorno(), acconti)
            return (
              <div className="ed-riga py-3">
                <p className="text-sm font-semibold text-green-dark">Segna come pagato</p>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {mancante > 0
                    ? <>Registro un pagamento di <span className="font-semibold text-green-dark">€{(mancante / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> con la data di oggi (il saldo che manca), poi segno la prenotazione come pagata.</>
                    : <>I pagamenti registrati coprono già il totale: segno solo la prenotazione come pagata.</>}
                </p>
                {mancante > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {METODI_PAGAMENTO.map(m => (
                      <button key={m.chiave} type="button" onClick={() => setMetodoPagato(m.chiave)} aria-pressed={metodoPagato === m.chiave}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${metodoPagato === m.chiave ? 'bg-green-mid text-white border-green-mid' : 'text-stone border-[#C9BFA8]'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={segnaPagato} disabled={segnandoPagato}
                    className={v.pil} style={{ flex: 1, minHeight: 42 }}>
                    {segnandoPagato ? 'Salvo…' : 'Conferma'}
                  </button>
                  <button type="button" onClick={() => { setFinestraPagato(false); setErrorePagato(null) }} disabled={segnandoPagato}
                    className="ed-pillola-tenue flex-1 text-sm">
                    Annulla
                  </button>
                </div>
              </div>
            )
          })()}
          {errorePagato && <AvvisoAzione testo={errorePagato} />}
        </div>
      )}

      {/* Messaggi al cliente (telefono; su desktop lo stesso blocco sta nella colonna) */}
      {!editing && waPhone && (
        <div className="lg:hidden">
          <p className={v.sezione}>Messaggi al cliente</p>
          {bloccoMessaggi}
          <div style={{ height: 18 }} />
        </div>
      )}

      {/* Cronologia (07/09/2026): solo lettura, righe scritte dal database (proposta 0042) */}
      {!editing && cronologia && (() => {
        const nomeSegmento = (bid: string) => (righePrenotazione.length > 1 ? (righePrenotazione.find((b: { id: string }) => b.id === bid)?.rooms?.name ?? null) : null)
        const righe = righeCronologia(cronologia.eventi, new Date(), nomeSegmento)
        return (
          <div className="mb-4" data-cronologia>
            <div className={v.azioni}>
              <button type="button" className={v.azione} onClick={() => setCronologiaAperta(x => !x)}>
                {cronologiaAperta ? 'Chiudi la cronologia' : 'Cronologia'}
              </button>
            </div>
            {!cronologiaAperta ? null : (<>
            {cronologia.errore ? (
              <AvvisoAzione testo={cronologia.errore} onRiprova={() => setTentativoCronologia(t => t + 1)} />
            ) : !cronologia.registrata ? (
              <p className="text-xs text-stone">{AVVISO_0042}</p>
            ) : righe.length === 0 ? (
              <p className="text-xs text-stone">Nessuna modifica registrata.</p>
            ) : (
              <ul className="space-y-1.5">
                {righe.map(r => (
                  <li key={r.id} className="text-sm text-green-dark leading-snug">
                    <span className="text-stone tabular-nums">{r.quando}</span>
                    <span className="text-stone"> · </span>
                    {r.segmento && <span className="text-stone">{r.segmento} · </span>}
                    <span>{r.cosa}</span>
                  </li>
                ))}
              </ul>
            )}
          </>)}
          </div>
        )
      })()}
      </div>

      {/* Messaggi al cliente (solo desktop): stesso disegno e stessi comandi del telefono */}
      {!editing && waPhone && (
        <aside className="hidden lg:block lg:flex-1 lg:sticky lg:top-6">
          <div className="ed-riga py-4">
            <p className={v.sezione} style={{ marginTop: 0 }}>Messaggi al cliente</p>
            {bloccoMessaggi}
          </div>
        </aside>
      )}
      </div>

      {showConferma && (
        <ConfermaWhatsApp booking={{ ...booking, bonifico: accordoComune.bonifico }} groupBookings={righePrenotazione.filter(r => r.status !== 'annullata')} payments={acconti} onClose={() => setShowConferma(false)} />
      )}

      {showCambiaCliente && prenotazioneOk && (
        <CambiaCliente booking={booking} segmenti={righePrenotazione.length} pagamenti={acconti.length}
          confermaInviata={!!richiestaOrigine?.proposta_inviata_at} strutture={strutture}
          onClose={() => setShowCambiaCliente(false)} onCambiato={dopoCambioCliente} />
      )}

      {showCancel && (
        <div className="fixed inset-0 ed-velo flex items-center justify-center z-50 p-4" onClick={() => setShowCancel(false)}>
          <div className="ed-foglio rounded-2xl p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <p className={v.sotto}>Annulla prenotazione</p>
            <h2 className={v.titolo} style={{ fontSize: 24, marginTop: 4 }}>Perché la annulli?</h2>
            <label className={v.campoBlocco} style={{ marginTop: 10 }}>
              <span className={v.campoEti}>Motivo dell&apos;annullamento</span>
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="es. il cliente ha disdetto" className={v.campo} style={{ borderBottom: '1px solid #C9BFA8' }} />
            </label>
            <p className={v.nota} style={{ marginTop: 8 }}>Resta scritto: la prenotazione si vedrà ancora nei soggiorni del cliente, col motivo. I pagamenti già registrati non si toccano.</p>
            {erroreAnnulla && <AvvisoAzione testo={erroreAnnulla} className="mb-2" />}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowCancel(false)} className={v.pilT} style={{ minHeight: 44 }}>Chiudi</button>
              <button onClick={cancelBooking} disabled={annullando} className={v.pilT}
                style={{ flex: 1, minHeight: 44, color: '#8C3B2E', borderColor: '#8C3B2E', fontWeight: 700 }}>
                {annullando ? 'Annullo…' : 'Conferma annullamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
