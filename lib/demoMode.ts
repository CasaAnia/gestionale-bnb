'use client'
// Modalità dimostrazione: nasconde le sezioni spese (B&B + Famiglia) quando
// si passa il gestionale a qualcun altro. Attivazione con un tocco, ritorno
// solo con PIN. Tutto lato browser (localStorage): protegge da chi guarda il
// telefono, non è una cassaforte contro un tecnico.

const PIN_KEY = 'ca_demo_pin'
const MODE_KEY = 'ca_demo_mode'
const EVT = 'ca-demo-change'

// Rotte nascoste in modalità dimostrazione.
export const DEMO_HIDDEN = ['/spese', '/spese-famiglia']

const ls = () => (typeof window === 'undefined' ? null : window.localStorage)

export function getDemoPin(): string { return ls()?.getItem(PIN_KEY) || '' }
export function hasDemoPin(): boolean { return getDemoPin().length > 0 }
export function setDemoPin(pin: string) { ls()?.setItem(PIN_KEY, pin); emit() }

export function isDemoMode(): boolean { return ls()?.getItem(MODE_KEY) === '1' }
export function enableDemo() { if (hasDemoPin()) { ls()?.setItem(MODE_KEY, '1'); emit() } }
export function disableDemo(pin: string): boolean {
  if (pin && pin === getDemoPin()) { ls()?.removeItem(MODE_KEY); emit(); return true }
  return false
}

// true se la rotta è tra quelle nascoste (in dimostrazione).
export function isHiddenPath(path: string): boolean {
  return DEMO_HIDDEN.some(p => path === p || path.startsWith(p + '/'))
}

function emit() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT)) }

// Notifica i componenti quando la modalità cambia (stessa scheda + altre schede).
export function onDemoChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}
