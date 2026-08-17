'use client'
// Finestra che compare all'apertura del gestionale quando ci sono richieste
// dal sito da confermare: Ania chiama sempre il cliente prima di confermare,
// quindi la finestra propone subito "Chiama". "Dopo" la nasconde per la
// sessione, ma richieste NUOVE la fanno ricomparire (la firma cambia).
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { fetchWebRequests, type WebRequest } from '@/lib/webRequests'

const DISMISS_KEY = 'ca_webreq_dismissed'

function fmtData(s: string) {
  const [, m, d] = s.split('-')
  return `${Number(d)}/${Number(m)}`
}

export default function WebRequestAlert() {
  const router = useRouter()
  const pathname = usePathname()
  const [requests, setRequests] = useState<WebRequest[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchWebRequests().then(reqs => {
      setRequests(reqs)
      if (reqs.length === 0) return
      const firma = reqs.map(r => r.id).sort().join(',')
      try {
        if (sessionStorage.getItem(DISMISS_KEY) === firma) return
      } catch {}
      setOpen(true)
    })
  }, [])

  if (!open || !requests || requests.length === 0 || pathname === '/login') return null
  const primo = requests[0]

  function chiudi() {
    try {
      sessionStorage.setItem(DISMISS_KEY, requests!.map(r => r.id).sort().join(','))
    } catch {}
    setOpen(false)
  }

  return (
    <div className="velo-in fixed inset-0 z-[90] flex items-center justify-center px-6"
      style={{ background: 'rgba(31, 61, 47, 0.35)' }} onClick={chiudi}>
      <div className="scheda-in bg-cream rounded-xl p-5 w-full max-w-[340px] shadow-xl" onClick={e => e.stopPropagation()}>
        <p className="font-serif text-lg text-green-dark mb-2">🌐 Richiesta dal sito</p>
        <p className="text-[14.5px] font-semibold text-green-dark">
          {primo.guest_name} · {primo.num_guests} {primo.num_guests === 1 ? 'persona' : 'persone'}
        </p>
        <p className="text-[13.5px] mb-3" style={{ color: 'var(--color-stone)' }}>
          {fmtData(primo.check_in)} → {fmtData(primo.check_out)} · {primo.room_name} · €{Math.round(primo.total_amount)}
        </p>
        {requests.length > 1 && (
          <div className="mb-3">
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-stone)' }}>
              {requests.length - 1 === 1 ? '…e un’altra richiesta in attesa:' : `…e altre ${requests.length - 1} richieste in attesa:`}
            </p>
            {requests.slice(1).map(r => (
              <div key={r.id} className="mb-1.5">
                <p className="text-[14.5px] font-semibold text-green-dark">
                  {r.guest_name} · {r.num_guests} {r.num_guests === 1 ? 'persona' : 'persone'}
                </p>
                <p className="text-[13.5px]" style={{ color: 'var(--color-stone)' }}>
                  {fmtData(r.check_in)} → {fmtData(r.check_out)} · {r.room_name} · €{Math.round(r.total_amount)}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mb-4">Chiama il cliente e poi conferma la prenotazione.</p>
        <div className="flex gap-2">
          {primo.guest_phone && (
            <a href={`tel:${primo.guest_phone}`}
              className="flex-1 text-center bg-green-mid text-white rounded-lg py-2 text-[13.5px] font-semibold transition-transform duration-100 active:scale-[0.97]">
              📞 Chiama
            </a>
          )}
          <button onClick={() => { chiudi(); router.push(`/prenotazioni/${primo.id}`) }}
            className="flex-1 bg-white text-green-dark rounded-lg py-2 text-[13.5px] font-semibold shadow-sm transition-transform duration-100 active:scale-[0.97]">
            Apri
          </button>
          <button onClick={chiudi}
            className="flex-1 bg-white text-gray-500 rounded-lg py-2 text-[13.5px] font-medium shadow-sm transition-transform duration-100 active:scale-[0.97]">
            Dopo
          </button>
        </div>
      </div>
    </div>
  )
}
