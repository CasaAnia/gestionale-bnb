'use client'
// Finestra che compare all'apertura del gestionale quando ci sono richieste
// dal sito da confermare: Ania chiama sempre il cliente prima di confermare,
// quindi la finestra propone subito "Chiama". "Dopo" la nasconde per la
// sessione, ma richieste NUOVE la fanno ricomparire (la firma cambia).
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { fetchWebRequests, type WebRequest } from '@/lib/webRequests'
import { leggiMemoria, scriviMemoria } from '@/lib/memoriaBrowser'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'

/** il foglio della richiesta dal sito: una richiesta col nome diverso e un'altra sotto */
export const ALTEZZA_RICHIESTA_SITO = 460

const DISMISS_KEY = 'ca_webreq_dismissed'
// Memoria della sessione: NON è Supabase. Se il browser la nega (navigazione
// privata, spazio esaurito) il ripiego è esplicito e prudente: la finestra si
// ripropone a ogni apertura del gestionale (parte 3, 05/09/2026), mai un
// errore a schermo per una cosa del browser.
const memoria = () => sessionStorage

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
    fetchWebRequests().then(({ richieste: reqs, errore }) => {
      // Con un errore di lettura la finestra non si apre: l'errore è visibile
      // nella home e col «!» sul bollino della barra, mai come «nessuna richiesta».
      if (errore) return
      setRequests(reqs)
      if (reqs.length === 0) return
      const firma = reqs.map(r => r.id).sort().join(',')
      // Senza memoria leggiMemoria torna null ≠ firma → la finestra si apre
      if (leggiMemoria(memoria, DISMISS_KEY) === firma) return
      setOpen(true)
    })
  }, [])

  if (!open || !requests || requests.length === 0 || pathname === '/login') return null
  const primo = requests[0]

  function chiudi() {
    // Se la scrittura non riesce la finestra si chiude lo stesso e tornerà
    // alla prossima apertura: ripiego voluto, nessun avviso
    scriviMemoria(memoria, DISMISS_KEY, requests!.map(r => r.id).sort().join(','))
    setOpen(false)
  }

  // Regola dei fogli (Ania, 01/10/2026): lo stesso foglio di tutto il
  // gestionale. Contenuto e comandi di sempre: «Chiama» è il link sopra,
  // «Dopo» a contorno e «Apri» pieno.
  return (
    <FoglioMaison titolo={primo.guest_name} sottotitolo="Richiesta dal sito" altezza={ALTEZZA_RICHIESTA_SITO} onChiudi={chiudi} dati="richiesta-sito"
      piede={<PiedeMaison testoAnnulla="Dopo" onAnnulla={chiudi} azione="Apri" onAzione={() => { chiudi(); router.push(`/scheda/${primo.id}`) }} dati="richiesta-sito"
        sopra={primo.guest_phone ? <a href={`tel:${primo.guest_phone}`} className="mz-lnk" data-chiama-richiesta>Chiama</a> : undefined} />}>
      <p className="mz-note" style={{ marginTop: 14, fontSize: 14, color: 'var(--m-ink)' }}>
        {primo.num_guests} {primo.num_guests === 1 ? 'persona' : 'persone'} · {fmtData(primo.check_in)} → {fmtData(primo.check_out)} · {primo.room_name} · €{Math.round(primo.total_amount)}
      </p>
      <AvvisoNomeDiverso r={primo} />
      {requests.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <span className="mz-lab">{requests.length - 1 === 1 ? '…e un’altra richiesta in attesa' : `…e altre ${requests.length - 1} richieste in attesa`}</span>
          {requests.slice(1).map(r => (
            <div key={r.id} style={{ marginBottom: 8 }}>
              <p style={{ fontFamily: 'var(--m-disp)', fontSize: 18 }}>{r.guest_name} <span className="mz-note" style={{ display: 'inline' }}>· {r.num_guests} {r.num_guests === 1 ? 'persona' : 'persone'}</span></p>
              <p className="mz-note" style={{ marginTop: 2 }}>{fmtData(r.check_in)} → {fmtData(r.check_out)} · {r.room_name} · €{Math.round(r.total_amount)}</p>
              <AvvisoNomeDiverso r={r} />
            </div>
          ))}
        </div>
      )}
      <p className="mz-hint">Chiama il cliente e poi conferma la prenotazione.</p>
    </FoglioMaison>
  )
}
