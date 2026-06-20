'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const RATING_LABEL: Record<string, string> = { ottimo: '⭐ Ottimo', problematico: '⚠️ Problematico', vuole_ricevuta: '🧾 Vuole ricevuta', normale: '👤 Normale' }
const RATING_COLOR: Record<string, string> = { ottimo: 'bg-green-100 text-green-700', problematico: 'bg-red-100 text-red-700', vuole_ricevuta: 'bg-blue-100 text-blue-700', normale: 'bg-gray-100 text-gray-600' }

export default function ClienteDetail() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [guest, setGuest] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('guests').select('*').eq('id', id).single(),
      supabase.from('bookings').select('*, rooms(name)').eq('guest_id', id).order('check_in', { ascending: false }),
    ]).then(([{ data: g }, { data: b }]) => {
      setGuest(g); setForm(g || {}); setBookings(b || []); setLoading(false)
    })
  }, [id])

  async function save() {
    setSaving(true)
    await supabase.from('guests').update({ full_name: form.full_name, phone: form.phone, email: form.email, rating: form.rating, notes: form.notes }).eq('id', id)
    setGuest({ ...guest, ...form }); setEditing(false); setSaving(false)
  }

  if (loading) return <div className="p-4 text-center py-10 text-gray-400">Caricamento...</div>
  if (!guest) return <div className="p-4 text-center py-10 text-gray-400">Cliente non trovato</div>

  const confermateCompletate = bookings.filter(b => b.status !== 'annullata')
  const annullate = bookings.filter(b => b.status === 'annullata')
  const totaleSpeso = confermateCompletate.reduce((s: number, b: any) => s + Number(b.total_amount), 0)

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-blue-600 text-sm">← Indietro</button>
        <h1 className="text-xl font-bold flex-1">Cliente</h1>
        <button onClick={() => setEditing(!editing)} className="text-blue-600 text-sm font-semibold">{editing ? 'Annulla' : 'Modifica'}</button>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
        {editing ? (
          <>
            <input value={form.full_name || ''} onChange={e => setForm({...form, full_name: e.target.value})}
              placeholder="Nome e cognome" className="w-full border border-gray-200 rounded-lg p-2 mb-2 text-sm" />
            <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="Telefono" className="w-full border border-gray-200 rounded-lg p-2 mb-2 text-sm" type="tel" />
            <input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})}
              placeholder="Email" className="w-full border border-gray-200 rounded-lg p-2 mb-2 text-sm" type="email" />
            <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Note..." className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-sm" rows={2} />
            <p className="text-sm font-semibold mb-2">Valutazione</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {Object.entries(RATING_LABEL).map(([k, v]) => (
                <button key={k} onClick={() => setForm({...form, rating: k})}
                  className={`text-xs py-2 px-3 rounded-lg font-medium border ${form.rating === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving} className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-lg">{guest.full_name || 'Senza nome'}</p>
                <p className="text-gray-500 text-sm">📞 {guest.phone}</p>
                {guest.email && <p className="text-gray-500 text-sm">✉️ {guest.email}</p>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${RATING_COLOR[guest.rating]}`}>{RATING_LABEL[guest.rating]}</span>
            </div>
            {guest.notes && <p className="text-sm text-gray-600 italic mt-2">📝 {guest.notes}</p>}
          </>
        )}
      </div>

      {/* Statistiche cliente */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-xl font-bold text-blue-600">{confermateCompletate.length}</p>
          <p className="text-xs text-gray-500">Soggiorni</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-xl font-bold text-green-600">€{totaleSpeso.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Totale speso</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-xl font-bold text-red-400">{annullate.length}</p>
          <p className="text-xs text-gray-500">Annullate</p>
        </div>
      </div>

      {/* Storico prenotazioni */}
      <p className="font-semibold mb-3">Storico prenotazioni</p>
      {bookings.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Nessuna prenotazione</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map(b => (
            <div key={b.id} className={`rounded-xl p-3 border ${b.status === 'annullata' ? 'bg-gray-50 border-gray-100 opacity-60' : b.extra_bed ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{b.rooms?.name}</p>
                  <p className="text-xs text-gray-500">{b.check_in} → {b.check_out}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">€{Number(b.total_amount).toFixed(0)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${b.status === 'annullata' ? 'bg-red-100 text-red-600' : b.status === 'completata' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{b.status}</span>
                </div>
              </div>
              {b.extra_bed && <p className="text-xs text-orange-600 mt-1">🛏 Letto aggiuntivo</p>}
              {b.status === 'annullata' && b.cancelled_reason && <p className="text-xs text-gray-400 mt-1">Motivo: {b.cancelled_reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
