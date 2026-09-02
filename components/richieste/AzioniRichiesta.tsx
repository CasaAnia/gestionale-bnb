'use client'
import { useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Richiesta } from '@/lib/richieste'

// Pulsanti sotto una richiesta (lista e pannello del calendario):
//  in_attesa        → «Invia proposta» (pieno) + «Rifiuta» (contorno)
//  proposta_inviata → «Conferma» (pieno, per ora solo un avviso) + «Rifiuta»
// Il rifiuto vero (con la finestra di conferma) lo gestisce chi contiene.
type Props = { r: Richiesta; onRifiuta: (r: Richiesta) => void; compatto?: boolean }

const PIENO = 'flex-1 inline-flex items-center justify-center rounded-xl bg-green-mid text-cream-text font-semibold active:opacity-80 transition-opacity'
const CONTORNO = 'flex-1 inline-flex items-center justify-center rounded-xl bg-white text-green-dark font-semibold border active:bg-sage transition-colors'

export default function AzioniRichiesta({ r, onRifiuta, compatto = false }: Props) {
  const router = useRouter()
  const [avviso, setAvviso] = useState<string | null>(null)
  if (r.stato !== 'in_attesa' && r.stato !== 'proposta_inviata') return null
  const misura = compatto ? 'py-2 text-[13px]' : 'py-2.5 text-sm'

  function ferma(e: MouseEvent) { e.stopPropagation() }
  function conferma(e: MouseEvent) {
    ferma(e)
    setAvviso('Arriva nel prossimo pezzo.')
    setTimeout(() => setAvviso(null), 2500)
  }

  return (
    <div className="mt-3" onClick={ferma}>
      <div className="flex gap-2">
        {r.stato === 'in_attesa' ? (
          <button type="button" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/proposta`) }} className={`${PIENO} ${misura}`}>
            Invia proposta
          </button>
        ) : (
          <button type="button" onClick={conferma} className={`${PIENO} ${misura}`}>Conferma</button>
        )}
        <button type="button" onClick={e => { ferma(e); onRifiuta(r) }} className={`${CONTORNO} ${misura}`} style={{ borderColor: '#C9BFA8' }}>
          Rifiuta
        </button>
      </div>
      {avviso && <p className="chip-in text-xs text-stone mt-1.5" role="status">{avviso}</p>}
    </div>
  )
}
