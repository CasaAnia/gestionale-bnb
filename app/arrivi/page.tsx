'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function isToday(dateStr: string) {
  return dateStr === toStr(new Date())
}

function isTomorrow(dateStr: string) {
  const t = new Date(); t.setDate(t.getDate() + 1)
  return dateStr === toStr(t)
}

export default function Arrivi() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*, rooms(name), guests(full_name, phone)')
      .eq('status', 'confermata')
      .order('check_in', { ascending: true })
      .then(({ data }) => {
        setBookings(data || [])
        setLoading(false)
      })
  }, [])

  const today = toStr(new Date())

  const filtered = bookings.filter(b =>
    showPast ? b.check_in < today : b.check_in >= today
  )

  // Raggruppa per data check_in
  const grouped = filtered.reduce((acc: Record<string, any[]>, b) => {
    if (!acc[b.check_in]) acc[b.check_in] = []
    acc[b.check_in].push(b)
    return acc
  }, {})

  const dates = Object.keys(grouped).sort((a, b) => showPast ? b.localeCompare(a) : a.localeCompare(b))

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Arrivi</h1>
        <button
          onClick={() => setShowPast(!showPast)}
          className="text-xs px-3 py-1.5 rounded-full font-semibold border border-gray-200 text-gray-600 bg-white"
        >
          {showPast ? '📅 Futuri' : '🕐 Passati'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : dates.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Nessun arrivo {showPast ? 'passato' : 'futuro'}</div>
      ) : (
        <div className="flex flex-col gap-5">
          {dates.map(date => {
            const arrivals = grouped[date].sort((a: any, b: any) => {
              if (!a.check_in_time) return 1
              if (!b.check_in_time) return -1
              return a.check_in_time.localeCompare(b.check_in_time)
            })

            const todayFlag = isToday(date)
            const tomorrowFlag = isTomorrow(date)

            return (
              <div key={date}>
                {/* Intestazione data */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${todayFlag ? 'bg-green-600 text-white' : tomorrowFlag ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                    {todayFlag ? 'Oggi' : tomorrowFlag ? 'Domani' : formatDate(date)}
                  </div>
                  {(todayFlag || tomorrowFlag) && (
                    <span className="text-sm text-gray-400 capitalize">{formatDate(date)}</span>
                  )}
                </div>

                {/* Carte arrivi */}
                <div className="flex flex-col gap-2">
                  {arrivals.map((b: any) => (
                    <div
                      key={b.id}
                      onClick={() => router.push(`/prenotazioni/${b.id}`)}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 cursor-pointer active:opacity-70"
                    >
                      {/* Orario */}
                      <div className="shrink-0 text-center" style={{ minWidth: 56 }}>
                        {b.check_in_time ? (
                          <>
                            <div className="text-2xl font-bold text-green-700">{b.check_in_time}</div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400 leading-tight">orario<br/>da def.</div>
                        )}
                      </div>

                      {/* Divisore */}
                      <div className="w-px self-stretch bg-gray-100" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">
                          {b.guests?.full_name || b.guests?.phone || '—'}
                        </p>
                        <p className="text-sm text-gray-500">{b.rooms?.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {b.num_guests > 1 && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              👥 {b.num_guests} ospiti
                            </span>
                          )}
                          {b.extra_bed && (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                              🛏 letto extra
                            </span>
                          )}
                          {b.bonifico && !b.pagato && (
                            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                              💸 bonifico atteso
                            </span>
                          )}
                          {b.pagato && (
                            <span className="text-xs bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full">
                              ✅ pagato
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-gray-300 text-lg shrink-0">›</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
