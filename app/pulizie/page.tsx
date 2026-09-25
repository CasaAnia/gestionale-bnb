'use client'
// Pagina Pulizie approvata da Ania il 25/09/2026 (riferimento
// app/anteprima-pulizie, stessa struttura, classi e testi): Oggi / Registro /
// Statistiche sulle pulizie vere. Le regole del calendario delle pulizie sono
// quelle di sempre (lib/pulizie), le stesse della Home.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { osservaAggiornamentiPulizie } from '@/lib/aggiornamentiPulizie'
import { supabase } from '@/lib/supabase'
import { nomeOspite, nomeConAltri } from '@/lib/guestName'
import BackBar from '@/components/BackBar'
import { giornoDaParametro } from '@/lib/daControllare'
import SalvataggiPulizie from '@/components/SalvataggiPulizie'
import SchedaPulizia, { TIPI_INTERVENTO } from '@/components/SchedaPulizia'
import TempiFuoriCamera from '@/components/TempiFuoriCamera'
import TimerInCorso from '@/components/TimerInCorso'
import StatistichePulizie from './Statistiche'
import { raccogliPagine } from '@/lib/statistiche/paginazione'
import { inviaOperazionePulizia } from '@/lib/pulizieServizio'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'
import { type RispostaPulizia } from '@/lib/pulizieOperazioni'
import { assettoDaSql, recuperoDaRiga, totalePezzi, totaleSenzaMisura } from '@/lib/dotazionePulizie'
import { lettiProposti, lettiTesto, confermateNelGiorno, prossimePulizie, rinviiInCorso, dataNumerica } from '@/lib/pulizieVista'
import {
  confrontaDecisioni, attive, pulizieAperte, prossimoArrivo, prioritaDi, testoArrivo, cronologiaCamera,
  pulizieAutomatiche, conteggioGiorno, addDaysStr, diffDays, todayStr, NOTA_AUTOMATICA_CORRETTA, NOTA_AUTOMATICA_TOLTA, GIORNI_PREAVVISO,
  type PrenotazionePulizie, type CameraPulizie, type Pulizia, type Priorita, type Decisione, type PuliziaAutomatica,
} from '@/lib/pulizie'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
const RANK: Record<Priorita, number> = { urgente: 0, alta: 1, flessibile: 2, nessuna_fretta: 3 }
const PRIORITA: Record<Priorita, string> = { urgente: 'urgente', alta: 'priorità alta', flessibile: 'flessibile', nessuna_fretta: 'nessuna fretta' }
const classe = 'ed-pillola-contorno'
const PAGINA_REGISTRO = 20
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
  const [vista, setVista] = useState<Vista>('oggi')
  const [scheda, setScheda] = useState<Apertura | null>(null)
  const [spiega, setSpiega] = useState<Record<string, boolean>>({})
  const [giornoRegistro, setGiornoRegistro] = useState('')
  const [quanteRighe, setQuanteRighe] = useState(PAGINA_REGISTRO)
  const [correzione, setCorrezione] = useState<Record<string, string>>({})
  const [td, setTd] = useState(todayStr)
  useEffect(() => osservaAggiornamentiPulizie(window, () => setRilettura(x => x + 1)), [])
  // Cambio di giornata con la pagina aperta: si rilegge tutto col giorno nuovo.
  useEffect(() => { const t = window.setInterval(() => { const g = todayStr(); if (g !== td) { setTd(g); setRilettura(x => x + 1) } }, 30000); return () => window.clearInterval(t) }, [td])
  // Dalla Home: ?giorno=… porta al giorno; #statistiche apre le statistiche.
  useEffect(() => { const t = window.setTimeout(() => { if (window.location.hash === '#statistiche') setVista('resoconto') }, 0); return () => window.clearTimeout(t) }, [])
  useEffect(() => {
    if (loading) return
    const giorno = giornoDaParametro(window.location.search)
    if (giorno) document.getElementById(`pulizie-giorno-${giorno}`)?.scrollIntoView({ behavior: 'auto', block: 'start' })
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
  const prossime = useMemo(() => prossimePulizie(prenotazioni, rooms.filter(r => r.active !== false).map(r => r.id), td, events)
    .filter(p => !camereOggi.some(c => c.room.id === p.roomId && c.aperte.some(a => a.tipo === p.tipo && a.booking.id === p.booking.id && a.due === p.data))), [prenotazioni, rooms, td, events, camereOggi])
  const rinvii = useMemo(() => rinviiInCorso(events, td), [events, td])

  async function sposta(p: Pulizia, giorni: number | null) {
    if (saving) return
    setSaving(p.roomId); setAvviso('')
    const prossima = giorni === null ? addDaysStr(p.due, 4) : addDaysStr(td > p.due ? td : p.due, giorni)
    const r = await inviaOperazionePulizia(p.roomId, { azione: 'registra', ultima_id: ultimaId(p.roomId), recupero: null, pulizia: {
      room_id: p.roomId, booking_id: p.booking.id, tipo: p.tipo, stato: giorni === null ? 'saltata' : 'rimandata', data_prevista: p.due,
      data_effettiva: null, prossima_data: prossima, cambio_biancheria: false, note: null, persone_servite: Number(p.booking.num_guests) || null } })
    setSaving(null)
    if (r.errore) { setAvviso(r.errore); return }
    if (r.risposta) aggiornato(r.risposta)
  }
  const apri = (camera: string, pulizia: Decisione, booking: PrenotazionePulizie | null) => setScheda({ camera, pulizia, booking })
  const apriPulizia = (p: Pulizia) => apri(breve(p.roomId), { room_id: p.roomId, booking_id: p.booking.id, tipo: p.tipo, stato: 'fatta', data_prevista: p.due, persone_servite: Number(p.booking.num_guests) || null }, p.booking)
  const vaiA = useCallback((chiave: string) => {
    setScheda(null); setVista('oggi')
    const p = chiave.split(':')
    const id = p[0] === 'fuori' ? 'fuori-camera' : `camera-${bookings.find(b => b.id === p[1])?.room_id}`
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 0)
  }, [bookings])

  // Registro: interventi confermati (i più recenti in alto) e automatiche da correggere.
  const registro = useMemo(() => {
    const perId = new Map((recuperi ?? []).map(r => [String(r.cleaning_id), r]))
    const fatte = events.filter(e => e.stato === 'fatta' && e.id).map(e => ({ chiave: `m:${e.id}`, data: e.data_effettiva || e.data_prevista, evento: e, auto: null as PuliziaAutomatica | null, recupero: recuperi === null ? undefined : perId.get(e.id!) ?? null }))
    const auto = pulizieAutomatiche(prenotazioni, events, td).map(a => ({ chiave: `a:${a.partenza.id}`, data: a.data, evento: null as Riga | null, auto: a, recupero: undefined }))
    return [...fatte, ...auto].filter(v => !giornoRegistro || v.data === giornoRegistro).sort((x, y) => y.data.localeCompare(x.data) || x.chiave.localeCompare(y.chiave))
  }, [events, recuperi, prenotazioni, td, giornoRegistro])
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
  return <main className="max-w-4xl mx-auto px-4 py-6 pb-28" data-nuove-pulizie>
    <BackBar href="/" />
    <h1 className="ed-titolo">Pulizie</h1>
    <p className="ed-sotto mt-2">Camere, tempo di lavoro e biancheria, nello stesso registro.</p>
    <nav className="flex flex-wrap gap-3 my-6" aria-label="Sezioni pulizie">{(['oggi', 'registro', 'resoconto'] as const).map(v => <button type="button" key={v} className={vista === v ? 'ed-pillola capitalize' : `${classe} capitalize`} aria-pressed={vista === v} onClick={() => setVista(v)}>{v === 'resoconto' ? 'Statistiche' : v}</button>)}</nav>
    <SalvataggiPulizie onVerificato={ricarica} />
    <TimerInCorso nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} />
    {errore && <p role="alert" className="text-red-800 my-3">{errore} <button type="button" className="ed-azione" onClick={() => { setLoading(true); ricarica() }}>Riprova</button></p>}
    {avviso && <p role="alert" className="text-red-800 my-3">{avviso}</p>}
    {loading && !errore ? <p>Lettura del registro…</p> : pronta && <>
    {vista === 'oggi' && <>
      <div className="flex justify-between gap-3 border-y border-card-border py-4 mb-4"><p data-da-fare={daFare}><strong className="text-2xl font-serif">{daFare}</strong> da fare</p><p data-confermate={confermate}><strong className="text-2xl font-serif">{confermate}</strong> confermate</p></div>
      <p className="ed-sezione mb-2" id={`pulizie-giorno-${td}`}>{dataNumerica(td)} · oggi</p>
      {camereOggi.map(c => <article key={c.room.id} id={`camera-${c.room.id}`} className="ed-riga py-5 scroll-mt-20" data-camera={c.nome}>
        {c.aperte.map((p, i) => { const b = p.booking; const rit = p.ritardo > 0 ? ` · in ritardo di ${p.ritardo} ${p.ritardo === 1 ? 'giorno' : 'giorni'}` : ''
          return <div key={`${p.tipo}:${b.id}:${p.due}`} className={i ? 'mt-5' : ''} data-pulizia={p.tipo}>
            <div className="flex justify-between items-baseline gap-3"><h2 className="font-serif text-2xl">{c.nome}</h2><span className="text-xs text-stone">{TIPI_INTERVENTO[p.tipo]}{rit}</span></div>
            <p className="text-sm mt-2">{lettiProposti(c.nome, b, td)}</p>
            <p className="text-xs text-stone mt-1">{p.tipo === 'soggiorno' ? `${nomeConAltri(b)} resta · pulizia 4 notti` : p.tipo === 'cambio_camera' ? `${nomeConAltri(b)} va in ${breve(p.cambioCameraVerso!.room_id)}` : p.prevista === td ? `è partito ${nomeOspite(b)}` : `partenza del ${dataNumerica(p.prevista)} · ${nomeOspite(b)}`}{i === 0 && c.arrivo ? ` · ${testoArrivo(c.arrivo)}` : ''}{i === 0 && c.priorita ? ` · ${PRIORITA[c.priorita]}` : ''}</p>
            {p.automatica ? <p className="text-xs text-stone mt-3">Cambio ospite: la pulizia è registrata da sola, non c’è nulla da segnare. Se serve la correggi nel Registro.</p> : <>
              <button type="button" className="ed-pillola mt-4 disabled:opacity-40" disabled={!!saving} onClick={() => apriPulizia(p)}>Registra pulizia · {c.nome}</button>
              <div className="flex flex-wrap gap-3 mt-3"><button type="button" className={`${classe} disabled:opacity-40`} disabled={!!saving} onClick={() => void sposta(p, 1)}>Domani · {c.nome}</button><button type="button" className={`${classe} disabled:opacity-40`} disabled={!!saving} onClick={() => void sposta(p, 2)}>Tra due giorni · {c.nome}</button>{p.tipo === 'soggiorno' && <button type="button" className={`${classe} disabled:opacity-40`} disabled={!!saving} onClick={() => void sposta(p, null)}>Salta questo cambio · {c.nome}</button>}</div>
            </>}
          </div> })}
        {c.cronologia.length > 0 && <div className="mt-3"><button type="button" className="ed-azione ed-azione-tenue" aria-expanded={!!spiega[c.room.id]} onClick={() => setSpiega(s => ({ ...s, [c.room.id]: !s[c.room.id] }))}>{spiega[c.room.id] ? 'nascondi la cronologia' : 'perché questa data?'}</button>
          {spiega[c.room.id] && <div className="mt-2 text-xs text-stone">{c.cronologia.map((v, i) => <p key={i} className="py-0.5">{dataNumerica(v.data)} · {v.testo}{v.registro === 'ricostruita' ? ' · ricostruito, esito ignoto' : v.registro === 'futura' ? ' · previsto' : ''}</p>)}</div>}</div>}
      </article>)}
      <div id="fuori-camera" className="scroll-mt-20"><TempiFuoriCamera giorno={td} oggi={td} nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} /></div>
      {camereOggi.length === 0 && <p className="font-serif text-xl py-6">Nessuna pulizia da fare nella giornata.</p>}
      {prossime.length > 0 && <section className="mt-6"><h2 className="font-serif text-2xl">Prossime pulizie</h2>{prossime.map(p => {
        const anticipabile = p.tipo === 'soggiorno' && diffDays(p.data, td) <= GIORNI_PREAVVISO
        return <div key={`${p.roomId}:${p.tipo}:${p.data}`} id={`pulizie-giorno-${p.data}`} className="py-3 text-sm border-b border-card-border scroll-mt-20" data-prossima={breve(p.roomId)}>
          <p>{breve(p.roomId)} · {dataNumerica(p.data)} · {TIPI_INTERVENTO[p.tipo].toLowerCase()}{p.rimandata ? ' · rimandata' : ''} · da fare, non ancora eseguita</p>
          {anticipabile && <button type="button" className={`${classe} mt-2`} onClick={() => apri(breve(p.roomId), { room_id: p.roomId, booking_id: p.booking.id, tipo: 'soggiorno', stato: 'fatta', data_prevista: p.data, persone_servite: Number(p.booking.num_guests) || null }, p.booking)}>Anticipa · {breve(p.roomId)}</button>}
        </div> })}</section>}
      {rinvii.length > 0 && <section className="mt-6"><h2 className="font-serif text-2xl">Rinvii e salti</h2>{rinvii.map(d => <p key={d.id} className="py-2 text-sm" data-rinvio={d.stato}>{breve(d.room_id)} · {d.stato === 'rimandata' ? `rimandata dal ${dataNumerica(d.data_prevista)} al ${dataNumerica(d.prossima_data!)}` : `saltato il cambio del ${dataNumerica(d.data_prevista)}`} · esclusa dalle pulizie fatte</p>)}</section>}
    </>}
    {vista === 'registro' && <>
      <h2 className="font-serif text-2xl mb-4">Ogni intervento, con i suoi numeri</h2>
      <div className="flex flex-wrap items-end gap-3 mb-4"><label className="text-xs">Giorno<input className="ed-campo block mt-1" type="date" max={td} value={giornoRegistro} onChange={e => { setGiornoRegistro(e.target.value); setQuanteRighe(PAGINA_REGISTRO) }} /></label><button type="button" className={giornoRegistro ? classe : 'ed-pillola'} aria-pressed={!giornoRegistro} onClick={() => setGiornoRegistro('')}>Tutti i giorni</button></div>
      {recuperi === null && <p role="status" className="text-sm text-stone mb-3">Recuperi non disponibili in questo momento: le quantità restano da leggere.</p>}
      {!registro.length && <p>{giornoRegistro ? 'Nessuna pulizia confermata in questo giorno.' : 'Nessuna pulizia registrata.'}</p>}
      {registro.slice(0, quanteRighe).map(v => { const nome = breve(v.evento?.room_id ?? v.auto!.roomId); const e = v.evento; const assetto = e ? assettoDaSql(e.assetto) : null; const rec = v.recupero ? recuperoDaRiga(v.recupero) : null
        return <article className="ed-riga py-4" key={v.chiave} data-registro={nome}><h3 className="font-serif text-xl">{nome} · {dataNumerica(v.data)}</h3>
          <p className="text-sm mt-2">{TIPI_INTERVENTO[e?.tipo ?? v.auto!.tipo]} · {assetto ? lettiTesto(assetto) : 'letti non documentati'}{v.auto ? ' · automatica' : ''}</p>
          {e && <p className="text-sm text-stone mt-1">{v.recupero === undefined ? 'Recuperi da leggere' : rec ? ((n => n === 0 ? 'Niente recuperato' : n === 1 ? '1 pezzo recuperato' : `${n} pezzi recuperati`)(totalePezzi(rec.pezzi) + totaleSenzaMisura(rec.senzaMisura))) : 'Recuperi non annotati'} · {e.minuti ? `${e.minuti} minuti effettivi` : 'Durata non annotata'}</p>}
          {e && <button type="button" className={`${classe} mt-3`} onClick={() => apri(nome, e, bookings.find(b => b.id === e.booking_id) ?? null)}>Riapri · {nome}</button>}
          {v.auto && (correzione[v.chiave] !== undefined ? <div className="flex flex-wrap items-center gap-2 mt-3"><label className="text-xs">Fatta il<input type="date" className="ed-campo ml-2" max={td} value={correzione[v.chiave]} onChange={ev => setCorrezione({ ...correzione, [v.chiave]: ev.target.value })} /></label><button type="button" className="ed-pillola" disabled={!!saving || !correzione[v.chiave]} onClick={() => void correggiAutomatica(v.auto!, v.chiave, 'data')}>Conferma</button><button type="button" className="ed-pillola-tenue" onClick={() => setCorrezione(c => { const r = { ...c }; delete r[v.chiave]; return r })}>Annulla</button></div>
            : <div className="flex flex-wrap gap-3 mt-3"><button type="button" className={classe} disabled={!!saving} onClick={() => setCorrezione({ ...correzione, [v.chiave]: v.data })}>Cambia data · {nome}</button><button type="button" className={classe} disabled={!!saving} onClick={() => void correggiAutomatica(v.auto!, v.chiave, 'tolta')}>Non fatta · {nome}</button></div>)}
        </article> })}
      {registro.length > quanteRighe && <button type="button" className={`${classe} mt-4`} onClick={() => setQuanteRighe(n => n + PAGINA_REGISTRO)}>Mostra altri interventi</button>}
      {giornoRegistro ? <TempiFuoriCamera key={giornoRegistro} giorno={giornoRegistro} oggi={td} nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} /> : <p className="text-xs text-stone mt-6">Per vedere o correggere i tempi fuori camera di un giorno passato, scegli il giorno qui sopra.</p>}
    </>}
    {vista === 'resoconto' && <StatistichePulizie rooms={rooms} bookings={prenotazioni} events={events} recuperi={recuperi} td={td} nomeCamera={nomeDaPrenotazione} />}
    </>}
    {scheda && <SchedaPulizia key={`${scheda.pulizia.id ?? ''}:${scheda.pulizia.booking_id}:${scheda.pulizia.data_prevista}`} camera={scheda.camera} pulizia={scheda.pulizia} booking={scheda.booking} oggi={td}
      ultimaId={ultimaId(scheda.pulizia.room_id)} onChiudi={() => setScheda(null)} onSalvato={aggiornato} nomeCamera={nomeDaPrenotazione} onVaiA={vaiA} />}
  </main>
}

