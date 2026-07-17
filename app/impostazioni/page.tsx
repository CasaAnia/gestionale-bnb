'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BackLink from '@/components/BackLink'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function Impostazioni() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, any>>({})
  const [notifStatus, setNotifStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')

  async function attivaNotifiche() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Il tuo browser non supporta le notifiche push')
      return
    }
    setNotifStatus('loading')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setNotifStatus('denied'); return }
      // Cancella subscription esistente e ricreala
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) })
      if (!res.ok) throw new Error('Errore salvataggio')
      setNotifStatus('ok')
    } catch (e) {
      setNotifStatus('denied')
    }
  }

  useEffect(() => {
    supabase.from('rooms').select('*')
      .then(({ data }) => {
        const ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
        const sorted = (data || []).sort((a, b) => {
          const ai = ORDER.findIndex(o => a.name.includes(o))
          const bi = ORDER.findIndex(o => b.name.includes(o))
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })
        setRooms(sorted); setLoading(false)
      })
  }, [])

  function edit(id: string, field: string, value: any) {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }

  function val(room: any, field: string) {
    return edits[room.id]?.[field] !== undefined ? edits[room.id][field] : room[field]
  }

  async function saveRoom(room: any) {
    const changes = edits[room.id]
    if (!changes) return
    setSaving(room.id)
    await supabase.from('rooms').update(changes).eq('id', room.id)
    setRooms(rooms.map(r => r.id === room.id ? { ...r, ...changes } : r))
    setEdits(prev => { const n = { ...prev }; delete n[room.id]; return n })
    setSaving(null)
  }

  const BATHROOM_LABELS: Record<string, string> = { privato_interno: '🚿 Privato in camera', privato_esterno: '🚶 Privato esterno' }

  return (
    <div className="p-4">
      <div className="mb-2"><BackLink href="/" /></div>
      <h1 className="font-serif text-xl text-green-dark mb-2">Impostazioni</h1>
      <p className="text-sm text-gray-500 mb-4">Configura prezzi e camere</p>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {rooms.map(room => (
            <div key={room.id} className="bg-white rounded-xl p-4 border border-card-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">{room.name}</p>
                <span className="text-xs text-gray-500">{BATHROOM_LABELS[room.bathroom_type]}</span>
              </div>
              {room.bathroom_note && (
                <p className="text-xs text-[#7A4B22] bg-[#F1E0CE] rounded p-2 mb-3">📍 {room.bathroom_note}</p>
              )}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Prezzo base/notte €</p>
                  <input type="number" min={0} value={val(room, 'base_price')}
                    onChange={e => edit(room.id, 'base_price', parseFloat(e.target.value))}
                    className="w-full border border-card-border rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Letto agg. €/notte</p>
                  <input type="number" min={0} value={val(room, 'extra_bed_price')}
                    onChange={e => edit(room.id, 'extra_bed_price', parseFloat(e.target.value))}
                    className="w-full border border-card-border rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
              </div>
              {room.double_price !== null && room.double_price !== undefined && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">👥 Prezzo 2 ospiti €/notte</p>
                  <input type="number" min={0} value={val(room, 'double_price')}
                    onChange={e => edit(room.id, 'double_price', parseFloat(e.target.value))}
                    className="w-full border border-card-border rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
              )}
              {room.matrimoniale_price !== null && room.matrimoniale_price !== undefined && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">💑 Uso matrimoniale €/notte</p>
                  <input type="number" min={0} value={val(room, 'matrimoniale_price')}
                    onChange={e => edit(room.id, 'matrimoniale_price', parseFloat(e.target.value))}
                    className="w-full border border-card-border rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
              )}
              {edits[room.id] && (
                <button onClick={() => saveRoom(room)} disabled={saving === room.id}
                  className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50">
                  {saving === room.id ? 'Salvataggio...' : '💾 Salva modifiche'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notifiche push */}
      <div className="mt-6 bg-white rounded-xl p-4 border border-card-border">
        <p className="font-semibold mb-1">🔔 Notifiche arrivi</p>
        <p className="text-xs text-gray-500 mb-3">Ricevi una notifica ogni giorno alle 15:00 con gli arrivi del giorno successivo e i letti da preparare.</p>
        {notifStatus === 'ok' ? (
          <div className="bg-sage text-green-dark rounded-lg px-3 py-2 text-sm font-semibold">✅ Notifiche attive!</div>
        ) : notifStatus === 'denied' ? (
          <div className="bg-[#F6E4DE] text-[#8C3B2E] rounded-lg px-3 py-2 text-sm">❌ Permesso negato. Vai nelle impostazioni del telefono per abilitarle.</div>
        ) : (
          <button onClick={attivaNotifiche} disabled={notifStatus === 'loading'}
            className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
            {notifStatus === 'loading' ? 'Attivazione...' : '🔔 Attiva notifiche sul telefono'}
          </button>
        )}
      </div>

      <div className="mt-4 bg-gray-100 rounded-xl p-4 text-sm text-gray-500">
        <p className="font-semibold text-gray-700 mb-1">ℹ️ Note</p>
        <p>• I prezzi si aggiornano subito per le nuove prenotazioni</p>
        <p>• Le prenotazioni esistenti mantengono il prezzo inserito</p>
        <p>• Il regime fiscale si potrà aggiungere in seguito</p>
      </div>
    </div>
  )
}
