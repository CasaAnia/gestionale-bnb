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

// Avviso rosso quando il numero della richiesta è già in archivio con un altro
// nominativo: solo informativo, non blocca né modifica nulla.
function AvvisoNomeDiverso({ r }: { r: WebRequest }) {
  if (!r.nome_diverso) return null
  return (
    <div className="rounded-lg px-2.5 py-2 mb-1.5" style={{ background: '#FBE7E4', border: '2px solid #C0392B' }}>
      <p className="text-[11px] font-extrabold tracking-wide" style={{ color: '#C0392B' }}>⚠️ NUMERO GIÀ USATO CON UN ALTRO NOMINATIVO</p>
      <p className="text-[12.5px] mt-0.5" style={{ color: '#8a5049' }}>
        Richiesta di <span className="font-bold text-green-dark">{r.guest_name}</span> · in archivio come <span className="font-bold" style={{ color: '#C0392B' }}>{r.nome_archivio}</span>
      </p>
    </div>
  )
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
        <p className="text-[13.5px] mb-2" style={{ color: 'var(--color-stone)' }}>
          {fmtData(primo.check_in)} → {fmtData(primo.check_out)} · {primo.room_name} · €{Math.round(primo.total_amount)}
        </p>
        <AvvisoNomeDiverso r={primo} />
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
                <p className="text-[13.5px] mb-1" style={{ color: 'var(--color-stone)' }}>
                  {fmtData(r.check_in)} → {fmtData(r.check_out)} · {r.room_name} · €{Math.round(r.total_amount)}
                </p>
                <AvvisoNomeDiverso r={r} />
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
