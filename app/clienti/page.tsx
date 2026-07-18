'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import BackLink from '@/components/BackLink'

const RATING_COLOR: Record<string, string> = { ottimo: 'bg-sage text-green-dark', problematico: 'bg-[#F6E4DE] text-[#8C3B2E]', vuole_ricevuta: 'bg-sage text-green-mid', normale: 'bg-gray-100 text-gray-600' }
const RATING_LABEL: Record<string, string> = { ottimo: '⭐', problematico: '⚠️', vuole_ricevuta: '🧾', normale: '' }

export default function Clienti() {
  const [guests, setGuests] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('guests').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setGuests(data || []); setLoading(false) })
  }, [])

  const filtered = guests.filter(g =>
    g.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    g.phone?.includes(search)
  )

  return (
    <div className="p-4">
      <div className="mb-2"><BackLink href="/" /></div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-green-dark max-lg:hidden">Clienti</h1>
        <Link href="/clienti/nuovo" className="ml-auto bg-green-mid text-white text-sm font-semibold px-4 py-2 rounded-xl">+ Nuovo</Link>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Cerca per nome o telefono..."
        className="w-full border border-card-border rounded-xl p-3 mb-4 text-sm focus:outline-none focus:border-green-mid" />

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Nessun cliente trovato</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(g => (
            <Link key={g.id} href={`/clienti/${g.id}`}
              className="bg-white rounded-xl p-5 border border-card-border shadow-sm flex items-center justify-between leading-relaxed">
              <div>
                <p className="font-semibold">{g.full_name || 'Senza nome'}</p>
                <p className="text-sm text-gray-500">📞 {g.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                {g.rating !== 'normale' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RATING_COLOR[g.rating]}`}>
                    {RATING_LABEL[g.rating]} {g.rating}
                  </span>
                )}
                <span className="text-gray-300">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
