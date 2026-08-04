'use client'
import { useEffect, useState } from 'react'
import { isDemoMode, onDemoChange } from './demoMode'

// Hook che tiene il componente sincronizzato con la modalità dimostrazione.
// Parte da false lato server per evitare mismatch di hydration, poi legge
// il valore vero al montaggio.
export function useDemoMode(): boolean {
  const [demo, setDemo] = useState(false)
  useEffect(() => {
    const sync = () => setDemo(isDemoMode())
    sync()
    return onDemoChange(sync)
  }, [])
  return demo
}
