'use client'
import type { MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Phone } from 'lucide-react'
import { nomeCompleto, type Richiesta } from '@/lib/richieste'
import { normalizzaTelefono, openWhatsApp } from '@/lib/whatsapp'

// Pulsanti sotto una richiesta (lista e pannello del calendario):
//  in_attesa        → «Invia proposta» (pieno) + «Modifica» + «Rifiuta» (contorno)
//  proposta_inviata → «Conferma» (pieno: apre «Creare la prenotazione?») + «Modifica» + «Rifiuta»
// «Modifica» (pezzo 9) apre /richieste/<id>/modifica: stesso modulo della nuova, precompilato.
// Rifiuto e conferma veri (con le loro finestre) li gestisce chi contiene.
type Props = { r: Richiesta; onRifiuta: (r: Richiesta) => void; onConferma: (r: Richiesta) => void; compatto?: boolean }

// desktop (blocco 2b): pulsanti allineati a destra su una riga, larghezza dal contenuto
const PIENO = 'flex-1 md:flex-none md:px-5 inline-flex items-center justify-center rounded-xl bg-green-mid text-cream-text font-semibold active:opacity-80 transition-opacity'
const CONTORNO = 'flex-1 md:flex-none md:px-5 inline-flex items-center justify-center rounded-xl bg-white text-green-dark font-semibold border active:bg-sage transition-colors'
const CONTATTO = 'shrink-0 w-11 inline-flex items-center justify-center rounded-xl bg-white text-green-dark border active:bg-sage transition-colors'

export default function AzioniRichiesta({ r, onRifiuta, onConferma, compatto = false }: Props) {
  const router = useRouter()
  if (r.stato !== 'in_attesa' && r.stato !== 'proposta_inviata') return null
  const misura = compatto ? 'py-2 text-[13px]' : 'py-2.5 text-sm'
  const telefono = normalizzaTelefono(r.telefono).numero
  const nome = nomeCompleto(r)

  function ferma(e: MouseEvent) { e.stopPropagation() }

  return (
    <div className="mt-3" onClick={ferma}>
      <div className="flex gap-2 md:justify-end">
        {r.stato === 'in_attesa' ? (
          <button type="button" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/proposta`) }} className={`${PIENO} ${misura}`}>
            Invia proposta
          </button>
        ) : (
          <button type="button" onClick={e => { ferma(e); onConferma(r) }} className={`${PIENO} ${misura}`}>Conferma</button>
        )}
        <button type="button" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/modifica`) }} className={`${CONTORNO} ${misura}`} style={{ borderColor: '#C9BFA8' }}>
          Modifica
        </button>
        <button type="button" onClick={e => { ferma(e); onRifiuta(r) }} className={`${CONTORNO} ${misura}`} style={{ borderColor: '#C9BFA8' }}>
          Rifiuta
        </button>
        {telefono && (
          <>
            <a href={`tel:${telefono}`} onClick={ferma} aria-label={`Chiama ${nome}`} title="Chiama il cliente"
              className={`${CONTATTO} ${misura}`} style={{ borderColor: '#C9BFA8' }}>
              <Phone size={17} strokeWidth={2} aria-hidden />
            </a>
            <a href={`https://wa.me/${telefono}`} target="_blank" rel="noopener noreferrer" onClick={e => { ferma(e); e.preventDefault(); openWhatsApp(telefono, '') }} aria-label={`Scrivi su WhatsApp a ${nome}`} title="Apri WhatsApp senza testo"
              className={`${CONTATTO} ${misura}`} style={{ borderColor: '#C9BFA8', color: '#2D6A4F' }}>
              <MessageCircle size={17} strokeWidth={2} aria-hidden />
            </a>
          </>
        )}
      </div>
    </div>
  )
}
