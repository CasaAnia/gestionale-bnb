'use client'
// Conferma volante dopo un salvataggio (Ania, 11/09/2026: «quando registro il
// pagamento il bottone sbiadisce e basta: mettimi un piccolo pop-up, sì è
// stato registrato»). Provata e corretta due volte lo stesso giorno: prima era
// una striscia in basso («preferirei un pop-up di due o tre centimetri
// all'altezza di metà telefono»), poi il verde scuro («fallo verdino, quello
// del box degli arrivi») e il testo su DUE righe. Così com'è ora: riquadro
// largo 320 px e alto ~135 (circa 2,5 cm), un po' SOPRA la metà dello schermo,
// fondo var(--color-sage) come il riquadro dell'arrivo nella scheda, scritte
// verde scuro, nessun bordo nero. Resta pochi secondi e se ne va da solo; un
// tocco lo chiude subito. Si muovono solo opacità e scala, con le curve già
// usate dalle altre comparse (app/globals.css); con «riduci movimento»
// l'animazione sparisce.
import { useEffect, useRef, useState } from 'react'
import type { ConfermaPagamento } from '@/lib/confermaPagamento'

export const DURATA_CONFERMA = 3200
const USCITA = 160

export default function ConfermaVolante({ righe, onChiudi, durata = DURATA_CONFERMA }: { righe: ConfermaPagamento; onChiudi: () => void; durata?: number }) {
  // Una conferma nuova rimonta il componente (il chiamante passa una `key`):
  // lo stato riparte da solo, senza toccarlo dentro l'effetto.
  const [uscita, setUscita] = useState(false)
  const chiudi = useRef(onChiudi)
  useEffect(() => { chiudi.current = onChiudi }, [onChiudi])
  useEffect(() => {
    const via = window.setTimeout(() => setUscita(true), Math.max(0, durata - USCITA))
    const fine = window.setTimeout(() => chiudi.current(), durata)
    return () => { window.clearTimeout(via); window.clearTimeout(fine) }
  }, [durata])
  return (
    // Il padding in basso alza il riquadro di circa mezzo pollice sopra la metà
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6 pb-[16vh] pointer-events-none" data-conferma-volante>
      <button type="button" role="status" aria-live="polite" onClick={() => chiudi.current()}
        className={`pointer-events-auto w-full max-w-[320px] min-h-[135px] rounded-3xl px-6 py-5 flex flex-col items-center justify-center gap-1.5 text-center ${uscita ? 'conferma-out' : 'conferma-in'}`}
        style={{
          background: 'var(--color-sage)', color: 'var(--color-green-dark)',
          // Filo verde tenue (mai nero) + ombra: serve a staccarlo quando
          // capita sopra il riquadro dell'arrivo, che è dello stesso verdino
          border: '1px solid rgba(45,106,79,0.22)', boxShadow: '0 14px 34px rgba(31,61,47,0.26)',
        }}>
        <span aria-hidden className="text-2xl leading-none" style={{ color: 'var(--color-green-mid)' }}>✓</span>
        <span className="text-[17px] font-semibold leading-snug">{righe.prima}</span>
        <span className="text-[15px] leading-snug" style={{ color: 'var(--color-green-mid)' }}>{righe.seconda}</span>
      </button>
    </div>
  )
}
