'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Globe, Phone, MessageCircle, ChevronDown } from 'lucide-react'
import BackBar from '@/components/BackBar'
import InterruttoreVista from '@/components/richieste/InterruttoreVista'
import CalendarioRichieste, { type Ancora, type ModoCalendario } from '@/components/richieste/CalendarioRichieste'
import PannelloRichieste from '@/components/richieste/PannelloRichieste'
import AzioniRichiesta from '@/components/richieste/AzioniRichiesta'
import RigaScadenza from '@/components/richieste/RigaScadenza'
import ConfermaDialog from '@/components/richieste/ConfermaDialog'
import FinestraConferma from '@/components/richieste/FinestraConferma'
import type { RichiestaConProposta } from '@/lib/richiesteConferma'
import { supabase } from '@/lib/supabase'
import { fetchRichieste, rifiutaRichiesta, MOTIVI_RIFIUTO } from '@/lib/richiesteDati'
import { useVista, useDesktop, useAdesso, useOrizzontaleTelefono, useSchermoIntero } from '@/lib/richiesteVista'
import { meseCorrente, richiesteAperte, richiesteNelPeriodo, sovrapposizioni, inizioQuindicina, giorniDaInizio } from '@/lib/richiesteCalendario'
import { nomeOspite } from '@/lib/guestName'
import type { PrenotazioneBarra } from '@/lib/calendarioBarre'
import type { Room } from '@/lib/types'
import {
  CANALE_LABEL, STATO_LABEL, eAperta, inArchivio, ordinaRichieste, nottiRichiesta, nomeCompleto,
  formatIntervallo, oraArrivo, avvisoFerma, daGuardare, nuoveDalSito, riassuntoPersone, type Richiesta, type OrdineRichieste,
} from '@/lib/richieste'

const FRAUNCES = { fontFamily: 'var(--font-fraunces), Georgia, serif' }
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

// Badge ⇄ ottone: la richiesta si sovrappone a una confermata o a un'altra aperta
function BadgeSovrapposta() {
  return (
    <span aria-label="si sovrappone" className="inline-flex items-center justify-center shrink-0 rounded-full text-[10px] font-bold leading-none h-[16px] min-w-[18px] px-1" style={{ background: '#A9884E', color: '#F5EFE4' }}>⇄</span>
  )
}

function RigaRichiesta({ r, adesso, conflitti, selezionata, onSeleziona, onRifiuta, onConferma }: { r: Richiesta; adesso: Date; conflitti: string[]; selezionata: boolean; onSeleziona: () => void; onRifiuta: (r: Richiesta) => void; onConferma: (r: Richiesta) => void }) {
  const n = nottiRichiesta(r)
  return (
    <li>
    <div role="button" tabIndex={0} onClick={onSeleziona} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleziona() } }} aria-pressed={selezionata}
      className={`w-full text-left bg-white rounded-xl border border-card-border p-4 md:px-5 md:py-4 leading-snug transition-shadow cursor-pointer ${selezionata ? 'shadow-md bg-sage/40' : 'shadow-sm'}`}>
      <div className="flex items-baseline justify-between gap-3">
        {/* desktop (blocco 2b): «Nome Cognome» in Fraunces 16 px; il badge ⇄ va sulla riga propria */}
        <p className="font-medium text-[15px] md:font-serif md:text-[16px] text-green-dark truncate inline-flex items-center gap-1.5 min-w-0"><span className="truncate">{nomeCompleto(r)}</span>{conflitti.length > 0 && <span className="md:hidden inline-flex"><BadgeSovrapposta /></span>}</p>
        <p className="shrink-0 text-sm font-semibold text-brass">{n === 1 ? '1 notte' : `${n} notti`}</p>
      </div>
      <p className="text-sm md:text-[13px] text-green-dark mt-1 md:mt-1.5">
        {formatIntervallo(r.arrivo, r.partenza)}
        <span className="text-stone"> · </span>
        {r.persone_per_notte ? riassuntoPersone(r.arrivo, r.persone_per_notte) : `${r.persone} ${r.persone === 1 ? 'persona' : 'persone'}`}
        <span className="text-stone"> · </span>
        {r.rooms?.name || 'qualsiasi camera'}
      </p>
      {/* timer delle 3 ore (solo proposta inviata): sostituisce il vecchio «proposta inviata N minuti fa» */}
      <RigaScadenza r={r} adesso={adesso} className="mt-1.5" />
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs md:text-[13px] text-stone mt-1.5">
        <span className="inline-flex items-center gap-1"><IconaCanale canale={r.canale} />{CANALE_LABEL[r.canale]}{r.canale === 'web' && r.origine && <span className="text-[10px] uppercase tracking-wide text-brass">· {r.origine}</span>}</span>
        <span aria-hidden>·</span>
        <span>{oraArrivo(r.created_at, adesso)}</span>
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
      <AzioniRichiesta r={r} onRifiuta={onRifiuta} onConferma={onConferma} />
    </div>
    </li>
  )
}

function RigaArchivio({ r, adesso, evidenziata = false }: { r: Richiesta; adesso: Date; evidenziata?: boolean }) {
  const colore = r.stato === 'confermata' ? '#6C9A7C' : '#8C3B2E'
  return (
    <li id={`richiesta-${r.id}`} className={`flex items-baseline justify-between gap-3 py-2.5 -mx-2 px-2 border-b-[0.5px] border-border-soft last:border-b-0 text-sm ${evidenziata ? 'bg-sage/50 rounded-lg' : ''}`}>
      <div className="min-w-0">
        <p className="text-green-dark truncate">{nomeCompleto(r)}</p>
        <p className="text-xs text-stone">{formatIntervallo(r.arrivo, r.partenza)} · {r.persone} {r.persone === 1 ? 'persona' : 'persone'} · {CANALE_LABEL[r.canale]}</p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1.5 text-xs text-green-dark">
        <span className="w-2 h-2 rounded-full" style={{ background: colore }} />
        {STATO_LABEL[r.stato]}{r.chiusa_at ? ` · ${oraArrivo(r.chiusa_at, adesso)}` : ''}
        {r.stato === 'confermata' && r.prenotazione_id && (
          <Link href={`/prenotazioni/${r.prenotazione_id}`} className="ml-1 underline underline-offset-2 text-green-mid" onClick={e => e.stopPropagation()}>scheda</Link>
        )}
      </span>
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
  // «N da guardare»: filtro sulle ferme (in attesa > 24 h, proposta > 48 h, arrivo passato) e sulle proposte scadute (3 h dall'invio)
  const [soloDaGuardare, setSoloDaGuardare] = useState(false)
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

  async function confermaRifiuto(motivo?: string) {
    if (!daRifiutare) return
    setRifiutando(true)
    const { chiusa_at, error } = await rifiutaRichiesta(daRifiutare.id, motivo)
    setRifiutando(false)
    if (error) { setErrori(e => [...e.filter(x => !x.startsWith('rifiuto')), `rifiuto: ${error}`]); setDaRifiutare(null); return }
    const id = daRifiutare.id
    setTutte(lista => lista.map(r => (r.id === id ? { ...r, stato: 'rifiutata', chiusa_at } : r)))
    setPannello(pan => (pan ? { ...pan, gruppo: pan.gruppo.filter(r => r.id !== id) } : pan))
    setSelezionata(s => (s === id ? null : s))
    setDaRifiutare(null)
  }
  // Dal 05/09/2026 calendario e lista sono sempre entrambi visibili, anche sul telefono
  const mostraCalendario = true
  const mostraLista = !orizzontale

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
  }, [])

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
  const mostrate = soloDaGuardare ? ferme : aperte
  const archivio = useMemo(
    () => tutte.filter(r => inArchivio(r, adesso)).sort((a, b) => (b.chiusa_at ?? b.created_at).localeCompare(a.chiusa_at ?? a.created_at)),
    [tutte, adesso],
  )
  // Vista Reale: nessuna richiesta, in nessuna forma.
  const richiesteCalendario = useMemo(
    () => (vista !== 'presunta' ? [] : modoCalendario === 'quindici' ? richiesteNelPeriodo(tutte, giorniDaInizio(inizio)) : richiesteAperte(tutte, mese)),
    [tutte, mese, vista, modoCalendario, inizio],
  )

  // Sovrapposizioni di ogni richiesta aperta: con confermate (nome ospite) e altre aperte («Nome Cognome»)
  const conflittiDi = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of aperte) {
      const s = sovrapposizioni(r, prenotazioni, aperte, camere)
      m.set(r.id, [
        ...s.prenotazioni.map(b => `${nomeOspite(b)} (${formatIntervallo(b.check_in, b.check_out)})`),
        ...s.richieste.map(x => `${nomeCompleto(x)} (${formatIntervallo(x.arrivo, x.partenza)})`),
      ])
    }
    return m
  }, [aperte, prenotazioni, camere])

  const nuovaRichiesta = (extra = '') => (
    <Link href="/richieste/nuova" className={`${BOTTONE_PIENO} ${extra}`}>+ Nuova richiesta</Link>
  )

  return (
    <div className="p-4">
      <BackBar href="/" />
      {/* Intestazione: su desktop (blocco 2c) titolo, Reale/Presunta, Nuova richiesta e
          contatori su UNA riga con spaziatura uniforme; sul telefono com'era */}
      {orizzontale ? null : desktop ? (
        <div className="flex items-center flex-wrap gap-4 mb-4 min-h-[44px]">
          <h1 className="text-[22px] text-green-dark leading-tight mr-auto" style={FRAUNCES}>Richieste di prenotazione</h1>
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
          {nuovaRichiesta('py-2.5')}
        </div>
      ) : (
        /* Telefono (05/09/2026, richiesta di Ania): stessa struttura del Mac — titolo,
           calendario, poi Reale/Presunta e «+ Nuova richiesta», contatori e lista */
        <h1 className="text-[22px] text-green-dark leading-tight mb-3" style={FRAUNCES}>Richieste di prenotazione</h1>
      )}

      {errori.length > 0 && (
        <div className="mb-4 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">
          Non riesco a leggere alcuni dati: {errori.join(' · ')}
        </div>
      )}

      {/* Dal Mac (blocco 4, 04/09/2026, scelta di Ania sul mockup): calendario a
          TUTTA larghezza sopra, lista delle richieste sotto in schede su due
          colonne. Prima erano affiancati e il calendario del mese aveva 30
          colonne minuscole coi nomi tagliati. Sul telefono invariato. */}
      <div>
        {/* Calendario (min-w-0: a 2 settimane scorre dentro il proprio riquadro) */}
        <section hidden={!mostraCalendario} className="min-w-0">
          {loading ? (
            <div className="bg-white rounded-xl border border-card-border text-center py-10 text-stone">Caricamento…</div>
          ) : (
            <CalendarioRichieste
              mese={mese} onMese={setMese} modo={modoCalendario} onModo={cambiaModo} inizio={inizio} onInizio={setInizio}
              camere={camere} prenotazioni={prenotazioni} richieste={richiesteCalendario}
              acconti={acconti} vista={vista} layout={desktop ? 'desktop' : 'mobile'} oggi={oggiIso()} adesso={adesso}
              compatto={orizzontale} evidenziata={selezionata} onApri={(gruppo, ancora) => setPannello({ gruppo, ancora })} />
          )}
          {!orizzontale && (
            <p className="text-xs mt-2" style={{ color: GRIGIO_NOTA }}>
              {vista === 'presunta' ? 'Tratteggiato = richieste in attesa. Tocca una barra per vedere chi c’è dentro.' : 'Solo confermate: queste non si toccano.'}
            </p>
          )}
          {!desktop && !orizzontale && (
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
          <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
            <span className="text-[11px] uppercase text-brass shrink-0" style={{ letterSpacing: '2px' }}>{soloDaGuardare ? 'Da guardare' : 'Richieste aperte'}</span>
            {!loading && <span className="text-[13px] text-stone shrink-0">{mostrate.length}</span>}
            <span className="flex-1 h-px" style={{ background: 'var(--color-card-border)' }} />
            <span className="text-xs text-stone shrink-0">Ordina per</span>
            {ORDINI.map(o => (
              <button key={o.chiave} type="button" onClick={() => setOrdine(o.chiave)} aria-pressed={ordine === o.chiave}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${ordine === o.chiave ? 'bg-green-mid text-cream-text' : 'bg-white text-stone border border-card-border'}`}>
                {o.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-10 text-stone">Caricamento…</div>
          ) : mostrate.length === 0 ? (
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
            <ul className="flex flex-col gap-3 min-[1100px]:grid min-[1100px]:grid-cols-2 min-[1100px]:items-start">
              {mostrate.map(r => (
                <RigaRichiesta key={r.id} r={r} adesso={adesso} conflitti={conflittiDi.get(r.id) || []}
                  selezionata={selezionata === r.id} onSeleziona={() => setSelezionata(s => (s === r.id ? null : r.id))} onRifiuta={setDaRifiutare} onConferma={r => setDaConfermare(r as RichiestaConProposta)} />
              ))}
            </ul>
          )}

          {!loading && (
            <details className="group mt-6" open={!!apriId && archivio.some(r => r.id === apriId) ? true : undefined}>
              <summary className="list-none cursor-pointer flex items-center justify-between py-2 text-sm text-stone select-none [&::-webkit-details-marker]:hidden">
                <span>Archivio <span className="text-xs">({archivio.length})</span></span>
                <ChevronDown size={16} strokeWidth={1.8} className="transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              {archivio.length === 0 ? (
                <p className="text-sm text-stone py-2">Nessuna richiesta chiusa negli ultimi 90 giorni.</p>
              ) : (
                <ul className="bg-white rounded-xl border border-card-border px-4 mt-1">
                  {archivio.map(r => <RigaArchivio key={r.id} r={r} adesso={adesso} evidenziata={r.id === apriId} />)}
                </ul>
              )}
            </details>
          )}
        </section>
      </div>

      {pannello && pannello.gruppo.length > 0 && (
        <PannelloRichieste gruppo={pannello.gruppo} ancora={pannello.ancora} layout={desktop ? 'desktop' : 'mobile'} adesso={adesso} onChiudi={() => setPannello(null)} onRifiuta={setDaRifiutare} onConferma={r => { setPannello(null); setDaConfermare(r as RichiestaConProposta) }} />
      )}
      {daConfermare && (
        <FinestraConferma richiesta={daConfermare} aperte={aperte} layout={desktop ? 'desktop' : 'mobile'}
          onChiudi={() => setDaConfermare(null)} onCreata={id => router.push(`/prenotazioni/${id}?da=richiesta`)} />
      )}
      {daRifiutare && (
        <ConfermaDialog titolo={`Rifiutare la richiesta di ${nomeCompleto(daRifiutare)}?`} testo="Nessun messaggio parte da qui."
          conferma="Rifiuta" occupato={rifiutando} scelte={MOTIVI_RIFIUTO} onConferma={confermaRifiuto} onAnnulla={() => { if (!rifiutando) setDaRifiutare(null) }} />
      )}
    </div>
  )
}
