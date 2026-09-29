'use client'
// ============================================================================
// IL CALENDARIO DELLE RICHIESTE «MAISON» (riferimento approvato da Ania il
// 29/09/2026: docs/design/richieste-riferimento.html, telefoni 1–3).
//
// È lo stesso nastro del Calendario, con gli stessi pezzi (components/
// calendario/Nastro e SchedaPrenotazione, RigaPeriodo, RigaMesi, la Legenda,
// il foglietto): colonna camere 66 px, corsie 92, giorni 60/40, righello,
// fili di oggi e del 1° del mese SOTTO le schede, buchi «+» che aprono la
// nuova prenotazione, schede delle prenotazioni confermate con le quattro
// righe, cambi camera col taglio obliquo e catena al tocco, camere tenute in
// ottone. Niente riga «🛏 extra».
//
// In più:
//  · la riga «VISTA · Reale | Presunta» sotto quella del periodo (la scelta
//    è ricordata nel browser, lib/richiesteVista);
//  · in «Presunta» le richieste aperte come schede tratteggiate d'ottone
//    (lib/richiesteNastro: dove stanno e cosa dicono), la riga «Qualsiasi
//    camera» se ce ne sono, e al posto delle camere tenute la scheda della
//    richiesta («proposta inviata · scade 18:00», fondo #FBF6EA);
//  · la richiesta cercata o scelta nell'elenco resta piena, il resto si
//    attenua (0,35).
// Il tocco su una richiesta (o su una camera tenuta) lo decide la pagina
// (`onRichieste`, il foglietto della richiesta); quello su una prenotazione
// apre il foglietto del Calendario, come lì.
// ============================================================================
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import RigaPeriodo from '@/components/RigaPeriodo'
import RigaMesi from '@/components/RigaMesi'
import InterruttorePillola from '@/components/InterruttorePillola'
import { PannelloLegenda } from '@/components/LegendaCalendario'
import FogliettoPrenotazione from '@/components/calendario/FogliettoPrenotazione'
import { RighelloNastro, FiliNastro, CorsiaNastro, BucoNastro, SchedaNastro } from '@/components/calendario/Nastro'
import { SchedaPrenotazione, SchedaTenuta } from '@/components/calendario/SchedaPrenotazione'
import { ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { periodoEsteso, meseEsteso } from '@/lib/periodoEsteso'
import { mesiCliccabili } from '@/lib/mesiCliccabili'
import { etichettaPeriodo, GIORNI_QUINDICINA, GIORNI_PRIMA_OGGI, RIGA_QUALSIASI } from '@/lib/richiesteCalendario'
import { CORSIA_H, SCHEDA_H, SCHEDA_TOP, ARIA_SCHEDA, FILO_SINISTRO, geometriaScheda, buchiLiberi, rigaBuco, arrivoToccatoNelBuco } from '@/lib/calendarioSchede'
import { areaTocco, PASSO_FRECCE_QUINDICI, etichettaFreccia, colonnaMinTelefono, VOCI_LEGENDA, ICONE_LEGENDA, VOCI_GRIGLIA_TELEFONO } from '@/lib/calendarioMobile'
import { nottiPagate, legamiCatene } from '@/lib/calendarioNastro'
import { barreTenute, barrePerCamera, testoTenuta, type RichiestaTenuta, type BarraTenuta } from '@/lib/calendarioOpzioni'
import { schedeRichieste, righeSchedaRichieste, TINTA_RICHIESTA, type RichiestaNastro, type SchedaRichieste } from '@/lib/richiesteNastro'
import { eAperta, type Richiesta } from '@/lib/richieste'
import type { Vista } from '@/lib/richiesteVista'
import { hrefScheda } from '@/lib/provenienzaScheda'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']   // l'ordine del Calendario
// Le misure del Calendario «Maison»: righello 22 px sul telefono e 26 dal Mac,
// colonna delle camere 66 sul telefono e 84 dal Mac, corsie da 92
const RULER_H_MOBILE = 22
const RULER_H_DESKTOP = 26
const NAME_W_MOBILE = 66
const NAME_W_DESKTOP = 84
const CELL_W_DESKTOP = 101
export type ModoCalendario = 'mese' | 'quindici'
const COLONNE_VISIBILI: Record<ModoCalendario, number> = { mese: 31, quindici: GIORNI_QUINDICINA }
// La scelta «Mese | 2 settimane» delle Richieste, ricordata nel browser come prima
const CHIAVE_MODO = 'ca_richieste_calendario_modo'
const VOCI_GRIGLIA = [['mese', 'Mese'], ['quindici', '2 settimane']] as const satisfies readonly (readonly [ModoCalendario, string])[]
const VOCI_VISTA = [['reale', 'Reale'], ['presunta', 'Presunta']] as const satisfies readonly (readonly [Vista, string])[]
const LARGHEZZA_MIN_COLONNA = 28
// Le richieste guardano avanti: un mese prima di oggi, più di un anno dopo
const DAYS_BEFORE = 30
const DAYS_TOTAL = 430
const MESI_CLICCABILI = 12
/** La legenda del Calendario con in più la voce delle richieste (incarico, punto 4) */
export const VOCE_LEGENDA_RICHIESTE = { testo: 'Richiesta in attesa / proposta inviata (tratteggio ottone)', colore: TINTA_RICHIESTA.bordo, tratteggiata: true }
export const VOCI_LEGENDA_RICHIESTE = [...VOCI_LEGENDA.slice(0, 4), VOCE_LEGENDA_RICHIESTE, ...VOCI_LEGENDA.slice(4)]
const ALTEZZA_LEGENDA_RICHIESTE = 500
const NOME_RIGA_QUALSIASI = 'Qualsiasi camera'

type Camera = { id: string; name: string; active?: boolean | null }
export type PrenotazioneRichieste = {
  id: string; room_id: string; guest_id?: string | null; group_id?: string | null
  check_in: string; check_out: string; status: string; source?: string | null
  num_guests?: number | string | null; total_amount?: number | string | null
  color?: string | null; pagato?: boolean | null; bonifico?: boolean | null
  extra_bed?: boolean | null; extra_bed_dates?: string[] | null; guest_name?: string | null
  guests?: { id?: string; full_name?: string | null; phone?: string | null; rating?: string | null; vuole_ricevuta?: boolean | null; notes?: string | null } | null
  [colonna: string]: unknown
}

function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function toStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function strToDate(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function fmtMonth(d: Date) { const l = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); return l.charAt(0).toUpperCase() + l.slice(1) }

export default function NastroRichieste({ camere, prenotazioni, pagamenti, richieste, vista, onVista, evidenziate, vaiA, adesso, desktop, orizzontale, onRichieste }: {
  camere: Camera[]
  /** le prenotazioni confermate e completate, con il cliente */
  prenotazioni: PrenotazioneRichieste[]
  pagamenti: { booking_id: string; amount: number | string }[]
  /** tutte le richieste: sul nastro vanno le aperte */
  richieste: Richiesta[]
  vista: Vista
  onVista: (v: Vista) => void
  /** le richieste da tenere piene (ricerca, riga scelta, foglietto aperto): il resto si attenua; null = niente */
  evidenziate: string[] | null
  /** porta il nastro su questa data (cambia `n` per ripetere) */
  vaiA: { iso: string; n: number } | null
  adesso: Date
  desktop: boolean
  orizzontale: boolean
  onRichieste: (gruppo: Richiesta[], e?: MouseEvent) => void
}) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [modo, setModo] = useState<ModoCalendario>('quindici')
  useEffect(() => {
    let v: string | null = null
    try { v = window.localStorage.getItem(CHIAVE_MODO) } catch { v = null }
    const t = setTimeout(() => { if (v === 'mese' || v === 'quindici') setModo(v) }, 0)
    return () => clearTimeout(t)
  }, [])
  const [larghezzaGriglia, setLarghezzaGriglia] = useState(0)
  const [primoVisibile, setPrimoVisibile] = useState(DAYS_BEFORE)
  const [colonnaSinistra, setColonnaSinistra] = useState(DAYS_BEFORE)
  const [visibleMonth, setVisibleMonth] = useState(() => fmtMonth(new Date()))
  const primoGiornoRef = useRef<number | null>(null)
  const [legendaAperta, setLegendaAperta] = useState(false)
  // Il foglietto del Calendario aperto su una prenotazione e la catena toccata
  const [aperta, setAperta] = useState<PrenotazioneRichieste | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const colonnaLarga = desktop && !orizzontale
  const NAME_W = colonnaLarga ? NAME_W_DESKTOP : NAME_W_MOBILE
  const colonnaMin = desktop ? (orizzontale ? 0 : LARGHEZZA_MIN_COLONNA) : colonnaMinTelefono(modo)
  const CELL_W = larghezzaGriglia > 0
    ? (colonnaMin === 0 ? (larghezzaGriglia - NAME_W) / COLONNE_VISIBILI[modo] : Math.max(colonnaMin, Math.floor((larghezzaGriglia - NAME_W) / COLONNE_VISIBILI[modo])))
    : (desktop ? CELL_W_DESKTOP : 60)
  const RULER_H = desktop && !orizzontale ? RULER_H_DESKTOP : RULER_H_MOBILE

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(today, -DAYS_BEFORE)
  const endDate = addDays(startDate, DAYS_TOTAL)
  const days: Date[] = Array.from({ length: DAYS_TOTAL }, (_, i) => addDays(startDate, i))
  const todayStr = toStr(today)
  const dayIndex = (iso: string) => Math.round((strToDate(iso).getTime() - startDate.getTime()) / 86400000)

  const rooms = useMemo(() => [...camere].filter(c => c.active !== false).sort((a, b) => {
    const ai = ROOM_ORDER.findIndex(o => a.name.includes(o)), bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  }), [camere])
  const legami = useMemo(() => legamiCatene(prenotazioni, rooms), [prenotazioni, rooms])
  const acconti = useMemo(() => {
    const s: Record<string, number> = {}
    for (const x of pagamenti) s[x.booking_id] = (s[x.booking_id] || 0) + Number(x.amount)
    return s
  }, [pagamenti])
  const pagate = useMemo(() => nottiPagate(prenotazioni, acconti, rooms), [prenotazioni, acconti, rooms])
  const aperte = useMemo(() => richieste.filter(eAperta) as RichiestaNastro[], [richieste])
  // Le camere tenute dalle proposte inviate (lib/calendarioOpzioni, come nel Calendario)
  const barre = useMemo(() => barreTenute(aperte.filter(r => r.stato === 'proposta_inviata') as unknown as RichiestaTenuta[], adesso), [aperte, adesso])
  const tenutePerRichieste = useMemo(() => barre.map(b => ({ richiestaId: b.richiestaId, cameraId: b.cameraId, notti: b.notti, scaduta: b.scaduta })), [barre])
  // In vista Reale le richieste non si vedono; in Presunta le schede tratteggiate
  const schede = useMemo(() => (vista === 'presunta' ? schedeRichieste(aperte, rooms, prenotazioni, tenutePerRichieste) : []), [vista, aperte, rooms, prenotazioni, tenutePerRichieste])
  const conQualsiasi = schede.some(s => s.riga === RIGA_QUALSIASI)
  const righe = [...rooms.map(r => ({ id: r.id, nome: r.name.split(' ').slice(-1)[0] })), ...(conQualsiasi ? [{ id: RIGA_QUALSIASI, nome: NOME_RIGA_QUALSIASI }] : [])]
  const evid = evidenziate ? new Set(evidenziate) : null

  // Il riquadro: misurato sul contenitore che scorre (e rimisurato quando la finestra cambia)
  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const ro = new ResizeObserver(() => setLarghezzaGriglia(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Prima casella: a 2 settimane 3 giorni prima di oggi, a mese il 1° del mese (come Calendario e Arrivi)
  function indiceOggi(): number {
    return modo === 'quindici' ? DAYS_BEFORE - GIORNI_PRIMA_OGGI : Math.max(0, DAYS_BEFORE - (today.getDate() - 1))
  }
  // La pagina chiede di andare su una richiesta (ricerca, riga dell'elenco)
  useEffect(() => {
    if (!vaiA || !scrollRef.current) return
    const i = dayIndex(vaiA.iso)
    if (i < 0 || i >= DAYS_TOTAL) return
    scrollRef.current.scrollTo({ left: Math.max(0, i - 1) * CELL_W, behavior: 'smooth' })
  }, [vaiA]) // eslint-disable-line react-hooks/exhaustive-deps

  function cambiaModo(m: ModoCalendario) {
    if (m === modo) return
    primoGiornoRef.current = Math.max(0, Math.floor((scrollRef.current?.scrollLeft ?? 0) / CELL_W))
    setModo(m)
    try { window.localStorage.setItem(CHIAVE_MODO, m) } catch { /* niente memoria: vale per questa apertura */ }
  }
  function vaiAIndice(idx: number) {
    scrollRef.current?.scrollTo({ left: Math.max(0, Math.min(days.length - 1, idx)) * CELL_W, behavior: 'smooth' })
  }
  // Frecce ‹ ›: a 2 settimane una settimana, a mese il 1° del mese prima/dopo (come il Calendario)
  function freccia(direzione: -1 | 1) {
    if (modo === 'quindici') { scrollRef.current?.scrollBy({ left: direzione * PASSO_FRECCE_QUINDICI * CELL_W, behavior: 'smooth' }); return }
    const d = days[Math.min(days.length - 1, Math.max(0, primoVisibile))]
    const primo = new Date(d.getFullYear(), d.getMonth() + (direzione === 1 ? 1 : (d.getDate() === 1 ? -1 : 0)), 1)
    vaiAIndice(Math.round((primo.getTime() - startDate.getTime()) / 86400000))
  }
  function aggiornaVisibile() {
    const sl = scrollRef.current?.scrollLeft ?? 0
    const idx = Math.min(days.length - 1, Math.max(0, Math.floor(sl / CELL_W)))
    const label = fmtMonth(days[idx])
    setVisibleMonth(prev => (prev === label ? prev : label))
    const primo = Math.min(days.length - 1, Math.max(0, Math.round(sl / CELL_W)))
    setPrimoVisibile(prev => (prev === primo ? prev : primo))
    const intero = Math.max(0, Math.ceil(sl / CELL_W - 0.01))
    setColonnaSinistra(prev => (prev === intero ? prev : intero))
  }

  useEffect(() => {
    if (!scrollRef.current) return
    if (primoGiornoRef.current !== null) { scrollRef.current.scrollLeft = primoGiornoRef.current * CELL_W; primoGiornoRef.current = null }
    else scrollRef.current.scrollLeft = indiceOggi() * CELL_W
    aggiornaVisibile()
  }, [CELL_W, desktop]) // eslint-disable-line react-hooks/exhaustive-deps
  // Tocco su una prenotazione (come nel Calendario): il primo apre il foglietto e
  // accende la catena del cambio camera; il secondo, o «Apri la scheda», la scheda
  function tocca(b: PrenotazioneRichieste, chainKey: string | undefined) {
    if (aperta?.id === b.id) { router.push(hrefScheda(b.id, 'richieste')); return }
    setAperta(b)
    setSelectedGroupId(chainKey ?? null)
  }
  function chiudiFoglietto() { setAperta(null); setSelectedGroupId(null) }
  function toccoSulVelo(e: MouseEvent<HTMLDivElement>) {
    const sotto = document.elementsFromPoint(e.clientX, e.clientY)
    const scheda = sotto.find(el => el instanceof HTMLElement && el.dataset.scheda) as HTMLElement | undefined
    if (aperta && scheda?.dataset.scheda === aperta.id) { router.push(hrefScheda(aperta.id, 'richieste')); return }
    chiudiFoglietto()
  }
  function toccaTenuta(barra: BarraTenuta) {
    const r = aperte.find(x => x.id === barra.richiestaId)
    if (r) onRichieste([r])
  }

  const totalW = NAME_W + DAYS_TOTAL * CELL_W
  const totalH = RULER_H + righe.length * CORSIA_H
  const corsiaVisibile = Math.max(0, larghezzaGriglia - NAME_W - ARIA_SCHEDA * 2)
  const parteInVista = (da: number, a: number) => {
    const w = geometriaScheda(Math.max(da, colonnaSinistra) < a ? Math.max(da, colonnaSinistra) : da, a, CELL_W).width
    return corsiaVisibile > 0 ? Math.min(w, corsiaVisibile) : w
  }
  const larghezzaTesto = (da: number, a: number) => Math.max(0, parteInVista(da, a) - 16 - FILO_SINISTRO)
  const giorniQuindici = days.slice(Math.max(0, primoVisibile), Math.max(0, primoVisibile) + GIORNI_QUINDICINA).map(toStr)
  const meseVisibile = toStr(days[Math.min(days.length - 1, Math.max(0, primoVisibile))]).slice(0, 7)
  const periodoMac = modo === 'quindici' ? periodoEsteso(giorniQuindici[0], giorniQuindici[giorniQuindici.length - 1]) : meseEsteso(meseVisibile)
  const periodoTelefono = modo === 'quindici' ? etichettaPeriodo(giorniQuindici) : visibleMonth
  const bordo = orizzontale ? 'px-2' : desktop ? 'px-4' : ''

  // La scheda tratteggiata di una o più richieste
  function schedaRichieste(s: SchedaRichieste, rigaTop: number) {
    const da = Math.max(0, dayIndex(s.arrivo)), a = Math.min(DAYS_TOTAL, dayIndex(s.partenza))
    if (a - da <= 0) return null
    const g = geometriaScheda(da, a, CELL_W)
    const r = righeSchedaRichieste(s, adesso)
    const piena = !evid || s.richieste.some(x => evid.has(x.id))
    const attenuata = !piena || selectedGroupId !== null
    const tocco = areaTocco(rigaTop + SCHEDA_TOP, SCHEDA_H)
    return (
      <SchedaNastro key={s.chiave} id={s.richieste.map(x => x.id).join('+')} dati={{ richiesta: s.richieste.map(x => x.id).join(' '), sovrapposte: r.sovrapposte ? 1 : undefined, inviata: r.inviata ? 1 : undefined }}
        onClick={e => { e.stopPropagation(); onRichieste(s.richieste, e) }}
        classi={`rq ${attenuata ? 'dim cerca' : ''} ${evid && piena ? 'scelta' : ''}`}
        top={tocco.top} height={tocco.height} left={NAME_W + g.left} width={g.width} zIndex={evid && piena ? 16 : 6}
        sito fondo={r.inviata ? TINTA_RICHIESTA.fondoInviata : TINTA_RICHIESTA.fondo} testo={TINTA_RICHIESTA.testo} filo={TINTA_RICHIESTA.bordo}
        stileInterno={r.sovrapposte ? { borderStyle: 'dotted' } : undefined}
        testoLeft={NAME_W + ARIA_SCHEDA + 8} testoWidth={larghezzaTesto(da, a)}>
        <em>{r.date}</em>
        <b>{r.nome}</b>
        <small>{r.sotto}</small>
      </SchedaNastro>
    )
  }

  return (
    <div className="flex flex-col" data-nastro-richieste data-senza-sottolinea>
      {/* Dal telefono il nastro va da bordo a bordo, come nel Calendario */}
      <div className={`flex flex-col flex-none ${orizzontale ? 'mx-2 mt-2' : desktop ? 'mx-4' : ''} overflow-hidden`}>
        {/* La riga del periodo comune (components/RigaPeriodo): dal Mac per esteso,
            dal telefono (novità 14a) il periodo in Cormorant 20 e ‹ · pillola · › attaccati */}
        <RigaPeriodo etichetta={periodoMac} onPrec={() => freccia(-1)} onSucc={() => freccia(1)}
          etichettaPrec={etichettaFreccia(modo, -1)} etichettaSucc={etichettaFreccia(modo, 1)} className="shrink-0"
          pillola={<InterruttorePillola voci={VOCI_GRIGLIA} scelta={modo} onScegli={cambiaModo} nome="Vista del calendario" dati="modo-calendario-mac" maison />}
          telefono={{ etichetta: periodoTelefono, pillola: <InterruttorePillola voci={VOCI_GRIGLIA_TELEFONO} scelta={modo} onScegli={cambiaModo} nome="Vista del calendario" dati="modo-calendario" maison /> }} />
        {/* «VISTA · Reale | Presunta», allineata a destra, col filo sotto */}
        <div className="ric-vista shrink-0" data-riga-vista>
          <span className="k">Vista</span>
          <InterruttorePillola voci={VOCI_VISTA} scelta={vista} onScegli={onVista} nome="Vista del calendario" dati="vista" maison />
        </div>

        <div ref={scrollRef} onScroll={aggiornaVisibile} className="overflow-auto flex-none no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="cal-nastro" style={{ width: totalW, position: 'relative', height: totalH }} onClick={() => setSelectedGroupId(null)}>
            <RighelloNastro giorni={days} oggi={todayStr} colonnaCamere={NAME_W} giorno={CELL_W} altezza={RULER_H} />
            <FiliNastro giorni={days} indiceOggi={dayIndex(todayStr)} colonnaCamere={NAME_W} giorno={CELL_W} top={RULER_H} altezza={totalH - RULER_H} />

            {righe.map((riga, ri) => {
              const rowTop = RULER_H + ri * CORSIA_H
              const qualsiasi = riga.id === RIGA_QUALSIASI
              const sue = qualsiasi ? [] : prenotazioni.filter(b => b.room_id === riga.id)
              const inVista = sue.filter(b => b.check_out > toStr(startDate) && b.check_in < toStr(endDate))
              const tenute = qualsiasi || vista === 'presunta' ? [] : barrePerCamera(barre, riga.id)
              const schedeRiga = schede.filter(s => s.riga === riga.id)
              // I buchi liberi: fra prenotazioni, camere tenute e (in Presunta) schede delle richieste
              const occupati = [
                ...sue.map(b => ({ da: b.check_in, a: b.check_out })),
                ...barrePerCamera(barre, riga.id).map(t => ({ da: t.arrivo, a: t.partenza })),
                ...schedeRiga.map(s => ({ da: s.arrivo, a: s.partenza })),
              ]
              const buchi = qualsiasi ? [] : buchiLiberi(occupati, toStr(startDate), toStr(endDate))
              const occupato = (iso: string) => occupati.some(o => o.da <= iso && iso < o.a)
              return (
                <div key={riga.id}>
                  <CorsiaNastro top={rowTop} larghezza={totalW} altezza={CORSIA_H} colonnaCamere={NAME_W} nome={riga.nome} descrizione={ROOM_DESC_BY_NAME[riga.nome]} classe={qualsiasi ? 'qualsiasi' : ''}
                    onClick={e => {
                      if (qualsiasi) return
                      // Un giorno libero toccato fuori dai buchi disegnati: nuova prenotazione da lì
                      const x = e.clientX - e.currentTarget.getBoundingClientRect().left - NAME_W
                      const dateStr = days[Math.floor(x / CELL_W)] ? toStr(days[Math.floor(x / CELL_W)]) : ''
                      if (!dateStr || occupato(dateStr)) return
                      router.push(`/nuova-prenotazione?room_id=${riga.id}&check_in=${dateStr}`)
                    }} />
                  {buchi.map(h => {
                    const da = Math.max(0, dayIndex(h.da)), a = Math.min(DAYS_TOTAL, dayIndex(h.a))
                    if (a - da <= 0) return null
                    const g = geometriaScheda(da, a, CELL_W)
                    return (
                      <BucoNastro key={`buco-${h.da}`} chiave={`${h.da}_${h.a}`} etichetta={`Nuova prenotazione in ${riga.nome} dal ${h.da}`} riga={rigaBuco(h)}
                        left={NAME_W + g.left} top={rowTop + SCHEDA_TOP} width={g.width} testoLeft={NAME_W + ARIA_SCHEDA} testoWidth={parteInVista(da, a)}
                        onClick={e => {
                          e.stopPropagation()
                          // L'arrivo è il GIORNO TOCCATO (come nel Calendario)
                          const nastro = e.currentTarget.closest('.cal-nastro')?.getBoundingClientRect().left ?? 0
                          router.push(`/nuova-prenotazione?room_id=${riga.id}&check_in=${arrivoToccatoNelBuco(e.clientX - nastro - NAME_W, CELL_W, toStr(days[0]), h)}`)
                        }} />
                    )
                  })}
                  {inVista.map(b => {
                    const chainKey = legami.changeGroups.chainKeyOf[b.id]
                    const isSelected = !!chainKey && selectedGroupId === chainKey
                    const toccata = aperta?.id === b.id
                    const attenuata = evid ? true : selectedGroupId !== null ? !isSelected : aperta !== null && !toccata
                    return (
                      <SchedaPrenotazione key={b.id} booking={b} rigaTop={rowTop} colonnaCamere={NAME_W} giorno={CELL_W} giorni={DAYS_TOTAL}
                        indice={dayIndex} legami={legami} coperte={pagate[b.id]}
                        attenuata={attenuata} cerca={!!evid || selectedGroupId !== null} trovata={false} selezionata={isSelected}
                        larghezzaTesto={larghezzaTesto} onTocca={tocca} />
                    )
                  })}
                  {tenute.map(barra => (
                    <SchedaTenuta key={`tenuta-${barra.richiestaId}-${barra.cameraId}-${barra.arrivo}`} barra={barra} rigaTop={rowTop} colonnaCamere={NAME_W} giorno={CELL_W} giorni={DAYS_TOTAL}
                      indice={dayIndex} attenuata={(!!evid && !evid.has(barra.richiestaId)) || selectedGroupId !== null} cerca larghezzaTesto={larghezzaTesto}
                      titolo={`${barra.ospite} · ${testoTenuta(barra, adesso)}`} onTocca={toccaTenuta} />
                  ))}
                  {schedeRiga.map(s => schedaRichieste(s, rowTop))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sotto il nastro: «Oggi», i mesi cliccabili e «Legenda», come nel Calendario */}
      <RigaMesi maison colonna={NAME_W} mesi={mesiCliccabili(today, MESI_CLICCABILI).filter(m => dayIndex(m.iso) < DAYS_TOTAL)} attivo={meseVisibile}
        onMese={m => vaiAIndice(dayIndex(m.iso))} onOggi={() => vaiAIndice(indiceOggi())} className={`shrink-0 ${bordo}`} />
      <div className={`shrink-0 flex ${bordo}`}>
        <div className="cal-lg" style={{ width: NAME_W, minWidth: NAME_W }}>
          <button type="button" className="mz-lnk" aria-label="Legenda" onClick={() => setLegendaAperta(true)}>Legenda</button>
        </div>
      </div>
      {legendaAperta && (
        <PannelloLegenda voci={VOCI_LEGENDA_RICHIESTE} icone={ICONE_LEGENDA} titolo="Legenda delle richieste" altezza={ALTEZZA_LEGENDA_RICHIESTE}
          dati="legenda-calendario" onChiudi={() => setLegendaAperta(false)} />
      )}
      {aperta && (
        <FogliettoPrenotazione prenotazione={aperta as Parameters<typeof FogliettoPrenotazione>[0]['prenotazione']} tutte={prenotazioni as Parameters<typeof FogliettoPrenotazione>[0]['tutte']}
          camere={rooms} pagamenti={pagamenti}
          onApri={() => router.push(hrefScheda(aperta.id, 'richieste'))} onChiudi={chiudiFoglietto} onVelo={toccoSulVelo} />
      )}
    </div>
  )
}
