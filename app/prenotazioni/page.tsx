'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BackLink from '@/components/BackLink'

const STATUS_COLORS: Record<string, string> = {
  confermata: 'bg-sage text-green-dark',
  in_attesa: 'bg-[#F1E0CE] text-[#7A4B22]',
  annullata: 'bg-[#F6E4DE] text-[#8C3B2E]',
  completata: 'bg-gray-100 text-gray-600',
}

export default function Prenotazioni() {
  const router = useRouter()
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
      <div className="mb-2"><BackLink href="/calendario" /></div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-green-dark">Prenotazioni</h1>
        <Link href="/nuova" className="bg-green-mid text-white rounded-full px-3 py-1.5 text-sm font-semibold">+ Nuova</Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(['attive', 'tutte', 'annullate'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-card-border'}`}>
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
            <div key={b.id} onClick={() => router.push(`/prenotazioni/${b.id}`)}
              className={`rounded-xl p-4 border shadow-sm transition-all cursor-pointer active:opacity-70 ${b.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-white border-card-border'}`}>
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <p className="font-semibold">{b.guests?.full_name || b.guests?.phone}</p>
                  <p className="text-sm text-gray-500">{b.rooms?.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                  {b.extra_bed && <span className="text-xs bg-[#F1E0CE] text-[#7A4B22] px-2 py-0.5 rounded-full font-semibold">+letto agg.</span>}
                  {b.group_id && <span className="text-xs bg-[#EFEAF7] text-[#5B4E82] px-2 py-0.5 rounded-full font-semibold">🔄 cambio camera</span>}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{b.check_in} → {b.check_out} ({notti(b)} notti)</span>
                <span className="font-semibold text-gray-800">€{Number(b.total_amount).toFixed(0)}</span>
              </div>
              {b.guests?.rating === 'problematico' && (
                <p className="text-xs text-[#8C3B2E] mt-1 font-semibold">⚠️ Cliente problematico</p>
              )}
              {b.guests?.rating === 'vuole_ricevuta' && (
                <p className="text-xs text-green-mid mt-1 font-semibold">🧾 Vuole ricevuta</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
