'use client'
// Pagina Pulizie approvata da Ania il 25/09/2026 (riferimento
// app/anteprima-pulizie, stessa struttura, classi e testi): Oggi / Registro /
// Statistiche sulle pulizie vere. Le regole del calendario delle pulizie sono
// quelle di sempre (lib/pulizie), le stesse della Home.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { osservaAggiornamentiPulizie } from '@/lib/aggiornamentiPulizie'
import { supabase } from '@/lib/supabase'
import BackBar from '@/components/BackBar'
import TestaMac from '@/components/TestaMac'
import { giornoDaParametro } from '@/lib/daControllare'
import SalvataggiPulizie from '@/components/SalvataggiPulizie'
import SchedaPulizia from '@/components/SchedaPulizia'
import TimerInCorso from '@/components/TimerInCorso'
import StatistichePulizie from './Statistiche'
import GraficoGiornata from '@/components/pulizie/GraficoGiornata'
import RegistroPulizie from '@/components/pulizie/RegistroPulizie'
import SchedaCameraOggi from '@/components/pulizie/SchedaCameraOggi'
import SpaziComuniOggi from '@/components/pulizie/SpaziComuniOggi'
import FoglioSpaziComuni from '@/components/pulizie/FoglioSpaziComuni'
import { voceSpazi, type VoceSpazi } from '@/lib/tempoPulizie'
import { TIPO_PROSSIMA, dataProssima, sottoProssima, rigaRinvio, NOTA_FONDO } from '@/lib/pulizieFondo'
import { testoFatta } from '@/lib/pulizieSchede'
import { rigaGiornata, rigaSpaziComuni, giornoLungo, contoGiorno, oraSegnata, romaDi, oraTesto } from '@/lib/giornataPulizie'
import { useParte0064 } from '@/lib/schema0064Dati'
import { nomeOspite } from '@/lib/guestName'
import { leggiFuoriCamera, useTimerPulizie, type FuoriCameraSql } from '@/lib/pulizieTempiDati'
import { raccogliPagine } from '@/lib/statistiche/paginazione'
import { inviaOperazionePulizia } from '@/lib/pulizieServizio'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'
import { type RispostaPulizia } from '@/lib/pulizieOperazioni'
import { confermateNelGiorno, prossimePulizie, rinviiInCorso } from '@/lib/pulizieVista'
import {
  confrontaDecisioni, attive, soggiornoContinuativo, pulizieAperte, prossimoArrivo, prioritaDi, cronologiaCamera,
  pulizieAutomatiche, conteggioGiorno, diffDays, todayStr, NOTA_AUTOMATICA_CORRETTA, NOTA_AUTOMATICA_TOLTA, GIORNI_PREAVVISO,
  type PrenotazionePulizie, type CameraPulizie, type Priorita, type Decisione, type PuliziaAutomatica,
} from '@/lib/pulizie'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const RANK: Record<Priorita, number> = { urgente: 0, alta: 1, flessibile: 2, nessuna_fretta: 3 }
type Vista = 'oggi' | 'registro' | 'resoconto'
type Riga = Decisione & { assetto?: unknown; minuti?: number | null; aggiornata_at?: string | null }
type Apertura = { camera: string; pulizia: Decisione; booking: PrenotazionePulizie | null }

export default function Pulizie() {
  const [rooms, setRooms] = useState<CameraPulizie[]>([])
  const [bookings, setBookings] = useState<PrenotazionePulizie[]>([])
  const [events, setEvents] = useState<Riga[]>([])
  const [recuperi, setRecuperi] = useState<Record<string, unknown>[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState('')
  const [rilettura, setRilettura] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const timerPrecedenti = useTimerPulizie().timer.filter(t => t.chiave.startsWith('fuori:') && t.chiave.endsWith(':area_comune') && !t.avviato_at && t.trascorsi > 0)
  const [vista, setVista] = useState<Vista>('oggi')
  const [scheda, setScheda] = useState<Apertura | null>(null)
  // «Spazi comuni · minuti a mano»: la voce e il giorno aperti nel foglio
  const [foglioSpazi, setFoglioSpazi] = useState<{ giorno: string; voce: VoceSpazi; righe: FuoriCameraSql[] } | null>(null)
  const [correzione, setCorrezione] = useState<Record<string, string>>({})
  const [td, setTd] = useState(todayStr)
  // Bagagli e partenza (proposta 0064): senza le colonne il grafico non le disegna
  const orari0064 = useParte0064('orari')
  const altro0064 = useParte0064('altro')
  const conOrari = orari0064.stato === 'si'
  // I tempi degli spazi comuni di oggi, per la riga in fondo al grafico
  const [fuoriOggi, setFuoriOggi] = useState<FuoriCameraSql[]>([])
  useEffect(() => {
    let viva = true
    const leggi = () => { void leggiFuoriCamera(td, td).then(r => { if (viva && r.righe) setFuoriOggi(r.righe) }) }
    leggi()
    const smetti = osservaAggiornamentiPulizie(window, leggi)
    window.addEventListener('pulizie-salvataggi', leggi)
    return () => { viva = false; smetti(); window.removeEventListener('pulizie-salvataggi', leggi) }
  }, [td, rilettura])
  useEffect(() => osservaAggiornamentiPulizie(window, () => setRilettura(x => x + 1)), [])
  // Cambio di giornata con la pagina aperta: si rilegge tutto col giorno nuovo.
  useEffect(() => { const t = window.setInterval(() => { const g = todayStr(); if (g !== td) { setTd(g); setRilettura(x => x + 1) } }, 30000); return () => window.clearInterval(t) }, [td])
  // Dalla Home: ?giorno=… porta al giorno; #statistiche apre le statistiche.
  useEffect(() => { const t = window.setTimeout(() => { if (window.location.hash === '#statistiche') setVista('resoconto') }, 0); return () => window.clearTimeout(t) }, [])
  useEffect(() => {
    if (loading) return
    const giorno = giornoDaParametro(window.location.search)
    if (giorno) document.getElementById(`pulizie-giorno-${giorno}`)?.scrollIntoView({ behavior: 'auto', block: 'start' })
    // Dalla Home «Tempi fuori dalle camere ↗» (e i vecchi link #fuori-camera): gli spazi comuni
    else if (window.location.hash === '#spazi-comuni' || window.location.hash === '#fuori-camera') document.getElementById('spazi-comuni')?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [loading])

  useEffect(() => {
    let viva = true
    Promise.all([
      raccogliPagine<CameraPulizie>((o, n) => supabase.from('rooms').select('*').order('id').range(o, o + n - 1)),
      raccogliPagine<PrenotazionePulizie>((o, n) => supabase.from('bookings').select('*, guests(full_name, phone)').neq('status', 'annullata').order('id').range(o, o + n - 1)),
      raccogliPagine<Riga>((o, n) => supabase.from('cleanings').select('*').order('created_at').order('id').range(o, o + n - 1)),
    ]).then(async ([r, b, ev]) => {
      if (!viva) return
      if (r.error || b.error || ev.error) { setErrore('Non riesco a leggere tutte le pulizie. Riprova.'); setLoading(false); return }
      const ids = ev.data.filter(e => e.stato === 'fatta' && e.id).map(e => e.id!)
      const rec = await leggiRecuperiDellePulizie(ids)
      if (!viva) return
      setRooms(r.data.sort((a, b) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o)), bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      }))
      setBookings(b.data); setEvents(ev.data)
      setRecuperi(rec.errore || !rec.tabella ? null : rec.righe as unknown as Record<string, unknown>[])
      setErrore(null); setLoading(false)
    }).catch(() => { if (viva) { setErrore('Non riesco a leggere tutte le pulizie. Riprova.'); setLoading(false) } })
    return () => { viva = false }
  }, [rilettura])

  const prenotazioni = useMemo(() => attive(bookings), [bookings])
  const breve = useCallback((id: string) => { const r = rooms.find(x => x.id === id); return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera' }, [rooms])
  const nomeDaPrenotazione = useCallback((bookingId: string) => { const b = bookings.find(x => x.id === bookingId); return b ? breve(b.room_id) : null }, [bookings, breve])
  const ultimaId = (camera: string) => events.filter(e => e.room_id === camera).sort((a, b) => confrontaDecisioni(b, a))[0]?.id ?? null
  function ricarica() { setRilettura(x => x + 1) }
  function aggiornato(r: RispostaPulizia) {
    setEvents(ev => [...ev.filter(e => e.id !== r.pulizia.id), r.pulizia])
    ricaricaNumeriOggiOvunque(); void ricaricaDaControllare(); ricarica()
  }

  // Oggi: una camera per riga, con le sue pulizie aperte (stesse della Home).
  const camereOggi = useMemo(() => rooms.filter(r => r.active !== false).map(room => {
    const aperte = pulizieAperte(prenotazioni, room.id, td, events)
    const arrivo = prossimoArrivo(prenotazioni, room.id, td)
    const priorita = aperte.length ? aperte.map(p => prioritaDi(p, arrivo)).sort((a, b) => RANK[a] - RANK[b])[0] : null
    return { room, nome: breve(room.id), aperte, arrivo, priorita, cronologia: cronologiaCamera(prenotazioni, room.id, td, events, rooms) }
  }).filter(r => r.aperte.length > 0).sort((a, b) => RANK[a.priorita!] - RANK[b.priorita!]), [rooms, prenotazioni, events, td, breve])
  const daFare = conteggioGiorno(rooms, prenotazioni, events, td, td).daFare
  const confermate = confermateNelGiorno(events, td)
  // Il grafico: una riga per OGNI camera attiva, nell'ordine di sempre
  const grafico = useMemo(() => rooms.filter(r => r.active !== false).map(r => rigaGiornata(r, breve(r.id), prenotazioni, events as Parameters<typeof rigaGiornata>[3], td, conOrari)), [rooms, prenotazioni, events, td, conOrari, breve])
  const spaziOggi = useMemo(() => rigaSpaziComuni(fuoriOggi, td), [fuoriOggi, td])
  const conto = contoGiorno(daFare, confermate)
  // Pulite oggi: in fondo, una riga sola con l'ora in cui sono state segnate
  const fatteOggi = useMemo(() => events.filter(e => e.stato === 'fatta' && e.id && (e.data_effettiva || e.data_prevista) === td)
    .map(e => { const o = oraSegnata(e as Parameters<typeof oraSegnata>[0], romaDi); return { id: e.id!, room_id: e.room_id, ora: o === null ? null : oraTesto(o), minuti: e.minuti ?? null } }), [events, td])
  const prossime = useMemo(() => prossimePulizie(prenotazioni, rooms.filter(r => r.active !== false).map(r => r.id), td, events)
    .filter(p => !camereOggi.some(c => c.room.id === p.roomId && c.aperte.some(a => a.tipo === p.tipo && a.booking.id === p.booking.id && a.due === p.data))), [prenotazioni, rooms, td, events, camereOggi])
  const rinvii = useMemo(() => rinviiInCorso(events, td), [events, td])

  const apri = (camera: string, pulizia: Decisione, booking: PrenotazionePulizie | null) => setScheda({ camera, pulizia, booking })
  const vaiA = useCallback((chiave: string) => {
    setScheda(null); setVista('oggi')
    const p = chiave.split(':')
    // un timer degli spazi comuni (anche l'«Area comune» di prima): la sua scheda fra gli spazi comuni
    const id = p[0] === 'fuori' ? `spazi-${voceSpazi(p[2]) ?? 'corridoio'}` : `camera-${bookings.find(b => b.id === p[1])?.room_id}`
    window.setTimeout(() => (document.getElementById(id) ?? document.getElementById('spazi-comuni'))?.scrollIntoView({ behavior: 'auto', block: 'start' }), 0)
  }, [bookings, setScheda, setVista])

  // Registro: le pulizie automatiche di prima, con i loro due comandi
  const automatiche = useMemo(() => pulizieAutomatiche(prenotazioni, events, td), [prenotazioni, events, td])
  async function correggiAutomatica(a: PuliziaAutomatica, chiave: string, modo: 'data' | 'tolta') {
    if (saving) return
    setSaving(a.roomId); setAvviso('')
    const r = await inviaOperazionePulizia(a.roomId, { azione: 'registra', ultima_id: ultimaId(a.roomId), recupero: null, pulizia: {
      room_id: a.roomId, booking_id: a.partenza.id, tipo: a.tipo, stato: modo === 'data' ? 'fatta' : 'saltata', data_prevista: a.data,
      data_effettiva: modo === 'data' ? correzione[chiave] || a.data : null, prossima_data: null, cambio_biancheria: modo === 'data',
      note: modo === 'data' ? NOTA_AUTOMATICA_CORRETTA : NOTA_AUTOMATICA_TOLTA, persone_servite: Number(a.partenza.num_guests) || null } })
    setSaving(null)
    if (r.errore) { setAvviso(r.errore); return }
    setCorrezione(c => { const resto = { ...c }; delete resto[chiave]; return resto })
    if (r.risposta) aggiornato(r.risposta)
  }

  const pronta = !loading && !errore
  // Veste del riferimento approvato il 01/10/2026: pagina bianca, sul telefono
  // il titolo è già nella barra in alto («‹ PULIZIE»); in cima le linguette.
  return <main className="pul pul-pagina max-w-4xl mx-auto px-4 pt-2 lg:pt-6 pb-28" data-nuove-pulizie>
    <BackBar href="/" />
    {/* Dal Mac la testa condivisa (29/09/2026): la sola scrittina. */}
    <TestaMac titolo="Pulizie" contenitore={24} />
    <nav className="pul-tabs" aria-label="Sezioni pulizie">{(['oggi', 'registro', 'resoconto'] as const).map(v => <button type="button" key={v} className={vista === v ? 'on' : ''} aria-pressed={vista === v} onClick={() => setVista(v)}>{v === 'resoconto' ? 'Statistiche' : v === 'oggi' ? 'Oggi' : 'Registro'}</button>)}</nav>
    <SalvataggiPulizie onVerificato={ricarica} />
    <TimerInCorso pagina nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} />
    {timerPrecedenti.map(t => <p key={t.chiave} className="pul-incorso" role="status">Timer precedente in pausa · Area comune · {t.chiave.split(':')[1].split('-').reverse().join('/')} · {Math.ceil(t.trascorsi / 60)} min <button type="button" className="pul-az" onClick={() => vaiA(t.chiave)}>Recupera minuti</button></p>)}
    {errore && <p role="alert" className="text-red-800 my-3">{errore} <button type="button" className="ed-azione" onClick={() => { setLoading(true); ricarica() }}>Riprova</button></p>}
    {avviso && <p role="alert" className="text-red-800 my-3">{avviso}</p>}
    {loading && !errore ? <p>Lettura del registro…</p> : pronta && <>
    {vista === 'oggi' && <>
      <div className="pul-giorno" id={`pulizie-giorno-${td}`}><b>{giornoLungo(td)}</b><small><span data-da-fare={daFare}>{conto.daFare}</span> · <em data-confermate={confermate}>{conto.fatte}</em></small></div>
      <GraficoGiornata righe={grafico} spazi={spaziOggi} />
      {/* Le camere da fare, nell'ordine di urgenza (RANK di prioritaDi) */}
      {camereOggi.flatMap(c => c.aperte.map((p, i) => <SchedaCameraOggi key={`${p.tipo}:${p.booking.id}:${p.due}`} id={i === 0 ? `camera-${c.room.id}` : undefined}
        nome={c.nome} cronologia={i === 0 ? c.cronologia : undefined} chi={p.tipo === 'soggiorno' ? `${nomeOspite(p.booking)} · ${diffDays(td, soggiornoContinuativo(prenotazioni, p.booking).inizio.check_in)}ª notte` : undefined} pulizia={p} arrivo={c.arrivo} priorita={prioritaDi(p, c.arrivo)} oggi={td} conOrari={conOrari}
        ultimaId={ultimaId(c.room.id)} nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} onSalvato={aggiornato} />))}
      {camereOggi.length === 0 && <p className="font-serif text-xl py-6" data-nessuna-pulizia>Nessuna pulizia da fare nella giornata.</p>}
      <SpaziComuniOggi oggi={td} righe={fuoriOggi} conAltro={altro0064.stato === 'si'} nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} onMinuti={voce => setFoglioSpazi({ giorno: td, voce, righe: fuoriOggi })} />
      {/* Le camere già pulite oggi, in fondo e attenuate */}
      {fatteOggi.map(f => <article key={f.id} className="pul-card dn" data-pulita-oggi={breve(f.room_id)}><div className="hd"><b>{breve(f.room_id)}</b><span className="pul-pr ok">{testoFatta(f.ora, f.minuti)}</span></div></article>)}
      {/* Fondo pagina (riferimento del 02/10/2026, pulizie-fondo-riferimento.html): «Fuori dalle
          camere» non c'è più, i suoi tempi stanno negli spazi comuni qui sopra. */}
      {prossime.length > 0 && <section data-prossime><p className="pul-sez">Prossime pulizie</p>{prossime.map(p => {
        const anticipabile = p.tipo === 'soggiorno' && diffDays(p.data, td) <= GIORNI_PREAVVISO
        return <div key={`${p.roomId}:${p.tipo}:${p.data}`} id={`pulizie-giorno-${p.data}`} className="pul-pross scroll-mt-20" data-prossima={breve(p.roomId)}>
          <b>{breve(p.roomId)}<small>{TIPO_PROSSIMA[p.tipo]}</small></b><span className="d">{dataProssima(p.data)}</span>
          <span className="x">{sottoProssima(p.tipo, nomeOspite(p.booking), p.rimandata)}{anticipabile && <button type="button" className="pul-anticipa" onClick={() => apri(breve(p.roomId), { room_id: p.roomId, booking_id: p.booking.id, tipo: 'soggiorno', stato: 'fatta', data_prevista: p.data, persone_servite: Number(p.booking.num_guests) || null }, p.booking)} data-anticipa>Anticipa</button>}</span>
        </div> })}</section>}
      {rinvii.length > 0 && <section data-rinvii-salti><p className="pul-sez">Rinvii e salti</p>{rinvii.map(d => { const r = rigaRinvio(d); return <div key={d.id} className="pul-pross mu" data-rinvio={d.stato}>
          <b>{breve(d.room_id)}<small>{r.tipo}</small></b><span className="d">{r.data}</span><span className="x">{r.sotto}</span>
        </div> })}</section>}
      <p className="pul-nota-fondo" data-nota-fondo>{NOTA_FONDO}</p>
    </>}
    {vista === 'registro' && <RegistroPulizie camere={rooms.filter(r => r.active !== false).map(r => ({ id: r.id, nome: breve(r.id) }))}
      events={events} recuperi={recuperi} automatiche={automatiche} oggi={td} rilettura={rilettura} nomeCamera={breve}
      onApri={e => apri(breve(e.room_id), e, bookings.find(b => b.id === e.booking_id) ?? null)}
      onApriSpazi={(giorno, voce, righe) => setFoglioSpazi({ giorno, voce, righe })}
      automatica={(a, chiave) => correzione[chiave] !== undefined ? <div className="flex flex-wrap items-center gap-2 mt-3"><label className="text-xs">Fatta il<input type="date" className="ed-campo ml-2" max={td} value={correzione[chiave]} onChange={ev => setCorrezione({ ...correzione, [chiave]: ev.target.value })} /></label><button type="button" className="pul-az" disabled={!!saving || !correzione[chiave]} onClick={() => void correggiAutomatica(a, chiave, 'data')}>Conferma</button><button type="button" className="pul-az tn" onClick={() => setCorrezione(c => { const r = { ...c }; delete r[chiave]; return r })}>Annulla</button></div>
        : <div className="pul-azioni" style={{ marginTop: 8 }}><button type="button" className="pul-az" disabled={!!saving} onClick={() => setCorrezione({ ...correzione, [chiave]: a.data })}>Cambia data</button><button type="button" className="pul-az tn" disabled={!!saving} onClick={() => void correggiAutomatica(a, chiave, 'tolta')}>Non fatta</button></div>} />}
    {vista === 'resoconto' && <StatistichePulizie rooms={rooms} bookings={prenotazioni} events={events} recuperi={recuperi} td={td} nomeCamera={nomeDaPrenotazione} />}
    </>}
    {foglioSpazi && <FoglioSpaziComuni key={`${foglioSpazi.giorno}:${foglioSpazi.voce}`} giorno={foglioSpazi.giorno} oggi={td} voce={foglioSpazi.voce} righe={foglioSpazi.righe}
      conCosa={altro0064.stato === 'si'} nomeCamera={nomeDaPrenotazione} onChiudi={() => setFoglioSpazi(null)} onSalvato={ricarica} />}
    {scheda && <SchedaPulizia key={`${scheda.pulizia.id ?? ''}:${scheda.pulizia.booking_id}:${scheda.pulizia.data_prevista}`} camera={scheda.camera} pulizia={scheda.pulizia} booking={scheda.booking} oggi={td}
      ultimaId={ultimaId(scheda.pulizia.room_id)} onChiudi={() => setScheda(null)} onSalvato={aggiornato}
      onTolta={id => { setEvents(ev => ev.filter(e => e.id !== id)); ricaricaNumeriOggiOvunque(); void ricaricaDaControllare(); ricarica() }} nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} />}
  </main>
}

