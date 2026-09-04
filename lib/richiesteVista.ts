'use client'
// Interruttore Reale / Presunta del calendario richieste: la scelta resta
// memorizzata nel browser (localStorage) tra una visita e l'altra.
// useSyncExternalStore: sul server vale sempre «presunta», nel browser il
// valore salvato, senza scritture di stato dentro un effect.
import { useEffect, useState, useSyncExternalStore } from 'react'

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

// Ora corrente che avanza da sola ogni minuto (timer della proposta), senza
// ricaricare la pagina; si riallinea subito quando la scheda torna in primo
// piano (ritorno da WhatsApp). Al primo disegno vale l'ora di apertura.
export function useAdesso(intervalloMs = 60000): Date {
  const [adesso, setAdesso] = useState(() => new Date())
  useEffect(() => {
    const aggiorna = () => setAdesso(new Date())
    const t = setInterval(aggiorna, intervalloMs)
    const onVisibile = () => { if (document.visibilityState === 'visible') aggiorna() }
    document.addEventListener('visibilitychange', onVisibile)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisibile) }
  }, [intervalloMs])
  return adesso
}
