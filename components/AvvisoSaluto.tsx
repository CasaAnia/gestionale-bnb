'use client'
// La riga «controlla il nome» sopra i tasti che mandano un messaggio.
// Le parole stanno in lib/avvisoSaluto; qui si decide solo come si vede.
// Niente bordi neri: fondo tenue e scritta scura (Ania).
import type { Saluto } from '@/lib/guestName'
import { avvisoSaluto } from '@/lib/avvisoSaluto'

export default function AvvisoSaluto({ saluto, className = '' }: { saluto: Saluto; className?: string }) {
  const avviso = avvisoSaluto(saluto)
  if (!avviso) return null
  return (
    <p data-avviso-nome={avviso.blocca ? 'blocca' : 'controlla'}
      className={`rounded-xl px-3 py-2 ${className}`}
      style={{
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.45,
        color: avviso.blocca ? '#8C3B2E' : 'var(--color-green-dark)',
        background: avviso.blocca ? '#F6E7E3' : 'var(--color-sage)',
      }}>
      {avviso.testo}
    </p>
  )
}
