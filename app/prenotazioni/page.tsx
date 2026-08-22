'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BackBar from '@/components/BackBar'
import { nomeOspite } from '@/lib/guestName'
import { matchPrenotazione } from '@/lib/ricerca'

// Pallino di stato discreto: colori coerenti con il calendario
const STATUS_DOT: Record<string, string> = {
  confermata: '#6C9A7C',
  in_attesa: '#C58A67',
  annullata: '#8C3B2E',
  completata: '#9CA3AF',
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-green-dark">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

export default function Prenotazioni() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [filter, setFilter] = useState<'tutte' | 'attive' | 'annullate'>('attive')
  const [search, setSearch] = useState('')
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
    if (!matchPrenotazione(b, search)) return false
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
      <BackBar href="/calendario" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-green-dark max-lg:hidden">Prenotazioni</h1>
        <Link href="/nuova?returnTo=/prenotazioni" className="ml-auto bg-green-mid text-white rounded-full px-3 py-1.5 text-sm font-semibold">+ Nuova</Link>
      </div>

      {/* Ricerca istantanea su nome della prenotazione, nome in scheda e
          telefono (tollerante a spazi, trattini e prefisso +39) */}
      <div className="relative mb-3">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔎</span>
        <input value={search} onChange={e => setSearch(e.target.value)} type="search" inputMode="search"
          placeholder="Cerca per nome o telefono…"
          className="w-full bg-white border border-card-border rounded-xl pl-10 pr-9 py-2.5 text-[15px] shadow-sm focus:outline-none focus:border-green-mid" />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Cancella ricerca"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 px-2 py-1 text-sm">✕</button>
        )}
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
        <div className="text-center py-10 text-gray-400">
          {search.trim() ? <>Nessun risultato per «{search.trim()}»</> : 'Nessuna prenotazione'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {search.trim() && (
            <p className="text-xs text-gray-500 -mt-1">{filtered.length} {filtered.length === 1 ? 'risultato' : 'risultati'} per «{search.trim()}»</p>
          )}
          {filtered.map(b => (
            <div key={b.id} onClick={() => router.push(`/prenotazioni/${b.id}`)}
              className={`rounded-xl p-5 border shadow-sm transition-all cursor-pointer active:opacity-70 leading-relaxed ${b.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-white border-card-border'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold">{nomeOspite(b)}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-stone)' }}>{b.rooms?.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {b.source === 'sito_web' && (
                    <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ background: '#EAF1EC', color: '#1F3D2F' }}>🌐 Dal sito</span>
                  )}
                  <StatusDot color={b.status === 'annullata' ? STATUS_DOT.annullata : b.pagato ? '#7D9DB0' : b.bonifico ? '#9B8EC4' : STATUS_DOT[b.status]}
                    label={b.status === 'annullata' ? 'annullata' : b.pagato ? 'pagata' : b.bonifico ? 'bonifico attesa' : b.status} />
                  {b.extra_bed && <StatusDot color="#C58A67" label="letto extra" />}
                  {b.group_id && <span className="text-xs text-gray-500">⇄ cambio camera</span>}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t-[0.5px] border-border-soft">
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
