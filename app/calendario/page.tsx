'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { prezzoPrenotazione } from '@/lib/prezzoNotti'
import { useRouter } from 'next/navigation'
import { buildChangeGroups, percorsoBarraArrotondata } from '@/lib/roomChanges'
import { ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { nomeDiverso, nomeConAltri } from '@/lib/guestName'
import { matchPrenotazione } from '@/lib/ricerca'
import { EXTRA_BED_MAX } from '@/lib/tariffe'
import { lettiPoolPrenotazione } from '@/lib/lettiAggiuntivi'
import type { Booking, Guest, Room } from '@/lib/types'
import { COLORE_LETTI_ESAURITI, statoLettiAggiuntivi } from '@/lib/calendarioLetti'
import {
  CORSIA_H, SCHEDA_H, SCHEDA_TOP, ARIA_SCHEDA, TAGLIO_CAMBIO, geometriaScheda, statoScheda, tintaScheda, testoStato,
  rigaDate, iconeScheda, rigaSotto, rigaArrivo, buchiLiberi, rigaBuco, filoObliquo, CAMBIO_CAMERA, FILO_SINISTRO,
} from '@/lib/calendarioSchede'
import { leggiArrivo } from '@/lib/arrivo'
import { oraRoma } from '@/lib/opzioni'
import BackLink from '@/components/BackLink'
import FogliettoPrenotazione from '@/components/calendario/FogliettoPrenotazione'
import TestaPagina from '@/components/TestaPagina'
import CampoRicerca from '@/components/CampoRicerca'
import RigaMesi, { BORDO_RIQUADRO } from '@/components/RigaMesi'
import InterruttorePillola from '@/components/InterruttorePillola'
import { mesiCliccabili } from '@/lib/mesiCliccabili'
import { MEDIA_ORIZZONTALE_TELEFONO, useOrizzontaleTelefono, useSchermoIntero } from '@/lib/richiesteVista'
import { etichettaPeriodo, GIORNI_QUINDICINA, inizioQuindicina } from '@/lib/richiesteCalendario'
import { formatIntervallo as formatIntervalloBreve } from '@/lib/richieste'
import { giornoDaParametro } from '@/lib/daControllare'
import { vuoleRicevuta as clienteVuoleRicevuta } from '@/lib/valutazione'
import { VociLegenda, PannelloLegenda } from '@/components/LegendaCalendario'
import { areaTocco, CHIAVE_POSIZIONE, codificaPosizione, indicePosizione, TINTE_SCHEDA, PASSO_FRECCE_QUINDICI, etichettaFreccia, colonnaMinTelefono } from '@/lib/calendarioMobile'
import { leggiMemoria, scriviMemoria } from '@/lib/memoriaBrowser'
import {
  barreTenute, barrePerCamera, lettiTenutiPerNotte, testoTenuta, comeDovevaPagare,
  type BarraTenuta, type RichiestaTenuta,
} from '@/lib/calendarioOpzioni'
import { campiLibera, indirizzoPrenotazioneNuova, testoConferma, quandoInParole, type MotivoLibera } from '@/lib/opzioneLibera'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

// Fattore di ingrandimento della griglia (1 = originale). Scala misure e testi.
const GRID_SCALE = 1.2
function gs(n: number) { return Math.round(n * GRID_SCALE) }
const CELL_W_DESKTOP = gs(84)
// Dal Mac (blocco 5, 04/09/2026, mockup approvato da Ania): griglia LEGGERA
// come il calendario delle Richieste — righe 54 px, colonna camere 116 px senza
// descrizione (resta nel tooltip), barre col solo nome e icone piccole in linea,
// intestazione compatta. Sopra la griglia la barra «‹ 2 settimane › · Mese ·
// Oggi · mesi cliccabili». Lo scorrimento continuo su tutto l'anno resta.
// Sul telefono le misure sono quelle di sempre.
// Misure IDENTICHE al calendario delle Richieste (components/richieste/CalendarioRichieste):
// righe 44, intestazione dei giorni 40, colonna camere 96, testi 11–13 px.
// Niente striscia dei mesi sopra i giorni: il periodo lo dice la riga di
// navigazione («1 – 14 set 2026» oppure «Settembre 2026»), come nelle Richieste.
// Dal 29/09/2026 (calendario «Maison», riferimento approvato da Ania): corsie
// da 92 px con le SCHEDE da 72 (lib/calendarioSchede), telefono e Mac; il
// righello dei giorni è una riga sola «lun 28».
const RULER_H_MOBILE = 22
const RULER_H_DESKTOP = 26
const NAME_W_MOBILE = 66   // telefono (05/09/2026): come le Richieste, uguale in Calendario/Arrivi/Richieste (richiesta di Ania)
const NAME_W_DESKTOP = 84   // solo il nome della camera, senza numero
const MESI_CLICCABILI = 12       // riga sottile dei mesi: da quello corrente in avanti
// Selettore «Mese | 2 settimane» come nelle Richieste: qui cambia la larghezza
// delle colonne (30 o 14 giorni nella larghezza del riquadro), lo scorrimento
// continuo su tutto l'anno resta. La scelta è ricordata nel browser.
type ModoGriglia = 'mese' | 'quindici'
const COLONNE_VISIBILI: Record<ModoGriglia, number> = { mese: 31, quindici: GIORNI_QUINDICINA }   // 31: a mese si vede il mese intero (05/09/2026)
const CHIAVE_MODO = 'ca_calendario_modo'
const VOCI_GRIGLIA = [['mese', 'Mese'], ['quindici', '2 settimane']] as const satisfies readonly (readonly [ModoGriglia, string])[]
const LARGHEZZA_MIN_COLONNA = 28
const DAYS_TOTAL = 365
const DAYS_BEFORE = 180
// Colori delle schede: blu prenotazione, viola bonifico in attesa, verde pagato… — da lib/calendarioMobile (stessa fonte della legenda)

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
  const orizzontale = useOrizzontaleTelefono()
  useSchermoIntero()

  // Catene di cambio camera (per group_id o per stesso ospite/date contigue) e relative transizioni
  const changeGroups = useMemo(() => buildChangeGroups(bookings), [bookings])
  // Cambio camera (29/09/2026): la scheda tagliata in obliquo col filo del suo stesso colore
  // lungo il taglio (lib/calendarioSchede.filoObliquo): le tinte delle catene di lib/roomChanges qui non servono più

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

  // Sulle schede della catena: «poi Lena» sul tratto che parte, «da Ambra» su quello che arriva
  const { poiCamera, daCamera } = useMemo(() => {
    const corta = (id: string) => (rooms.find(r => r.id === bookings.find(b => b.id === id)?.room_id)?.name ?? '').split(' ').slice(-1)[0]
    const poi: Record<string, string> = {}, da: Record<string, string> = {}
    changeGroups.edges.forEach(e => { poi[e.fromId] = corta(e.toId); da[e.toId] = corta(e.fromId) })
    return { poiCamera: poi, daCamera: da }
  }, [changeGroups, bookings, rooms])

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
  // Indice del primo giorno in vista (per l'etichetta «1 – 14 set 2026» e le frecce a mesi)
  const [primoVisibile, setPrimoVisibile] = useState(DAYS_BEFORE)
  // Il primo giorno INTERO in vista (per tenere il testo delle schede lunghe dentro la parte che si vede)
  const [colonnaSinistra, setColonnaSinistra] = useState(DAYS_BEFORE)
  // Modo della griglia dal Mac (mese / 2 settimane), letto dal browser dopo il primo disegno
  const [modo, setModo] = useState<ModoGriglia>('quindici')
  useEffect(() => {
    let v: string | null = null
    try { v = window.localStorage.getItem(CHIAVE_MODO) } catch { v = null }
    const t = setTimeout(() => { if (v === 'mese' || v === 'quindici') setModo(v) }, 0)
    return () => clearTimeout(t)
  }, [])
  // Larghezza del riquadro (per calcolare le colonne): misurata sul contenitore che scorre
  const [larghezzaGriglia, setLarghezzaGriglia] = useState(0)
  // Primo giorno da tenere in vista quando cambiano le colonne (cambio di modo)
  const primoGiornoRef = useRef<number | null>(null)
  // Da controllare in Home (06/09/2026): «Apri calendario» arriva con ?giorno=AAAA-MM-GG
  const giornoUrlRef = useRef<string | null | undefined>(undefined)
  // Telefono (07/09/2026): legenda nel pannello «?» in alto a destra; posizione
  // da riprendere tornando dalla scheda prenotazione (sessionStorage, una volta sola)
  const [legendaAperta, setLegendaAperta] = useState(false)
  const legendaInRiga = isDesktop && !orizzontale
  const posizioneRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Telefono girato in orizzontale: griglia del Mac (compatta) a tutto schermo
    const check = () => setIsDesktop(window.innerWidth >= 1024 || window.matchMedia(MEDIA_ORIZZONTALE_TELEFONO).matches)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Dal Mac le colonne riempiono il riquadro: 14 giorni (2 settimane) o 30 (mese)
  // Griglia del Mac OVUNQUE (05/09/2026, richiesta di Ania): sul telefono stessa
  // griglia, colonna camere 80 px, colonne di almeno 60 px (40 a mese) che
  // scorrono di lato col dito dentro il riquadro.
  // Colonna delle camere: larga solo sul Mac vero; sul telefono, dritto o
  // girato, quella stretta delle Richieste (uguale nelle tre pagine, 05/09/2026)
  const colonnaLarga = isDesktop && !orizzontale
  const NAME_W = colonnaLarga ? NAME_W_DESKTOP : NAME_W_MOBILE
  // Telefono girato (scelta di Ania, 05/09/2026): a mese tutti i 31 giorni e a
  // 2 settimane tutte le 14 caselle nella larghezza dello schermo, senza
  // scorrimento di lato e senza caselle a metà (colonne da ~20 px a mese: i
  // numeri restano leggibili, i nomi sulle barre si riducono a una lettera).
  const colonnaMin = isDesktop ? (orizzontale ? 0 : LARGHEZZA_MIN_COLONNA) : colonnaMinTelefono(modo)
  // Senza minimo (telefono girato a mese) la colonna NON si arrotonda: così
  // in vista ci sono esattamente 31 caselle, non 31 e qualcosa (Ania, 05/09/2026)
  const CELL_W = larghezzaGriglia > 0
    ? (colonnaMin === 0 ? (larghezzaGriglia - NAME_W) / COLONNE_VISIBILI[modo] : Math.max(colonnaMin, Math.floor((larghezzaGriglia - NAME_W) / COLONNE_VISIBILI[modo])))
    : (isDesktop ? CELL_W_DESKTOP : 60)
  const ROW_H = CORSIA_H
  const RULER_H = isDesktop && !orizzontale ? RULER_H_DESKTOP : RULER_H_MOBILE
  const EXTRA_ROW_H = 30

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -daysBefore)
  const endDate = addDays(startDate, daysTotal)
  const days: Date[] = Array.from({ length: daysTotal }, (_, i) => addDays(startDate, i))
  const todayStr = toStr(today)

  // Somma acconti per prenotazione (vuota se la tabella payments non è ancora migrata)
  const [accontiByBooking, setAccontiByBooking] = useState<Record<string, number>>({})
  // I pagamenti uno per uno: il foglietto li usa per il conto (lib/prenotazioneUnica)
  const [pagamenti, setPagamenti] = useState<PaymentRow[]>([])
  // Il foglietto di dettaglio aperto (29/09/2026): la scheda toccata
  const [aperta, setAperta] = useState<CalendarBooking | null>(null)
  // Camere tenute da una proposta (15/09/2026): le barre tratteggiate, il
  // foglietto che si apre toccandole e il pop-up di conferma.
  const [richiesteTenute, setRichiesteTenute] = useState<RichiestaTenuta[]>([])
  const [adesso, setAdesso] = useState<Date>(() => new Date())
  const [barraAperta, setBarraAperta] = useState<BarraTenuta | null>(null)
  const [confermaLibera, setConfermaLibera] = useState<{ barra: BarraTenuta; prenotaDopo: boolean } | null>(null)
  const [liberando, setLiberando] = useState(false)
  const [avvisoTenuta, setAvvisoTenuta] = useState<string | null>(null)

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

  // Le richieste con una proposta in giro: tengono una camera, e il calendario
  // lo deve dire (Ania, 15/09/2026). Se il database è indietro di una colonna
  // non si perde tutto: si rilegge senza, e l'opzione vale tre ore per tutti.
  const leggiTenute = useCallback(async () => {
    const colonne = 'id, nome, cognome, stato, telefono, proposta_inviata_at, proposta_soluzione, proposta_alternative'
    const conCondizione = await supabase.from('richieste').select(`${colonne}, condizione_pagamento`).eq('stato', 'proposta_inviata')
    if (!conCondizione.error) return (conCondizione.data ?? []) as unknown as RichiestaTenuta[]
    const base = await supabase.from('richieste').select(colonne).eq('stato', 'proposta_inviata')
    return (base.data ?? []) as unknown as RichiestaTenuta[]
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(*)').neq('status', 'annullata'),
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
      setPagamenti((p || []) as PaymentRow[])
      setLoading(false)
    })
    leggiTenute().then(setRichiesteTenute)
  }, [leggiTenute])

  // L'ora avanza da sola: una tenuta scade mentre guardi il calendario, e la
  // barra deve smorzarsi senza che tu ricarichi la pagina.
  useEffect(() => {
    const t = setInterval(() => setAdesso(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const barre = useMemo(() => barreTenute(richiesteTenute, adesso), [richiesteTenute, adesso])
  const lettiTenuti = useMemo(() => lettiTenutiPerNotte(barre), [barre])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      if (giornoUrlRef.current === undefined) giornoUrlRef.current = giornoDaParametro(window.location.search)
      if (giornoUrlRef.current) {
        // Giorno chiesto dalla Home: se è già disegnato la griglia parte dal giorno
        // prima (posizione diretta, come per «oggi»), altrimenti vaiAData estende
        // l'intervallo e scorre; una volta misurato il riquadro il parametro non
        // comanda più (frecce, modo)
        const idx = dayIndex(giornoUrlRef.current)
        if (idx >= 0 && idx + 3 <= daysTotal) scrollRef.current.scrollLeft = Math.max(0, idx - 1) * CELL_W
        else vaiAData(giornoUrlRef.current, 1)
        if (larghezzaGriglia > 0 && idx >= 0) giornoUrlRef.current = null
      } else if (primoGiornoRef.current !== null) {
        scrollRef.current.scrollLeft = primoGiornoRef.current * CELL_W
        primoGiornoRef.current = null
      } else if (posizioneSalvata() !== null) {
        // Rientro dalla scheda prenotazione (07/09/2026): stesso giorno (e mese) di
        // prima; la memoria si consuma alla prima lettura (una volta sola), il
        // valore resta nel ref finché il riquadro viene misurato
        scrollRef.current.scrollLeft = (posizioneSalvata() ?? 0) * CELL_W
      } else {
        // Stessa prima casella delle Richieste e degli Arrivi (Ania, 05/09/2026):
        // a 2 settimane 3 giorni prima di oggi, a mese il 1° del mese
        scrollRef.current.scrollLeft = Math.max(0, dayIndex(primaCasellaOggi())) * CELL_W
      }
      // L'etichetta «2 – 15 set» deve dire subito la posizione vera (come negli Arrivi)
      updateVisibleMonth()
    }
  }, [loading, CELL_W, isDesktop]) // eslint-disable-line react-hooks/exhaustive-deps

  // Misura il riquadro (e la rimisura quando la finestra cambia)
  useEffect(() => {
    if (loading || !scrollRef.current) return
    const el = scrollRef.current
    const misura = () => setLarghezzaGriglia(el.clientWidth)
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  function cambiaModo(m: ModoGriglia) {
    if (m === modo) return
    primoGiornoRef.current = Math.max(0, Math.floor((scrollRef.current?.scrollLeft ?? 0) / CELL_W))
    setModo(m)
    try { window.localStorage.setItem(CHIAVE_MODO, m) } catch { /* niente memoria: vale per questa apertura */ }
  }

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
  // Prima casella quando si torna a oggi: 3 giorni prima di oggi a 2 settimane
  // (come le Richieste), il 1° del mese a mese. Caselle intere, mai a metà.
  function primaCasellaOggi(): string {
    return modo === 'quindici' ? inizioQuindicina(todayStr) : `${todayStr.slice(0, 7)}-01`
  }
  function vaiAOggi() { vaiAData(primaCasellaOggi(), 0) }
  function scorriDiGiorni(n: number) {
    scrollRef.current?.scrollBy({ left: n * CELL_W, behavior: 'smooth' })
  }
  // Frecce ‹ ›: a 2 settimane spostano di UNA settimana (novità del 29/09/2026,
  // prima 14 giorni), a mese vanno al 1° del mese prima/dopo
  function freccia(direzione: -1 | 1) {
    if (modo === 'quindici') { scorriDiGiorni(direzione * PASSO_FRECCE_QUINDICI); return }
    const d = days[Math.min(days.length - 1, Math.max(0, primoVisibile))]
    const primo = new Date(d.getFullYear(), d.getMonth() + (direzione === 1 ? 1 : (d.getDate() === 1 ? -1 : 0)), 1)
    vaiAData(toStr(primo), 0)
  }
  // Etichetta al centro della riga di navigazione, come nelle Richieste
  const etichettaVista = modo === 'quindici'
    ? etichettaPeriodo(days.slice(Math.max(0, primoVisibile), Math.max(0, primoVisibile) + GIORNI_QUINDICINA).map(toStr))
    : visibleMonth
  // I 12 mesi cliccabili: da quello corrente in avanti, con l'anno quando cambia
  // Striscia dei mesi (condivisa con Arrivi e Richieste) e mese del primo giorno in vista
  const mesi = mesiCliccabili(today, MESI_CLICCABILI)
  const meseVisibile = toStr(days[Math.min(days.length - 1, Math.max(0, primoVisibile))]).slice(0, 7)

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
    scrollRef.current.scrollTo({ left: Math.max(0, (dayIndex(scrollTarget) - margineScroll.current) * CELL_W), behavior: 'smooth' })
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
        vaiAOggi()
      }
    }
  }

  // Libera una camera tenuta (15/09/2026). La richiesta NON si cancella mai:
  // passa a «chiusa» col motivo vero — «date assegnate a un altro» se la camera
  // va a chi è al telefono — e resta in archivio con nome, telefono, date e
  // prezzo proposto. Se qualcosa non va, lo si dice e non si prosegue: meglio
  // restare sul calendario che aprire una pagina nuova su una camera ancora tenuta.
  async function liberaCamera(barra: BarraTenuta, prenotaDopo: boolean) {
    if (liberando) return
    setLiberando(true)
    const motivo: MotivoLibera = prenotaDopo ? 'un_altro_cliente' : 'liberata'
    const { error } = await supabase.from('richieste')
      .update(campiLibera(motivo, new Date()))
      .eq('id', barra.richiestaId)
      .eq('stato', 'proposta_inviata')
    setLiberando(false)
    setConfermaLibera(null)
    if (error) {
      setAvvisoTenuta(`La camera non è stata liberata: ${error.message}`)
      return
    }
    setBarraAperta(null)
    setAvvisoTenuta(null)
    setRichiesteTenute(prima => prima.filter(r => r.id !== barra.richiestaId))
    if (prenotaDopo) {
      ricordaPosizione()
      router.push(indirizzoPrenotazioneNuova(barra.arrivo, barra.partenza))
    }
  }

  // Posizione da riprendere (07/09/2026): il primo giorno in vista, salvato
  // prima di aprire una scheda prenotazione; memoria negata = si riparte da oggi
  function ricordaPosizione() {
    const sl = scrollRef.current?.scrollLeft ?? 0
    const idx = Math.min(days.length - 1, Math.max(0, Math.round(sl / CELL_W)))
    const giorno = days[idx] ? toStr(days[idx]) : ''
    if (codificaPosizione(giorno)) scriviMemoria(() => sessionStorage, CHIAVE_POSIZIONE, giorno)
  }

  // Indice della colonna salvata (null se niente o giorno non disegnato); la
  // chiave si toglie subito dalla memoria, così vale solo per questo rientro
  function posizioneSalvata(): number | null {
    if (posizioneRef.current === undefined) {
      posizioneRef.current = leggiMemoria(() => sessionStorage, CHIAVE_POSIZIONE)
      try { sessionStorage.removeItem(CHIAVE_POSIZIONE) } catch { /* memoria negata */ }
    }
    return indicePosizione(posizioneRef.current, days.map(toStr))
  }

  function updateVisibleMonth() {
    const sl = scrollRef.current?.scrollLeft ?? 0
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor(sl / CELL_W)))
    const label = fmtMonth(days[idx])
    setVisibleMonth(prev => (prev === label ? prev : label))
    // Per l'etichetta «1 – 14 set» conta il primo giorno visibile per più di metà
    const primo = Math.min(days.length - 1, Math.max(0, Math.round(sl / CELL_W)))
    setPrimoVisibile(prev => (prev === primo ? prev : primo))
    const intero = Math.max(0, Math.ceil(sl / CELL_W - 0.01))
    setColonnaSinistra(prev => (prev === intero ? prev : intero))
  }

  // Tocco su una scheda (29/09/2026, novità 12g): il primo tocco apre il
  // FOGLIETTO di dettaglio (anche con la ricerca attiva); se la scheda è di una
  // catena di cambio camera, insieme la catena resta piena e il resto si
  // attenua, come prima. Il secondo tocco sulla stessa scheda, o «Apri la
  // scheda» nel foglietto, apre la scheda prenotazione.
  function tocca(booking: CalendarBooking, chainKey: string | undefined) {
    if (aperta?.id === booking.id) { apriScheda(booking); return }
    setAperta(booking)
    setSelectedGroupId(chainKey ?? null)
  }
  function apriScheda(booking: CalendarBooking) {
    ricordaPosizione()
    router.push(`/scheda/${booking.id}`)
  }
  function chiudiFoglietto() {
    setAperta(null)
    setSelectedGroupId(null)
  }
  // Il tocco sul velo del foglietto: se sotto c'è la stessa scheda è il
  // secondo tocco (si apre la scheda), altrimenti il foglietto si chiude
  function toccoSulVelo(e: React.MouseEvent) {
    const sotto = document.elementsFromPoint(e.clientX, e.clientY)
    const scheda = sotto.find(el => el instanceof HTMLElement && el.dataset.scheda) as HTMLElement | undefined
    if (aperta && scheda?.dataset.scheda === aperta.id) { apriScheda(aperta); return }
    chiudiFoglietto()
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

  const totalW = NAME_W + daysTotal * CELL_W
  // La parte di scheda che si vede: il testo non è mai più largo di così,
  // così resta leggibile anche sulle schede lunghe che cominciano fuori vista
  const corsiaVisibile = Math.max(0, larghezzaGriglia - NAME_W - ARIA_SCHEDA * 2)
  // Quanto di una scheda (o di un buco) dal giorno `da` al giorno `a` si vede da
  // `colonnaSinistra` in poi: il testo, fermo a sinistra, non è mai più largo
  const parteInVista = (da: number, a: number) => {
    const w = geometriaScheda(Math.max(da, colonnaSinistra) < a ? Math.max(da, colonnaSinistra) : da, a, CELL_W).width
    return corsiaVisibile > 0 ? Math.min(w, corsiaVisibile) : w
  }
  const larghezzaTesto = (da: number, a: number) => Math.max(0, parteInVista(da, a) - 16 - FILO_SINISTRO)
  const totalH = RULER_H + rooms.length * ROW_H + EXTRA_ROW_H

  // Calcola mesi per header
  const monthGroups: { label: string; startIdx: number; count: number }[] = []
  days.forEach((d, i) => {
    const label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.label === label) last.count++
    else monthGroups.push({ label, startIdx: i, count: 1 })
  })

  return (
    <div className="maison cal flex flex-col" data-senza-sottolinea data-calendario-maison>
      {/* sticky: qui la pagina è più alta dello schermo, quindi scorre anche la finestra */}
      {/* La testa è quella condivisa da Calendario, Arrivi e Richieste:
          components/TestaPagina (spazio in alto uguale per tutt'e tre) */}
      <TestaPagina titolo="Calendario" desktop={isDesktop} indietro={<BackLink href="/" />}
        comandi={<CampoRicerca maison value={query} onChange={cambiaRicerca} className={isDesktop ? (orizzontale ? 'flex-1 max-w-[360px]' : 'w-[360px]') : 'w-full'} />}>
        {/* Nessun risultato: messaggio semplice, calendario normale */}
        {cercando && matches.length === 0 && (
          <div className="cal-nessuno">Nessuna prenotazione trovata</div>
        )}

        {/* Risultati della ricerca (veste «Maison», 29/09/2026: stesso comportamento di prima) */}
        {searchAttiva && (() => {
          if (!currentMatch) return null
          const m = currentMatch
          const stessoCliente = clientiDiversi === 1
          const roomShort = (id: string) => (rooms.find(r => r.id === id)?.name || '').split(' ').slice(-1)[0]
          const tel4 = (x: CalendarBooking) => (x.guests?.phone || '').replace(/\D/g, '').slice(-4)
          const voce = (x: CalendarBooking) => `${lblDate(x.check_in, x.check_out)} · ${roomShort(x.room_id)}`
          const voceNavigatore = (x: CalendarBooking) => `${lblDate(x.check_in, x.check_out).replace('–', ' – ')} · ${roomShort(x.room_id)}`
          return (
            <div className="cal-res" data-risultati-ricerca>
              {matches.length === 1 ? (
                // Un solo risultato: UNA riga compatta
                <div className="uno">
                  🔎 {nomeConAltri(m)} · {voce(m)}
                </div>
              ) : (
                <>
                  {/* Riga 1: quante prenotazioni, ben chiaro (tocco = elenco a comparsa) */}
                  <button type="button" onClick={() => setMenuAperto(o => !o)} className="cnt" aria-expanded={menuAperto}>
                    <span aria-hidden>🔎</span>
                    <span>
                      <b>{matches.length} prenotazioni trovate</b> · {stessoCliente ? nomeConAltri(matches[0]) : `${clientiDiversi} clienti diversi`}
                    </span>
                    <span className="dn" aria-hidden>{menuAperto ? '▴' : '▾'}</span>
                  </button>

                  {/* Telefono: navigatore ‹ [2 di 3 · data · camera] › */}
                  <div className="cal-navg lg:hidden">
                    <button type="button" className="ar"
                      onClick={() => vaiA((matchIdx - 1 + matches.length) % matches.length)}
                      aria-label="Risultato precedente">‹</button>
                    <button type="button" className="cur" onClick={() => setScrollTarget(m.check_in)}>
                      <small>{matchIdx + 1} di {matches.length}</small>
                      <b>{voceNavigatore(m)}</b>
                      {!stessoCliente && <i>{nomeConAltri(m)} · …{tel4(m)}</i>}
                    </button>
                    <button type="button" className="ar"
                      onClick={() => vaiA((matchIdx + 1) % matches.length)}
                      aria-label="Risultato successivo">›</button>
                  </div>

                  {/* Dal Mac: i risultati in fila */}
                  <div className="cal-fila hidden lg:flex">
                    {matches.map((x, i) => (
                      <button type="button" key={x.id} onClick={() => vaiA(i)} className={i === matchIdx ? 'on' : ''}>
                        <b>{voceNavigatore(x)}</b>
                        {!stessoCliente && <i>{nomeConAltri(x)} · …{tel4(x)}</i>}
                      </button>
                    ))}
                  </div>

                  {/* Elenco a comparsa: sta SOPRA il calendario, non lo spinge in basso */}
                  {menuAperto && (
                    <div className="cal-dd" data-elenco-risultati>
                      {matches.map((x, i) => (
                        <button type="button" key={x.id} onClick={() => vaiA(i)} className={i === matchIdx ? 'on' : ''}>
                          {voceNavigatore(x)}
                          {!stessoCliente && <i>{nomeConAltri(x)} · …{tel4(x)}</i>}
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
          // porta il calendario sulla data, «Apri» apre la prenotazione.
          // Durante una ricerca con più richieste il blocco si compatta in una
          // riga sola (il calendario deve restare visibile); un tocco lo riapre
          // e con ✕ torna comunque tutto com'era.
          <div className="cal-wr chip-in" data-richieste-sito>
            {searchAttiva && webRequests.length > 1 && !wrAperto ? (
              <div onClick={() => setWrAperto(true)}>
                <span aria-hidden>🌐</span>
                <span><b>{webRequests.length} richieste dal sito</b></span>
                <span className="tocca">tocca per vedere</span>
              </div>
            ) : webRequests.map(b => (
              <div key={b.id}
                onClick={() => {
                  if (!scrollRef.current) return
                  scrollRef.current.scrollTo({ left: Math.max(0, dayIndex(b.check_in) * CELL_W - Math.round(CELL_W * 1.5)), behavior: 'smooth' })
                }}>
                <span aria-hidden>🌐</span>
                <span className="tx">
                  <span>
                    <b>{nomeConAltri(b)}</b>
                    {' · '}
                    {b.check_in?.slice(5).split('-').reverse().join('/')} → {b.check_out?.slice(5).split('-').reverse().join('/')}
                    {rooms.find(r => r.id === b.room_id)?.name ? ` · ${rooms.find(r => r.id === b.room_id)?.name}` : ''}
                  </span>
                  {/* Numero già in archivio con un altro nominativo: avviso rosso su
                      riga propria, mai troncato (su mobile lo spazio è poco) */}
                  {nomeDiverso(b) && (
                    <span className="avviso">⚠️ Numero già usato · in archivio: {b.guests?.full_name}</span>
                  )}
                </span>
                <button type="button" className="mz-lnk"
                  onClick={e => {
                    e.stopPropagation()
                    router.push(`/scheda/${b.id}`)
                  }}>
                  Apri
                </button>
              </div>
            ))}
          </div>
        )}
      </TestaPagina>

      {/* Dal Mac la griglia sta in un riquadro bianco arrotondato come il calendario
          delle Richieste, con la barra di navigazione come prima riga del riquadro */}
      {/* stesse distanze delle Richieste: riquadro, 12 px, riga «Oggi · mesi» allineata alla colonna delle camere */}
      {/* Dal telefono il calendario va da bordo a bordo (riferimento del 29/09/2026):
          la colonna delle camere parte dal bordo, «Oggi» e «Legenda» sotto di lei */}
      <div className={`flex flex-col flex-none ${orizzontale ? 'mx-2 mt-2' : isDesktop ? 'mx-4' : ''} overflow-hidden`}>
      {!loading && (
        <>
          {/* Riga di navigazione (veste «Maison», 29/09/2026): ‹ · periodo · Mese | 2 settimane · › */}
          <div className="cal-nav shrink-0" data-riga-navigazione>
            <button type="button" className="ar" onClick={() => freccia(-1)} aria-label={etichettaFreccia(modo, -1)}>‹</button>
            <span className="per">{etichettaVista}</span>
            <span className="dx">
              {/* Lo stesso interruttore delle Richieste: il disegno sta in
                  components/InterruttorePillola (Ania, 12/09/2026), qui nella veste Maison */}
              <InterruttorePillola voci={VOCI_GRIGLIA} scelta={modo} onScegli={cambiaModo} nome="Vista del calendario" dati="modo-griglia" maison />
              <button type="button" className="ar" onClick={() => freccia(1)} aria-label={etichettaFreccia(modo, 1)}>›</button>
            </span>
          </div>
        </>
      )}

      {/* Dal Mac niente barra di scorrimento visibile sotto la griglia (sembrava un'ombra
          diversa dalle Richieste): si scorre con due dita, con le frecce e con i mesi */}
      {loading ? (
        <div className="mz-caricamento">Caricamento…</div>
      ) : (
        <div ref={scrollRef} onScroll={updateVisibleMonth} className="overflow-auto flex-none no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="cal-nastro" style={{ width: totalW, position: 'relative', height: totalH }} onClick={() => setSelectedGroupId(null)}>

            {/* ── IL RIGHELLO DEI GIORNI: «lun 28», domeniche in terra, oggi in verde; fermo in alto ── */}
            <div className="cal-righello" style={{ height: RULER_H }}>
              <div className="cal-angolo" style={{ width: NAME_W, minWidth: NAME_W }} />
              {days.map((d, i) => {
                const isToday = toStr(d) === todayStr
                const isSun = d.getDay() === 0
                const sett = d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3)
                return (
                  <span key={i} className={`${isSun ? 'dom' : ''} ${isToday ? 'oggi' : ''}`} style={{ width: CELL_W, minWidth: CELL_W }}>
                    {CELL_W >= 34 ? `${sett} ${d.getDate()}` : d.getDate()}
                  </span>
                )
              })}
            </div>

            {/* ── FILI DEI MESI: ottone 2 px al 1° del mese, su tutte le righe ── */}
            {monthGroups.map((mg, i) => i === 0 ? null : (
              <div key={`sep-${i}`} className="cal-filo-mese" aria-hidden style={{
                left: NAME_W + mg.startIdx * CELL_W - 1,
                top: RULER_H,
                height: totalH - RULER_H,
              }} />
            ))}

            {/* ── IL FILO DI OGGI: verde, a tutta altezza sulla colonna di oggi ── */}
            {dayIndex(todayStr) >= 0 && dayIndex(todayStr) < daysTotal && (
              <div className="cal-filo-oggi" aria-hidden data-filo-oggi style={{ left: NAME_W + dayIndex(todayStr) * CELL_W, top: RULER_H, height: totalH - RULER_H }} />
            )}

            {/* ── LE CORSIE DELLE CAMERE ── */}
            {rooms.map((room, ri) => {
              const rowTop = RULER_H + ri * ROW_H
              const shortName = room.name.split(' ').slice(-1)[0]
              const prenotazioni = bookingsForRoom(room.id)
              const tenute = barrePerCamera(barre, room.id)
              // I buchi liberi: fra una scheda e l'altra, prima della prima e dopo l'ultima
              const buchi = buchiLiberi([
                ...prenotazioni.map(b => ({ da: b.check_in, a: b.check_out })),
                ...tenute.map(t => ({ da: t.arrivo, a: t.partenza })),
              ], toStr(startDate), toStr(endDate))
              const occupato = (iso: string) => prenotazioni.some(b => b.check_in <= iso && iso < b.check_out) || tenute.some(t => t.arrivo <= iso && iso < t.partenza)
              return (
                <div key={room.id}>
                  <div className="cal-corsia" style={{ top: rowTop, width: totalW, height: ROW_H }}
                    onClick={e => {
                      // Un giorno libero toccato fuori dai buchi disegnati: nuova prenotazione da lì
                      const x = e.clientX - e.currentTarget.getBoundingClientRect().left - NAME_W
                      const idx = Math.floor(x / CELL_W)
                      const dateStr = days[idx] ? toStr(days[idx]) : ''
                      if (!dateStr || occupato(dateStr)) return
                      router.push(`/nuova-prenotazione?room_id=${room.id}&check_in=${dateStr}`)
                    }}>
                    {/* Nome camera: niente numero 01–04, solo il nome (05/09/2026) */}
                    <div className="cal-camera" title={ROOM_DESC_BY_NAME[shortName] || ''} style={{ width: NAME_W, minWidth: NAME_W }} onClick={e => e.stopPropagation()}>
                      {shortName}
                    </div>
                  </div>

                  {/* I buchi liberi: riquadro tratteggiato, «3 → 4 ott» e il «+»; il
                      tocco apre la nuova prenotazione con camera e arrivo già scritti */}
                  {buchi.map(h => {
                    const da = Math.max(0, dayIndex(h.da)), a = Math.min(daysTotal, dayIndex(h.a))
                    if (a - da <= 0) return null
                    const g = geometriaScheda(da, a, CELL_W)
                    return (
                      <button type="button" key={`buco-${h.da}`} className="cal-buco" data-buco={`${h.da}_${h.a}`}
                        aria-label={`Nuova prenotazione in ${shortName} dal ${h.da}`}
                        style={{ left: NAME_W + g.left, top: rowTop + SCHEDA_TOP, width: g.width, height: SCHEDA_H }}
                        onClick={e => {
                          e.stopPropagation()
                          // L'arrivo è l'inizio del buco; se l'inizio è fuori vista (a sinistra), il primo giorno del buco in vista
                          const primo = Math.floor((scrollRef.current?.scrollLeft ?? 0) / CELL_W)
                          const dateStr = toStr(days[Math.min(a - 1, Math.max(da, primo))])
                          router.push(`/nuova-prenotazione?room_id=${room.id}&check_in=${dateStr}`)
                        }}>
                        <span className="in" style={{ left: NAME_W + ARIA_SCHEDA, width: parteInVista(da, a) }}>
                          <em>{rigaBuco(h)}</em>
                          <span className="pl" aria-hidden>+</span>
                        </span>
                      </button>
                    )
                  })}

                  {/* Le schede: quattro righe scritte sopra (date · icone e nome · ospiti e stato · arrivo) */}
                  {prenotazioni.map(booking => {
                    const startIdx = Math.max(0, dayIndex(booking.check_in))
                    const endIdx = Math.min(daysTotal, dayIndex(booking.check_out))
                    if (endIdx - startIdx <= 0) return null
                    const isOttimo = booking.guests?.rating === 'ottimo'
                    const isEsclusiva = booking.color === '#f97316'
                    const vuoleRicevuta = clienteVuoleRicevuta(booking.guests)
                    const hasExtraBed = booking.extra_bed || (booking.extra_bed_dates && booking.extra_bed_dates.length > 0)
                    const chainKey = changeGroups.chainKeyOf[booking.id]
                    const isMultiRoom = !!chainKey
                    const hasIncoming = incomingIds.has(booking.id)
                    const hasOutgoing = outgoingIds.has(booking.id)
                    const isSelected = isMultiRoom && selectedGroupId === chainKey
                    // Ricerca attiva: risultato selezionato col contorno verde, gli
                    // altri risultati pieni, tutto il resto attenuato ma leggibile.
                    // Catena toccata: la catena piena con l'ombra, il resto attenuato.
                    const isMatch = matchedIds.has(booking.id)
                    const isCurrent = searchAttiva && currentMatch?.id === booking.id
                    const isDimmed = searchAttiva
                      ? !isMatch
                      : (selectedGroupId !== null && !isSelected)
                    // Richiesta dal sito da confermare: scheda tratteggiata verde
                    const isWebPending = booking.status === 'in_attesa' && booking.source === 'sito_web'
                    const stato = statoScheda(booking, paidNightsByBooking[booking.id] === -1)
                    const tinta = tintaScheda(stato, booking.color)
                    const g = geometriaScheda(startIdx, endIdx, CELL_W)
                    // Cambio camera: il tratto che parte tagliato in basso a destra, quello che arriva in basso a sinistra
                    const cutLeft = hasIncoming && startIdx === dayIndex(booking.check_in)
                    const cutRight = hasOutgoing && endIdx === dayIndex(booking.check_out)
                    const clipPath = cutLeft || cutRight ? percorsoBarraArrotondata(g.width, SCHEDA_H, cutLeft, cutRight, 6, TAGLIO_CAMBIO) : undefined
                    const tocco = areaTocco(rowTop + SCHEDA_TOP, SCHEDA_H)
                    const righe = {
                      date: rigaDate(booking.check_in, booking.check_out, isWebPending ? 'dalSito' : null),
                      icone: iconeScheda({ esclusiva: isEsclusiva, ottimo: isOttimo, ricevuta: vuoleRicevuta, letto: !!hasExtraBed, cambio: isMultiRoom, dalSito: booking.source === 'sito_web' && !isWebPending }),
                      nome: nomeConAltri(booking),
                      sotto: rigaSotto({ ospiti: Number(booking.num_guests) || 1, stato: testoStato(stato), letti: lettiPoolPrenotazione(booking), poi: poiCamera[booking.id], da: daCamera[booking.id] }),
                      arrivo: isWebPending ? null : hasIncoming ? CAMBIO_CAMERA : rigaArrivo(leggiArrivo(booking as unknown as Record<string, unknown>)),
                    }
                    return (
                      <div key={booking.id} data-tocco data-scheda={booking.id} data-stato={stato}
                        onClick={e => { e.stopPropagation(); tocca(booking, chainKey) }}
                        className={`cal-scheda ${isDimmed ? (searchAttiva ? 'dim cerca' : 'dim') : ''} ${isSelected ? 'catena' : ''} ${isCurrent ? 'trovata' : ''}`}
                        style={{ top: tocco.top, height: tocco.height, left: NAME_W + g.left, width: g.width, zIndex: isCurrent ? 16 : isSelected ? 15 : 5 }}>
                        <div className={`cal-scheda-in ${isWebPending ? 'sito' : ''} ${cutLeft ? 'cl' : ''}`} data-letto={hasExtraBed ? lettiPoolPrenotazione(booking) : undefined}
                          style={{
                            background: tinta.fondo, color: tinta.testo,
                            borderLeftColor: isWebPending ? tinta.filo : cutLeft ? 'transparent' : tinta.filo,
                            ...(isWebPending ? { borderColor: tinta.filo } : {}),
                            clipPath, borderRadius: clipPath ? 0 : 6,
                          }}>
                          {cutRight && <span aria-hidden data-filo-obliquo="uscita" className="cal-cuneo" style={{ background: tinta.filo, clipPath: filoObliquo('destra', g.width, SCHEDA_H) }} />}
                          {cutLeft && <span aria-hidden data-filo-obliquo="arrivo" className="cal-cuneo" style={{ background: tinta.filo, clipPath: filoObliquo('sinistra', g.width, SCHEDA_H) }} />}
                          {/* il testo resta in vista anche quando la scheda comincia fuori, a sinistra */}
                          <span className="tx" style={{ left: NAME_W + ARIA_SCHEDA + 8, width: larghezzaTesto(startIdx, endIdx) }}>
                            <em>{righe.date}</em>
                            <b>{righe.icone && <span className="ic">{righe.icone} </span>}{righe.nome}</b>
                            <small>{righe.sotto}</small>
                            {righe.arrivo && <small className="ar2">{righe.arrivo}</small>}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* ── CAMERE TENUTE DA UNA PROPOSTA (15/09/2026) ── schede in ottone,
                      «in opzione», fino a quando; smorzate quando la tenuta è scaduta */}
                  {tenute.map(barra => {
                    const startIdx = Math.max(0, dayIndex(barra.arrivo))
                    const endIdx = Math.min(daysTotal, dayIndex(barra.partenza))
                    if (endIdx - startIdx <= 0) return null
                    const g = geometriaScheda(startIdx, endIdx, CELL_W)
                    const tinta = TINTE_SCHEDA.tenuta
                    const isDimmed = searchAttiva || selectedGroupId !== null
                    return (
                      <div key={`tenuta-${barra.richiestaId}-${barra.cameraId}-${barra.arrivo}`}
                        data-tenuta={barra.anticipato ? 'anticipato' : 'arrivo'} data-tocco
                        onClick={(e) => { e.stopPropagation(); setBarraAperta(barra) }}
                        title={`${barra.ospite} · ${testoTenuta(barra, adesso)}`}
                        className={`cal-scheda ${isDimmed ? (searchAttiva ? 'dim cerca' : 'dim') : barra.scaduta ? 'scaduta' : ''}`}
                        style={{ top: rowTop + SCHEDA_TOP, height: SCHEDA_H, left: NAME_W + g.left, width: g.width, zIndex: 5 }}>
                        <div className="cal-scheda-in" data-letto={barra.lettoNotti.length > 0 ? 1 : undefined}
                          style={{ background: tinta.fondo, color: tinta.testo, borderLeftColor: tinta.filo, borderRadius: 6 }}>
                          <span className="tx" style={{ left: NAME_W + ARIA_SCHEDA + 8, width: larghezzaTesto(startIdx, endIdx) }}>
                            <em>{rigaDate(barra.arrivo, barra.partenza, 'opzione')}</em>
                            <b>{barra.lettoNotti.length > 0 && <span className="ic">🛏 </span>}{barra.ospite}</b>
                            <small>{rigaSotto({ ospiti: barra.persone, stato: barra.scaduta ? 'scaduta' : `scade alle ${oraRoma(barra.scadenza)}`, letti: barra.lettoNotti.length > 0 ? 1 : 0 })}</small>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* ── RIGA LETTI AGGIUNTIVI «🛏 EXTRA»: è lei a dire quando i due letti della casa sono finiti ── */}
            {(() => {
              const rowTop = RULER_H + rooms.length * ROW_H
              return (
                <div className="cal-extra" style={{ top: rowTop, width: totalW, height: EXTRA_ROW_H }}>
                  <div className="cal-camera extra" style={{ width: NAME_W, minWidth: NAME_W }}>
                    <span className="xl">🛏 extra</span>
                  </div>
                  {days.map((d, i) => {
                    const dateStr = toStr(d)
                    const count = extraBedsMap.get(dateStr) || 0
                    const isFull = statoLettiAggiuntivi(count) === 'esauriti'
                    const isToday = dateStr === todayStr
                    // Letti TENUTI da una proposta: promessi, non ancora
                    // prenotati. Vanno accanto al conto vero, dentro un
                    // riquadro tratteggiato (Ania, 15/09/2026).
                    const tenuti = lettiTenuti.get(dateStr) || 0
                    return (
                      <div key={i} className={`cal-extra-g ${isFull ? 'pieno' : isToday ? 'oggi' : ''}`}
                        style={{ width: CELL_W, minWidth: CELL_W, background: isFull ? COLORE_LETTI_ESAURITI : undefined }}>
                        {count > 0 && <b>{count}/{EXTRA_BED_MAX}</b>}
                        {tenuti > 0 && (
                          <i data-letti-tenuti title={`${tenuti} ${tenuti === 1 ? 'letto tenuto' : 'letti tenuti'} da una proposta`}>{tenuti}</i>
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
      {/* Sotto il calendario: «Oggi» e i 12 mesi cliccabili (riga condivisa con Arrivi e Richieste), telefono e Mac */}
      {!loading && (
        <RigaMesi colonna={NAME_W} mesi={mesi} attivo={meseVisibile} onMese={m => vaiAData(m.iso, 0)} onOggi={vaiAOggi} className={`shrink-0 pt-3 ${legendaInRiga ? 'pb-4' : 'pb-1'} ${orizzontale ? 'px-2' : 'px-4'}`} />
      )}
      {/* Legenda a pannello dove non c'è quella in riga (Ania, 07/09/2026): il «?» sta
          SOTTO «Oggi», centrato nella stessa colonna, non più in alto accanto a «Indietro» */}
      {!loading && !legendaInRiga && (
        <div className={`shrink-0 flex pb-3 ${orizzontale ? 'px-2' : 'px-4'}`}>
          <div className="shrink-0 flex justify-center" style={{ width: BORDO_RIQUADRO + NAME_W, minWidth: BORDO_RIQUADRO + NAME_W }}>
            <button type="button" aria-label="Legenda" title="Legenda" onClick={() => setLegendaAperta(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-green-mid font-serif text-[18px] leading-none active:bg-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid">?</button>
          </div>
        </div>
      )}

      {/* Legenda in riga solo dal Mac (07/09/2026): sul telefono sta nel pannello «?» sotto «Oggi» */}
      {legendaInRiga && (
        <div className="shrink-0 px-4 pb-4 flex flex-wrap gap-3 items-center">
          <VociLegenda />
          {/* Niente voce «Cambio camera» nella legenda (richiesta di Ania, 04/09/2026): le barre tagliate a incastro si spiegano da sole */}
          <span className="ml-auto text-[9px] text-gray-300">v. {process.env.NEXT_PUBLIC_BUILD_TAG}</span>
        </div>
      )}
      {legendaAperta && <PannelloLegenda onChiudi={() => setLegendaAperta(false)} />}

      {/* ── FOGLIETTO DELLA CAMERA TENUTA (15/09/2026) ──
          Si apre toccando una barra tratteggiata: per chi è tenuta, fino a
          quando, come doveva pagare. Da qui si libera la camera, o si libera e
          si scrive subito una prenotazione nuova per chi è al telefono. */}
      {barraAperta && !confermaLibera && (
        <div role="dialog" aria-label="Camera tenuta" data-foglietto-tenuta
          onClick={() => setBarraAperta(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(31,61,47,0.35)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            className="ed-riquadro w-full"
            style={{ maxWidth: 520, borderRadius: '14px 14px 0 0', padding: '14px 16px 22px' }}>
            <div style={{ width: 38, height: 4, borderRadius: 99, background: '#D9D3C4', margin: '0 auto 12px' }} />
            <p className="ed-sezione">Camera tenuta</p>
            <p className="titolo-classico" style={{ fontSize: 22, margin: '0 0 2px' }}>{barraAperta.ospite}</p>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <b>{barraAperta.cameraNome}</b> · {formatIntervalloBreve(barraAperta.arrivo, barraAperta.partenza)} · {barraAperta.notti.length} {barraAperta.notti.length === 1 ? 'notte' : 'notti'} · {barraAperta.persone} {barraAperta.persone === 1 ? 'persona' : 'persone'}{barraAperta.lettoNotti.length > 0 ? ' + letto' : ''}
            </p>
            {barraAperta.alternativa && (
              <p className="text-[12px] text-gray-500 mt-1">Camera proposta come alternativa, insieme alle altre.</p>
            )}
            <div className="ed-riga mt-2">
              <p className="text-[13px] text-gray-600">
                {comeDovevaPagare(barraAperta)}
                {' · '}
                <span style={{ color: barraAperta.scaduta ? '#8C3B2E' : '#7a5f2c', fontWeight: 700 }}>{testoTenuta(barraAperta, adesso)}</span>
              </p>
            </div>
            {barraAperta.prezzo !== null && (
              <div className="ed-riga">
                <p className="text-[13px] text-gray-600">Prezzo proposto <b>{barraAperta.prezzo.toLocaleString('it-IT')} €</b></p>
                <p className="text-[12px] text-gray-400 mt-0.5">Questo accordo era per {barraAperta.ospite}: nella prenotazione nuova non viene portato dietro.</p>
              </div>
            )}
            {avvisoTenuta && <p className="text-[13px] mt-3" style={{ color: '#8C3B2E' }}>{avvisoTenuta}</p>}
            <div className="flex flex-col gap-2 mt-4">
              <button type="button" className="ed-pillola" style={{ minHeight: 44 }}
                onClick={() => { setAvvisoTenuta(null); setConfermaLibera({ barra: barraAperta, prenotaDopo: true }) }}>
                Libera e fai una prenotazione nuova
              </button>
              <button type="button" className="ed-pillola-contorno" style={{ minHeight: 44 }}
                onClick={() => { setAvvisoTenuta(null); setConfermaLibera({ barra: barraAperta, prenotaDopo: false }) }}>
                Libera la camera
              </button>
              <button type="button" className="ed-pillola-tenue" style={{ minHeight: 44 }}
                onClick={() => { ricordaPosizione(); router.push(`/richieste/${barraAperta.richiestaId}`) }}>
                Apri la richiesta di {barraAperta.ospite}
              </button>
              <button type="button" className="ed-azione self-center" onClick={() => setBarraAperta(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* ── IL FOGLIETTO DI DETTAGLIO (29/09/2026): sale dal basso al primo tocco su una scheda ── */}
      {aperta && (
        <FogliettoPrenotazione prenotazione={aperta} tutte={bookings} camere={rooms} pagamenti={pagamenti}
          onApri={() => apriScheda(aperta)} onChiudi={chiudiFoglietto} onVelo={toccoSulVelo} />
      )}

      {/* ── IL POP-UP: niente si muove senza un sì (Ania, 15/09/2026) ── */}
      {confermaLibera && (() => {
        const { barra, prenotaDopo } = confermaLibera
        const testo = testoConferma({
          camera: barra.cameraNome, ospite: barra.ospite,
          quando: quandoInParole(barra.notti), prenotaDopo,
        })
        return (
          <div role="dialog" aria-label={testo.titolo} data-conferma-tenuta
            style={{ position: 'fixed', inset: 0, background: 'rgba(31,61,47,0.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="ed-riquadro w-full" style={{ maxWidth: 420, padding: 18 }}>
              <p className="titolo-classico" style={{ fontSize: 22, margin: '0 0 10px' }}>{testo.titolo}</p>
              {testo.righe.map(r => <p key={r} className="text-[13px] text-gray-600 leading-relaxed mb-1.5">{r}</p>)}
              <div className="flex flex-col gap-2 mt-4">
                <button type="button" className="ed-pillola" style={{ minHeight: 44 }} disabled={liberando}
                  onClick={() => liberaCamera(barra, prenotaDopo)}>
                  {liberando ? 'Un attimo…' : testo.conferma}
                </button>
                <button type="button" className="ed-pillola-tenue" style={{ minHeight: 44 }} disabled={liberando}
                  onClick={() => setConfermaLibera(null)}>
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
