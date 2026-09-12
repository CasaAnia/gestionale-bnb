'use client'
import { TITOLO_RICHIESTE, sottotitoloRichieste } from '@/lib/testataRichieste'

// La testa della pagina (Ania, su bozza, 12/09/2026): «Richieste» in Georgia
// 26 px e sotto, piccola e grigia, una riga che dice come sta la pagina —
// «4 aperte · 2 nuove dal sito». Prima c'era «Richieste di prenotazione», che
// sul telefono veniva nascosto e lasciava solo un vuoto.
const GEORGIA = "Georgia, 'Times New Roman', serif"

export default function TestataRichieste({ aperte, nuoveDalSito, mostraConto = true, className = '' }: {
  aperte: number
  nuoveDalSito: number
  mostraConto?: boolean
  className?: string
}) {
  return (
    <div data-testata-richieste className={`min-w-0 ${className}`}>
      <h1 style={{ fontFamily: GEORGIA, fontSize: 26, lineHeight: 1.15, color: 'var(--color-green-dark)' }}>{TITOLO_RICHIESTE}</h1>
      {mostraConto && (
        <p data-conto-richieste className="mt-0.5" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>
          {sottotitoloRichieste({ aperte, nuoveDalSito })}
        </p>
      )}
    </div>
  )
}
