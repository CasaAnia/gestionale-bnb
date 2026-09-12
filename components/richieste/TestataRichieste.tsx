'use client'
import { sottotitoloRichieste } from '@/lib/testataRichieste'

// La testa della pagina. Dal 12/09/2026 (Ania, dal telefono) è UNA riga sola:
//
//   4 aperte · 2 nuove dal sito
//
// Il titolo «Richieste» in Georgia che stava sopra è stato tolto: la barra in
// alto della pagina dice già dove si è, e leggerlo due volte ruba una riga di
// schermo. Il conto è la prima cosa che si legge, in 13,5 px color stone.
export default function TestataRichieste({ aperte, nuoveDalSito, mostraConto = true, className = '' }: {
  aperte: number
  nuoveDalSito: number
  mostraConto?: boolean
  className?: string
}) {
  return (
    <div data-testata-richieste className={`min-w-0 ${className}`}>
      {mostraConto && (
        <p data-conto-richieste style={{ fontSize: 13.5, color: 'var(--color-stone)' }}>
          {sottotitoloRichieste({ aperte, nuoveDalSito })}
        </p>
      )}
    </div>
  )
}
