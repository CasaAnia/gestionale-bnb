'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BackBar from '@/components/BackBar'

import CampoValutazione from '@/components/CampoValutazione'
import { payloadValutazione, type Valutazione } from '@/lib/valutazione'

export default function NuovoCliente() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', rating: 'normale' as Valutazione, ricevuta: false })
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
    const base = { full_name: form.full_name.trim() || null, phone: formattedPhone, email: form.email.trim() || null }
    // Colonna nuova (0038) se c'è; altrimenti la forma vecchia, così nulla si blocca
    let { data, error: err } = await supabase.from('guests').insert({ ...base, ...payloadValutazione(form.rating, form.ricevuta, true) }).select().single()
    if (err && /vuole_ricevuta/i.test(err.message || '')) ({ data, error: err } = await supabase.from('guests').insert({ ...base, ...payloadValutazione(form.rating, form.ricevuta, false) }).select().single())
    setSaving(false)
    if (err) { setError(err.message); return }
    router.push(`/clienti/${data.id}`)
  }

  return (
    <div className="p-4">
      <BackBar href="/clienti" />
      <div className="flex items-center gap-3 mb-4">
        <h1 className="font-serif text-xl text-green-dark">Nuovo cliente</h1>
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm space-y-3">
        <div>
          <p className="text-sm text-gray-500 mb-1">Nome e cognome</p>
          <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
            placeholder="Nome e cognome" autoFocus
            className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-3 text-sm focus:outline-none focus:border-green-mid" />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">Telefono (opzionale)</p>
          <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="+39 333 1234567"
            className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-3 text-sm focus:outline-none focus:border-green-mid" />
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">Email (opzionale)</p>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="email@esempio.it"
            className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-3 text-sm focus:outline-none focus:border-green-mid" />
        </div>
        <CampoValutazione titolo="Valutazione" valutazione={form.rating} ricevuta={form.ricevuta} onChange={v => setForm({ ...form, rating: v.valutazione, ricevuta: v.ricevuta })} />
      </div>

      {error && <div className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">❌ {error}</div>}

      <button onClick={save} disabled={saving}
        className="w-full mt-4 bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
        {saving ? 'Salvataggio...' : '✅ Salva cliente'}
      </button>
    </div>
  )
}
