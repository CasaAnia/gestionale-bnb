'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import BackLink from '@/components/BackLink'

const ROOM_ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']

// Segna-pulita salvati in locale quando la colonna cleaned_at non esiste ancora su Supabase
const LOCAL_KEY = 'pulizie_cleaned_ids'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function italianDate() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// "2026-07-18" -> "ieri" / "il 15 luglio" (rispetto a oggi)
function partenzaLabel(checkOut: string, td: string) {
  if (checkOut === td) return 'partenza oggi'
  const [y, m, d] = checkOut.split('-').map(Number)
  const diff = Math.round((new Date(td).getTime() - new Date(y, m - 1, d).getTime()) / 86400000)
  if (diff === 1) return 'partenza ieri'
  return `partenza il ${new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`
}

type RigaCamera = {
  room: any
  shortName: string
  daPulire: boolean
  partenza: any | null   // prenotazione del check-out che ha sporcato la camera
  arrivo: any | null     // prenotazione che arriva oggi nella stessa camera
}

export default function Pulizie() {
  const [rooms, setRooms] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [localCleaned, setLocalCleaned] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const td = todayStr()

  useEffect(() => {
    try { setLocalCleaned(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')) } catch { /* ignora */ }
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
      // Ultimo check-out già avvenuto (oggi o nel passato): è lui a rendere la camera "da pulire"
      const partenze = bookings.filter(b => b.room_id === room.id && b.check_out <= td)
      const partenza = partenze.sort((a, b) => b.check_out.localeCompare(a.check_out))[0] || null
      const pulita = !partenza || partenza.cleaned_at != null || localCleaned.includes(partenza.id)
      const arrivo = bookings.find(b => b.room_id === room.id && b.check_in === td) || null
      return {
        room,
        shortName: room.name.split(' ').slice(-1)[0],
        daPulire: !pulita,
        partenza: pulita ? null : partenza,
        arrivo,
      }
    })
    // Prima le "da pulire con arrivo oggi", poi le "da pulire", infine le "pulite"
    const rank = (r: RigaCamera) => (r.daPulire && r.arrivo ? 0 : r.daPulire ? 1 : 2)
    return out.sort((a, b) => rank(a) - rank(b))
  }, [rooms, bookings, localCleaned, td])

  const daRifare = righe.filter(r => r.daPulire).length

  async function segnaPulita(riga: RigaCamera) {
    const b = riga.partenza
    if (!b || saving) return
    setSaving(riga.room.id)
    const cleanedAt = new Date().toISOString()
    const { error } = await supabase.from('bookings').update({ cleaned_at: cleanedAt }).eq('id', b.id)
    if (error) {
      // Colonna cleaned_at non ancora migrata su Supabase: ricorda la pulizia in locale
      const next = [...localCleaned, b.id]
      setLocalCleaned(next)
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch { /* ignora */ }
    } else {
      setBookings(bookings.map(x => x.id === b.id ? { ...x, cleaned_at: cleanedAt } : x))
    }
    setSaving(null)
  }

  return (
    <div className="p-4">
      <div className="mb-3"><BackLink href="/" /></div>

      <h1 className="font-serif text-2xl text-green-dark capitalize">{italianDate()}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {loading ? ' ' : daRifare === 0 ? 'Nessuna camera da rifare' : daRifare === 1 ? '1 camera da rifare' : `${daRifare} camere da rifare`}
      </p>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {righe.map(riga => {
            const { room, shortName, daPulire, partenza, arrivo } = riga
            const conArrivo = daPulire && arrivo
            return (
              <div key={room.id}
                className={`bg-white rounded-[10px] border border-card-border p-4 ${!daPulire ? 'opacity-55' : ''}`}>
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
                    </div>
                    <p className="text-[11px] text-stone mt-0.5">{ROOM_DESC_BY_NAME[shortName] || ''}</p>
                    {conArrivo && (
                      <p className="text-sm font-semibold mt-2" style={{ color: 'var(--color-brass)' }}>
                        arriva un ospite oggi{arrivo.check_in_time ? ` alle ${arrivo.check_in_time}` : ''}
                      </p>
                    )}
                    {partenza?.notes && (
                      <p className="text-sm text-green-mid italic mt-2">“{partenza.notes}”</p>
                    )}
                  </div>
                  {daPulire && (
                    <button onClick={() => segnaPulita(riga)} disabled={saving === room.id}
                      className="shrink-0 text-cream-text rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      style={{ background: '#2D6A4F' }}>
                      {saving === room.id ? 'Salvo...' : 'Segna pulita'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
