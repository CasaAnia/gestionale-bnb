'use client'
// Interruttore Reale / Presunta del calendario richieste: la scelta resta
// memorizzata nel browser (localStorage) tra una visita e l'altra.
// useSyncExternalStore: sul server vale sempre «presunta», nel browser il
// valore salvato, senza scritture di stato dentro un effect.
import { useSyncExternalStore } from 'react'

export type Vista = 'reale' | 'presunta'
const KEY = 'ca_richieste_vista'
const EVT = 'ca-richieste-vista'

function leggi(): Vista {
  try { return window.localStorage.getItem(KEY) === 'reale' ? 'reale' : 'presunta' } catch { return 'presunta' }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}

export function useVista(): [Vista, (v: Vista) => void] {
  const vista = useSyncExternalStore(subscribe, leggi, () => 'presunta' as Vista)
  const imposta = (v: Vista) => {
    try { window.localStorage.setItem(KEY, v) } catch { /* senza memoria resta per la sessione */ }
    window.dispatchEvent(new Event(EVT))
  }
  return [vista, imposta]
}

// true da 768px in su (griglia desktop); sul server e al primo disegno vale
// il telefono, che è il caso più frequente.
export function useDesktop(): boolean {
  return useSyncExternalStore(
    cb => { const mq = window.matchMedia('(min-width: 768px)'); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb) },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  )
}
