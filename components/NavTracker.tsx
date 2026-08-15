'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getDepth, setDepth } from '@/lib/navHistory'

// Tiene aggiornato il conteggio delle pagine visitate (vedi lib/navHistory).
//
// - A ogni cambio di pagina il conteggio sale di 1.
// - Se il cambio arriva da un "indietro" del browser (evento popstate),
//   scende di 1: stiamo tornando su una pagina già contata.
// - Alla prima apertura dell'app il conteggio riparte da zero; dopo una
//   semplice ricarica invece resta com'era, perché la cronologia del browser
//   è ancora lì.
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
      return
    }
    if (tornatoIndietro.current) {
      tornatoIndietro.current = false
      setDepth(getDepth() - 1)
    } else {
      setDepth(getDepth() + 1)
    }
  }, [pathname])

  return null
}
