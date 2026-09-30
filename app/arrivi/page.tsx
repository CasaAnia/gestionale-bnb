'use client'
import { hrefScheda } from '@/lib/provenienzaScheda'
// ============================================================================
// ARRIVI «MAISON» (riferimento approvato da Ania il 29/09/2026:
// docs/design/arrivi-riferimento.html, checklist in docs/design/arrivi-checklist.md).
//
// Lo stesso nastro del Calendario «Maison» — stessa testa, stessa riga di
// navigazione, stesse misure, gli stessi pezzi (components/calendario/Nastro)
// — ma la scheda parla di ARRIVO: l'orario grande davanti al nome, sotto
// luogo · mezzo · navetta e prelievo (lib/arriviSchede), e il colore dice lo
// stato dell'arrivo: verde tutto a posto, ottone arrivo autonomo con l'orario,
// blu manca qualcosa. Gli arrivi già avvenuti sono attenuati. Il tocco apre
// il foglio «Arrivo e navetta» (components/scheda/FoglioArrivo, lo stesso
// della Home e della scheda) con lo storico e le azioni di sempre.
//
// Tutto il resto è come prima: 90 giorni (7 prima di oggi, 83 dopo), la
// ricerca, il box dei cambi camera, i mesi, ?apri=<id> dalla Home.
// ============================================================================
import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUpcomingRoomChanges, buildChangeGroups, percorsoBarraArrotondata } from '@/lib/roomChanges'
import { ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { nomeConAltri } from '@/lib/guestName'
import { matchPrenotazione } from '@/lib/ricerca'
import BackLink from '@/components/BackLink'
import TestaPagina from '@/components/TestaPagina'
import RigaPeriodo from '@/components/RigaPeriodo'
import { periodoEsteso, meseEsteso } from '@/lib/periodoEsteso'
import { sottotitoloArrivi } from '@/lib/testaMac'
import CampoRicerca from '@/components/CampoRicerca'
import RigaMesi from '@/components/RigaMesi'
import InterruttorePillola from '@/components/InterruttorePillola'
import { RighelloNastro, FiliNastro, CorsiaNastro, BucoNastro, SchedaNastro } from '@/components/calendario/Nastro'
import { lettiPoolPrenotazione, nottiLettoExtra } from '@/lib/lettiAggiuntivi'
import { PannelloLegenda } from '@/components/LegendaCalendario'
import FoglioArrivo, { ALTEZZA_FOGLIO_ARRIVO_ARRIVI } from '@/components/scheda/FoglioArrivo'
import { IconeContatto } from '@/components/scheda/TestataMaison'
import { mesiCliccabili } from '@/lib/mesiCliccabili'
import { MEDIA_ORIZZONTALE_TELEFONO, useOrizzontaleTelefono, useSchermoIntero } from '@/lib/richiesteVista'
import { etichettaPeriodo, GIORNI_QUINDICINA, GIORNI_PRIMA_OGGI } from '@/lib/richiesteCalendario'
import { leggiArrivo, arrivoInScheda, navettaInScheda, TITOLO_ARRIVO } from '@/lib/arrivo'
import { idDaParametro } from '@/lib/daControllare'
import { BottoniOrario } from '@/components/BottoniWhatsApp'
import { whatsappRichiestaOrario } from '@/lib/messaggiWhatsApp'
import { vuoleRicevuta } from '@/lib/valutazione'
import { dataConGiorno } from '@/lib/dateItaliane'
import { iconeFoglietto, LARGHEZZA_FOGLIETTO_MAC } from '@/lib/calendarioFoglietto'
import {
  CORSIA_H, SCHEDA_H, SCHEDA_TOP, ARIA_SCHEDA, TAGLIO_CAMBIO, FILO_SINISTRO, geometriaScheda, iconeScheda, buchiLiberi, rigaBuco, arrivoToccatoNelBuco,
  daConfermareDalSito, trattiLetto,
} from '@/lib/calendarioSchede'
import {
  statoArrivo, orarioScheda, tintaArrivo, coloreRigaArrivo, rigaArrivoArrivi, rigaDateArrivi, arrivoPassato, primoTratto, haOrario,
} from '@/lib/arriviSchede'
import {
  areaTocco, PASSO_FRECCE_QUINDICI, etichettaFreccia, colonnaMinTelefono, OPACITA_ARRIVATA, VOCI_LEGENDA_ARRIVI, ICONE_LEGENDA_ARRIVI,
  VOCI_GRIGLIA_TELEFONO, BUCHI_LIBERI_VISIBILI,
} from '@/lib/calendarioMobile'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
// Le misure del Calendario «Maison» (app/calendario): righello 22 px sul
// telefono e 26 dal Mac, colonna delle camere 66 sul telefono e 84 dal Mac,
// corsie da 92 con le schede da 72 (lib/calendarioSchede)
const RULER_H_MOBILE = 22
const RULER_H_DESKTOP = 26
const NAME_W_MOBILE = 66   // telefono (05/09/2026): come le Richieste, uguale in Calendario/Arrivi/Richieste (richiesta di Ania)
const NAME_W_DESKTOP = 84   // solo il nome della camera, senza numero
const CELL_W_DESKTOP = 101
// Selettore «Mese | 2 settimane» (stessa scelta ricordata del Calendario)
type ModoGriglia = 'mese' | 'quindici'
const COLONNE_VISIBILI: Record<ModoGriglia, number> = { mese: 31, quindici: GIORNI_QUINDICINA }   // 31: a mese si vede il mese intero (05/09/2026)
const CHIAVE_MODO = 'ca_calendario_modo'
const VOCI_GRIGLIA = [['mese', 'Mese'], ['quindici', '2 settimane']] as const satisfies readonly (readonly [ModoGriglia, string])[]
const LARGHEZZA_MIN_COLONNA = 28
const DAYS_TOTAL = 90
const DAYS_BEFORE = 7
// La legenda degli Arrivi nel foglio: cinque voci, alcune su due righe
const ALTEZZA_LEGENDA_ARRIVI = 470

// Una prenotazione come la leggono gli Arrivi (bookings + guests)
type Riga = {
  id: string; room_id: string; guest_id?: string | null; group_id?: string | null
  check_in: string; check_out: string; check_in_time?: string | null
  status?: string | null; source?: string | null; color?: string | null
  extra_bed?: boolean | null; extra_bed_dates?: string[] | null
  guest_name?: string | null
  guests?: { id?: string; full_name?: string | null; phone?: string | null; rating?: string | null; vuole_ricevuta?: boolean | null } | null
  [colonna: string]: unknown
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

function roomPreposition(room: string) {
  return /^[aeiouAEIOU]/.test(room) ? 'ad' : 'a'
}

// Gli arrivi sono le prenotazioni confermate e concluse, come prima; più le
// richieste dal sito da confermare, tratteggiate come nel Calendario
const eArrivo = (b: Riga) => b.status === 'confermata' || b.status === 'completata' || daConfermareDalSito(b)

export default function Arrivi() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([])
  // tutte le prenotazioni non annullate: servono per i buchi liberi veri; a schermo vanno gli arrivi
  const [bookings, setBookings] = useState<Riga[]>([])
  const [loading, setLoading] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)
  const orizzontale = useOrizzontaleTelefono()
  useSchermoIntero()
  // Il foglio «Arrivo e navetta» aperto: la prenotazione toccata
  const [popup, setPopup] = useState<{ id: string } | null>(null)
  const [showStorico, setShowStorico] = useState(false)
  // 30/09/2026 (Ania): lo storico nel foglio è una riga chiusa «Storico ›» che si apre al tocco
  const [storicoAperto, setStoricoAperto] = useState(false)
  // Primo tocco su una scheda con cambio camera: la catena resta piena, il resto attenuato
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [legendaAperta, setLegendaAperta] = useState(false)

  // Titolo sticky mese+anno: segue il mese più a sinistra attualmente in vista (come nel calendario)
  function fmtMonth(d: Date) {
    const l = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    return l.charAt(0).toUpperCase() + l.slice(1)
  }
  const [visibleMonth, setVisibleMonth] = useState(() => fmtMonth(new Date()))

  useEffect(() => {
    // Telefono girato in orizzontale: griglia del Mac (compatta) a tutto schermo
    const check = () => setIsDesktop(window.innerWidth >= 1024 || window.matchMedia(MEDIA_ORIZZONTALE_TELEFONO).matches)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const arrivi = useMemo(() => bookings.filter(eArrivo), [bookings])
  const confermati = useMemo(() => arrivi.filter(b => !daConfermareDalSito(b)), [arrivi])

  const [primoVisibile, setPrimoVisibile] = useState(DAYS_BEFORE)
  // Il primo giorno INTERO in vista (per tenere il testo delle schede lunghe dentro la parte che si vede)
  const [colonnaSinistra, setColonnaSinistra] = useState(DAYS_BEFORE)
  // Ricerca per nome o telefono (stesso campo del Calendario): gli arrivi
  // trovati col contorno verde, gli altri attenuati; si scorre al primo.
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const t = query.trim()
    if (!t) return []
    return arrivi.filter(b => matchPrenotazione(b, t)).sort((a, b) => a.check_in.localeCompare(b.check_in))
  }, [arrivi, query])
  const matchedIds = useMemo(() => new Set(matches.map(m => m.id)), [matches])
  const cercando = query.trim() !== ''
  const searchAttiva = matches.length > 0
  const [modo, setModo] = useState<ModoGriglia>('quindici')
  useEffect(() => {
    let v: string | null = null
    try { v = window.localStorage.getItem(CHIAVE_MODO) } catch { v = null }
    const t = setTimeout(() => { if (v === 'mese' || v === 'quindici') setModo(v) }, 0)
    return () => clearTimeout(t)
  }, [])
  const [larghezzaGriglia, setLarghezzaGriglia] = useState(0)
  const primoGiornoRef = useRef<number | null>(null)
  // Da controllare in Home (06/09/2026): ?apri=<id> → giorno di arrivo da cui far partire la griglia
  const apriUrlRef = useRef<string | null>(null)
  // Colonna delle camere: larga solo sul Mac vero; sul telefono, dritto o
  // girato, quella stretta delle Richieste (uguale nelle tre pagine, 05/09/2026)
  const colonnaLarga = isDesktop && !orizzontale
  const NAME_W = colonnaLarga ? NAME_W_DESKTOP : NAME_W_MOBILE
  // Telefono girato (scelta di Ania, 05/09/2026): a mese tutti i 31 giorni e a
  // 2 settimane tutte le 14 caselle nella larghezza dello schermo, senza
  // scorrimento di lato e senza caselle a metà. Sul telefono dritto 60 px a
  // «2 settimane» e 40 a «Mese», come il Calendario.
  const colonnaMin = isDesktop ? (orizzontale ? 0 : LARGHEZZA_MIN_COLONNA) : colonnaMinTelefono(modo)
  const CELL_W = larghezzaGriglia > 0
    ? (colonnaMin === 0 ? (larghezzaGriglia - NAME_W) / COLONNE_VISIBILI[modo] : Math.max(colonnaMin, Math.floor((larghezzaGriglia - NAME_W) / COLONNE_VISIBILI[modo])))
    : (isDesktop ? CELL_W_DESKTOP : 60)
  const ROW_H = CORSIA_H
  const RULER_H = isDesktop && !orizzontale ? RULER_H_DESKTOP : RULER_H_MOBILE

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -DAYS_BEFORE)
  const endDate = addDays(startDate, DAYS_TOTAL)
  const days: Date[] = Array.from({ length: DAYS_TOTAL }, (_, i) => addDays(startDate, i))
  const todayStr = toStr(today)
  const tomorrowStr = toStr(addDays(today, 1))

  const roomNameById = useMemo(() => {
    const map: Record<string, string> = {}
    rooms.forEach(r => { map[r.id] = r.name.split(' ').slice(-1)[0] })
    return map
  }, [rooms])

  // Cambi camera (di soggiorni collegati) la cui nuova camera inizia oggi o domani
  const roomChanges = useMemo(
    () => getUpcomingRoomChanges(confermati, roomNameById, [todayStr, tomorrowStr]),
    [confermati, roomNameById, todayStr, tomorrowStr]
  )

  // Catene cambio camera: stesse del calendario, per il taglio a incastro delle schede
  const changeGroups = useMemo(() => buildChangeGroups(arrivi), [arrivi])
  const { outgoingIds, incomingIds, poiCamera, daCamera } = useMemo(() => {
    const outgoing = new Set<string>()
    const incoming = new Set<string>()
    const poi: Record<string, string> = {}, da: Record<string, string> = {}
    changeGroups.edges.forEach(e => {
      outgoing.add(e.fromId); incoming.add(e.toId)
      poi[e.fromId] = roomNameById[arrivi.find(b => b.id === e.toId)?.room_id ?? ''] ?? ''
      da[e.toId] = roomNameById[arrivi.find(b => b.id === e.fromId)?.room_id ?? ''] ?? ''
    })
    return { outgoingIds: outgoing, incomingIds: incoming, poiCamera: poi, daCamera: da }
  }, [changeGroups, arrivi, roomNameById])

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings')
        .select('*, guests(*)')
        .neq('status', 'annullata'),
    ]).then(([{ data: r }, { data: b }]) => {
      const sorted = ((r || []) as { id: string; name: string }[]).sort((a, b) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      setBookings((b || []) as Riga[])
      // Da controllare in Home (06/09/2026): «Apri arrivo» arriva con ?apri=<id>
      // e trova il foglio dell'arrivo già aperto su quella prenotazione
      const apri = idDaParametro(window.location.search, 'apri')
      const daAprire = apri ? ((b || []) as Riga[]).find(x => x.id === apri && eArrivo(x)) : null
      if (daAprire) {
        apriUrlRef.current = daAprire.check_in
        setShowStorico(false)
        setStoricoAperto(false)
        setPopup({ id: daAprire.id })
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading && scrollRef.current) {
      if (apriUrlRef.current) {
        // Arrivo chiesto dalla Home: la griglia parte dal giorno prima; una
        // volta misurato il riquadro il parametro non comanda più (frecce, modo)
        scrollRef.current.scrollLeft = Math.max(0, days.findIndex(d => toStr(d) === apriUrlRef.current) - 1) * CELL_W
        if (larghezzaGriglia > 0) apriUrlRef.current = null
      } else if (primoGiornoRef.current !== null) {
        scrollRef.current.scrollLeft = primoGiornoRef.current * CELL_W
        primoGiornoRef.current = null
      } else {
        // Stessa prima casella di Calendario e Richieste (Ania, 05/09/2026)
        scrollRef.current.scrollLeft = indiceOggi() * CELL_W
      }
      updateVisibleMonth()
    }
  }, [loading, CELL_W, isDesktop]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !scrollRef.current) return
    const el = scrollRef.current
    const ro = new ResizeObserver(() => setLarghezzaGriglia(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  function cambiaModo(m: ModoGriglia) {
    if (m === modo) return
    primoGiornoRef.current = Math.max(0, Math.floor((scrollRef.current?.scrollLeft ?? 0) / CELL_W))
    setModo(m)
    try { window.localStorage.setItem(CHIAVE_MODO, m) } catch { /* niente memoria */ }
  }
  function cambiaRicerca(v: string) {
    setQuery(v)
    const t = v.trim()
    if (!t) return
    const primo = arrivi.filter(b => matchPrenotazione(b, t)).sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
    if (primo) vaiAIndice(dayIndex(primo.check_in) - 1)
  }
  // Prima casella quando si torna a oggi: 3 giorni prima di oggi a 2 settimane,
  // il 1° del mese a mese (entro i 7 giorni di storia della pagina)
  function indiceOggi(): number {
    return modo === 'quindici' ? DAYS_BEFORE - GIORNI_PRIMA_OGGI : Math.max(0, DAYS_BEFORE - (today.getDate() - 1))
  }
  function vaiAIndice(idx: number) {
    scrollRef.current?.scrollTo({ left: Math.max(0, Math.min(days.length - 1, idx)) * CELL_W, behavior: 'smooth' })
  }
  // Frecce ‹ ›: a 2 settimane spostano di UNA settimana (novità del 29/09/2026,
  // come nel Calendario), a mese vanno al 1° del mese prima/dopo (entro i 90 giorni)
  function freccia(direzione: -1 | 1) {
    if (modo === 'quindici') { scrollRef.current?.scrollBy({ left: direzione * PASSO_FRECCE_QUINDICI * CELL_W, behavior: 'smooth' }); return }
    const d = days[Math.min(days.length - 1, Math.max(0, primoVisibile))]
    const primo = new Date(d.getFullYear(), d.getMonth() + (direzione === 1 ? 1 : (d.getDate() === 1 ? -1 : 0)), 1)
    vaiAIndice(Math.round((primo.getTime() - startDate.getTime()) / 86400000))
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

  function dayIndex(dateStr: string) {
    const d = strToDate(dateStr)
    return Math.round((d.getTime() - startDate.getTime()) / 86400000)
  }

  // Tocco su una scheda: il foglio «Arrivo e navetta»; se la scheda è di una
  // catena di cambio camera, la catena resta piena e il resto si attenua
  function tocca(booking: Riga, chainKey: string | undefined) {
    setShowStorico(false)
    setStoricoAperto(false)
    setPopup({ id: booking.id })
    setSelectedGroupId(chainKey ?? null)
  }
  function chiudiFoglio() {
    setPopup(null)
    setSelectedGroupId(null)
  }

  const totalW = NAME_W + DAYS_TOTAL * CELL_W
  const totalH = RULER_H + rooms.length * ROW_H
  // La parte di scheda che si vede: il testo non è mai più largo di così
  const corsiaVisibile = Math.max(0, larghezzaGriglia - NAME_W - ARIA_SCHEDA * 2)
  const parteInVista = (da: number, a: number) => {
    const w = geometriaScheda(Math.max(da, colonnaSinistra) < a ? Math.max(da, colonnaSinistra) : da, a, CELL_W).width
    return corsiaVisibile > 0 ? Math.min(w, corsiaVisibile) : w
  }
  const larghezzaTesto = (da: number, a: number) => Math.max(0, parteInVista(da, a) - 16 - FILO_SINISTRO)

  const aperta = popup ? arrivi.find(b => b.id === popup.id) ?? null : null
  // Dal Mac il periodo per esteso (RigaPeriodo): «26 settembre – 9 ottobre 2026», a mese «Settembre 2026»
  const giorniMac = days.slice(Math.max(0, primoVisibile), Math.max(0, primoVisibile) + GIORNI_QUINDICINA).map(toStr)
  const periodoMac = modo === 'quindici'
    ? periodoEsteso(giorniMac[0], giorniMac[giorniMac.length - 1])
    : meseEsteso(toStr(days[Math.min(days.length - 1, Math.max(0, primoVisibile))]))

  return (
    <div className="maison cal flex flex-col" data-senza-sottolinea data-arrivi-maison>
      {/* La testa è quella condivisa da Calendario, Arrivi e Richieste:
          components/TestaPagina (spazio in alto uguale per tutt'e tre) */}
      <TestaPagina titolo="Arrivi" maison desktop={isDesktop} indietro={<BackLink href="/" />}
        scrittaMac={isDesktop && !orizzontale}
        comandi={<CampoRicerca maison value={query} onChange={cambiaRicerca} className={isDesktop ? (orizzontale ? 'flex-1 max-w-[360px]' : 'w-[340px]') : 'w-full'} />}>
        {cercando && matches.length === 0 && (
          <div className="cal-nessuno">Nessun arrivo trovato nei prossimi {DAYS_TOTAL - DAYS_BEFORE} giorni</div>
        )}
        {searchAttiva && (
          <div className="cal-res" data-risultati-ricerca><div className="uno">🔎 {matches.length === 1 ? nomeConAltri(matches[0]) : `${matches.length} arrivi trovati`}</div></div>
        )}
      </TestaPagina>

      {/* Dal telefono il nastro va da bordo a bordo, come il Calendario */}
      <div className={`flex flex-col flex-none ${orizzontale ? 'mx-2 mt-2' : isDesktop ? 'mx-4' : ''} overflow-hidden`}>
      {/* La riga del periodo comune (components/RigaPeriodo, 29/09/2026): dal Mac per esteso,
          dal telefono (novità 14a) il periodo in Cormorant 20 e ‹ · pillola · › attaccati */}
      {!loading && (
        <RigaPeriodo etichetta={periodoMac} onPrec={() => freccia(-1)} onSucc={() => freccia(1)}
          etichettaPrec={etichettaFreccia(modo, -1)} etichettaSucc={etichettaFreccia(modo, 1)} className="shrink-0"
          pillola={<InterruttorePillola voci={VOCI_GRIGLIA} scelta={modo} onScegli={cambiaModo} nome="Vista del calendario" dati="modo-griglia-mac" maison />}
          telefono={{
            etichetta: modo === 'quindici' ? etichettaPeriodo(days.slice(Math.max(0, primoVisibile), Math.max(0, primoVisibile) + GIORNI_QUINDICINA).map(toStr)) : visibleMonth,
            pillola: <InterruttorePillola voci={VOCI_GRIGLIA_TELEFONO} scelta={modo} onScegli={cambiaModo} nome="Vista del calendario" dati="modo-griglia" maison />,
          }} />
      )}

      {/* Dal Mac niente barra di scorrimento visibile sotto la griglia: si scorre con due dita, con le frecce e con i mesi */}
      {loading ? (
        <div className="mz-caricamento">Caricamento…</div>
      ) : (
        <div ref={scrollRef} onScroll={updateVisibleMonth} className="overflow-auto flex-none no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="cal-nastro" style={{ width: totalW, position: 'relative', height: totalH }} onClick={() => setSelectedGroupId(null)}>

            {/* ── IL RIGHELLO «lun 28» E I FILI (ottone al 1° del mese, verde su oggi) — gli stessi del Calendario ── */}
            <RighelloNastro giorni={days} oggi={todayStr} colonnaCamere={NAME_W} giorno={CELL_W} altezza={RULER_H} />
            <FiliNastro giorni={days} indiceOggi={dayIndex(todayStr)} colonnaCamere={NAME_W} giorno={CELL_W} top={RULER_H} altezza={totalH - RULER_H} />

            {/* ── LE CORSIE DELLE CAMERE (niente riga «🛏 extra» negli Arrivi) ── */}
            {rooms.map((room, ri) => {
              const rowTop = RULER_H + ri * ROW_H
              const shortName = room.name.split(' ').slice(-1)[0]
              const prenotazioni = arrivi.filter(b => b.room_id === room.id && b.check_out > toStr(startDate) && b.check_in < toStr(endDate))
              // I buchi liberi guardano TUTTE le prenotazioni della camera (anche quelle
              // che negli Arrivi non si disegnano): un buco è libero davvero
              const occupate = bookings.filter(b => b.room_id === room.id)
              const buchi = buchiLiberi(occupate.map(b => ({ da: b.check_in, a: b.check_out })), toStr(startDate), toStr(endDate))
              const occupato = (iso: string) => occupate.some(b => b.check_in <= iso && iso < b.check_out)
              return (
                <div key={room.id}>
                  <CorsiaNastro top={rowTop} larghezza={totalW} altezza={ROW_H} colonnaCamere={NAME_W} nome={shortName} descrizione={ROOM_DESC_BY_NAME[shortName]}
                    onClick={e => {
                      // Un giorno libero toccato fuori dai buchi disegnati: nuova prenotazione da lì
                      const x = e.clientX - e.currentTarget.getBoundingClientRect().left - NAME_W
                      const idx = Math.floor(x / CELL_W)
                      const dateStr = days[idx] ? toStr(days[idx]) : ''
                      if (!dateStr || occupato(dateStr)) return
                      router.push(`/nuova-prenotazione?room_id=${room.id}&check_in=${dateStr}`)
                    }} />

                  {/* I buchi liberi: riquadro tratteggiato, le date e il «+»; il tocco apre la nuova prenotazione con camera e data */}
                  {/* PROVA del 29/09/2026 (A3): con BUCHI_LIBERI_VISIBILI a false i riquadri
                      non si disegnano e la corsia resta vuota; il tocco lo prende la corsia */}
                  {BUCHI_LIBERI_VISIBILI && buchi.map(h => {
                    const da = Math.max(0, dayIndex(h.da)), a = Math.min(DAYS_TOTAL, dayIndex(h.a))
                    if (a - da <= 0) return null
                    const g = geometriaScheda(da, a, CELL_W)
                    return (
                      <BucoNastro key={`buco-${h.da}`} chiave={`${h.da}_${h.a}`} etichetta={`Nuova prenotazione in ${shortName} dal ${h.da}`} riga={rigaBuco(h)}
                        left={NAME_W + g.left} top={rowTop + SCHEDA_TOP} width={g.width} testoLeft={NAME_W + ARIA_SCHEDA} testoWidth={parteInVista(da, a)}
                        onClick={e => {
                          e.stopPropagation()
                          // L'arrivo è il GIORNO TOCCATO (Ania, 29/09/2026): dalle coordinate del tocco
                          // rispetto al nastro, che scorre con lui; fuori dal buco, il giorno più vicino dentro
                          const nastro = e.currentTarget.closest('.cal-nastro')?.getBoundingClientRect().left ?? 0
                          const dateStr = arrivoToccatoNelBuco(e.clientX - nastro - NAME_W, CELL_W, toStr(days[0]), h)
                          router.push(`/nuova-prenotazione?room_id=${room.id}&check_in=${dateStr}`)
                        }} />
                    )
                  })}

                  {/* Le schede: date · ORARIO, icone e nome · l'arrivo in breve · (vuota) */}
                  {prenotazioni.map(booking => {
                    const startIdx = Math.max(0, dayIndex(booking.check_in))
                    const endIdx = Math.min(DAYS_TOTAL, dayIndex(booking.check_out))
                    if (endIdx - startIdx <= 0) return null
                    const chainKey = changeGroups.chainKeyOf[booking.id]
                    const isMultiRoom = !!chainKey
                    const hasIncoming = incomingIds.has(booking.id)
                    const hasOutgoing = outgoingIds.has(booking.id)
                    const isSelected = isMultiRoom && selectedGroupId === chainKey
                    const isWebPending = daConfermareDalSito(booking)
                    // L'arrivo è uno solo: il tratto che arriva da un cambio camera prende il colore del primo tratto
                    const origine = hasIncoming ? arrivi.find(b => b.id === primoTratto(booking.id, changeGroups.edges)) ?? booking : booking
                    const arrivo = leggiArrivo(origine)
                    const stato = statoArrivo(arrivo)
                    const tinta = tintaArrivo(stato, isWebPending)
                    const passato = arrivoPassato(booking.check_in, todayStr)
                    // Ricerca attiva: le schede trovate col contorno verde, le altre attenuate.
                    // Foglio aperto: la scheda toccata (o la sua catena) piena, il resto attenuato.
                    const isMatch = matchedIds.has(booking.id)
                    const toccata = popup?.id === booking.id
                    const isCurrent = (searchAttiva && isMatch) || (toccata && !isMultiRoom)
                    const isDimmed = searchAttiva
                      ? !isMatch
                      : selectedGroupId !== null ? !isSelected : popup !== null && !toccata
                    const g = geometriaScheda(startIdx, endIdx, CELL_W)
                    // Cambio camera: il tratto che parte tagliato in basso a destra, quello che arriva in basso a sinistra
                    const cutLeft = hasIncoming && startIdx === dayIndex(booking.check_in)
                    const cutRight = hasOutgoing && endIdx === dayIndex(booking.check_out)
                    const clipPath = cutLeft || cutRight ? percorsoBarraArrotondata(g.width, SCHEDA_H, cutLeft, cutRight, 6, TAGLIO_CAMBIO) : undefined
                    const tocco = areaTocco(rowTop + SCHEDA_TOP, SCHEDA_H)
                    const hasExtraBed = booking.extra_bed || (booking.extra_bed_dates && booking.extra_bed_dates.length > 0)
                    const icone = iconeScheda({
                      esclusiva: booking.color === '#f97316', ottimo: booking.guests?.rating === 'ottimo', ricevuta: vuoleRicevuta(booking.guests),
                      letto: !!hasExtraBed, cambio: isMultiRoom, dalSito: booking.source === 'sito_web' && !isWebPending,
                    })
                    const coloreRiga = hasIncoming ? undefined : coloreRigaArrivo(arrivo, stato)
                    return (
                      <SchedaNastro key={booking.id} id={booking.id} dati={{ arrivo: isWebPending ? 'dalSito' : stato, passato: passato ? 1 : undefined }}
                        onClick={e => { e.stopPropagation(); tocca(booking, chainKey) }}
                        classi={`${isDimmed ? (searchAttiva ? 'dim cerca' : 'dim') : ''} ${isSelected ? 'catena' : ''} ${isCurrent ? 'trovata' : ''}`}
                        top={tocco.top} height={tocco.height} left={NAME_W + g.left} width={g.width} zIndex={isCurrent ? 16 : isSelected ? 15 : 5}
                        sito={isWebPending} cutLeft={cutLeft} letto={hasExtraBed ? lettiPoolPrenotazione(booking) : undefined}
                        lettoTratti={trattiLetto(nottiLettoExtra(booking), dayIndex, startIdx, endIdx, CELL_W)}
                        fondo={tinta.fondo} testo={tinta.testo} filo={tinta.filo} clipPath={clipPath}
                        cuneoDestra={cutRight ? tinta.filo : undefined} cuneoSinistra={cutLeft ? tinta.filo : undefined}
                        stileInterno={passato ? { opacity: OPACITA_ARRIVATA } : undefined}
                        testoLeft={NAME_W + ARIA_SCHEDA + 8} testoWidth={larghezzaTesto(startIdx, endIdx)}>
                        <em>{rigaDateArrivi(booking.check_in, booking.check_out, { dalSito: isWebPending, passato })}</em>
                        <b>
                          {!hasIncoming && <span className={`hr ${haOrario(arrivo) ? '' : 'manca'}`} data-orario>{orarioScheda(arrivo)}</span>}
                          {icone && <span className="ic">{icone} </span>}{nomeConAltri(booking)}
                        </b>
                        <small style={coloreRiga ? { color: coloreRiga } : undefined} data-riga-arrivo>
                          {rigaArrivoArrivi(arrivo, { poi: hasOutgoing ? poiCamera[booking.id] : null, da: hasIncoming ? daCamera[booking.id] : null })}
                        </small>
                      </SchedaNastro>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
      </div>

      {/* Il box «⇄ Cambi camera» di oggi e domani, rivestito */}
      {!loading && roomChanges.length > 0 && (
        <div className="cal-cambi shrink-0" data-cambi-camera>
          <div className="ck">⇄ Cambi camera</div>
          {roomChanges.map(m => (
            <p key={m.id}>
              {m.guest} da {m.fromRoom} {roomPreposition(m.toRoom)} {m.toRoom}
              <span> ({m.date === todayStr ? 'oggi' : 'domani'})</span>
            </p>
          ))}
        </div>
      )}

      {/* Sotto il nastro: «Oggi», i mesi cliccabili (quelli dei 90 giorni) e la nota, come il Calendario */}
      {!loading && (
        <RigaMesi maison colonna={NAME_W} mesi={mesiCliccabili(today, 4).filter(m => dayIndex(m.iso) < DAYS_TOTAL)} attivo={toStr(days[Math.min(days.length - 1, Math.max(0, primoVisibile))]).slice(0, 7)}
          onMese={m => vaiAIndice(dayIndex(m.iso))} onOggi={() => vaiAIndice(indiceOggi())} nota={sottotitoloArrivi(DAYS_TOTAL - DAYS_BEFORE)}
          className={`shrink-0 cal-rm-staccata ${orizzontale ? 'px-2' : isDesktop ? 'px-4' : ''}`} />
      )}
      {/* «LEGENDA» sotto «Oggi» (novità del 29/09/2026): apre la legenda nel foglio dal basso,
          anche dal Mac al posto della legenda in riga (Ania, 29/09/2026) */}
      {!loading && (
        <div className={`shrink-0 flex ${orizzontale ? 'px-2' : isDesktop ? 'px-4' : ''}`}>
          <div className="cal-lg cal-lg-staccata" style={{ width: NAME_W, minWidth: NAME_W }}>
            <button type="button" className="mz-lnk" aria-label="Legenda" onClick={() => setLegendaAperta(true)}>Legenda</button>
          </div>
        </div>
      )}
      {legendaAperta && (
        <PannelloLegenda voci={VOCI_LEGENDA_ARRIVI} icone={ICONE_LEGENDA_ARRIVI} titolo="Legenda degli arrivi" altezza={ALTEZZA_LEGENDA_ARRIVI}
          dati="legenda-arrivi" onChiudi={() => setLegendaAperta(false)} />
      )}

      {/* ── IL FOGLIO «ARRIVO E NAVETTA»: il FoglioArrivo Maison della Home e della scheda, con lo storico ── */}
      {popup && aperta && (() => {
        // Storico arrivi del cliente (24/08/2026): visite precedenti dello
        // stesso cliente (scheda, non nome), solo veri arrivi — i segmenti
        // preceduti da un check-out dello stesso ospite nello stesso giorno
        // (prolungamenti e cambi camera) non contano.
        const cur = aperta
        const precedenti = cur.guest_id
          ? confermati
              .filter(b => b.id !== cur.id && b.guest_id === cur.guest_id && b.check_in < cur.check_in
                && !confermati.some(x => x.id !== b.id && x.guest_id === b.guest_id && x.check_out === b.check_in))
              .sort((a, b) => b.check_in.localeCompare(a.check_in))
          : []
        const ultimoConOra = precedenti.find(b => b.check_in_time)
        const dataIt = (s: string) => {
          const [y, m, dd] = s.split('-').map(Number)
          return new Date(y, m - 1, dd).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
        }
        // Lo storico degli arrivi dice anche CHI era l'autista, se si sa
        const navettaTxt = (b: unknown) => {
          const n = leggiArrivo(b as Record<string, unknown>).navetta
          if (n === 'non_richiesta') return ' · no navetta'
          if (n === 'da_definire') return ''
          if (n === 'da_assegnare') return ' · 🚌'
          return ` · 🚌 ${navettaInScheda(leggiArrivo(b as Record<string, unknown>)).titolo}`
        }
        const nome = nomeConAltri(cur)
        const icone = iconeFoglietto(vuoleRicevuta(cur.guests), cur.guests?.rating === 'ottimo')
        // Stessi bottoni WhatsApp della Home (08/09/2026): «Chiedi orario» · «Apri chat»; senza numero non compaiono
        const wa = whatsappRichiestaOrario(cur)
        return (
          <FoglioArrivo key={cur.id} bookingId={cur.id} prenotazione={cur} dati="arrivo-arrivi" veloChiaro larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC} altezza={ALTEZZA_FOGLIO_ARRIVO_ARRIVI}
            onChiudi={chiudiFoglio}
            onSalvato={campi => { setBookings(prima => prima.map(b => b.id === cur.id ? { ...b, ...campi } : b)); chiudiFoglio() }}
            testa={
              <div className="cal-fog-testa" data-testa-arrivo>
                <div className="k">{TITOLO_ARRIVO} · {roomNameById[cur.room_id] ?? ''} · {dataConGiorno(cur.check_in)}</div>
                <div className="hd2">
                  <div className="ti">{icone && <span className="ic">{icone} </span>}{nome}</div>
                  <IconeContatto telefono={cur.guests?.phone ?? null} nome={nome} dati="arrivi" />
                </div>
              </div>
            }
            // Il riassunto in una riga: lo stesso testo della scheda, e segue la bozza
            sopra={a => (
              <p className="cal-fa-so" data-riassunto-arrivo>
                {arrivoInScheda(a).titolo} · Navetta: {navettaInScheda(a).titolo}
              </p>
            )}
            // Memoria: "arriviamo come sempre" — cosa significa davvero.
            // Solo consultazione: niente viene compilato da solo.
            // Dal 30/09/2026 (Ania) chiuso: si apre da «Storico ›» fra i comandi in fondo,
            // così il foglio sta sul telefono coi tasti fermi
            sotto={(_, onArrivo) => precedenti.length > 0 && storicoAperto && (
              <div className="cal-fa-st" data-storico-arrivi>
                <div className="dentro">
                {ultimoConOra ? (
                  <>Ultimo arrivo registrato: <b>{dataIt(ultimoConOra.check_in)} — {ultimoConOra.check_in_time}</b>{navettaTxt(ultimoConOra)}{' · '}
                    <button type="button" className="mz-lnk" onClick={() => onArrivo(leggiArrivo(ultimoConOra))}>Usa come l&apos;ultima volta</button>{' · '}</>
                ) : (
                  <>Già ospite {precedenti.length === 1 ? 'una volta' : `${precedenti.length} volte`}, ma senza orari registrati{' · '}</>
                )}
                <button type="button" className="mz-lnk q" onClick={() => setShowStorico(s => !s)}>
                  {showStorico ? 'nascondi storico' : `Vedi storico arrivi (${precedenti.length})`}
                </button>
                {showStorico && (
                  <div className="righe">
                    {precedenti.map(b => (
                      <p key={b.id}>
                        <b>{dataIt(b.check_in)}</b>
                        {b.check_in_time ? ` — arrivo ${b.check_in_time}` : <span className="no"> — orario non registrato</span>}
                        {navettaTxt(b)}
                        {roomNameById[b.room_id] ? <span className="no"> · {roomNameById[b.room_id]}</span> : null}
                      </p>
                    ))}
                  </div>
                )}
                </div>
              </div>
            )}
            azioni={<>
              {wa && <BottoniOrario wa={wa} maison />}
              {precedenti.length > 0 && (
                <button type="button" className="mz-lnk q cal-fa-st-apri" data-apri-storico aria-expanded={storicoAperto} onClick={() => setStoricoAperto(a => !a)}>
                  Storico <span aria-hidden className={storicoAperto ? 'aperto' : ''}>›</span>
                </button>
              )}
              <button type="button" className="mz-lnk q" onClick={() => router.push(hrefScheda(popup.id, 'arrivi'))}>Apri prenotazione</button>
            </>}
            salvaPieno={{ salvando: 'Salvo...' }} />
        )
      })()}
    </div>
  )
}
