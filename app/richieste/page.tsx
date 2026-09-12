'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { soggiorniPrecedenti, etichettaGiaStato } from '@/lib/clienteCheTorna'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import BackBar from '@/components/BackBar'
import InterruttoreVista from '@/components/richieste/InterruttoreVista'
import TestataRichieste from '@/components/richieste/TestataRichieste'
import { TastoNuovaRichiesta, RigaDaGuardare, RigaOrdina } from '@/components/richieste/ComandiPagina'
import { ORDINI_RICHIESTE } from '@/lib/comandiRichieste'
import CalendarioRichieste, { larghezzaColonnaCamere, type Ancora, type ModoCalendario } from '@/components/richieste/CalendarioRichieste'
import PannelloRichieste from '@/components/richieste/PannelloRichieste'
import { TastoPrincipale, ComandiRichiesta, IconeContatto, SPAZIO_COMANDI } from '@/components/richieste/AzioniRichiesta'
import RigaScadenza from '@/components/richieste/RigaScadenza'
import NotaCliente from '@/components/richieste/NotaCliente'
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
import { altreStesseDate, gruppoStesseDate, etichettaAltre, sottotitoloGruppo, contatoreGruppo, VEDI_TUTTE } from '@/lib/richiesteStesseDate'
import { personePerNotte } from '@/lib/richiesteProposta'
import { pezziRigaRichiesta, daQuantoArrivata } from '@/lib/rigaRichiesta'
import { periodoConGiorni } from '@/lib/dateItaliane'
import { smartBack } from '@/lib/navHistory'
import { nomeOspite } from '@/lib/guestName'
import type { PrenotazioneBarra } from '@/lib/calendarioBarre'
import type { Room } from '@/lib/types'
import {
  CANALE_LABEL, eAperta, inArchivio, rigaChiusa, riapribile, ordinaRichieste, nottiRichiesta, nomeCompleto,
  formatIntervallo, formatDateRichiesta, avvisoFerma, daGuardare, nuoveDalSito, scadenzaProposta, type Richiesta, type OrdineRichieste,
} from '@/lib/richieste'

const GRIGIO_NOTA = '#6b6b60'

const GRIGIO_QUANDO = '#B9B6AD'   // «oggi», «ieri», «2 giorni fa», in fondo alla prima riga
const GRIGIO_RIGA = '#6b736a'     // la seconda riga: date, notti, persone, camera

const oggiIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Il segno delle richieste che si accavallano: etichettina blu DAVANTI al
// nome, si tocca e restringe l'elenco a quel gruppo (Ania, su bozza,
// 12/09/2026). Il ⇄ non si usa più per questo caso: resta per il cambio camera.
// Ha la misura delle altre etichettine della pagina — angoli 4, 11 bold, 2 px
// sopra e sotto e 7 ai lati — e i colori del blu tenue.
const BLU_FONDO = '#DCE7ED'
const BLU_TESTO = '#3F6377'
function SegnoStesseDate({ testo, onClick }: { testo: string; onClick: () => void }) {
  return (
    <button type="button" data-stesse-date onClick={e => { e.stopPropagation(); onClick() }}
      className="inline-flex items-center shrink-0 py-[13px] -my-[13px] rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid">
      <span className="inline-flex items-center gap-1"
        style={{ background: BLU_FONDO, color: BLU_TESTO, borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 7px', lineHeight: '18px' }}>
        <span aria-hidden>⧉</span>{testo}
      </span>
    </button>
  )
}

function RigaRichiesta({ r, adesso, conflitti, stesseDate, onGruppo, nelGruppo = false, selezionata, onSeleziona, onRifiuta, onConferma, giaStato }: { r: Richiesta; adesso: Date; conflitti: string[]; stesseDate?: string | null; onGruppo?: () => void; nelGruppo?: boolean; selezionata: boolean; onSeleziona: () => void; onRifiuta: (r: Richiesta) => void; onConferma: (r: Richiesta) => void; giaStato?: string | null }) {
  // Le persone di ogni notte: con dati storti (persone_per_notte non coerente)
  // personePerNotte alza un errore e qui la scheda non deve sparire.
  let personeNotti: number[]
  try { personeNotti = personePerNotte(r) } catch { personeNotti = [Math.max(1, Number(r.persone) || 1)] }
  // Le notti scelte a mano non si scrivono con la freccia: si elencano
  const periodo = r.notti_richieste ? formatDateRichiesta(r) : periodoConGiorni(r.arrivo, r.partenza)
  const pezzi = pezziRigaRichiesta({ periodo, notti: nottiRichiesta(r), personeNotti, camera: r.rooms?.name ?? null, forte: 'elenco' })
  const quando = daQuantoArrivata(r.created_at, adesso)
  const ferma = avvisoFerma(r, adesso)
  return (
    // Le richieste sono separate solo da un filo sottile: niente riquadri
    // (Ania, su bozza, 12/09/2026). Nel gruppo un filo d'ottone a sinistra.
    <li style={nelGruppo ? { borderLeft: '2px solid #A9884E', paddingLeft: 12 } : undefined}>
    <div role="button" tabIndex={0} onClick={onSeleziona} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleziona() } }} aria-pressed={selezionata}
      className={`w-full text-left cursor-pointer border-t border-card-border transition-colors ${selezionata ? 'bg-sage/40 rounded-lg px-3 -mx-3' : ''}`}
      style={{ paddingTop: 11, paddingBottom: 11 }}>
      {/* Prima riga: l'etichettina blu delle altre richieste per le stesse
          date, poi il nome; in fondo a destra da quanto è arrivata */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 min-w-0 leading-tight" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>
          {stesseDate && onGruppo && <SegnoStesseDate testo={stesseDate} onClick={onGruppo} />}
          <span className="truncate">{nomeCompleto(r)}</span>
          {/* Cliente che torna (08/09/2026): non è una provenienza, è un'etichetta */}
          {giaStato && <span data-gia-stato className="shrink-0 text-[11px] font-bold bg-sage text-green-mid whitespace-nowrap" style={{ borderRadius: 4, padding: '2px 7px', lineHeight: '18px' }}>{giaStato}</span>}
        </p>
        {quando && <span className="shrink-0" style={{ fontSize: 11, color: GRIGIO_QUANDO }}>{quando}</span>}
      </div>
      {/* Seconda riga, tutto di seguito: date, notti, persone, camera. In
          semibold verde solo i DATI — le date con la freccia, il numero delle
          notti, quello delle persone e la camera; le parole di mezzo restano
          piccole e grigie (Ania, dal telefono, 12/09/2026; lib/rigaRichiesta) */}
      <p className="mt-[3px]" style={{ fontSize: 13, lineHeight: 1.3, color: GRIGIO_RIGA }}>
        {pezzi.map((x, i) => (
          <span key={i} style={x.forte ? { fontWeight: 600, color: 'var(--color-green-dark)' } : undefined}>{x.testo}</span>
        ))}
      </p>
      {/* Solo quando c'è qualcosa da dire: timer della proposta, richiesta
          ferma, sovrapposizioni con le prenotazioni confermate */}
      {(scadenzaProposta(r, adesso) || ferma) && (
        <div className="flex flex-wrap items-center gap-x-1.5 mt-1">
          <RigaScadenza r={r} adesso={adesso} />
          {ferma && <span className="text-[11.5px] font-semibold text-brass">{ferma}</span>}
        </div>
      )}
      {conflitti.length > 0 && (
        <p className="mt-1" style={{ fontSize: 11.5, color: '#7a5f2c' }} title={conflitti.join(' · ')}>
          si sovrappone con {conflitti.join(', ')}
        </p>
      )}
      {/* La nota del cliente come nella Home: tutta in rosso, 13 px semibold */}
      <NotaCliente note={r.note} home className="mt-1" />
      {/* Ultima riga: la pastiglia verde, «Modifica» e «Rifiuta», e in fondo a
          destra le due icone nude per chiamare e per scrivere su WhatsApp */}
      <div className="flex items-center mt-2" style={{ gap: SPAZIO_COMANDI }}>
        <TastoPrincipale r={r} onConferma={onConferma} />
        <ComandiRichiesta r={r} onRifiuta={onRifiuta} />
        <IconeContatto r={r} className="ml-auto" />
      </div>
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

  return (
    <div className="p-4">
      {/* La freccia torna alla Home, da dove si entra nelle Richieste. Solo
          arrivando dalla scheda di una prenotazione (?apri=) si torna davvero
          indietro, cioè a quella scheda. Nelle pagine di una richiesta la
          destinazione è sempre scritta: vedi ritornoDallaRichiesta. */}
      <BackBar onClick={() => (apriId ? smartBack(router, '/') : router.push('/'))} />
      {/* Intestazione (Ania, su bozza, 12/09/2026): «Richieste» in Georgia e
          sotto una riga sola che dice come sta la pagina — «4 aperte · 2 nuove
          dal sito». Su desktop la testa sta a sinistra e i comandi, tutti della
          stessa famiglia, le stanno accanto sulla stessa riga. */}
      {desktop && !orizzontale ? (
        <div className="flex items-center flex-wrap gap-4 mb-4 min-h-[44px]">
          <TestataRichieste aperte={aperte.length} nuoveDalSito={nuoveWeb} mostraConto={!loading} className="mr-auto" />
          {!loading && <RigaDaGuardare quante={ferme.length} acceso={soloDaGuardare} onClick={() => setSoloDaGuardare(v => !v)} />}
          <InterruttoreVista vista={vista} onChange={setVista} />
          <CampoRicerca value={query} onChange={cambiaRicerca} className="w-[260px]" />
          <TastoNuovaRichiesta />
        </div>
      ) : orizzontale ? (
        /* Telefono girato: testa e ricerca sulla stessa riga, come sul Mac */
        <div className="flex items-center gap-4 mb-3 min-h-[44px]">
          <TestataRichieste aperte={aperte.length} nuoveDalSito={nuoveWeb} mostraConto={!loading} className="mr-auto" />
          <CampoRicerca value={query} onChange={cambiaRicerca} className="flex-1 max-w-[360px]" />
        </div>
      ) : (
        /* Telefono dritto: testa e ricerca, poi calendario, mesi, i comandi e la lista */
        <div className="flex flex-col gap-2 mb-3">
          <TestataRichieste aperte={aperte.length} nuoveDalSito={nuoveWeb} mostraConto={!loading} />
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
          {/* Sul telefono i comandi stanno sotto il calendario (Ania, dal
              telefono, 12/09/2026): l'interruttore a sinistra e «+ Nuova
              richiesta» a destra; sotto, a parole, «N da guardare» e «Ordina
              per». Niente più pastiglie: vedi ComandiPagina. */}
          {(!desktop || orizzontale) && (
            <>
              <div className="flex items-center justify-between gap-3 mt-3">
                <InterruttoreVista vista={vista} onChange={setVista} />
                <TastoNuovaRichiesta />
              </div>
              {!loading && <RigaDaGuardare quante={ferme.length} acceso={soloDaGuardare} onClick={() => setSoloDaGuardare(v => !v)} />}
              <RigaOrdina voci={ORDINI_RICHIESTE} scelta={ordine} onScegli={setOrdine} nome="Ordina le richieste" />
            </>
          )}
        </section>

        {/* Lista */}
        <section hidden={!mostraLista} className="mt-4 md:mt-7">
          {/* Il titoletto della lista. «Ordina per» sul telefono sta già sotto
              il calendario; sul Mac resta qui, con le stesse parole. */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] uppercase text-brass shrink-0" style={{ letterSpacing: '2px' }}>{capogruppo ? 'Stesse date' : soloDaGuardare ? 'Da guardare' : 'Richieste aperte'}</span>
              {!loading && <span className="text-[13px] text-stone shrink-0">{capogruppo ? contatoreGruppo(gruppo.length) : mostrate.length}</span>}
              <span className="flex-1 h-px" style={{ background: 'rgba(169,136,78,0.45)' }} />
            </div>
            {desktop && <RigaOrdina voci={ORDINI_RICHIESTE} scelta={ordine} onScegli={setOrdine} nome="Ordina le richieste" className="shrink-0" />}
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
                {!soloDaGuardare && <TastoNuovaRichiesta />}
              </div>
            ) : (
              <div className="text-center py-12 flex flex-col items-center gap-4">
                <p className="text-stone">{soloDaGuardare ? 'Nessuna richiesta ferma' : 'Nessuna richiesta in attesa'}</p>
                {!soloDaGuardare && <TastoNuovaRichiesta />}
              </div>
            )
          ) : (
            <ul className="flex flex-col min-[1100px]:grid min-[1100px]:grid-cols-2 min-[1100px]:gap-x-8 min-[1100px]:items-start">
              {mostrate.map(r => (
                <RigaRichiesta key={r.id} r={r} adesso={adesso} conflitti={conflittiDi.get(r.id) || []} giaStato={etichettaGiaStato(soggiorniPrecedenti({ nome: r.nome, cognome: r.cognome, telefono: r.telefono }, prenotazioni, oggiIso()))}
                  stesseDate={capogruppo ? null : etichettaAltre(altreDi.get(r.id) ?? 0)} onGruppo={() => setGruppoDi(r.id)} nelGruppo={!!capogruppo}
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
