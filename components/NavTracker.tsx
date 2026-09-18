'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getDepth, setDepth, ricordaPagina } from '@/lib/navHistory'

// Tiene aggiornato il conteggio delle pagine visitate (vedi lib/navHistory).
//
// - A ogni cambio di pagina il conteggio sale di 1.
// - Se il cambio arriva da un "indietro" del browser (evento popstate),
//   scende di 1: stiamo tornando su una pagina già contata.
// - Alla prima apertura dell'app il conteggio riparte da zero; dopo una
//   semplice ricarica invece resta com'era, perché la cronologia del browser
//   è ancora lì.
// - In più tiene la fila delle pagine visitate (lib/navHistory.ricordaPagina),
//   che sopravvive alle ricariche del telefono: è la riserva di «Indietro»
//   quando la cronologia non si può usare (Ania, 18/09/2026).
export default function NavTracker() {
  const pathname = usePathname()
  const tornatoIndietro = useRef(false)
  const primoAvvio = useRef(true)

  useEffect(() => {
    const onPop = () => { tornatoIndietro.current = true }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (primoAvvio.current) {
      primoAvvio.current = false
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      const ricarica = nav && (nav.type === 'reload' || nav.type === 'back_forward')
      if (!ricarica) setDepth(0)
      ricordaPagina(pathname, false)
      return
    }
    if (tornatoIndietro.current) {
      tornatoIndietro.current = false
      setDepth(getDepth() - 1)
      ricordaPagina(pathname, true)
    } else {
      setDepth(getDepth() + 1)
      ricordaPagina(pathname, false)
    }
  }, [pathname])

  return null
}
