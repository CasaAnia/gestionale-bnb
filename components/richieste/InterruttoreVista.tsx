'use client'
import type { Vista } from '@/lib/richiesteVista'

// Interruttore a due voci. Reale = solo prenotazioni confermate; Presunta =
// confermate più richieste in attesa / con proposta inviata.
//
// Veste del 12/09/2026 (Ania, su bozza): la stessa del calendario della Home,
// cioè una pillola grigio crema con dentro le due parole e quella scelta su
// fondo bianco. Prima erano due bottoni grandi verdi e pesavano troppo sotto
// il calendario, dove serve spazio per vedere le richieste.
const CREMA = '#EFEADF'

export default function InterruttoreVista({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  return (
    <div role="group" aria-label="Vista del calendario" data-interruttore-vista
      className="inline-flex shrink-0 rounded-full" style={{ background: CREMA, padding: 3 }}>
      {([['reale', 'Reale'], ['presunta', 'Presunta']] as const).map(([v, label]) => {
        const scelta = vista === v
        return (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={scelta}
            className="rounded-full transition-colors"
            style={{
              padding: '5px 13px',
              fontSize: 12.5,
              fontWeight: 600,
              color: scelta ? 'var(--color-green-dark)' : 'var(--color-stone)',
              background: scelta ? '#fff' : 'transparent',
              boxShadow: scelta ? '0 1px 2px rgba(31,61,47,0.10)' : 'none',
            }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
