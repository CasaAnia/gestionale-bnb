'use client'
// Conferma volante dopo un salvataggio (Ania, 11/09/2026: «quando registro il
// pagamento il bottone sbiadisce e basta: mettimi un piccolo pop-up, sì è
// stato registrato»). Dalla seconda richiesta dello stesso giorno — «è una
// striscia piccola in basso: preferirei un pop-up di due o tre centimetri
// all'altezza di metà telefono» — è un riquadro CENTRATO sullo schermo, alto
// circa 2,5 cm (≈ 135 px), che resta pochi secondi e se ne va da solo; un
// tocco lo chiude subito. Nessun bordo nero: fondo verde scuro del
// gestionale, testo crema, ombra morbida. Si muovono solo opacità e scala,
// con le curve già usate dalle altre comparse (app/globals.css); con «riduci
// movimento» l'animazione sparisce.
import { useEffect, useRef, useState } from 'react'

export const DURATA_CONFERMA = 3200
const USCITA = 160

export default function ConfermaVolante({ testo, onChiudi, durata = DURATA_CONFERMA }: { testo: string; onChiudi: () => void; durata?: number }) {
  // Una conferma nuova rimonta il componente (il chiamante passa `key={testo}`):
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6 pointer-events-none" data-conferma-volante>
      <button type="button" role="status" aria-live="polite" onClick={() => chiudi.current()}
        className={`pointer-events-auto w-full max-w-[320px] min-h-[135px] rounded-3xl px-6 py-5 flex flex-col items-center justify-center gap-2 text-center ${uscita ? 'conferma-out' : 'conferma-in'}`}
        style={{ background: 'var(--color-green-dark)', color: 'var(--color-cream-text)', boxShadow: '0 14px 40px rgba(31,61,47,0.30)' }}>
        <span aria-hidden className="text-2xl leading-none">✓</span>
        <span className="text-[17px] font-semibold leading-snug">{testo}</span>
      </button>
    </div>
  )
}
