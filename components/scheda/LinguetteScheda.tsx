'use client'
// ============================================================================
// LE CINQUE LINGUETTE della scheda «Maison» (riferimento del 28/09/2026):
// Oggi · Soggiorno (con sotto le date) · Conto (con sotto «resta 470 €» in
// mattone, o «saldato») · Messaggi · Cliente. Fili d'ottone sopra e sotto;
// la linguetta attiva ha il filo d'ottone sotto; il puntino mattone in alto a
// destra dice che lì c'è qualcosa di «Da controllare».
//
// Si vede UNA parte alla volta: la scelta sta nell'indirizzo (#oggi,
// #soggiorno, …) così i link di prima (#conto, #cliente, #arrivo,
// #messaggi) continuano a portare al posto giusto. Le regole stanno in
// lib/schedaMaison (linguettaDaHash, puntiniLinguette).
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { LINGUETTE, linguettaDaHash, type Linguetta } from '@/lib/schedaMaison'

/** La linguetta scelta, letta e scritta nell'indirizzo (#conto) */
export function useLinguetta(): [Linguetta, (l: Linguetta) => void] {
  const [scelta, setScelta] = useState<Linguetta>('oggi')
  useEffect(() => {
    const leggi = () => setScelta(linguettaDaHash(window.location.hash))
    leggi()
    window.addEventListener('hashchange', leggi)
    return () => window.removeEventListener('hashchange', leggi)
  }, [])
  const scegli = useCallback((l: Linguetta) => {
    setScelta(l)
    // replaceState: cambiare linguetta non riempie la cronologia di «Indietro»
    const url = `${window.location.pathname}${window.location.search}#${l}`
    window.history.replaceState(window.history.state, '', url)
  }, [])
  return [scelta, scegli]
}

export default function LinguetteScheda({ scelta, onScegli, periodo, conto, puntini }: {
  scelta: Linguetta
  onScegli: (l: Linguetta) => void
  /** sotto «Soggiorno»: «28 set → 4 ott» */
  periodo: string
  /** sotto «Conto»: «resta 470 €» (mattone) o «saldato»; null = niente */
  conto: { testo: string; resta: boolean } | null
  puntini: Linguetta[]
}) {
  return (
    <nav className="sch-tabs" role="tablist" aria-label="Parti della prenotazione" data-linguette>
      {LINGUETTE.map(l => (
        <button key={l.id} type="button" role="tab" aria-selected={scelta === l.id} aria-controls={`parte-${l.id}`}
          data-linguetta={l.id} data-attiva={scelta === l.id || undefined} className={scelta === l.id ? 'on' : ''}
          onClick={() => onScegli(l.id)}>
          {l.label}
          {l.id === 'soggiorno' && periodo && <small data-periodo-linguetta>{periodo}</small>}
          {l.id === 'conto' && conto && <small data-conto-linguetta className={conto.resta ? 'mat' : ''}>{conto.testo}</small>}
          {puntini.includes(l.id) && <b className="punto" data-puntino={l.id} aria-label="qualcosa da sistemare" />}
        </button>
      ))}
    </nav>
  )
}
