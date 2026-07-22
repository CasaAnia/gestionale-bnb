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

// Salvataggi locali usati quando le colonne cleaned_at / linen_next_date
// non esistono ancora su Supabase (migrazioni 0004 e 0005 da eseguire a mano)
const LOCAL_KEY = 'pulizie_cleaned_ids'
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

function dayMonth(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

function italianDate() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// "2026-07-18" -> "partenza ieri" / "partenza il 15 luglio" (rispetto a oggi)
function partenzaLabel(checkOut: string, td: string) {
  if (checkOut === td) return 'partenza oggi'
  const diff = diffDays(td, checkOut)
  if (diff === 1) return 'partenza ieri'
  return `partenza il ${dayMonth(checkOut)}`
}

// Quando cade (o cadeva) il cambio biancheria rispetto a oggi
function cambioLabel(due: string, td: string) {
  const diff = diffDays(due, td)
  if (diff === 0) return 'oggi'
  if (diff === -1) return 'previsto ieri'
  if (diff < 0) return `previsto il ${dayMonth(due)}`
  if (diff === 1) return 'domani'
  return `il ${dayMonth(due)}`
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

type RigaCamera = {
  room: any
  shortName: string
  daPulire: boolean
  partenza: any | null       // prenotazione del check-out che ha sporcato la camera
  cambio: Cambio | null      // cambio biancheria dovuto (oggi o in ritardo)
  cambioProssimo: Cambio | null // cambio in arrivo nei prossimi giorni (spostabile/anticipabile)
  arrivo: any | null         // prenotazione che arriva oggi nella stessa camera
  prossimo: { date: string; motivo: string } | null // primo lavoro futuro previsto e perché
}

export default function Pulizie() {
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [localCleaned, setLocalCleaned] = useState<string[]>([])
  const [localLinen, setLocalLinen] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  // Data scelta a mano per "cambio fatto il" (per camera; default oggi)
  const [fattoIl, setFattoIl] = useState<Record<string, string>>({})
  // Data scelta a mano per "Segna pulita" (per camera; default oggi), per quando
  // la pulizia viene registrata nell'app in un giorno diverso da quello vero
  const [pulitaIl, setPulitaIl] = useState<Record<string, string>>({})
  const td = todayStr()

  useEffect(() => {
    try { setLocalCleaned(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')) } catch { /* ignora */ }
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
    const out: RigaCamera[] = rooms.map(room => {
      // Ultimo check-out già avvenuto (oggi o nel passato): è lui a rendere la camera
      // "da pulire". I confini dei prolungamenti (l'ospite continua) non contano.
      const partenze = bookings.filter(b => b.room_id === room.id && b.check_out <= td && !continuaIn(bookings, b))
      const ultima = partenze.sort((a, b) => b.check_out.localeCompare(a.check_out))[0] || null
      const partenzaSporca = ultima && ultima.cleaned_at == null && !localCleaned.includes(ultima.id)

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

      // "Prossimo: ..." — il primo lavoro futuro previsto in questa camera, con motivo:
      // cambio biancheria (4 notti), partenza dell'ospite in corso, o arrivo/cambio camera
      const eventi: { date: string; motivo: string }[] = []
      if (dueFuturo && dueFuturo > td) eventi.push({ date: dueFuturo, motivo: 'cambio biancheria' })
      if (inCorso) {
        let fineSoggiorno = inCorso
        for (let next = continuaIn(bookings, fineSoggiorno); next; next = continuaIn(bookings, next)) fineSoggiorno = next
        eventi.push({ date: fineSoggiorno.check_out, motivo: `parte ${fineSoggiorno.guests?.full_name || 'l’ospite'}` })
      }
      const arrivoFuturo = bookings
        .filter(b => b.room_id === room.id && b.check_in > td && !continuaDa(bookings, b))
        .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
      if (arrivoFuturo) {
        const daAltraCamera = bookings.some(x => x.guest_id && x.guest_id === arrivoFuturo.guest_id && x.check_out === arrivoFuturo.check_in && x.room_id !== room.id)
        eventi.push({ date: arrivoFuturo.check_in, motivo: `arriva ${arrivoFuturo.guests?.full_name || 'un ospite'}${daAltraCamera ? ' (cambio camera)' : ''}` })
      }
      eventi.sort((a, b) => a.date.localeCompare(b.date))
      const prossimo = eventi.length > 0
        ? { date: eventi[0].date, motivo: eventi.filter(e => e.date === eventi[0].date).map(e => e.motivo).join(' · ') }
        : null

      return {
        room,
        shortName: room.name.split(' ').slice(-1)[0],
        daPulire: !!partenzaSporca || !!cambio,
        partenza: partenzaSporca ? ultima : null,
        cambio,
        cambioProssimo,
        arrivo,
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
  }, [rooms, bookings, localCleaned, localLinen, td])

  const daRifare = righe.filter(r => r.daPulire).length

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

  async function segnaPulita(riga: RigaCamera) {
    if (saving) return
    setSaving(riga.room.id)
    const giorno = pulitaIl[riga.room.id] || td
    if (riga.partenza) {
      const b = riga.partenza
      // Se la data scelta è oggi vale l'ora esatta; per un giorno passato mezzogiorno
      const cleanedAt = giorno === td ? new Date().toISOString() : new Date(`${giorno}T12:00:00`).toISOString()
      const { error } = await supabase.from('bookings').update({ cleaned_at: cleanedAt }).eq('id', b.id)
      if (error) {
        // Colonna cleaned_at non ancora migrata su Supabase: ricorda la pulizia in locale
        const next = [...localCleaned, b.id]
        setLocalCleaned(next)
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch { /* ignora */ }
      } else {
        setBookings(bs => bs.map(x => x.id === b.id ? { ...x, cleaned_at: cleanedAt } : x))
      }
    }
    // Cambio biancheria fatto: il conteggio delle 4 notti riparte dal giorno scelto
    if (riga.cambio) await salvaCambio(riga.cambio.booking.id, addDaysStr(giorno, NOTTI_CAMBIO))
    setSaving(null)
  }

  return (
    <div className="p-4">
      <div className="mb-3"><BackLink href="/" /></div>

      <h1 className="font-serif text-2xl text-green-dark capitalize">{italianDate()}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {loading ? ' ' : daRifare === 0 ? 'Nessuna camera da rifare' : daRifare === 1 ? '1 camera da rifare' : `${daRifare} camere da rifare`}
      </p>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {righe.map(riga => {
            const { room, shortName, daPulire, partenza, cambio, cambioProssimo, arrivo, prossimo } = riga
            const conArrivo = daPulire && arrivo
            const spostabile = cambio || cambioProssimo
            return (
              <div key={room.id}
                className={`bg-white rounded-[10px] border border-card-border p-4 ${!daPulire && !cambioProssimo && !(prossimo && diffDays(prossimo.date, td) <= 1) ? 'opacity-55' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="font-serif text-sm text-brass pt-0.5">{ROOM_NUMBER_BY_NAME[shortName] || ''}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-lg text-green-dark leading-tight">{shortName}</span>
                      {daPulire ? (
                        <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={{ background: '#EFD9C7', color: '#8a4f2f' }}>da pulire</span>
                      ) : (
                        <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={{ background: '#DCE8DD', color: '#2f6a4d' }}>pulita</span>
                      )}
                      {partenza && (
                        <span className="text-xs text-gray-500">{partenzaLabel(partenza.check_out, td)}</span>
                      )}
                      {(cambio || cambioProssimo) && (
                        <>
                          <span className="text-xs font-bold rounded-full px-2.5 py-0.5" style={{ background: '#EDE6D6', color: '#5a6b3f' }}>cambio biancheria</span>
                          <span className="text-xs text-gray-500">{cambioLabel((cambio || cambioProssimo)!.due, td)}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-stone mt-0.5">{ROOM_DESC_BY_NAME[shortName] || ''}</p>
                    {prossimo && (
                      <p className={`text-xs mt-1 ${diffDays(prossimo.date, td) <= 1 ? 'font-semibold' : ''}`}
                        style={{ color: diffDays(prossimo.date, td) <= 1 ? 'var(--color-brass)' : 'var(--color-stone)' }}>
                        Prossimo: {cambioLabel(prossimo.date, td)} · {prossimo.motivo}
                      </p>
                    )}
                    {conArrivo && (
                      <p className="text-sm font-semibold mt-2" style={{ color: 'var(--color-brass)' }}>
                        arriva un ospite oggi{arrivo.check_in_time ? ` alle ${arrivo.check_in_time}` : ''}
                      </p>
                    )}
                    {spostabile && (
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
                    )}
                    {partenza?.notes && (
                      <p className="text-sm text-green-mid italic mt-2">“{partenza.notes}”</p>
                    )}
                    {(cambio || cambioProssimo)?.booking.notes && (
                      <p className="text-sm text-green-mid italic mt-2">“{(cambio || cambioProssimo)!.booking.notes}”</p>
                    )}
                  </div>
                  {daPulire && (
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <button onClick={() => segnaPulita(riga)} disabled={saving === room.id}
                        className="text-cream-text rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        style={{ background: '#2D6A4F' }}>
                        {saving === room.id ? 'Salvo...' : 'Segna pulita'}
                      </button>
                      <input type="date" value={pulitaIl[room.id] || td} max={td} aria-label="Pulita il giorno"
                        onChange={e => setPulitaIl({ ...pulitaIl, [room.id]: e.target.value })}
                        className="border border-card-border rounded-lg px-2 py-1 text-xs bg-white" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && <Statistiche rooms={rooms} bookings={bookings} localCleaned={localCleaned} td={td} />}
    </div>
  )
}
