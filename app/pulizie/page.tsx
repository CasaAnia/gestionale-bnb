'use client'
import { useEffect, useMemo, useState } from 'react'
import Statistiche from './Statistiche'
import { supabase } from '@/lib/supabase'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { nomeOspite } from '@/lib/guestName'
import BackBar from '@/components/BackBar'
import {
  attive, pulizieAperte, prossimoArrivo, prioritaDi, testoArrivo, cicloCambio,
  partenzaAperta, cambioCameraIn, continuaDa, cambioCameraOut,
  soggiornoContinuativo, todayStr, addDaysStr, diffDays,
  NOTTI_CAMBIO, GIORNI_PREAVVISO,
  type Pulizia, type Priorita, type Decisione,
} from '@/lib/pulizie'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

// Salvataggio locale usato in passato quando la colonna linen_next_date non
// esisteva ancora: si legge soltanto, per non perdere date salvate allora.
const LOCAL_LINEN_KEY = 'pulizie_linen_dates'

function italianDate() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function dataBreve(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

// Intestazione di un gruppo di giorni nella sezione "Prossimi"
function intestazioneGiorno(date: string, td: string) {
  const diff = diffDays(date, td)
  const [y, m, d] = date.split('-').map(Number)
  const full = new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  if (diff === 1) return { label: 'Domani', sub: full }
  if (diff === 2) return { label: 'Dopodomani', sub: full }
  return { label: full.charAt(0).toUpperCase() + full.slice(1), sub: '' }
}

// Etichette e colori delle priorità (audit 24/08/2026): niente bordi neri,
// solo tinte piene coerenti con l'identità del gestionale.
const PRIORITA_STYLE: Record<Priorita, { label: string; background: string; color: string }> = {
  urgente: { label: 'URGENTE', background: '#E8C4B0', color: '#7a3a1d' },
  alta: { label: 'ALTA', background: '#EFD9C7', color: '#8a4f2f' },
  flessibile: { label: 'FLESSIBILE', background: '#DFE9E0', color: '#2D6A4F' },
  nessuna_fretta: { label: 'NESSUNA FRETTA', background: '#EDEAE2', color: '#7A7466' },
}

const badgeStyle: Record<string, { background: string; color: string }> = {
  'da pulire': { background: '#EFD9C7', color: '#8a4f2f' },
  'cambio biancheria': { background: '#EDE6D6', color: '#5a6b3f' },
  '⇄ cambio camera': { background: '#EDE6D6', color: '#5a6b3f' },
}

type RigaCamera = {
  room: any
  shortName: string
  aperte: Pulizia[]                       // pulizie da fare oggi (o in ritardo)
  arrivo: ReturnType<typeof prossimoArrivo>
  priorita: Priorita | null               // la più alta tra le pulizie aperte
  cambioProssimo: { due: string; booking: any } | null // cambio 4 notti nei prossimi giorni (anticipabile)
  prossimo: { date: string; badges: string[]; testo: string } | null
  spiegazione: string[]                   // pannello "perché questa data?"
}

const RANK: Record<Priorita, number> = { urgente: 0, alta: 1, flessibile: 2, nessuna_fretta: 3 }

export default function Pulizie() {
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [events, setEvents] = useState<Decisione[]>([])
  // false = la tabella cleanings non esiste ancora (migrazione 0018 da
  // incollare nell'editor SQL): i pulsanti ripiegano su linen_next_date
  const [tabellaOk, setTabellaOk] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  // Data del campo "Fatta il" per ogni pulizia (default oggi)
  const [fattoIl, setFattoIl] = useState<Record<string, string>>({})
  // Riquadro aperto di Rimanda/Salta: chiave pulizia → { azione, data proposta }
  const [azione, setAzione] = useState<Record<string, { tipo: 'rimanda' | 'salta'; data: string }>>({})
  const [spiegaAperta, setSpiegaAperta] = useState<Record<string, boolean>>({})
  const td = todayStr()

  useEffect(() => {
    let localLinen: Record<string, string> = {}
    try { localLinen = JSON.parse(localStorage.getItem(LOCAL_LINEN_KEY) || '{}') } catch { /* ignora */ }
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(full_name, phone)').neq('status', 'annullata'),
      supabase.from('cleanings').select('*').order('created_at'),
    ]).then(([{ data: r }, { data: b }, ev]) => {
      const sorted = (r || []).sort((a: any, b: any) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      // Le date del vecchio salvataggio locale valgono solo dove la colonna è vuota
      setBookings((b || []).map((x: any) => x.linen_next_date || !localLinen[x.id] ? x : { ...x, linen_next_date: localLinen[x.id] }))
      if (ev.error) setTabellaOk(false)
      else setEvents((ev.data || []) as Decisione[])
      setLoading(false)
    })
  }, [])

  const prenotazioni = useMemo(() => attive(bookings), [bookings])

  const righe: RigaCamera[] = useMemo(() => {
    const shortOf = (id: string) => {
      const r = rooms.find(rr => rr.id === id)
      return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera'
    }
    const out: RigaCamera[] = rooms.map(room => {
      const aperte = pulizieAperte(prenotazioni, room.id, td, events)
      const arrivo = prossimoArrivo(prenotazioni, room.id, td)
      const priorita = aperte.length > 0
        ? aperte.map(p => prioritaDi(p, arrivo)).sort((a, b) => RANK[a] - RANK[b])[0]
        : null

      const inCorso = prenotazioni.find(b => b.room_id === room.id && b.check_in <= td && b.check_out > td) || null
      const ciclo = inCorso ? cicloCambio(prenotazioni, inCorso, events) : null
      const cambioProssimo = ciclo?.due && ciclo.due > td && diffDays(ciclo.due, td) <= GIORNI_PREAVVISO
        ? { due: ciclo.due, booking: inCorso }
        : null

      // Pannello "perché questa data?": la provenienza di ogni numero mostrato
      const spiegazione: string[] = []
      if (inCorso && ciclo) {
        spiegazione.push(`Ciclo 4 notti: ${ciclo.base}`)
        for (const r of ciclo.rinvii) spiegazione.push(`Rimandata dal ${dataBreve(r.data_prevista)} al ${dataBreve(r.prossima_data!)}`)
        spiegazione.push(ciclo.due
          ? `Prossima pulizia calcolata: ${dataBreve(ciclo.due)} · notifica prevista la sera del ${dataBreve(addDaysStr(ciclo.due, -1))}`
          : 'Nessun altro cambio previsto: cadrebbe alla partenza')
      }
      const fsAperta = partenzaAperta(prenotazioni, room.id, td, events)
      if (fsAperta) {
        spiegazione.push(`Fine soggiorno: partenza del ${dataBreve(fsAperta.partenza.check_out)}`)
        for (const r of fsAperta.rinvii) spiegazione.push(`Rimandata dal ${dataBreve(r.data_prevista)} al ${dataBreve(r.prossima_data!)}`)
      }
      if (!tabellaOk) spiegazione.push('Storico non attivo: manca la migrazione 0018 su Supabase')

      // "Prossimi": il primo lavoro futuro previsto in questa camera
      type Ev = { date: string; badge: string | null; testo: string }
      const eventi: Ev[] = []
      if (ciclo?.due && ciclo.due > td) {
        const g = inCorso ? nomeOspite(inCorso) : null
        const rimandata = ciclo.rinvii.length > 0 ? ` · rimandata dal ${dataBreve(ciclo.prevista!)}` : ''
        eventi.push({ date: ciclo.due, badge: 'cambio biancheria', testo: (g ? `${g} resta · solo lenzuola` : 'solo lenzuola') + rimandata })
      }
      if (fsAperta && fsAperta.due > td) {
        eventi.push({
          date: fsAperta.due, badge: 'da pulire',
          testo: `rimandata dal ${dataBreve(fsAperta.partenza.check_out)} · era partito ${nomeOspite(fsAperta.partenza)}`,
        })
      }
      if (inCorso) {
        const { fine } = soggiornoContinuativo(prenotazioni, inCorso)
        const verso = cambioCameraOut(prenotazioni, fine)
        eventi.push({
          date: fine.check_out,
          badge: 'da pulire',
          testo: verso ? `${nomeOspite(fine)} cambia camera → va in ${shortOf(verso.room_id)}` : `parte ${nomeOspite(fine)}`,
        })
      }
      const arrivoFuturo = prenotazioni
        .filter(b => b.room_id === room.id && b.check_in > td && !continuaDa(prenotazioni, b))
        .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
      if (arrivoFuturo) {
        const inCC = cambioCameraIn(prenotazioni, arrivoFuturo)
        eventi.push({
          date: arrivoFuturo.check_in,
          badge: inCC ? '⇄ cambio camera' : null,
          testo: inCC ? `arriva ${nomeOspite(arrivoFuturo)} (⇄ da ${shortOf(inCC.room_id)})` : `arriva ${nomeOspite(arrivoFuturo)}`,
        })
      }
      eventi.sort((a, b) => a.date.localeCompare(b.date))
      let prossimo: RigaCamera['prossimo'] = null
      if (eventi.length > 0) {
        const d0 = eventi[0].date
        const onDay = eventi.filter(e => e.date === d0)
        const badges = Array.from(new Set(onDay.map(e => e.badge).filter(Boolean))) as string[]
        prossimo = { date: d0, badges, testo: onDay.map(e => e.testo).join(' · ') }
      }

      return {
        room,
        shortName: room.name.split(' ').slice(-1)[0],
        aperte, arrivo, priorita, cambioProssimo, prossimo, spiegazione,
      }
    })
    // Oggi: prima le più urgenti; a parità, l'ordine fisso delle camere
    return out.sort((a, b) => (a.priorita ? RANK[a.priorita] : 9) - (b.priorita ? RANK[b.priorita] : 9))
  }, [rooms, prenotazioni, events, td, tabellaOk])

  const righeOggi = righe.filter(r => r.aperte.length > 0)
  const righeProssimi = righe.filter(r => r.aperte.length === 0 && r.prossimo)
  const giorniProssimi = Array.from(new Set(righeProssimi.map(r => r.prossimo!.date))).sort()
  const daRifare = righeOggi.length

  const shortNameOf = (id: string) => {
    const r = rooms.find(rr => rr.id === id)
    return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera'
  }

  const chiave = (roomId: string, tipo: string) => `${roomId}:${tipo}`

  // Registra una decisione nella tabella cleanings. Se la tabella non c'è
  // ancora (migrazione 0018 da incollare a mano), per il cambio 4 notti si
  // ripiega sul vecchio linen_next_date così nulla si blocca.
  async function registra(p: Pulizia, stato: 'fatta' | 'rimandata' | 'saltata', dati: { data_effettiva?: string; prossima_data?: string }) {
    const k = chiave(p.roomId, p.tipo)
    if (saving) return
    setSaving(k)
    const riga: Decisione = {
      room_id: p.roomId,
      booking_id: p.booking.id,
      tipo: p.tipo,
      stato,
      data_prevista: p.due,
      data_effettiva: dati.data_effettiva ?? null,
      prossima_data: dati.prossima_data ?? null,
      cambio_biancheria: stato === 'fatta',
    }
    const { data, error } = await supabase.from('cleanings').insert(riga).select().single()
    if (!error && data) {
      setEvents(ev => [...ev, data as Decisione])
    } else if (p.tipo === 'soggiorno') {
      // Vecchio meccanismo: linen_next_date = prossima scadenza del ciclo
      const next = stato === 'fatta' ? addDaysStr(dati.data_effettiva!, NOTTI_CAMBIO) : dati.prossima_data!
      const { error: e2 } = await supabase.from('bookings').update({ linen_next_date: next }).eq('id', p.booking.id)
      if (!e2) setBookings(bs => bs.map(x => x.id === p.booking.id ? { ...x, linen_next_date: next } : x))
      else alert('Salvataggio non riuscito: controlla la connessione.')
      setTabellaOk(false)
    } else {
      alert('Salvataggio non riuscito: la migrazione 0018 è già stata incollata su Supabase?')
      setTabellaOk(false)
    }
    setAzione(a => { const { [k]: _, ...resto } = a; return resto })
    setSaving(null)
  }

  // Un cambio 4 notti dei prossimi giorni può essere anticipato: si crea una
  // Pulizia "virtuale" con la scadenza futura e la si segna fatta oggi.
  function puliziaDaCambioProssimo(r: RigaCamera): Pulizia {
    return {
      roomId: r.room.id, tipo: 'soggiorno', booking: r.cambioProssimo!.booking,
      prevista: r.cambioProssimo!.due, due: r.cambioProssimo!.due, ritardo: 0, rinvii: [],
    }
  }

  // Pulsanti Fatta / Rimanda / Salta di una pulizia
  const controlli = (p: Pulizia) => {
    const k = chiave(p.roomId, p.tipo)
    const aperta = azione[k]
    const disab = saving === k
    return (
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500">Fatta il</span>
          <input type="date" value={fattoIl[k] || td}
            onChange={e => setFattoIl({ ...fattoIl, [k]: e.target.value })}
            className="border border-card-border rounded-lg px-2 py-1 text-xs bg-white" />
          <button onClick={() => registra(p, 'fatta', { data_effettiva: fattoIl[k] || td })} disabled={disab}
            className="rounded-full text-xs font-bold px-3 py-1.5 text-white disabled:opacity-50"
            style={{ background: '#2D6A4F' }}>
            ✓ Fatta
          </button>
          <button onClick={() => setAzione({ ...azione, [k]: { tipo: 'rimanda', data: addDaysStr(td, 1) } })} disabled={disab}
            className="rounded-full border border-card-border bg-cream text-xs font-bold px-3 py-1.5 disabled:opacity-50"
            style={{ color: '#5a6b3f', opacity: aperta?.tipo === 'rimanda' ? 0.5 : 1 }}>
            Rimanda
          </button>
          {p.tipo === 'soggiorno' && (
            <button onClick={() => setAzione({ ...azione, [k]: { tipo: 'salta', data: addDaysStr(p.due, NOTTI_CAMBIO) } })} disabled={disab}
              className="rounded-full border border-card-border bg-cream text-xs font-bold px-3 py-1.5 disabled:opacity-50"
              style={{ color: '#8a4f2f', opacity: aperta?.tipo === 'salta' ? 0.5 : 1 }}>
              Salta
            </button>
          )}
        </div>
        {aperta && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 rounded-lg p-2" style={{ background: '#F5F1E8' }}>
            <span className="text-xs text-gray-600">
              {aperta.tipo === 'rimanda' ? 'Rimanda al' : 'Salta questa · prossima il'}
            </span>
            <input type="date" value={aperta.data} min={addDaysStr(td, aperta.tipo === 'rimanda' ? 1 : 0)}
              onChange={e => setAzione({ ...azione, [k]: { ...aperta, data: e.target.value } })}
              className="border border-card-border rounded-lg px-2 py-1 text-xs bg-white" />
            <button onClick={() => registra(p, aperta.tipo === 'rimanda' ? 'rimandata' : 'saltata', { prossima_data: aperta.data })} disabled={disab}
              className="rounded-full text-xs font-bold px-3 py-1.5 text-white disabled:opacity-50"
              style={{ background: aperta.tipo === 'rimanda' ? '#5a6b3f' : '#8a4f2f' }}>
              Conferma
            </button>
            <button onClick={() => setAzione(a => { const { [k]: _, ...resto } = a; return resto })} disabled={disab}
              className="text-xs text-gray-500 px-2 py-1.5">
              Annulla
            </button>
          </div>
        )}
      </div>
    )
  }

  // Link + pannello "perché questa data?" di una camera
  const spiega = (r: RigaCamera) => r.spiegazione.length === 0 ? null : (
    <div className="mt-2">
      <button onClick={() => setSpiegaAperta(s => ({ ...s, [r.room.id]: !s[r.room.id] }))}
        className="text-[11px] text-stone underline decoration-dotted underline-offset-2">
        {spiegaAperta[r.room.id] ? 'nascondi il calcolo' : 'perché questa data?'}
      </button>
      {spiegaAperta[r.room.id] && (
        <div className="mt-1.5 rounded-lg p-2.5 text-[11px] leading-relaxed text-stone" style={{ background: '#F5F1E8' }}>
          {r.spiegazione.map((s, i) => <p key={i}>{s}</p>)}
        </div>
      )}
    </div>
  )

  const sezioneTitolo = (titolo: string, sub?: string) => (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-[11px] uppercase text-brass" style={{ letterSpacing: '2px' }}>{titolo}</span>
      {sub && <span className="text-xs text-stone">{sub}</span>}
      <span className="flex-1 h-px" style={{ background: 'var(--color-card-border)' }} />
    </div>
  )

  // Card della sezione "Oggi": la camera ha almeno una pulizia da fare
  const cardOggi = (riga: RigaCamera) => {
    const { room, shortName, aperte, arrivo, priorita } = riga
    const prio = priorita ? PRIORITA_STYLE[priorita] : null
    return (
      <div key={room.id} className="bg-white rounded-[10px] border border-card-border p-4">
        <div className="flex items-start gap-3">
          <span className="font-serif text-sm text-brass pt-0.5">{ROOM_NUMBER_BY_NAME[shortName] || ''}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-lg text-green-dark leading-tight">{shortName}</span>
              <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={badgeStyle['da pulire']}>da pulire</span>
              {prio && (
                <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: prio.background, color: prio.color, letterSpacing: '0.5px' }}>{prio.label}</span>
              )}
            </div>
            <p className="text-[11px] text-stone mt-0.5">{ROOM_DESC_BY_NAME[shortName] || ''}</p>

            {aperte.map(p => (
              <div key={p.tipo} className="mt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.tipo === 'soggiorno' && (
                    <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={badgeStyle['cambio biancheria']}>cambio biancheria</span>
                  )}
                  {p.tipo === 'cambio_camera' && (
                    <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={badgeStyle['⇄ cambio camera']}>⇄ cambio camera</span>
                  )}
                  <span className="text-xs text-stone">
                    {p.tipo === 'soggiorno'
                      ? `${nomeOspite(p.booking)} resta · pulizia 4 notti`
                      : p.tipo === 'cambio_camera'
                        ? `${nomeOspite(p.booking)} va in ${shortNameOf(p.cambioCameraVerso!.room_id)}`
                        : p.prevista === td ? `è partito ${nomeOspite(p.booking)}` : `partenza del ${dataBreve(p.prevista)} · ${nomeOspite(p.booking)}`}
                  </span>
                  {p.ritardo > 0 && (
                    <span className="text-xs font-bold" style={{ color: '#8a4f2f' }}>
                      in ritardo di {p.ritardo} {p.ritardo === 1 ? 'giorno' : 'giorni'}
                    </span>
                  )}
                </div>
                {controlli(p)}
                {p.booking.notes && (
                  <p className="text-sm text-green-mid italic mt-2">“{p.booking.notes}”</p>
                )}
              </div>
            ))}

            <p className="text-sm font-semibold mt-2 flex flex-wrap items-center gap-1.5" style={{ color: 'var(--color-brass)' }}>
              {testoArrivo(arrivo)}
              {arrivo?.cambioDa && (
                <span className="text-xs font-bold rounded-full px-2 py-0.5" style={badgeStyle['⇄ cambio camera']}>⇄ cambio camera da {shortNameOf(arrivo.cambioDa.room_id)}</span>
              )}
            </p>
            {spiega(riga)}
          </div>
        </div>
      </div>
    )
  }

  // Card della sezione "Prossimi": lavoro futuro, sotto l'intestazione del giorno
  const cardProssimo = (riga: RigaCamera) => {
    const { room, shortName, prossimo, cambioProssimo } = riga
    return (
      <div key={room.id} className="bg-white rounded-[10px] border border-card-border p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-xs text-brass">{ROOM_NUMBER_BY_NAME[shortName] || ''}</span>
          <span className="font-serif text-base text-green-dark leading-tight">{shortName}</span>
          {prossimo!.badges.map(b => (
            <span key={b} className="text-xs font-bold rounded-full px-2.5 py-0.5" style={badgeStyle[b] || badgeStyle['cambio biancheria']}>{b}</span>
          ))}
        </div>
        <p className="text-xs mt-1.5" style={{ color: '#41637A' }}>{prossimo!.testo}</p>
        {cambioProssimo && controlli(puliziaDaCambioProssimo(riga))}
        {cambioProssimo?.booking?.notes && (
          <p className="text-sm text-green-mid italic mt-2">“{cambioProssimo.booking.notes}”</p>
        )}
        {spiega(riga)}
      </div>
    )
  }

  return (
    <div className="p-4">
      <BackBar href="/" />

      <h1 className="text-2xl text-green-dark capitalize" style={{ fontFamily: 'Georgia, serif', fontWeight: 600 }}>{italianDate()}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {loading ? ' ' : daRifare === 0 ? 'Nessuna camera da rifare oggi' : daRifare === 1 ? '1 camera da rifare oggi' : `${daRifare} camere da rifare oggi`}
      </p>

      {!loading && !tabellaOk && (
        <div className="rounded-[10px] p-3 mb-4 text-xs" style={{ background: '#F6E4DE', color: '#8C3B2E' }}>
          Lo storico pulizie non è ancora attivo: va incollata la migrazione 0018
          nell&apos;editor SQL di Supabase. Nel frattempo tutto funziona col vecchio sistema.
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <>
          {sezioneTitolo('Oggi')}
          {righeOggi.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-card-border p-5 text-center mb-6">
              <p className="text-green-dark">Nessuna camera da rifare oggi</p>
              <p className="text-xs text-stone mt-0.5">tutto pulito · guarda i prossimi qui sotto</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              {righeOggi.map(riga => cardOggi(riga))}
            </div>
          )}

          {righeProssimi.length > 0 && (
            <>
              {sezioneTitolo('Prossimi', 'domani e oltre')}
              {giorniProssimi.map(g => {
                const h = intestazioneGiorno(g, td)
                return (
                  <div key={g} className="mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-[11px] uppercase" style={{ letterSpacing: '2px', color: '#8a9488' }}>{h.label}</span>
                      {h.sub && <span className="text-xs text-stone">{h.sub}</span>}
                    </div>
                    <div className="flex flex-col gap-3">
                      {righeProssimi.filter(r => r.prossimo!.date === g).map(riga => cardProssimo(riga))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {!loading && <Statistiche rooms={rooms} bookings={prenotazioni} events={events} td={td} />}
    </div>
  )
}
