'use client'
import type { Vista } from '@/lib/richiesteVista'

// Segmented control a due voci. Reale = solo prenotazioni confermate;
// Presunta = confermate più richieste in attesa / con proposta inviata.
export default function InterruttoreVista({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  return (
    <div role="group" aria-label="Vista del calendario" className="inline-flex shrink-0 rounded-full border bg-white p-0.5" style={{ borderColor: '#C9BFA8' }}>
      {([['reale', 'Reale'], ['presunta', 'Presunta']] as const).map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={vista === v}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${vista === v ? 'bg-green-mid text-cream-text' : 'text-green-dark'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
