'use client'
import { useEffect, useMemo, useState } from 'react'
import Statistiche from './Statistiche'
import { supabase } from '@/lib/supabase'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import BackLink from '@/components/BackLink'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

// Ogni quante notti di permanenza va rifatta la biancheria
const NOTTI_CAMBIO = 4
// Con quanti giorni di anticipo mostrare il prossimo cambio (per poterlo anticipare)
const GIORNI_PREAVVISO = 2

// Salvataggio locale usato quando la colonna linen_next_date
// non esiste ancora su Supabase (migrazione 0005 da eseguire a mano)
const LOCAL_LINEN_KEY = 'pulizie_linen_dates'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysStr(s: string, n: number) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Giorni da b a a (positivo se a è nel futuro rispetto a b)
function diffDays(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime()) / 86400000)
}

function italianDate() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Intestazione di un gruppo di giorni nella sezione "Prossimi":
// "Domani" / "Dopodomani" con la data per esteso, o solo la data se più lontano.
function intestazioneGiorno(date: string, td: string) {
  const diff = diffDays(date, td)
  const [y, m, d] = date.split('-').map(Number)
  const full = new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  if (diff === 1) return { label: 'Domani', sub: full }
  if (diff === 2) return { label: 'Dopodomani', sub: full }
  return { label: full.charAt(0).toUpperCase() + full.slice(1), sub: '' }
}

type Cambio = { booking: any; due: string }

// Prolungamenti: stesso ospite, stessa camera, date contigue = un unico soggiorno
// (es. prenotazione separata per distinguere il pagamento). Il confine tra le due
// prenotazioni non è una partenza né un arrivo, e il conteggio delle 4 notti
// non riparte. Il cambio camera invece resta un soggiorno nuovo (biancheria fresca).
function continuaIn(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && x.room_id === b.room_id && b.guest_id && x.guest_id === b.guest_id && x.check_in === b.check_out) || null
}
function continuaDa(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && x.room_id === b.room_id && b.guest_id && x.guest_id === b.guest_id && x.check_out === b.check_in) || null
}

// Cambio camera: stesso ospite che lo stesso giorno si sposta in un'altra camera.
// In uscita = parte da questa camera e riappare altrove; in entrata = arriva qui da un'altra.
// Il badge "⇄ cambio camera" segnala SOLO chi arriva: chi parte per spostarsi lascia
// comunque la camera "da pulire" (senza fretta, non entra subito un altro ospite).
function cambioCameraOut(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && b.guest_id && x.guest_id === b.guest_id && x.check_in === b.check_out && x.room_id !== b.room_id) || null
}
function cambioCameraIn(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && b.guest_id && x.guest_id === b.guest_id && x.check_out === b.check_in && x.room_id !== b.room_id) || null
}

type RigaCamera = {
  room: any
  shortName: string
  daPulire: boolean
  occupata: boolean          // c'è un ospite che soggiorna ora (né da pulire né vuota)
  partenza: any | null       // check-out di oggi: la camera va rifatta (sempre, cambia l'ospite)
  cambio: Cambio | null      // cambio biancheria dovuto (oggi o in ritardo)
  cambioProssimo: Cambio | null // cambio in arrivo nei prossimi giorni (spostabile/anticipabile)
  arrivo: any | null         // prenotazione che arriva oggi nella stessa camera
  arrivoCC: any | null       // se chi arriva oggi fa un cambio camera: prenotazione di provenienza
  partenzaCC: any | null     // se chi parte oggi fa un cambio camera: prenotazione di destinazione
  prossimo: { date: string; badges: string[]; testo: string } | null // primo lavoro futuro: giorno, etichette e testo
}

export default function Pulizie() {
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [localLinen, setLocalLinen] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  // Data scelta a mano per "cambio fatto il" (per camera; default oggi)
  const [fattoIl, setFattoIl] = useState<Record<string, string>>({})
  const td = todayStr()

  useEffect(() => {
    try { setLocalLinen(JSON.parse(localStorage.getItem(LOCAL_LINEN_KEY) || '{}')) } catch { /* ignora */ }
    Promise.all([
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, guests(full_name, phone)').neq('status', 'annullata'),
    ]).then(([{ data: r }, { data: b }]) => {
      const sorted = (r || []).sort((a: any, b: any) => {
        const ai = ROOM_ORDER.findIndex(o => a.name.includes(o))
        const bi = ROOM_ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      setBookings(b || [])
      setLoading(false)
    })
  }, [])

  const righe: RigaCamera[] = useMemo(() => {
    const shortOf = (id: string) => {
      const r = rooms.find(rr => rr.id === id)
      return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera'
    }
    const out: RigaCamera[] = rooms.map(room => {
      // Check-out di oggi: la camera va rifatta. La pulizia al cambio ospite è
      // obbligatoria, quindi non si chiede più conferma: domani si considera fatta.
      // I confini dei prolungamenti (l'ospite continua) non contano.
      const partenzaOggi = bookings.find(b => b.room_id === room.id && b.check_out === td && !continuaIn(bookings, b)) || null

      // Cambio biancheria: ospite in corso (non parte oggi), ogni NOTTI_CAMBIO notti
      // dall'inizio del soggiorno continuativo in questa camera (prolungamenti inclusi),
      // oppure dalla data spostata/segnata (linen_next_date)
      const inCorso = bookings.find(b => b.room_id === room.id && b.check_in <= td && b.check_out > td) || null
      let cambio: Cambio | null = null
      let cambioProssimo: Cambio | null = null
      let dueFuturo: string | null = null
      if (inCorso) {
        // Ricostruisce il soggiorno continuativo: indietro fino al primo segmento,
        // avanti fino all'ultimo (prolungamenti già prenotati)
        let inizio = inCorso
        const tratto = [inCorso]
        for (let prev = continuaDa(bookings, inizio); prev; prev = continuaDa(bookings, prev)) { inizio = prev; tratto.push(prev) }
        let fine = inCorso
        for (let next = continuaIn(bookings, fine); next; next = continuaIn(bookings, next)) { fine = next; tratto.push(next) }
        // Data salvata: prima quella del segmento corrente (è dove scriviamo),
        // poi quella dei segmenti precedenti (cambio segnato prima del prolungamento)
        const salvata = inCorso.linen_next_date ?? localLinen[inCorso.id]
          ?? tratto.map(b => b.linen_next_date ?? localLinen[b.id]).filter(Boolean).sort().slice(-1)[0]
        const due = salvata ?? addDaysStr(inizio.check_in, NOTTI_CAMBIO)
        if (due < fine.check_out) {
          if (due <= td) cambio = { booking: inCorso, due }
          else {
            dueFuturo = due
            if (diffDays(due, td) <= GIORNI_PREAVVISO) cambioProssimo = { booking: inCorso, due }
          }
        }
      }

      // Arrivo di oggi: solo se è un ospite nuovo per questa camera (non un prolungamento)
      const arrivo = bookings.find(b => b.room_id === room.id && b.check_in === td && !continuaDa(bookings, b)) || null
      const arrivoCC = arrivo ? cambioCameraIn(bookings, arrivo) : null
      const partenzaCC = partenzaOggi ? cambioCameraOut(bookings, partenzaOggi) : null

      // "Prossimi": il primo lavoro futuro previsto in questa camera, con le etichette
      // (da pulire / cambio biancheria / ⇄ cambio camera) e un testo che spiega cosa succede.
      type Ev = { date: string; badge: string | null; testo: string }
      const eventi: Ev[] = []
      if (dueFuturo && dueFuturo > td) {
        const g = inCorso?.guests?.full_name
        eventi.push({ date: dueFuturo, badge: 'cambio biancheria', testo: g ? `${g} resta · solo lenzuola` : 'solo lenzuola' })
      }
      if (inCorso) {
        let fineSoggiorno = inCorso
        for (let next = continuaIn(bookings, fineSoggiorno); next; next = continuaIn(bookings, next)) fineSoggiorno = next
        const out = cambioCameraOut(bookings, fineSoggiorno)
        const nome = fineSoggiorno.guests?.full_name || 'l’ospite'
        // Partenza: sempre "da pulire". Se l'ospite fa cambio camera, niente badge ⇄
        // (il badge è di chi arriva); qui basta il testo che spiega dove va.
        eventi.push({
          date: fineSoggiorno.check_out,
          badge: 'da pulire',
          testo: out ? `${nome} cambia camera → va in ${shortOf(out.room_id)}` : `parte ${nome}`,
        })
      }
      const arrivoFuturo = bookings
        .filter(b => b.room_id === room.id && b.check_in > td && !continuaDa(bookings, b))
        .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
      if (arrivoFuturo) {
        const inCC = cambioCameraIn(bookings, arrivoFuturo)
        const nome = arrivoFuturo.guests?.full_name || 'un ospite'
        eventi.push({
          date: arrivoFuturo.check_in,
          badge: inCC ? '⇄ cambio camera' : null,
          testo: inCC ? `arriva ${nome} (⇄ da ${shortOf(inCC.room_id)})` : `arriva ${nome}`,
        })
      }
      eventi.sort((a, b) => a.date.localeCompare(b.date))
      let prossimo: { date: string; badges: string[]; testo: string } | null = null
      if (eventi.length > 0) {
        const d0 = eventi[0].date
        const onDay = eventi.filter(e => e.date === d0)
        const badges = Array.from(new Set(onDay.map(e => e.badge).filter(Boolean))) as string[]
        prossimo = { date: d0, badges, testo: onDay.map(e => e.testo).join(' · ') }
      }

      return {
        room,
        shortName: room.name.split(' ').slice(-1)[0],
        daPulire: !!partenzaOggi || !!cambio,
        occupata: !!inCorso,
        partenza: partenzaOggi,
        cambio,
        cambioProssimo,
        arrivo,
        arrivoCC,
        partenzaCC,
        prossimo,
      }
    })
    // Prima le "da pulire con arrivo oggi", poi le "da pulire", poi le camere con
    // qualcosa in arrivo entro domani (cambio, partenza o arrivo), infine le altre
    const rank = (r: RigaCamera) => (
      r.daPulire && r.arrivo ? 0
      : r.daPulire ? 1
      : r.cambioProssimo || (r.prossimo && diffDays(r.prossimo.date, td) <= 1) ? 2
      : 3
    )
    return out.sort((a, b) => rank(a) - rank(b))
  }, [rooms, bookings, localLinen, td])

  // Due sezioni: "Oggi" (da fare adesso) e "Prossimi" (domani e oltre, raggruppati per giorno)
  const righeOggi = righe.filter(r => r.daPulire)
  const righeProssimi = righe.filter(r => !r.daPulire && r.prossimo)
  const giorniProssimi = Array.from(new Set(righeProssimi.map(r => r.prossimo!.date))).sort()
  const daRifare = righeOggi.length

  // Nome breve di una camera dal suo id (per i cambi camera: provenienza/destinazione)
  const shortNameOf = (id: string) => {
    const r = rooms.find(rr => rr.id === id)
    return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera'
  }

  // Colori dei badge azione (coerenti con l'identità del gestionale)
  const badgeStyle: Record<string, { background: string; color: string }> = {
    'da pulire': { background: '#EFD9C7', color: '#8a4f2f' },
    'cambio biancheria': { background: '#EDE6D6', color: '#5a6b3f' },
    '⇄ cambio camera': { background: '#EDE6D6', color: '#5a6b3f' },
  }

  // Salva la data del prossimo cambio biancheria (con fallback locale se la colonna manca)
  async function salvaCambio(bookingId: string, date: string) {
    const { error } = await supabase.from('bookings').update({ linen_next_date: date }).eq('id', bookingId)
    if (error) {
      const next = { ...localLinen, [bookingId]: date }
      setLocalLinen(next)
      try { localStorage.setItem(LOCAL_LINEN_KEY, JSON.stringify(next)) } catch { /* ignora */ }
    } else {
      setBookings(bs => bs.map(x => x.id === bookingId ? { ...x, linen_next_date: date } : x))
    }
  }

  // Cambio fatto in una data scelta a mano: il conteggio delle 4 notti riparte da lì
  async function cambioFatto(riga: RigaCamera) {
    const c = riga.cambio || riga.cambioProssimo
    if (!c || saving) return
    setSaving(riga.room.id)
    await salvaCambio(c.booking.id, addDaysStr(fattoIl[riga.room.id] || td, NOTTI_CAMBIO))
    setSaving(null)
  }

  // Cambio non fatto (es. l'ospite rifiuta): si salta e se ne riparla fra 4 notti
  async function saltaCambio(riga: RigaCamera) {
    const c = riga.cambio || riga.cambioProssimo
    if (!c || saving) return
    setSaving(riga.room.id)
    await salvaCambio(c.booking.id, addDaysStr(c.due, NOTTI_CAMBIO))
    setSaving(null)
  }

  // Comandi cambio biancheria (data + Salva + salta): compaiono dove c'è un cambio da gestire
  const linenControls = (riga: RigaCamera) => {
    if (!riga.cambio && !riga.cambioProssimo) return null
    const room = riga.room
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-xs text-gray-500">Fatto il</span>
        <input type="date" value={fattoIl[room.id] || td}
          onChange={e => setFattoIl({ ...fattoIl, [room.id]: e.target.value })}
          className="border border-card-border rounded-lg px-2 py-1 text-xs bg-white" />
        <button onClick={() => cambioFatto(riga)} disabled={saving === room.id}
          className="rounded-full text-xs font-semibold px-3 py-1.5 text-white disabled:opacity-50"
          style={{ background: '#2D6A4F' }}>
          ✓ Salva
        </button>
        <button onClick={() => saltaCambio(riga)} disabled={saving === room.id}
          className="rounded-full border border-card-border bg-cream text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
          style={{ color: '#8a4f2f' }}>
          Non fatto, salta
        </button>
      </div>
    )
  }

  // Divisorio di sezione ("Oggi", "Prossimi") — etichetta identica alla Home (ottone)
  const sezioneTitolo = (titolo: string, sub?: string) => (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-[11px] uppercase text-brass" style={{ letterSpacing: '2px' }}>{titolo}</span>
      {sub && <span className="text-xs text-stone">{sub}</span>}
      <span className="flex-1 h-px" style={{ background: 'var(--color-card-border)' }} />
    </div>
  )

  // Card della sezione "Oggi": la camera va rifatta adesso
  const cardOggi = (riga: RigaCamera) => {
    const { room, shortName, partenza, cambio, arrivo, arrivoCC, partenzaCC } = riga
    return (
      <div key={room.id} className="bg-white rounded-[10px] border border-card-border p-4">
        <div className="flex items-start gap-3">
          <span className="font-serif text-sm text-brass pt-0.5">{ROOM_NUMBER_BY_NAME[shortName] || ''}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-lg text-green-dark leading-tight">{shortName}</span>
              <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={badgeStyle['da pulire']}>da pulire</span>
              {partenza && <span className="text-xs text-gray-500">partenza oggi</span>}
              {cambio && (
                <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={badgeStyle['cambio biancheria']}>cambio biancheria</span>
              )}
            </div>
            <p className="text-[11px] text-stone mt-0.5">{ROOM_DESC_BY_NAME[shortName] || ''}</p>
            {partenza && (
              <p className="text-xs text-stone mt-1">
                {partenzaCC
                  ? `${partenza.guests?.full_name || 'l’ospite'} cambia camera → va in ${shortNameOf(partenzaCC.room_id)}`
                  : `è partito ${partenza.guests?.full_name || 'l’ospite'}`}
              </p>
            )}
            {arrivo && (
              <p className="text-sm font-semibold mt-2 flex flex-wrap items-center gap-1.5" style={{ color: 'var(--color-brass)' }}>
                arriva {arrivo.guests?.full_name || 'un ospite'} oggi{arrivo.check_in_time ? ` alle ${arrivo.check_in_time}` : ''}
                {arrivoCC && (
                  <span className="text-xs font-bold rounded-full px-2 py-0.5" style={badgeStyle['⇄ cambio camera']}>⇄ cambio camera da {shortNameOf(arrivoCC.room_id)}</span>
                )}
              </p>
            )}
            {linenControls(riga)}
            {partenza?.notes && (
              <p className="text-sm text-green-mid italic mt-2">“{partenza.notes}”</p>
            )}
            {cambio?.booking.notes && (
              <p className="text-sm text-green-mid italic mt-2">“{cambio.booking.notes}”</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Card della sezione "Prossimi": lavoro futuro, sotto l'intestazione del giorno
  const cardProssimo = (riga: RigaCamera) => {
    const { room, shortName, prossimo } = riga
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
        {linenControls(riga)}
        {riga.cambioProssimo?.booking.notes && (
          <p className="text-sm text-green-mid italic mt-2">“{riga.cambioProssimo.booking.notes}”</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-3"><BackLink href="/" /></div>

      <h1 className="text-2xl text-green-dark capitalize" style={{ fontFamily: 'Georgia, serif', fontWeight: 600 }}>{italianDate()}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {loading ? ' ' : daRifare === 0 ? 'Nessuna camera da rifare oggi' : daRifare === 1 ? '1 camera da rifare oggi' : `${daRifare} camere da rifare oggi`}
      </p>

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

      {!loading && <Statistiche rooms={rooms} bookings={bookings} td={td} />}
    </div>
  )
}
