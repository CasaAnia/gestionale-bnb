'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { soggiorniPrecedenti, etichettaGiaStato } from '@/lib/clienteCheTorna'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Globe, Phone, MessageCircle, ChevronDown } from 'lucide-react'
import BackBar from '@/components/BackBar'
import InterruttoreVista from '@/components/richieste/InterruttoreVista'
import CalendarioRichieste, { larghezzaColonnaCamere, type Ancora, type ModoCalendario } from '@/components/richieste/CalendarioRichieste'
import PannelloRichieste from '@/components/richieste/PannelloRichieste'
import AzioniRichiesta from '@/components/richieste/AzioniRichiesta'
import RigaScadenza from '@/components/richieste/RigaScadenza'
import NotaCliente from '@/components/richieste/NotaCliente'
import RigaPersoneCamera from '@/components/richieste/RigaPersoneCamera'
import CampoRicerca from '@/components/CampoRicerca'
import RigaMesi from '@/components/RigaMesi'
import { mesiCliccabili } from '@/lib/mesiCliccabili'
import { matchNome, matchTelefono } from '@/lib/ricerca'
import RifiutaConMotivo from '@/components/richieste/RifiutaConMotivo'
import type { MotivoRifiuto } from '@/lib/motivoRifiuto'
import FinestraConferma from '@/components/richieste/FinestraConferma'
import type { RichiestaConProposta } from '@/lib/richiesteConferma'
import { supabase } from '@/lib/supabase'
import { fetchRichieste, rifiutaRichiesta, riapriRichiesta, ricaricaRichiesteAperte } from '@/lib/richiesteDati'
import AvvisoAzione from '@/components/AvvisoAzione'
import { useVista, useDesktop, useAdesso, useOrizzontaleTelefono, useSchermoIntero } from '@/lib/richiesteVista'
import { meseCorrente, richiesteAperte, richiesteNelPeriodo, sovrapposizioni, inizioQuindicina, giorniDaInizio } from '@/lib/richiesteCalendario'
import { altreStesseDate, gruppoStesseDate, etichettaStesseDate, sottotitoloGruppo, contatoreGruppo, VEDI_TUTTE } from '@/lib/richiesteStesseDate'
import { personePerNotte } from '@/lib/richiesteProposta'
import { periodoConGiorni } from '@/lib/dateItaliane'
import { smartBack } from '@/lib/navHistory'
import { nomeOspite } from '@/lib/guestName'
import type { PrenotazioneBarra } from '@/lib/calendarioBarre'
import type { Room } from '@/lib/types'
import {
  CANALE_LABEL, eAperta, inArchivio, rigaChiusa, riapribile, ordinaRichieste, nottiRichiesta, nomeCompleto,
  formatIntervallo, formatDateRichiesta, oraArrivo, avvisoFerma, daGuardare, nuoveDalSito, type Richiesta, type OrdineRichieste,
} from '@/lib/richieste'

const ORDINI: { chiave: OrdineRichieste; label: string }[] = [
  { chiave: 'durata', label: 'durata' },
  { chiave: 'arrivo', label: 'arrivo' },
  { chiave: 'persone', label: 'persone' },
]
const GRIGIO_NOTA = '#6b6b60'

// Pulsante pieno verde con testo crema: unico stile dell'azione principale.
const BOTTONE_PIENO = 'inline-flex items-center justify-center bg-green-mid text-cream-text rounded-xl px-5 py-3 font-semibold text-[15px] active:opacity-80 transition-opacity'

const oggiIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function IconaCanale({ canale }: { canale: Richiesta['canale'] }) {
  const props = { size: 13, strokeWidth: 1.8, 'aria-hidden': true as const, className: 'shrink-0' }
  if (canale === 'web') return <Globe {...props} />
  if (canale === 'whatsapp') return <MessageCircle {...props} />
  return <Phone {...props} />
}

// Badge ⇄ ottone: la richiesta si sovrappone a una CONFERMATA (per le altre
// richieste aperte c'è il segno blu qui sotto, Ania 12/09/2026)
function BadgeSovrapposta() {
  return (
    <span aria-label="si sovrappone" className="inline-flex items-center justify-center shrink-0 rounded-full text-[10px] font-bold leading-none h-[16px] min-w-[18px] px-1" style={{ background: '#A9884E', color: '#F5EFE4' }}>⇄</span>
  )
}

// Il segno delle richieste che si accavallano: pillola blu, si tocca e
// restringe l'elenco a quel gruppo (Ania, 12/09/2026). Il ⇄ non si usa più
// per questo caso: resta per il cambio camera.
const BLU_RICHIESTE = '#7D9DB0'
function SegnoStesseDate({ testo, onClick }: { testo: string; onClick: () => void }) {
  return (
    <button type="button" data-stesse-date onClick={e => { e.stopPropagation(); onClick() }}
      className="inline-flex items-center gap-1.5 rounded-full font-semibold text-white"
      style={{ background: BLU_RICHIESTE, fontSize: 12, padding: '4px 11px', minHeight: 34 }}>
      <span aria-hidden>⧉</span>{testo}
    </button>
  )
}

function RigaRichiesta({ r, adesso, conflitti, stesseDate, onGruppo, nelGruppo = false, selezionata, onSeleziona, onRifiuta, onConferma, giaStato }: { r: Richiesta; adesso: Date; conflitti: string[]; stesseDate?: string | null; onGruppo?: () => void; nelGruppo?: boolean; selezionata: boolean; onSeleziona: () => void; onRifiuta: (r: Richiesta) => void; onConferma: (r: Richiesta) => void; giaStato?: string | null }) {
  const n = nottiRichiesta(r)
  // Le persone di ogni notte, per la riga «persone e camera». Con dati storti
  // (persone_per_notte non coerente) personePerNotte alza un errore: qui la
  // scheda non deve sparire, si mostra il numero della richiesta e basta.
  let personeNotti: number[]
  try { personeNotti = personePerNotte(r) } catch { personeNotti = [Math.max(1, Number(r.persone) || 1)] }
  // Da quanto è arrivata: «oggi» e «ieri» li dice già l'ora, più in là no
  const giorniFa = Math.floor((adesso.getTime() - new Date(r.created_at).getTime()) / 86400000)
  const daQuanto = giorniFa >= 2 ? `${giorniFa} giorni fa` : null
  return (
    // Nel gruppo un filo d'ottone a sinistra tiene insieme le righe
    <li style={nelGruppo ? { borderLeft: '2px solid #A9884E', paddingLeft: 12 } : undefined}>
    <div role="button" tabIndex={0} onClick={onSeleziona} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleziona() } }} aria-pressed={selezionata}
      className={`w-full text-left py-4 leading-snug cursor-pointer border-t border-card-border transition-colors ${selezionata ? 'bg-sage/40 rounded-lg px-3 -mx-3' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        {/* desktop (blocco 2b): «Nome Cognome» in Fraunces 16 px; il badge ⇄ va sulla riga propria */}
        <p className="font-medium text-[15px] md:font-serif md:text-[16px] text-green-dark truncate inline-flex items-center gap-1.5 min-w-0"><span className="truncate">{nomeCompleto(r)}</span>
          {/* Cliente che torna (08/09/2026): non è una provenienza, è un'etichetta */}
          {giaStato && <span data-gia-stato className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sage text-green-mid whitespace-nowrap">{giaStato}</span>}</p>
        <p className="shrink-0 text-sm font-semibold text-brass">{n === 1 ? '1 notte' : `${n} notti`}</p>
      </div>
      {/* La riga delle date: persone e camera non si ripetono più qui, hanno
          la loro riga sotto la pillola (Ania, 12/09/2026) */}
      <p className="text-sm md:text-[13px] text-green-dark mt-1 md:mt-1.5">
        {formatDateRichiesta(r)}
      </p>
      {/* Sotto le date: quante ALTRE richieste vogliono queste stesse notti */}
      {stesseDate && onGruppo && <div className="mt-1.5"><SegnoStesseDate testo={stesseDate} onClick={onGruppo} /></div>}
      {/* Nota del cliente (Ania, 07/09/2026): prima si vedeva solo in «Modifica» */}
      <NotaCliente note={r.note} className="mt-1" />
      {/* timer delle 3 ore (solo proposta inviata): sostituisce il vecchio «proposta inviata N minuti fa» */}
      <RigaScadenza r={r} adesso={adesso} className="mt-1.5" />
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs md:text-[13px] text-stone mt-1.5">
        <span className="inline-flex items-center gap-1"><IconaCanale canale={r.canale} />{CANALE_LABEL[r.canale]}{r.canale === 'web' && r.origine && <span className="text-[10px] uppercase tracking-wide text-brass">· {r.origine}</span>}</span>
        <span aria-hidden>·</span>
        <span>{oraArrivo(r.created_at, adesso)}</span>
        {daQuanto && <><span aria-hidden>·</span><span>{daQuanto}</span></>}
        {avvisoFerma(r, adesso) && (
          <>
            <span aria-hidden>·</span>
            <span className="font-semibold text-brass">{avvisoFerma(r, adesso)}</span>
          </>
        )}
      </p>
      {conflitti.length > 0 && (
        <p className="text-xs md:text-[13px] mt-1 md:mt-2 md:inline-flex md:items-center md:gap-1.5" style={{ color: '#7a5f2c' }} title={conflitti.join(' · ')}>
          <span className="hidden md:inline-flex"><BadgeSovrapposta /></span>
          <span className="md:font-semibold md:text-brass">si sovrappone con {conflitti.join(', ')}</span>
        </p>
      )}
      <RigaPersoneCamera personeNotti={personeNotti} cameraChiesta={r.rooms?.name ?? null} className="mt-3" />
      <AzioniRichiesta r={r} onRifiuta={onRifiuta} onConferma={onConferma} />
    </div>
    </li>
  )
}

// Linguetta «Chiuse» (06/09/2026): riga di stato in ottone (scaduta, chiusa da sola),
// grigia (rifiutata da te) o verde (confermata) e «Riapri» che riporta in attesa
function RigaChiusa({ r, adesso, evidenziata = false, onRiapri, riaprendo }: { r: Richiesta; adesso: Date; evidenziata?: boolean; onRiapri: (r: Richiesta) => void; riaprendo: boolean }) {
  const stato = rigaChiusa(r, adesso)
  const colore = stato.tono === 'ottone' ? '#A9884E' : stato.tono === 'verde' ? '#6C9A7C' : 'var(--color-stone)'
  return (
    <li id={`richiesta-${r.id}`} data-chiusa={stato.tono} className={`flex items-center justify-between gap-3 py-2.5 -mx-2 px-2 border-b-[0.5px] border-border-soft last:border-b-0 text-sm ${evidenziata ? 'bg-sage/50 rounded-lg' : ''}`}>
      <div className="min-w-0">
        <p className="text-green-dark truncate">{nomeCompleto(r)}</p>
        <p className="text-xs text-stone">{formatDateRichiesta(r)} · {r.persone} {r.persone === 1 ? 'persona' : 'persone'} · {CANALE_LABEL[r.canale]}</p>
        <p className="text-xs font-semibold mt-0.5" style={{ color: colore }}>{stato.testo}
          {r.stato === 'confermata' && r.prenotazione_id && (
            <Link href={`/prenotazioni/${r.prenotazione_id}`} className="ml-1.5 font-normal underline underline-offset-2 text-green-mid" onClick={e => e.stopPropagation()}>scheda</Link>
          )}
        </p>
      </div>
      {riapribile(r) && (
        <button type="button" onClick={() => onRiapri(r)} disabled={riaprendo} className="ed-pillola-tenue shrink-0 text-green-dark" data-riapri>{riaprendo ? 'Riapro…' : 'Riapri'}</button>
      )}
    </li>
  )
}

// useSearchParams (?apri=) richiede un confine Suspense per la pagina statica
export default function Page() {
  return <Suspense><Richieste /></Suspense>
}

function Richieste() {
  const router = useRouter()
  // ?apri=<id>: arrivo dalla scheda prenotazione, archivio aperto e riga evidenziata
  const apriId = useSearchParams().get('apri')
  const [tutte, setTutte] = useState<Richiesta[]>([])
  const [camere, setCamere] = useState<Room[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneBarra[]>([])
  const [acconti, setAcconti] = useState<Record<string, number>>({})
  const [ordine, setOrdine] = useState<OrdineRichieste>('durata')
  // «Cerca nome o telefono…» (05/09/2026): filtra la lista; con un solo risultato lo evidenzia anche nel calendario
  const [query, setQuery] = useState('')
  // «N da guardare»: filtro sulle ferme (in attesa > 24 h, proposta > 48 h, arrivo passato) e sulle proposte scadute (3 h dall'invio)
  const [soloDaGuardare, setSoloDaGuardare] = useState(false)
  // Filtro «stesse date»: l'id della richiesta toccata. È solo della pagina,
  // non si ricorda uscendo e rientrando (Ania, 12/09/2026).
  const [gruppoDi, setGruppoDi] = useState<string | null>(null)
  // «N nuove dal sito»: richieste web arrivate dopo l'ultima apertura di questa pagina (localStorage)
  const [nuoveWeb, setNuoveWeb] = useState(0)
  const [mese, setMese] = useState(() => meseCorrente())
  // Calendario desktop (blocco 2): «Mese» o «2 settimane», ricordato nel browser;
  // default 2 settimane su desktop, mese sul telefono. All'apertura la
  // finestra contiene sempre la colonna di oggi.
  const CHIAVE_MODO = 'ca_richieste_calendario_modo'
  const [modoScelto, setModoScelto] = useState<ModoCalendario | null>(null)
  const [inizio, setInizio] = useState(() => inizioQuindicina(oggiIso()))
  useEffect(() => {
    // lettura della memoria del browser dopo il primo disegno (mai durante)
    let v: string | null = null
    try { v = window.localStorage.getItem(CHIAVE_MODO) } catch { v = null }
    const scelto = v === 'mese' || v === 'quindici' ? v : null
    const t = setTimeout(() => { if (scelto) setModoScelto(scelto) }, 0)
    return () => clearTimeout(t)
  }, [])
  const [loading, setLoading] = useState(true)
  const [errori, setErrori] = useState<string[]>([])
  // Parte 3 (05/09/2026): «Riprova» ricarica la pagina E il contatore della barra
  const [tentativo, setTentativo] = useState(0)
  // avanza ogni minuto: timer della proposta, «da guardare» e archivio si aggiornano da soli
  const adesso = useAdesso()
  const [vista, setVista] = useVista()
  const desktop = useDesktop()
  // Telefono in orizzontale: solo il calendario, a tutto schermo
  // (a 844 px il telefono girato conta già come «desktop»: la griglia del Mac riempie lo schermo)
  const orizzontale = useOrizzontaleTelefono()
  useSchermoIntero()
  // Default «2 settimane» ovunque (dal 05/09/2026 anche sul telefono, che ha la stessa griglia del Mac)
  const modoCalendario: ModoCalendario = modoScelto ?? 'quindici'
  function cambiaModo(m: ModoCalendario) {
    setModoScelto(m)
    if (m === 'quindici') setInizio(inizioQuindicina(oggiIso()))
    try { window.localStorage.setItem(CHIAVE_MODO, m) } catch { /* niente memoria: vale per questa apertura */ }
  }
  // Richiesta selezionata dalla lista (evidenziata nel calendario) e pannello «chi c'è dentro»
  const [selezionata, setSelezionata] = useState<string | null>(null)
  const [pannello, setPannello] = useState<{ gruppo: Richiesta[]; ancora: Ancora } | null>(null)
  // Rifiuto: finestra di conferma, poi aggiornamento locale della riga
  const [daRifiutare, setDaRifiutare] = useState<Richiesta | null>(null)
  // Conferma → prenotazione (finestra «Creare la prenotazione?», poi la scheda)
  const [daConfermare, setDaConfermare] = useState<RichiestaConProposta | null>(null)
  const [rifiutando, setRifiutando] = useState(false)
  // «Riapri» dalla linguetta Chiuse (06/09/2026)
  const [riaprendo, setRiaprendo] = useState<string | null>(null)
  async function riapri(r: Richiesta) {
    if (riaprendo) return
    setRiaprendo(r.id)
    const { error } = await riapriRichiesta(r.id)
    setRiaprendo(null)
    if (error) { setErrori(e => [...e.filter(x => !x.startsWith('riapertura')), `riapertura: ${error}`]); return }
    setTutte(lista => lista.map(x => (x.id === r.id ? { ...x, stato: 'in_attesa', chiusa_at: null, proposta_inviata_at: null, chiusura_motivo: null, scadenza_notificata_at: null } : x)))
    void ricaricaRichiesteAperte()
  }

  // Rifiuta con motivo (07/09/2026): la finestra «Perché la rifiuti?» obbliga a scegliere il motivo
  async function confermaRifiuto(motivo: MotivoRifiuto) {
    if (!daRifiutare) return
    setRifiutando(true)
    const { chiusa_at, stato, error } = await rifiutaRichiesta(daRifiutare.id, motivo)
    setRifiutando(false)
    if (error) { setErrori(e => [...e.filter(x => !x.startsWith('rifiuto')), `rifiuto: ${error}`]); setDaRifiutare(null); return }
    const id = daRifiutare.id
    setTutte(lista => lista.map(r => (r.id === id ? { ...r, stato, chiusa_at, chiusura_motivo: stato === 'chiusa' ? 'rifiutata' : r.chiusura_motivo, motivo_rifiuto: motivo } : r)))
    setPannello(pan => (pan ? { ...pan, gruppo: pan.gruppo.filter(r => r.id !== id) } : pan))
    setSelezionata(s => (s === id ? null : s))
    setDaRifiutare(null)
  }
  // Dal 05/09/2026 calendario e lista sono sempre entrambi visibili, anche sul telefono (e girato: «porta tutto», Ania)
  const mostraCalendario = true
  const mostraLista = true

  useEffect(() => {
    // Stesse letture del calendario principale (camere attive, prenotazioni
    // con ospite, acconti) più le richieste. Ogni errore finisce a schermo.
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(id, full_name, phone, rating)').in('status', ['confermata', 'completata']),
      supabase.from('payments').select('booking_id, amount'),
      fetchRichieste(),
    ]).then(([r, b, pay, ric]) => {
      const errs: string[] = []
      if (r.error) errs.push(`camere: ${r.error.message}`)
      if (b.error) errs.push(`prenotazioni: ${b.error.message}`)
      if (pay.error) errs.push(`acconti: ${pay.error.message}`)
      if (ric.error) errs.push(`richieste: ${ric.error}`)
      setCamere((r.data || []) as Room[])
      setPrenotazioni((b.data || []) as unknown as PrenotazioneBarra[])
      const sums: Record<string, number> = {}
      for (const x of (pay.data || []) as { booking_id: string; amount: number | string }[]) sums[x.booking_id] = (sums[x.booking_id] || 0) + Number(x.amount)
      setAcconti(sums)
      setTutte(ric.data)
      setErrori(errs)
      setLoading(false)
    })
  }, [tentativo])

  // Con la lettura delle richieste fallita la lista non mostra «Nessuna
  // richiesta…»: un errore non è mai «nessuna richiesta» (parte 3)
  const richiesteNonLette = errori.some(e => e.startsWith('richieste:'))

  function riprovaCaricamento() {
    setErrori([])
    setLoading(true)
    setTentativo(t => t + 1)
    void ricaricaRichiesteAperte(true)
  }

  useEffect(() => {
    if (loading) return
    const CHIAVE = 'ca_richieste_ultima_visita'
    let ultima: string | null = null
    try { ultima = window.localStorage.getItem(CHIAVE) } catch { ultima = null }
    const n = nuoveDalSito(tutte, ultima).length
    const t = setTimeout(() => setNuoveWeb(n), 0)
    try { window.localStorage.setItem(CHIAVE, new Date().toISOString()) } catch { /* senza memoria il conteggio riparte ogni volta */ }
    return () => clearTimeout(t)
  }, [loading, tutte])

  useEffect(() => {
    if (loading || !apriId) return
    document.getElementById(`richiesta-${apriId}`)?.scrollIntoView({ block: 'center' })
  }, [loading, apriId])

  const aperte = useMemo(() => ordinaRichieste(tutte.filter(eAperta), ordine), [tutte, ordine])
  const ferme = useMemo(() => daGuardare(aperte, adesso), [aperte, adesso])
  const cercaTra = (lista: Richiesta[], q: string) => {
    const t = q.trim()
    if (!t) return lista
    return lista.filter(r => matchNome([r.nome, r.cognome, nomeCompleto(r)], t) || matchTelefono(r.telefono, t))
  }
  const trovate = useMemo(() => cercaTra(aperte, query), [aperte, query])
  // Quante ALTRE richieste aperte vogliono le stesse notti: il segno blu
  const altreDi = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of aperte) m.set(r.id, altreStesseDate(r, aperte).length)
    return m
  }, [aperte])
  // Col filtro attivo si vede solo quel gruppo, dalla più vecchia
  const capogruppo = gruppoDi ? aperte.find(r => r.id === gruppoDi) ?? null : null
  const gruppo = useMemo(() => (capogruppo ? gruppoStesseDate(capogruppo, aperte) : []), [capogruppo, aperte])
  const mostrate = capogruppo ? gruppo : soloDaGuardare ? cercaTra(ferme, query) : trovate
  function cambiaRicerca(v: string) {
    setQuery(v)
    const t = cercaTra(aperte, v)
    setSelezionata(v.trim() && t.length === 1 ? t[0].id : null)
  }
  const archivio = useMemo(
    () => tutte.filter(r => inArchivio(r, adesso)).sort((a, b) => (b.chiusa_at ?? b.created_at).localeCompare(a.chiusa_at ?? a.created_at)),
    [tutte, adesso],
  )
  // Vista Reale: nessuna richiesta, in nessuna forma.
  const richiesteCalendario = useMemo(
    () => (vista !== 'presunta' ? [] : modoCalendario === 'quindici' ? richiesteNelPeriodo(tutte, giorniDaInizio(inizio)) : richiesteAperte(tutte, mese)),
    [tutte, mese, vista, modoCalendario, inizio],
  )

  // Sovrapposizioni con le prenotazioni CONFERMATE (nome ospite). Le altre
  // richieste aperte non stanno più qui: dal 12/09/2026 le dice il segno blu,
  // che si tocca e restringe l'elenco a quel gruppo. Così il ⇄ resta una cosa
  // sola, il cambio camera, e la riga non ripete quello che dice il segno.
  const conflittiDi = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of aperte) {
      const s = sovrapposizioni(r, prenotazioni, [], camere)
      m.set(r.id, s.prenotazioni.map(b => `${nomeOspite(b)} (${formatIntervallo(b.check_in, b.check_out)})`))
    }
    return m
  }, [aperte, prenotazioni, camere])

  const nuovaRichiesta = (extra = '') => (
    <Link href="/richieste/nuova" className={`${BOTTONE_PIENO} ${extra}`}>+ Nuova richiesta</Link>
  )

  return (
    <div className="p-4">
      {/* La freccia torna alla Home, da dove si entra nelle Richieste. Solo
          arrivando dalla scheda di una prenotazione (?apri=) si torna davvero
          indietro, cioè a quella scheda. Nelle pagine di una richiesta la
          destinazione è sempre scritta: vedi ritornoDallaRichiesta. */}
      <BackBar onClick={() => (apriId ? smartBack(router, '/') : router.push('/'))} />
      {/* Intestazione: su desktop (blocco 2c) titolo, Reale/Presunta, Nuova richiesta e
          contatori su UNA riga con spaziatura uniforme; sul telefono com'era */}
      {desktop && !orizzontale ? (
        <div className="flex items-center flex-wrap gap-4 mb-4 min-h-[44px]">
          <h1 className="ed-titolo-medio mr-auto max-lg:invisible">Richieste di prenotazione</h1>
          {!loading && nuoveWeb > 0 && (
            <p className="chip-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-green-mid text-cream-text">
              <Globe size={14} strokeWidth={2} aria-hidden /> {nuoveWeb} {nuoveWeb === 1 ? 'nuova' : 'nuove'} dal sito
            </p>
          )}
          {!loading && ferme.length > 0 && (
            <button type="button" onClick={() => setSoloDaGuardare(v => !v)} aria-pressed={soloDaGuardare}
              className={`chip-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold border transition-colors ${soloDaGuardare ? 'text-cream-text' : 'bg-white'}`}
              style={soloDaGuardare ? { background: '#A9884E', borderColor: '#A9884E' } : { color: '#A9884E', borderColor: '#A9884E' }}>
              {ferme.length} da guardare{soloDaGuardare ? ' · mostra tutte' : ''}
            </button>
          )}
          <InterruttoreVista vista={vista} onChange={setVista} />
          <CampoRicerca value={query} onChange={cambiaRicerca} className="w-[260px]" />
          {nuovaRichiesta('py-2.5')}
        </div>
      ) : orizzontale ? (
        /* Telefono girato: titolo e ricerca sulla stessa riga, come sul Mac */
        <div className="flex items-center gap-4 mb-3 min-h-[44px]">
          <h1 className="ed-titolo-medio mr-auto max-lg:invisible">Richieste di prenotazione</h1>
          <CampoRicerca value={query} onChange={cambiaRicerca} className="flex-1 max-w-[360px]" />
        </div>
      ) : (
        /* Telefono dritto (05/09/2026): stessa struttura del Mac — titolo e ricerca,
           calendario, mesi, poi Reale/Presunta e «+ Nuova richiesta», contatori e lista */
        <div className="flex flex-col gap-2 mb-3">
          {/* Sul telefono la scritta non si ripete (Ania, 11/09/2026: la barra
              in alto dice già «Richieste»), ma il suo SPAZIO resta libero: si
              nasconde soltanto, così ricerca, calendario e lista non salgono. */}
          <h1 className="ed-titolo max-lg:invisible">Richieste di prenotazione</h1>
          <CampoRicerca value={query} onChange={cambiaRicerca} className="w-full" />
        </div>
      )}

      {errori.length > 0 && (
        <AvvisoAzione testo={`Non riesco a leggere alcuni dati: ${errori.join(' · ')}`} onRiprova={riprovaCaricamento} className="mb-4" />
      )}

      {/* Dal Mac (blocco 4, 04/09/2026, scelta di Ania sul mockup): calendario a
          TUTTA larghezza sopra, lista delle richieste sotto in schede su due
          colonne. Prima erano affiancati e il calendario del mese aveva 30
          colonne minuscole coi nomi tagliati. Sul telefono invariato. */}
      <div>
        {/* Calendario (min-w-0: a 2 settimane scorre dentro il proprio riquadro) */}
        <section hidden={!mostraCalendario} className="min-w-0">
          {capogruppo && (
            <div data-barra-gruppo className="flex items-start justify-between gap-3 bg-white mb-3" style={{ border: '1px solid var(--color-card-border)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>Richieste per {periodoConGiorni(capogruppo.arrivo, capogruppo.partenza)}</p>
                <p style={{ fontSize: 11.5, color: 'var(--color-stone)' }}>{sottotitoloGruppo(gruppo.length)}</p>
              </div>
              <button type="button" data-vedi-tutte onClick={() => setGruppoDi(null)} className="shrink-0 text-[13px] font-semibold text-green-mid underline underline-offset-2">{VEDI_TUTTE}</button>
            </div>
          )}
          {loading ? (
            <div className="text-center py-10 text-stone">Caricamento…</div>
          ) : (
            <CalendarioRichieste
              mese={mese} onMese={setMese} modo={modoCalendario} onModo={cambiaModo} inizio={inizio} onInizio={setInizio}
              camere={camere} prenotazioni={prenotazioni} richieste={richiesteCalendario}
              acconti={acconti} vista={vista} layout={desktop ? 'desktop' : 'mobile'} oggi={oggiIso()} adesso={adesso}
              compatto={orizzontale} evidenziata={selezionata} onApri={(gruppo, ancora) => setPannello({ gruppo, ancora })} />
          )}
          <RigaMesi colonna={larghezzaColonnaCamere(desktop ? 'desktop' : 'mobile', orizzontale)} mesi={mesiCliccabili(new Date())} attivo={modoCalendario === 'quindici' ? inizio.slice(0, 7) : mese}
            onMese={m => (modoCalendario === 'quindici' ? setInizio(m.iso) : setMese(m.chiave))}
            onOggi={() => (modoCalendario === 'quindici' ? setInizio(inizioQuindicina(oggiIso())) : setMese(meseCorrente()))} className="mt-3" />
          <p className="text-xs mt-2" style={{ color: GRIGIO_NOTA }}>
            {vista === 'presunta' ? 'Tratteggiato = richieste in attesa. Tocca una barra per vedere chi c’è dentro.' : 'Solo confermate: queste non si toccano.'}
          </p>
          {/* Telefono, dritto e girato (05/09/2026): Reale/Presunta, «+ Nuova richiesta» e contatori sotto il calendario */}
          {(!desktop || orizzontale) && (
            <>
              <div className="flex items-center justify-between gap-3 mt-4">
                <InterruttoreVista vista={vista} onChange={setVista} />
                {nuovaRichiesta('py-2.5')}
              </div>
              {!loading && (nuoveWeb > 0 || ferme.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {nuoveWeb > 0 && (
                    <p className="chip-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-green-mid text-cream-text">
                      <Globe size={14} strokeWidth={2} aria-hidden /> {nuoveWeb} {nuoveWeb === 1 ? 'nuova' : 'nuove'} dal sito
                    </p>
                  )}
                  {ferme.length > 0 && (
                    <button type="button" onClick={() => setSoloDaGuardare(v => !v)} aria-pressed={soloDaGuardare}
                      className={`chip-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold border transition-colors ${soloDaGuardare ? 'text-cream-text' : 'bg-white'}`}
                      style={soloDaGuardare ? { background: '#A9884E', borderColor: '#A9884E' } : { color: '#A9884E', borderColor: '#A9884E' }}>
                      {ferme.length} da guardare{soloDaGuardare ? ' · mostra tutte' : ''}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* Lista */}
        <section hidden={!mostraLista} className="mt-4 md:mt-7">
          {/* Sul telefono (05/09/2026, richiesta di Ania) due righe: prima «Ordina per …»,
              sotto «RICHIESTE APERTE · N»; sul Mac tutto su una riga come prima */}
          <div className={`mb-4 ${desktop ? 'flex items-center gap-2' : 'flex flex-col gap-2.5'}`}>
            {!desktop && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs text-stone shrink-0">Ordina per</span>
                {ORDINI.map(o => (
                  <button key={o.chiave} type="button" onClick={() => setOrdine(o.chiave)} aria-pressed={ordine === o.chiave}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${ordine === o.chiave ? 'bg-green-mid text-cream-text' : 'text-stone border border-[#C9BFA8]'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] uppercase text-brass shrink-0" style={{ letterSpacing: '2px' }}>{capogruppo ? 'Stesse date' : soloDaGuardare ? 'Da guardare' : 'Richieste aperte'}</span>
              {!loading && <span className="text-[13px] text-stone shrink-0">{capogruppo ? contatoreGruppo(gruppo.length) : mostrate.length}</span>}
              <span className="flex-1 h-px" style={{ background: 'rgba(169,136,78,0.45)' }} />
            </div>
            {desktop && (
              <>
                <span className="text-xs text-stone shrink-0">Ordina per</span>
                {ORDINI.map(o => (
                  <button key={o.chiave} type="button" onClick={() => setOrdine(o.chiave)} aria-pressed={ordine === o.chiave}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${ordine === o.chiave ? 'bg-green-mid text-cream-text' : 'text-stone border border-[#C9BFA8]'}`}>
                    {o.label}
                  </button>
                ))}
              </>
            )}
          </div>

          {capogruppo && (
            <div data-barra-gruppo className="flex items-start justify-between gap-3 bg-white mb-3" style={{ border: '1px solid var(--color-card-border)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>Richieste per {periodoConGiorni(capogruppo.arrivo, capogruppo.partenza)}</p>
                <p style={{ fontSize: 11.5, color: 'var(--color-stone)' }}>{sottotitoloGruppo(gruppo.length)}</p>
              </div>
              <button type="button" data-vedi-tutte onClick={() => setGruppoDi(null)} className="shrink-0 text-[13px] font-semibold text-green-mid underline underline-offset-2">{VEDI_TUTTE}</button>
            </div>
          )}
          {loading ? (
            <div className="text-center py-10 text-stone">Caricamento…</div>
          ) : mostrate.length === 0 && !richiesteNonLette ? (
            desktop ? (
              <div className="flex items-center gap-4 rounded-xl border border-dashed border-border-soft px-5 py-3.5 text-sm text-stone">
                <span>{soloDaGuardare ? 'Nessuna richiesta ferma' : 'Nessuna richiesta in attesa'}</span>
                {!soloDaGuardare && <Link href="/richieste/nuova" className="rounded-[10px] border border-green-mid text-green-mid bg-white px-3.5 py-1.5 text-[13px] font-semibold">+ Nuova richiesta</Link>}
              </div>
            ) : (
              <div className="text-center py-12 flex flex-col items-center gap-4">
                <p className="text-stone">{soloDaGuardare ? 'Nessuna richiesta ferma' : 'Nessuna richiesta in attesa'}</p>
                {!soloDaGuardare && <Link href="/richieste/nuova" className={BOTTONE_PIENO}>Nuova richiesta</Link>}
              </div>
            )
          ) : (
            <ul className="flex flex-col min-[1100px]:grid min-[1100px]:grid-cols-2 min-[1100px]:gap-x-8 min-[1100px]:items-start">
              {mostrate.map(r => (
                <RigaRichiesta key={r.id} r={r} adesso={adesso} conflitti={conflittiDi.get(r.id) || []} giaStato={etichettaGiaStato(soggiorniPrecedenti({ nome: r.nome, cognome: r.cognome, telefono: r.telefono }, prenotazioni, oggiIso()))}
                  stesseDate={capogruppo ? null : etichettaStesseDate(altreDi.get(r.id) ?? 0)} onGruppo={() => setGruppoDi(r.id)} nelGruppo={!!capogruppo}
                  selezionata={selezionata === r.id} onSeleziona={() => setSelezionata(s => (s === r.id ? null : r.id))} onRifiuta={setDaRifiutare} onConferma={r => setDaConfermare(r as RichiestaConProposta)} />
              ))}
            </ul>
          )}

          {!loading && (
            <details className="group mt-6" open={!!apriId && archivio.some(r => r.id === apriId) ? true : undefined}>
              <summary className="list-none cursor-pointer flex items-center justify-between py-2 text-sm text-stone select-none [&::-webkit-details-marker]:hidden">
                <span>Chiuse <span className="text-xs">({archivio.length})</span></span>
                <ChevronDown size={16} strokeWidth={1.8} className="transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              {archivio.length === 0 ? (
                <p className="text-sm text-stone py-2">{richiesteNonLette ? 'Richieste non lette.' : 'Nessuna richiesta chiusa negli ultimi 3 giorni.'}</p>
              ) : (
                <ul className="mt-1">
                  {archivio.map(r => <RigaChiusa key={r.id} r={r} adesso={adesso} evidenziata={r.id === apriId} onRiapri={riapri} riaprendo={riaprendo === r.id} />)}
                </ul>
              )}
              <p className="text-[11px] text-stone pt-2">Dopo 3 giorni spariscono da sole.</p>
            </details>
          )}
        </section>
      </div>

      {pannello && pannello.gruppo.length > 0 && (
        <PannelloRichieste gruppo={pannello.gruppo} ancora={pannello.ancora} layout={desktop ? 'desktop' : 'mobile'} adesso={adesso} onChiudi={() => setPannello(null)} onRifiuta={setDaRifiutare} onConferma={r => { setPannello(null); setDaConfermare(r as RichiestaConProposta) }} />
      )}
      {daConfermare && (
        <FinestraConferma richiesta={daConfermare} aperte={aperte} layout={desktop ? 'desktop' : 'mobile'}
          onChiudi={() => setDaConfermare(null)} onCreata={(id, avviso) => router.push(`/prenotazioni/${id}?da=richiesta${avviso ? `&avviso=${encodeURIComponent(avviso)}` : ''}`)} />
      )}
      {daRifiutare && (
        <RifiutaConMotivo richiesta={daRifiutare} occupato={rifiutando} onConferma={confermaRifiuto} onAnnulla={() => { if (!rifiutando) setDaRifiutare(null) }} />
      )}
    </div>
  )
}
