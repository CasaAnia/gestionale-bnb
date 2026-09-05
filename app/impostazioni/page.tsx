'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackBar from '@/components/BackBar'
import { ROOM_NUMBER_BY_NAME, ROOM_DESC_BY_NAME } from '@/lib/roomTypes'
import { useDemoMode } from '@/lib/useDemoMode'
import { hasDemoPin, setDemoPin, enableDemo, disableDemo } from '@/lib/demoMode'
import { scriviPoiAggiorna } from '@/lib/scritturaSicura'
import AvvisoAzione from '@/components/AvvisoAzione'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function Impostazioni() {
  const router = useRouter()
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, any>>({})
  // Errori di salvataggio visibili, parte 2 (05/09/2026): le tariffe cambiano
  // a schermo solo se salvate; con un errore le modifiche restano in bozza
  const [erroreCamera, setErroreCamera] = useState<Record<string, string | null>>({})
  const [notifStatus, setNotifStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')
  // Motivo del fallimento: prima l'attivazione falliva in silenzio e non si
  // capiva se era il permesso del telefono o la sessione scaduta
  const [notifErr, setNotifErr] = useState('')

  // Modalità dimostrazione
  const demo = useDemoMode()
  const [pinSet, setPinSet] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [exitPin, setExitPin] = useState('')
  const [exitErr, setExitErr] = useState(false)
  useEffect(() => { setPinSet(hasDemoPin()) }, [demo])
  function salvaPin() {
    const p = newPin.trim()
    if (p.length < 4) return
    setDemoPin(p); setPinSet(true); setNewPin(''); setPinSaved(true)
    setTimeout(() => setPinSaved(false), 2000)
  }

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
      if (permission !== 'granted') {
        setNotifErr('Permesso negato dal telefono. Vai nelle impostazioni del telefono per abilitarle.')
        setNotifStatus('denied')
        return
      }
      // Cancella subscription esistente e ricreala
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) })
      if (!res.ok) {
        throw new Error(res.status === 401
          ? 'Sessione scaduta: esci e rientra nel gestionale, poi riprova.'
          : 'Errore nel salvataggio: riprova tra un momento.')
      }
      setNotifStatus('ok')
    } catch (e) {
      setNotifErr(e instanceof Error && e.message ? e.message : 'Attivazione non riuscita: riprova.')
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
    setErroreCamera(prev => ({ ...prev, [room.id]: null }))
    try {
      const errore = await scriviPoiAggiorna(
        () => supabase.from('rooms').update(changes).eq('id', room.id),
        () => {
          setRooms(rooms.map(r => r.id === room.id ? { ...r, ...changes } : r))
          setEdits(prev => { const n = { ...prev }; delete n[room.id]; return n })
        },
      )
      setErroreCamera(prev => ({ ...prev, [room.id]: errore }))
    } finally {
      setSaving(null)
    }
  }

  const BATHROOM_LABELS: Record<string, string> = { privato_interno: '🚿 Privato in camera', privato_esterno: '🚶 Privato esterno' }

  return (
    <div className="p-4">
      <BackBar href="/" />
      <h1 className="font-serif text-xl text-green-dark mb-2 max-lg:hidden">Impostazioni</h1>
      <p className="text-sm text-gray-500 mb-4">Configura prezzi e camere</p>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <>
        <p className="text-[11px] uppercase mb-3 mt-2" style={{ color: 'var(--color-brass)', letterSpacing: '2px' }}>Le camere</p>
        <div className="flex flex-col gap-5">
          {rooms.map(room => {
            const shortName = room.name.split(' ').slice(-1)[0]
            return (
            <div key={room.id} className="bg-white rounded-xl p-5 border border-[#C9BFA8] shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-sm" style={{ color: 'var(--color-brass)' }}>{ROOM_NUMBER_BY_NAME[shortName] || ''}</span>
                  <div>
                    <p className="font-serif text-lg text-green-dark leading-tight">{shortName}</p>
                    <p className="text-xs" style={{ color: 'var(--color-stone)' }}>{ROOM_DESC_BY_NAME[shortName] || ''}</p>
                  </div>
                </div>
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
                    className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Letto agg. €/notte</p>
                  <input type="number" min={0} value={val(room, 'extra_bed_price')}
                    onChange={e => edit(room.id, 'extra_bed_price', parseFloat(e.target.value))}
                    className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
              </div>
              {room.double_price !== null && room.double_price !== undefined && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">👥 Prezzo 2 ospiti €/notte</p>
                  <input type="number" min={0} value={val(room, 'double_price')}
                    onChange={e => edit(room.id, 'double_price', parseFloat(e.target.value))}
                    className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
              )}
              {room.matrimoniale_price !== null && room.matrimoniale_price !== undefined && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">💑 Uso matrimoniale €/notte</p>
                  <input type="number" min={0} value={val(room, 'matrimoniale_price')}
                    onChange={e => edit(room.id, 'matrimoniale_price', parseFloat(e.target.value))}
                    className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm focus:outline-none focus:border-green-mid" />
                </div>
              )}
              {edits[room.id] && (
                <button onClick={() => saveRoom(room)} disabled={saving === room.id}
                  className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50">
                  {saving === room.id ? 'Salvataggio...' : '💾 Salva modifiche'}
                </button>
              )}
              {edits[room.id] && erroreCamera[room.id] && <AvvisoAzione testo={erroreCamera[room.id]!} className="mt-2" />}
            </div>
          )})}
        </div>
        </>
      )}

      {/* Notifiche push */}
      <div className="mt-6 bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm">
        <p className="font-semibold mb-1">🔔 Notifiche arrivi</p>
        <p className="text-xs text-gray-500 mb-3">Ricevi una notifica ogni giorno alle 15:00 con gli arrivi del giorno successivo e i letti da preparare.</p>
        {notifStatus === 'ok' ? (
          <div className="bg-sage text-green-dark rounded-lg px-3 py-2 text-sm font-semibold">✅ Notifiche attive!</div>
        ) : notifStatus === 'denied' ? (
          <div className="space-y-2">
            <div className="bg-[#F6E4DE] text-[#8C3B2E] rounded-lg px-3 py-2 text-sm">{notifErr || 'Attivazione non riuscita: riprova.'}</div>
            <button onClick={() => { setNotifErr(''); setNotifStatus('idle') }}
              className="w-full border border-[#C9BFA8] shadow-sm rounded-xl py-2 text-sm font-semibold">
              Riprova
            </button>
          </div>
        ) : (
          <button onClick={attivaNotifiche} disabled={notifStatus === 'loading'}
            className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
            {notifStatus === 'loading' ? 'Attivazione...' : '🔔 Attiva notifiche sul telefono'}
          </button>
        )}
      </div>

      {/* Modalità dimostrazione */}
      <div className="mt-6 bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm">
        <p className="font-semibold mb-1">🫥 Modalità dimostrazione</p>
        <p className="text-xs text-gray-500 mb-3">
          Nasconde le sezioni <b>Spese</b> e <b>Spese Famiglia</b> quando fai vedere il gestionale a qualcuno.
          Per farle riapparire serve il PIN.
        </p>

        {demo ? (
          <form onSubmit={e => { e.preventDefault(); if (disableDemo(exitPin)) { setExitErr(false); setExitPin('') } else setExitErr(true) }}>
            <div className="bg-[#F3ECD8] text-[#7A5C1E] rounded-lg px-3 py-2 text-sm font-semibold mb-2">🫥 Attiva — le spese sono nascoste</div>
            <input inputMode="numeric" type="password" value={exitPin}
              onChange={e => { setExitPin(e.target.value); setExitErr(false) }} placeholder="PIN per uscire"
              className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2.5 text-center tracking-widest mb-2" />
            {exitErr && <p className="text-xs text-[#8C3B2E] mb-2">PIN errato</p>}
            <button type="submit" className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold">Esci dalla dimostrazione</button>
          </form>
        ) : (
          <>
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">{pinSet ? 'Cambia PIN' : 'Scegli un PIN (min 4 cifre)'}</p>
              <div className="flex gap-2">
                <input inputMode="numeric" type="password" value={newPin}
                  onChange={e => setNewPin(e.target.value)} placeholder="PIN"
                  className="flex-1 border border-[#C9BFA8] shadow-sm rounded-lg p-2.5 text-center tracking-widest" />
                <button onClick={salvaPin} disabled={newPin.trim().length < 4}
                  className="border border-[#C9BFA8] shadow-sm text-green-dark rounded-lg px-4 font-semibold text-sm disabled:opacity-50">
                  {pinSaved ? '✅' : 'Salva'}
                </button>
              </div>
            </div>
            <button onClick={enableDemo} disabled={!pinSet}
              className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
              🫥 Attiva modalità dimostrazione
            </button>
            {!pinSet && <p className="text-xs text-gray-400 mt-2 text-center">Imposta prima un PIN per poter attivare</p>}
          </>
        )}
      </div>

      {/* Accesso */}
      <div className="mt-6 bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm">
        <p className="font-semibold mb-1">🔒 Accesso</p>
        <p className="text-xs text-gray-500 mb-3">
          Il gestionale è protetto da password. Esci se usi un telefono o un computer non tuo.
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.replace('/login')
            router.refresh()
          }}
          className="w-full border border-[#C9BFA8] shadow-sm text-green-dark rounded-xl py-2.5 font-semibold"
        >
          Esci
        </button>
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
