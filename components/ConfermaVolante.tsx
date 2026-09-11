'use client'
// Conferma volante dopo un salvataggio (Ania, 11/09/2026: «quando registro il
// pagamento il bottone sbiadisce e basta: mettimi un piccolo pop-up, sì è
// stato registrato»). Compare in basso sopra la barra dei tasti, resta pochi
// secondi e se ne va da sola; un tocco la chiude subito. Nessun bordo nero:
// fondo verde scuro del gestionale, testo crema, ombra leggera. Si muovono
// solo opacità e posizione, con le curve già usate dalle altre comparse
// (app/globals.css); con «riduci movimento» l'animazione sparisce.
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
    <div className="fixed left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6"
      data-conferma-volante>
      <button type="button" role="status" aria-live="polite" onClick={() => chiudi.current()}
        className={`pointer-events-auto max-w-[92vw] rounded-full px-4 py-2.5 text-sm font-semibold text-left ${uscita ? 'conferma-out' : 'conferma-in'}`}
        style={{ background: 'var(--color-green-dark)', color: 'var(--color-cream-text)', boxShadow: '0 6px 18px rgba(31,61,47,0.22)' }}>
        ✓ {testo}
      </button>
    </div>
  )
}
