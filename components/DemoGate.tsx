'use client'
import { useState } from 'react'
import { useDemoMode } from '@/lib/useDemoMode'
import { disableDemo } from '@/lib/demoMode'
import BackBar from './BackBar'

// Avvolge il contenuto di una sezione privata. In modalità dimostrazione
// mostra una schermata di blocco: per rientrare serve il PIN.
export default function DemoGate({ children }: { children: React.ReactNode }) {
  const demo = useDemoMode()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  if (!demo) return <>{children}</>

  return (
    <div className="p-4">
      <BackBar href="/" />
      <div className="bg-white rounded-[10px] border border-card-border p-6 text-center mt-6 shadow-sm">
        <div className="text-3xl mb-2">🔒</div>
        <p className="font-serif text-lg text-green-dark mb-1">Sezione nascosta</p>
        <p className="text-sm text-gray-500 mb-4">Modalità dimostrazione attiva. Inserisci il PIN per rientrare.</p>
        <form onSubmit={e => { e.preventDefault(); if (disableDemo(pin)) { setErr(false); setPin('') } else setErr(true) }}>
          <input inputMode="numeric" type="password" value={pin} autoFocus
            onChange={e => { setPin(e.target.value); setErr(false) }} placeholder="PIN"
            className="w-full border border-card-border rounded-lg p-3 text-center tracking-widest mb-2" />
          {err && <p className="text-xs text-[#8C3B2E] mb-2">PIN errato</p>}
          <button type="submit" className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold">Sblocca</button>
        </form>
      </div>
    </div>
  )
}
