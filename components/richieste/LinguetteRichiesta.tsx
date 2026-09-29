'use client'
// ============================================================================
// LE QUATTRO LINGUETTE DELLA RICHIESTA (Richieste «Maison», novità 14d del
// 29/09/2026): CONTROLLARE · CAMERE · PAGAMENTO · MESSAGGIO, con la veste
// delle linguette della scheda prenotazione (.sch-tabs: fili d'ottone sopra e
// sotto, la linguetta attiva col filo d'ottone sotto).
//
// Dal telefono si vede UNA parte alla volta e la scelta sta nell'indirizzo
// (#controllare, #camere, #pagamento, #messaggio); all'apertura Controllare,
// Messaggio se la proposta è già inviata. Dal Mac le quattro parti stanno una
// sotto l'altra e la fascia porta alla sezione.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'

import { LINGUETTE_RICHIESTA, linguettaDaHash, type LinguettaRichiesta } from '@/lib/richiestaMaison'
export { LINGUETTE_RICHIESTA, linguettaDaHash, linguettaDiPartenza, type LinguettaRichiesta } from '@/lib/richiestaMaison'

/** La linguetta scelta, letta e scritta nell'indirizzo */
export function useLinguettaRichiesta(partenza: LinguettaRichiesta): [LinguettaRichiesta, (l: LinguettaRichiesta) => void] {
  const [scelta, setScelta] = useState<LinguettaRichiesta>(partenza)
  useEffect(() => {
    const leggi = () => setScelta(linguettaDaHash(window.location.hash, partenza))
    leggi()
    window.addEventListener('hashchange', leggi)
    return () => window.removeEventListener('hashchange', leggi)
  }, [partenza])
  const scegli = useCallback((l: LinguettaRichiesta) => {
    setScelta(l)
    // replaceState: cambiare linguetta non riempie la cronologia di «Indietro»
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${l}`)
    window.scrollTo({ top: 0 })
  }, [])
  return [scelta, scegli]
}

export default function LinguetteRichiesta({ scelta, onScegli, paginaUnica = false }: {
  scelta: LinguettaRichiesta
  onScegli: (l: LinguettaRichiesta) => void
  /** dal Mac: le parti una sotto l'altra, il tocco porta alla sezione */
  paginaUnica?: boolean
}) {
  return (
    <nav className="sch-tabs quattro" role="tablist" aria-label="Parti della richiesta" data-linguette-richiesta data-senza-sottolinea>
      {LINGUETTE_RICHIESTA.map(l => (
        <button key={l.id} type="button" role="tab" aria-selected={scelta === l.id} aria-controls={`parte-${l.id}`}
          data-linguetta={l.id} className={scelta === l.id ? 'on' : ''}
          onClick={() => {
            if (paginaUnica) {
              document.getElementById(`parte-${l.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${l.id}`)
            } else onScegli(l.id)
          }}>
          {l.label}
        </button>
      ))}
    </nav>
  )
}
