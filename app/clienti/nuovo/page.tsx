'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BackLink from '@/components/BackLink'

const RATING_LABEL: Record<string, string> = { ottimo: '⭐ Ottimo', problematico: '⚠️ Problematico', vuole_ricevuta: '🧾 Vuole ricevuta', normale: '👤 Normale' }

export default function NuovoCliente() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', rating: 'normale' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!form.full_name.trim() && !form.phone.trim()) {
      setError('Inserisci almeno nome o numero di telefono.')
      return
    }
    setSaving(true)
    setError(null)
    const rawP = form.phone.trim().replace(/\D/g, '')
    const formattedPhone = rawP ? (rawP.startsWith('39') ? rawP : `39${rawP}`) : null
    const { data, error: err } = await supabase.from('guests').insert({
      full_name: form.full_name.trim() || null,
      phone: formattedPhone,
      email: form.email.trim() || null,
      rating: form.rating,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    router.push(`/clienti/${data.id}`)
  }

  return (
    <div className="p-4">
      <div className="mb-2"><BackLink href="/clienti" /></div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="font-serif text-xl text-green-dark">Nuovo cliente</h1>
      </div>

      <div className="bg-white rounded-xl p-4 border border-card-border space-y-3">
        <div>
          <p className="text-sm text-gray-500 mb-1">Nome e cognome</p>
          <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
            placeholder="Nome e cognome" autoFocus
            className="w-full border border-card-border rounded-lg p-3 text-sm focus:outline-none focus:border-green-mid" />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">Telefono (opzionale)</p>
          <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="+39 333 1234567"
            className="w-full border border-card-border rounded-lg p-3 text-sm focus:outline-none focus:border-green-mid" />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">Email (opzionale)</p>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="email@esempio.it"
            className="w-full border border-card-border rounded-lg p-3 text-sm focus:outline-none focus:border-green-mid" />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-2">Valutazione</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(RATING_LABEL).map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, rating: k })}
                className={`text-xs py-2 px-3 rounded-lg font-medium border transition-colors ${form.rating === k ? 'bg-green-mid text-white border-green-mid' : 'bg-white text-gray-600 border-card-border'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">❌ {error}</div>}

      <button onClick={save} disabled={saving}
        className="w-full mt-4 bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
        {saving ? 'Salvataggio...' : '✅ Salva cliente'}
      </button>
    </div>
  )
}
