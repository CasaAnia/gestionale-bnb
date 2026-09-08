'use client'
import { useEffect, useMemo, useState } from 'react'
import Statistiche from './Statistiche'
import { supabase } from '@/lib/supabase'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { nomeOspite } from '@/lib/guestName'
import BackBar from '@/components/BackBar'
import { giornoDaParametro } from '@/lib/daControllare'
import SalvataggiPulizie from '@/components/SalvataggiPulizie'
import ControlliPulizia from '@/components/ControlliPulizia'
import AvvisoAzione from '@/components/AvvisoAzione'
import { raccogliPagine } from '@/lib/statistiche/paginazione'
import { inviaOperazionePulizia } from '@/lib/pulizieServizio'
import { type RispostaPulizia } from '@/lib/pulizieOperazioni'
import {
  confrontaDecisioni, attive, pulizieAperte, prossimoArrivo, prioritaDi, testoArrivo, cicloCambio,
  partenzeAperte, cambioCameraIn, continuaDa, cambioCameraOut,
  soggiornoContinuativo, todayStr, diffDays, cronologiaCamera,
  pulizieAutomatiche, conteggioGiorno, GIORNI_PREAVVISO, NOTA_AUTOMATICA_CORRETTA, NOTA_AUTOMATICA_TOLTA,
  type PrenotazionePulizie, type CameraPulizie, type Pulizia, type Priorita, type Decisione, type VoceCronologia, type PuliziaAutomatica, type TipoPulizia,
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
// Stile editoriale (06/09/2026): pillole col solo contorno, stesso colore del testo
const PRIORITA_STYLE: Record<Priorita, { label: string; background: string; color: string; border: string }> = {
  urgente: { label: 'URGENTE', background: 'transparent', color: '#7a3a1d', border: '1px solid #C9A791' },
  alta: { label: 'ALTA', background: 'transparent', color: '#8a4f2f', border: '1px solid #D9BFA8' },
  flessibile: { label: 'FLESSIBILE', background: 'transparent', color: '#2D6A4F', border: '1px solid #B7CDBD' },
  nessuna_fretta: { label: 'NESSUNA FRETTA', background: 'transparent', color: '#7A7466', border: '1px solid #C9BFA8' },
}

const badgeStyle: Record<string, { background: string; color: string; border: string }> = {
  'da pulire': { background: 'transparent', color: '#8a4f2f', border: '1px solid #D9BFA8' },
  'cambio biancheria': { background: 'transparent', color: '#5a6b3f', border: '1px solid #C9BFA8' },
  '⇄ cambio camera': { background: 'transparent', color: '#5a6b3f', border: '1px solid #C9BFA8' },
  // pulizia registrata da sola al cambio ospite (regola del 04/09/2026)
  automatica: { background: 'transparent', color: '#7a5f2c', border: '1px solid #D8C89E' },
}

const TIPO_LABEL: Record<TipoPulizia, string> = { fine_soggiorno: 'fine soggiorno', soggiorno: 'cambio biancheria', cambio_camera: 'cambio camera' }
// Quante righe mostra il registro «Ultime pulizie»
const RIGHE_REGISTRO = 12

// Una riga del registro: pulizia segnata a mano (tabella cleanings) oppure
// automatica (calcolata dalle prenotazioni, correggibile)
type VoceRegistro = { chiave: string; data: string; roomId: string; tipo: TipoPulizia; ospite: string; auto: PuliziaAutomatica | null; evento?: Decisione }

type RigaCamera = {
  room: CameraPulizie
  shortName: string
  aperte: Pulizia[]                       // pulizie da fare oggi (o in ritardo)
  arrivo: ReturnType<typeof prossimoArrivo>
  priorita: Priorita | null               // la più alta tra le pulizie aperte
  cambioProssimo: { due: string; booking: PrenotazionePulizie } | null // cambio 4 notti nei prossimi giorni (anticipabile)
  prossimo: { date: string; badges: string[]; testo: string } | null
  cronologia: VoceCronologia[]            // pannello "perché questa data?"
}

const RANK: Record<Priorita, number> = { urgente: 0, alta: 1, flessibile: 2, nessuna_fretta: 3 }

export default function Pulizie() {
  const [rooms, setRooms] = useState<CameraPulizie[]>([])
  const [bookings, setBookings] = useState<PrenotazionePulizie[]>([])
  const [events, setEvents] = useState<Decisione[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [rilettura, setRilettura] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [spiegaAperta, setSpiegaAperta] = useState<Record<string, boolean>>({})
  // Correzione di un'automatica nel registro: chiave → data scelta per «cambia data»
  const [correzione, setCorrezione] = useState<Record<string, string>>({})
  const td = todayStr()
  // Dalla striscia della settimana in Home (07/09/2026): ?giorno=AAAA-MM-GG
  // porta al blocco di quel giorno (Oggi o uno dei Prossimi); senza blocco
  // (nessuna pulizia quel giorno) la pagina resta in cima
  useEffect(() => {
    if (loading) return
    const giorno = giornoDaParametro(window.location.search)
    if (!giorno) return
    document.getElementById(`pulizie-giorno-${giorno}`)?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [loading])

  useEffect(() => {
    let viva = true
    let localLinen: Record<string, string> = {}
    try { localLinen = JSON.parse(localStorage.getItem(LOCAL_LINEN_KEY) || '{}') } catch { /* solo vecchie date */ }
    Promise.all([
      raccogliPagine<CameraPulizie>((o, n) => supabase.from('rooms').select('*').order('id').range(o, o + n - 1)),
      raccogliPagine<PrenotazionePulizie>((o, n) => supabase.from('bookings').select('*, guests(full_name, phone)').neq('status', 'annullata').order('id').range(o, o + n - 1)),
      raccogliPagine<Decisione>((o, n) => supabase.from('cleanings').select('*').order('created_at').order('id').range(o, o + n - 1)),
    ]).then(([r, b, ev]) => {
      if (!viva) return
      if (r.error || b.error || ev.error) { setErrore('Non riesco a leggere tutte le pulizie. Riprova.'); setLoading(false); return }
      setRooms(r.data.sort((a, b) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o)), bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      }))
      setBookings(b.data.map(x => x.linen_next_date || !localLinen[x.id] ? x : { ...x, linen_next_date: localLinen[x.id] }))
      setEvents(ev.data); setLoading(false)
    }).catch(() => { if (viva) { setErrore('Non riesco a leggere tutte le pulizie. Riprova.'); setLoading(false) } })
    return () => { viva = false }
  }, [rilettura])

  const prenotazioni = useMemo(() => attive(bookings), [bookings])
  const ultimaId = (camera: string) => events.filter(e => e.room_id === camera).sort((a, b) => confrontaDecisioni(b, a))[0]?.id ?? null
  function ricaricaPagina() { setLoading(true); setErrore(null); setRilettura(x => x + 1) }
  function aggiornato(r: RispostaPulizia) {
    setEvents(ev => [...ev.filter(e => e.id !== r.pulizia.id), r.pulizia])
    ricaricaPagina()
  }

  const righe: RigaCamera[] = useMemo(() => {
    const shortOf = (id: string) => {
      const r = rooms.find(rr => rr.id === id)
      return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera'
    }
    const out: RigaCamera[] = rooms.filter(room => room.active !== false).map(room => {
      const aperte = pulizieAperte(prenotazioni, room.id, td, events)
      const arrivo = prossimoArrivo(prenotazioni, room.id, td)
      const priorita = aperte.length > 0
        ? aperte.map(p => prioritaDi(p, arrivo)).sort((a, b) => RANK[a] - RANK[b])[0]
        : null

      const inCorso = prenotazioni.find(b => b.room_id === room.id && b.check_in <= td && b.check_out > td) || null
      const ciclo = inCorso ? cicloCambio(prenotazioni, inCorso, events) : null
      const cambioProssimo = inCorso && ciclo?.due && ciclo.due > td && diffDays(ciclo.due, td) <= GIORNI_PREAVVISO
        ? { due: ciclo.due, booking: inCorso }
        : null

      // Pannello "perché questa data?": la cronologia completa del soggiorno,
      // con la distinzione netta tra eventi reali, date ricostruite dal
      // vecchio sistema e prossima scadenza calcolata (lib/pulizie.ts)
      const cronologia = cronologiaCamera(prenotazioni, room.id, td, events, rooms)
      const partenze = partenzeAperte(prenotazioni, room.id, td, events)

      // "Prossimi": il primo lavoro futuro previsto in questa camera
      type Ev = { date: string; badge: string | null; testo: string }
      const eventi: Ev[] = []
      if (ciclo?.due && ciclo.due > td) {
        const g = inCorso ? nomeOspite(inCorso) : null
        const rimandata = ciclo.rinvii.length > 0 ? ` · rimandata dal ${dataBreve(ciclo.prevista!)}` : ''
        eventi.push({ date: ciclo.due, badge: 'cambio biancheria', testo: (g ? `${g} resta · solo lenzuola` : 'solo lenzuola') + rimandata })
      }
      for (const fsAperta of partenze.filter(p => p.due > td)) {
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
        aperte, arrivo, priorita, cambioProssimo, prossimo, cronologia,
      }
    })
    // Oggi: prima le più urgenti; a parità, l'ordine fisso delle camere
    return out.sort((a, b) => (a.priorita ? RANK[a.priorita] : 9) - (b.priorita ? RANK[b.priorita] : 9))
  }, [rooms, prenotazioni, events, td])

  // Registro «Ultime pulizie»: segnate a mano + automatiche dei cambi ospite,
  // le più recenti in alto. Le automatiche portano l'etichetta e i comandi
  // per correggerle (data diversa, oppure «non fatta»).
  const registro: VoceRegistro[] = useMemo(() => {
    const voci: VoceRegistro[] = []
    for (const e of events) {
      if (e.stato !== 'fatta') continue
      const b = e.booking_id ? bookings.find(x => x.id === e.booking_id) : null
      voci.push({ chiave: `m:${e.id ?? `${e.room_id}:${e.data_prevista}`}`, data: e.data_effettiva || e.data_prevista, roomId: e.room_id, tipo: e.tipo, ospite: b ? nomeOspite(b) : '', auto: null, evento: e })
    }
    for (const a of pulizieAutomatiche(prenotazioni, events, td)) {
      voci.push({ chiave: `a:${a.partenza.id}`, data: a.data, roomId: a.roomId, tipo: a.tipo, ospite: nomeOspite(a.partenza), auto: a })
    }
    return voci.sort((x, y) => y.data.localeCompare(x.data) || x.chiave.localeCompare(y.chiave)).slice(0, RIGHE_REGISTRO)
  }, [events, bookings, prenotazioni, td])

  const righeOggi = righe.filter(r => r.aperte.length > 0)
  const righeProssimi = righe.filter(r => r.aperte.length === 0 && r.prossimo)
  const giorniProssimi = Array.from(new Set(righeProssimi.map(r => r.prossimo!.date))).sort()
  // Stesso numero della striscia in Home (lib/pulizie.conteggioGiorno, 08/09/2026):
  // le camere con pulizie ancora da fare oggi (automatiche comprese: sono
  // lavoro della giornata finché non sono segnate, come le righe qui sotto)
  const daRifare = conteggioGiorno(rooms, prenotazioni, events, td, td).daFare

  const shortNameOf = (id: string) => {
    const r = rooms.find(rr => rr.id === id)
    return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera'
  }

  async function registra(p: Pulizia, stato: 'fatta' | 'saltata', dati: { data_effettiva?: string; prossima_data?: string }, note: string): Promise<Decisione | null> {
    if (saving) return null
    setSaving(p.roomId)
    const riga: Decisione = { room_id: p.roomId, booking_id: p.booking.id, tipo: p.tipo, stato,
      data_prevista: p.due, data_effettiva: dati.data_effettiva ?? null, prossima_data: dati.prossima_data ?? null,
      cambio_biancheria: stato === 'fatta', note, persone_servite: Number(p.booking.num_guests) || null }
    const r = await inviaOperazionePulizia(p.roomId, { azione: 'registra', ultima_id: ultimaId(p.roomId), pulizia: riga, recupero: null })
    setSaving(null)
    if (r.errore) { setErrore(r.errore); return null }
    if (r.risposta) aggiornato(r.risposta)
    return r.risposta?.pulizia ?? null
  }

  // Correzione di un'automatica: si scrive nella tabella cleanings una riga
  // legata alla partenza (con la nota), che da quel momento comanda al posto
  // del calcolo automatico. «Cambia data» = fatta a mano nella data scelta;
  // «Non fatta» = la pulizia non c'è stata (non conta nelle statistiche).
  function puliziaDaAutomatica(a: PuliziaAutomatica): Pulizia {
    return { roomId: a.roomId, tipo: a.tipo, booking: a.partenza, prevista: a.data, due: a.data, ritardo: 0, rinvii: [] }
  }
  async function correggiAutomatica(v: VoceRegistro, modo: 'data' | 'tolta') {
    if (!v.auto) return
    if (modo === 'data') await registra(puliziaDaAutomatica(v.auto), 'fatta', { data_effettiva: correzione[v.chiave] || v.data }, NOTA_AUTOMATICA_CORRETTA)
    else await registra(puliziaDaAutomatica(v.auto), 'saltata', {}, NOTA_AUTOMATICA_TOLTA)
    setCorrezione(c => { const resto = { ...c }; delete resto[v.chiave]; return resto })
  }

  // Un cambio 4 notti dei prossimi giorni può essere anticipato: si crea una
  // Pulizia "virtuale" con la scadenza futura e la si segna fatta oggi.
  function puliziaDaCambioProssimo(r: RigaCamera): Pulizia {
    return {
      roomId: r.room.id, tipo: 'soggiorno', booking: r.cambioProssimo!.booking,
      prevista: r.cambioProssimo!.due, due: r.cambioProssimo!.due, ritardo: 0, rinvii: [],
    }
  }

  const controlli = (p: Pulizia) => <ControlliPulizia
    key={`${p.roomId}:${p.booking.id}:${p.tipo}:${p.due}`} camera={shortNameOf(p.roomId)} oggi={td}
    pulizia={{ room_id: p.roomId, booking_id: p.booking.id, tipo: p.tipo, stato: 'fatta', data_prevista: p.due }}
    ultimaId={ultimaId(p.roomId)} persone={Number(p.booking.num_guests) || null} scegliData
    partenza={p.tipo === 'soggiorno' ? soggiornoContinuativo(prenotazioni, p.booking).fine.check_out : undefined}
    onSalvato={aggiornato} />

  // Stili dei tre registri della cronologia: un evento reale, una data
  // ricostruita dal vecchio sistema e una scadenza futura non si devono
  // poter confondere nemmeno a colpo d'occhio.
  const pallino = (registro: VoceCronologia['registro']) =>
    registro === 'reale'
      ? { background: '#2D6A4F' }
      : registro === 'futura'
        ? { background: '#A98A56' }
        : { background: 'transparent', border: '1.5px solid #B4AC9C' }

  // Link + pannello "perché questa data?" di una camera: la cronologia
  // completa del soggiorno, solo su richiesta (le card restano leggere)
  const spiega = (r: RigaCamera) => r.cronologia.length === 0 ? null : (
    <div className="mt-2">
      <button onClick={() => setSpiegaAperta(s => ({ ...s, [r.room.id]: !s[r.room.id] }))}
        className="text-[11px] text-stone underline decoration-dotted underline-offset-2">
        {spiegaAperta[r.room.id] ? 'nascondi la cronologia' : 'perché questa data?'}
      </button>
      {spiegaAperta[r.room.id] && (
        <div className="mt-1.5 rounded-lg p-3 text-[11px] leading-relaxed" style={{ background: '#F5F1E8' }}>
          {r.cronologia.map((v, i) => (
            <div key={i} className="flex items-baseline gap-2 mb-1.5 last:mb-0">
              <span className="shrink-0 w-2 h-2 rounded-full translate-y-px" style={pallino(v.registro)} />
              <span className="shrink-0 font-semibold text-green-dark" style={{ fontVariantNumeric: 'tabular-nums' }}>{dataBreve(v.data)}</span>
              <span className={v.registro === 'ricostruita' ? 'italic text-stone' : v.registro === 'futura' ? 'text-brass' : 'text-green-dark'}>
                {v.testo}
              </span>
            </div>
          ))}
          <p className="mt-2 pt-2 text-[10px] text-stone" style={{ borderTop: '1px solid #E5DCCB' }}>
            <span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={pallino('reale')} />registrato
            <span className="inline-block w-2 h-2 rounded-full align-middle ml-2.5 mr-1" style={pallino('ricostruita')} />ricostruito, esito ignoto
            <span className="inline-block w-2 h-2 rounded-full align-middle ml-2.5 mr-1" style={pallino('futura')} />previsto
          </p>
        </div>
      )}
    </div>
  )

  const sezioneTitolo = (titolo: string, sub?: string) => (
    <div className="ed-sezione mb-2.5">{titolo}{sub && <small>{sub}</small>}</div>
  )

  // Card della sezione "Oggi": la camera ha almeno una pulizia da fare
  const cardOggi = (riga: RigaCamera) => {
    const { room, shortName, aperte, arrivo, priorita } = riga
    const prio = priorita ? PRIORITA_STYLE[priorita] : null
    return (
      <div key={room.id} className="ed-riga py-4">
        <div className="flex items-start gap-3">
          <span className="font-serif text-sm text-brass pt-0.5">{ROOM_NUMBER_BY_NAME[shortName] || ''}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-xl text-green-dark leading-tight">{shortName}</span>
              <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={badgeStyle['da pulire']}>da pulire</span>
              {prio && (
                <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: prio.background, color: prio.color, border: prio.border, letterSpacing: '0.5px' }}>{prio.label}</span>
              )}
            </div>
            <p className="text-[11px] text-stone mt-0.5">{ROOM_DESC_BY_NAME[shortName] || ''}</p>

            {aperte.map(p => (
              <div key={`${p.tipo}:${p.booking.id}:${p.due}`} className="mt-2">
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
                  {p.automatica && (
                    <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={badgeStyle.automatica}>automatica</span>
                  )}
                </div>
                {p.automatica ? (
                  <p className="text-xs text-stone mt-1.5">
                    Cambio ospite: la pulizia è registrata da sola con la data di oggi, non c&apos;è nulla da segnare.
                    Se serve la correggi nel registro «Ultime pulizie» qui sotto.
                  </p>
                ) : controlli(p)}
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
      <div key={room.id} className="ed-riga py-3.5">
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

      <h1 className="ed-titolo capitalize">{italianDate()}</h1>
      <p className="ed-sotto mt-2 mb-5">
        {loading || errore ? ' ' : daRifare === 0 ? 'Nessuna camera da rifare oggi' : daRifare === 1 ? '1 camera da rifare oggi' : `${daRifare} camere da rifare oggi`}
      </p>

      <SalvataggiPulizie onVerificato={ricaricaPagina} />
      {errore && <AvvisoAzione testo={errore} onRiprova={ricaricaPagina} className="my-4" />}
      {loading || errore ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <>
          <div id={`pulizie-giorno-${td}`} className="scroll-mt-20" />
          {sezioneTitolo('Oggi')}
          {righeOggi.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-card-border p-5 text-center mb-6">
              <p className="text-green-dark">Nessuna camera da rifare oggi</p>
              <p className="text-xs text-stone mt-0.5">tutto pulito · guarda i prossimi qui sotto</p>
            </div>
          ) : (
            <div className="mb-6">
              {righeOggi.map(riga => cardOggi(riga))}
            </div>
          )}

          {righeProssimi.length > 0 && (
            <>
              {sezioneTitolo('Prossimi', 'domani e oltre')}
              {giorniProssimi.map(g => {
                const h = intestazioneGiorno(g, td)
                // Camere con un lavoro quel giorno: lo stesso numero della striscia in Home
                const c = conteggioGiorno(rooms, prenotazioni, events, g, td)
                const n = c.daFare
                return (
                  <div key={g} id={`pulizie-giorno-${g}`} className="mb-4 scroll-mt-20" data-camere-giorno={n} data-fatte-giorno={c.fatte}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-[11px] uppercase" style={{ letterSpacing: '2px', color: 'var(--color-brass)' }}>{h.label}</span>
                      {h.sub && <span className="text-xs text-stone">{h.sub}</span>}
                      {n > 0 ? <span className="text-xs text-stone">· {n === 1 ? '1 camera da fare' : `${n} camere da fare`}</span> : c.fatte > 0 ? <span className="text-xs text-stone">· tutte fatte ✓</span> : null}
                    </div>
                    <div>
                      {righeProssimi.filter(r => r.prossimo!.date === g).map(riga => cardProssimo(riga))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {!loading && !errore && registro.length > 0 && (
        <div className="mt-6">
          {sezioneTitolo('Ultime pulizie', 'segnate da te e automatiche')}
          <div>
            {registro.map(v => {
              const nome = shortNameOf(v.roomId)
              const disab = !!saving
              const aperta = correzione[v.chiave] !== undefined
              return (
                <div key={v.chiave} className="ed-riga py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                    <span className="font-semibold text-green-dark shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{dataBreve(v.data)}</span>
                    <span className="font-serif text-green-dark">{nome}</span>
                    <span className="text-xs text-stone">{TIPO_LABEL[v.tipo]}{v.ospite ? ` · ${v.ospite}` : ''}</span>
                    {v.auto && <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={badgeStyle.automatica}>automatica</span>}
                  </div>
                  {v.evento?.id && <ControlliPulizia camera={nome} oggi={td} pulizia={v.evento} ultimaId={ultimaId(v.roomId)}
                    persone={v.evento.persone_servite ?? (Number(bookings.find(b => b.id === v.evento?.booking_id)?.num_guests) || null)} onSalvato={aggiornato} />}
                  {v.auto && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {aperta ? (
                        <>
                          <span className="text-xs text-stone">Fatta il</span>
                          <input type="date" value={correzione[v.chiave]} max={td}
                            onChange={e => setCorrezione({ ...correzione, [v.chiave]: e.target.value })}
                            className="ed-campo text-xs py-1" />
                          <button onClick={() => correggiAutomatica(v, 'data')} disabled={disab || !correzione[v.chiave]}
                            className="ed-pillola disabled:opacity-50" style={{ background: '#2D6A4F' }}>Conferma</button>
                          <button onClick={() => setCorrezione(c => { const resto = { ...c }; delete resto[v.chiave]; return resto })} disabled={disab}
                            className="text-xs text-gray-500 px-2 py-1.5">Annulla</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setCorrezione({ ...correzione, [v.chiave]: v.data })} disabled={disab}
                            className="ed-pillola-tenue disabled:opacity-50" style={{ color: '#5a6b3f' }}>Cambia data</button>
                          <button onClick={() => correggiAutomatica(v, 'tolta')} disabled={disab}
                            className="ed-pillola-tenue disabled:opacity-50" style={{ color: '#8a4f2f' }}>Non fatta</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-stone mt-2 leading-relaxed">
            Le automatiche precedenti all’8 settembre sono stime del vecchio sistema, ricostruite dalle prenotazioni. Le nuove pulizie richiedono la tua conferma.
          </p>
        </div>
      )}

      {!loading && !errore && <Statistiche rooms={rooms} bookings={prenotazioni} events={events} td={td} />}

    </div>
  )
}
