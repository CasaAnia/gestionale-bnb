'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import BackLink from '@/components/BackLink'

const RATING_LABEL: Record<string, string> = { ottimo: '⭐ Ottimo', problematico: '⚠️ Problematico', vuole_ricevuta: '🧾 Vuole ricevuta', normale: '👤 Normale' }
const RATING_COLOR: Record<string, string> = { ottimo: 'bg-sage text-green-dark', problematico: 'bg-[#F6E4DE] text-[#8C3B2E]', vuole_ricevuta: 'bg-sage text-green-mid', normale: 'bg-gray-100 text-gray-600' }

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
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('guests').select('*').eq('id', id).single(),
      supabase.from('bookings').select('*, rooms(name)').eq('guest_id', id).order('check_in', { ascending: false }),
    ]).then(([{ data: g }, { data: b }]) => {
      setGuest(g); setForm(g || {}); setBookings(b || []); setLoading(false)
    })
  }, [id])

  async function deleteGuest() {
    await supabase.from('guests').delete().eq('id', id)
    router.push('/clienti')
  }

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
      <div className="mb-2"><BackLink href="/clienti" /></div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="font-serif text-xl text-green-dark flex-1">Cliente</h1>
        <button onClick={() => setEditing(!editing)} className="text-green-mid text-sm font-semibold">{editing ? 'Annulla' : 'Modifica'}</button>
      </div>

      <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
        {editing ? (
          <>
            <input value={form.full_name || ''} onChange={e => setForm({...form, full_name: e.target.value})}
              placeholder="Nome e cognome" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" />
            <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="Telefono" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" type="tel" />
            <input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})}
              placeholder="Email" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" type="email" />
            <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Note..." className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" rows={2} />
            <p className="text-sm font-semibold mb-2">Valutazione</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {Object.entries(RATING_LABEL).map(([k, v]) => (
                <button key={k} onClick={() => setForm({...form, rating: k})}
                  className={`text-xs py-2 px-3 rounded-lg font-medium border ${form.rating === k ? 'bg-green-mid text-white border-green-mid' : 'bg-white text-gray-600 border-card-border'}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving} className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
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
        <div className="bg-white rounded-xl p-3 border border-card-border text-center">
          <p className="font-serif text-xl text-green-dark">{confermateCompletate.length}</p>
          <p className="text-xs text-gray-500">Soggiorni</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-card-border text-center">
          <p className="font-serif text-xl text-green-dark">€{totaleSpeso.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Totale speso</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-card-border text-center">
          <p className="font-serif text-xl text-[#8C3B2E]">{annullate.length}</p>
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
            <div key={b.id} className={`rounded-xl p-3 border ${b.status === 'annullata' ? 'bg-gray-50 border-card-border opacity-60' : b.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-white border-card-border'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{b.rooms?.name}</p>
                  <p className="text-xs text-gray-500">{b.check_in} → {b.check_out}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">€{Number(b.total_amount).toFixed(0)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${b.status === 'annullata' ? 'bg-[#F6E4DE] text-[#8C3B2E]' : b.status === 'completata' ? 'bg-gray-100 text-gray-600' : 'bg-sage text-green-dark'}`}>{b.status}</span>
                </div>
              </div>
              {b.extra_bed && <p className="text-xs text-[#7A4B22] mt-1">🛏 Letto aggiuntivo</p>}
              {b.status === 'annullata' && b.cancelled_reason && <p className="text-xs text-gray-400 mt-1">Motivo: {b.cancelled_reason}</p>}
            </div>
          ))}
        </div>
      )}
      {/* Elimina cliente */}
      {!editing && (
        <button onClick={() => setShowDelete(true)} className="w-full mt-2 text-[#8C3B2E] text-sm py-2">
          🗑 Elimina cliente
        </button>
      )}

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowDelete(false)}>
          <div className="bg-white rounded-t-2xl p-4 w-full max-w-lg mx-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-2">Elimina cliente</h2>
            <p className="text-sm text-gray-500 mb-4">Sei sicuro? Questa azione non si può annullare. Le prenotazioni associate rimarranno nel sistema.</p>
            <button onClick={deleteGuest} className="w-full bg-[#B5502F] text-white rounded-xl py-3 font-semibold mb-2">Sì, elimina</button>
            <button onClick={() => setShowDelete(false)} className="w-full text-gray-500 py-2 text-sm">Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}
