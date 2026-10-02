'use client'
// ============================================================================
// IL RIQUADRO DEL DITO PREMUTO (versione D, approvata da Ania il 02/10/2026).
//
// Il dito (o il tasto del mouse) fermo 500 ms su una scheda del Calendario lo
// apre; alzando il dito sparisce, subito, senza animazione. Non è un foglio:
// niente tasti, niente Annulla/Conferma, nessuna scritta in fondo. Velo e
// riquadro hanno pointer-events: none, così il pointerup arriva alla scheda
// sotto il dito (components/calendario/SchedaPrenotazione).
//   · telefono: 14 px dai bordi, in alto a 120 px; se non ci sta, al centro
//   · Mac: largo al massimo 420 px, al centro
// Compare in dissolvenza in 120 ms (app/maison.css, .cal-pk).
// ============================================================================
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function RiquadroPremuto({ filo, mac, children }: {
  /** il colore della scheda premuta: il filo in alto */
  filo: string
  mac: boolean
  children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [centro, setCentro] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || mac) return
    // 120 px dall'alto, 16 px d'aria sotto: se non ci sta va al centro
    setCentro(120 + el.scrollHeight > window.innerHeight - 16)
  }, [mac, children])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="mz" data-riquadro-premuto>
      <div className="cal-pk-velo" aria-hidden />
      <div ref={ref} role="dialog" aria-live="polite" className={`cal-pk${mac ? ' mac' : centro ? ' centro' : ''}`} style={{ '--pk-filo': filo } as CSSProperties}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
