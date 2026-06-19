'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  confermata: 'bg-green-100 text-green-700',
  in_attesa: 'bg-yellow-100 text-yellow-700',
  annullata: 'bg-red-100 text-red-700',
  completata: 'bg-gray-100 text-gray-600',
}

export default function Prenotazioni() {
  const [bookings, setBookings] = useState<any[]>([])
  const [filter, setFilter] = useState<'tutte' | 'attive' | 'annullate'>('attive')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bookings')
        .select('*, rooms(name), guests(full_name, phone, rating)')
        .order('check_in', { ascending: false })
      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = bookings.filter(b => {
    if (filter === 'attive') return b.status !== 'annullata'
    if (filter === 'annullate') return b.status === 'annullata'
    return true
  })

  function notti(b: any) {
    const diff = (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000
    return diff
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Prenotazioni</h1>
        <Link href="/nuova" className="bg-blue-600 text-white rounded-full px-3 py-1.5 text-sm font-semibold">+ Nuova</Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(['attive', 'tutte', 'annullate'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Nessuna prenotazione</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(b => (
            <Link key={b.id} href={`/prenotazioni/${b.id}`}
              className={`rounded-xl p-4 border shadow-sm transition-all ${b.extra_bed ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <p className="font-semibold">{b.guests?.full_name || b.guests?.phone}</p>
                  <p className="text-sm text-gray-500">{b.rooms?.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                  {b.extra_bed && <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-semibold">+letto agg.</span>}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{b.check_in} → {b.check_out} ({notti(b)} notti)</span>
                <span className="font-semibold text-gray-800">€{Number(b.total_amount).toFixed(0)}</span>
              </div>
              {b.guests?.rating === 'problematico' && (
                <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ Cliente problematico</p>
              )}
              {b.guests?.rating === 'vuole_ricevuta' && (
                <p className="text-xs text-blue-600 mt-1 font-semibold">🧾 Vuole ricevuta</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
