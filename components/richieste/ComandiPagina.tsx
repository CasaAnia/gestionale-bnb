'use client'
import Link from 'next/link'

// ============================================================================
// «+ NUOVA RICHIESTA» (Ania, su bozza, 12/09/2026).
//
// Qui restava l'ultimo dei comandi disegnati a mano per questa pagina. Gli
// altri se ne sono andati tutti al posto loro:
//
//  · «Reale | Presunta» → components/InterruttorePillola, la stessa pillola
//    del Calendario;
//  · ordinamento e «da guardare» → components/richieste/FasciaComandi, la
//    fascia con le voci in maiuscolo;
//  · le etichettine colorate degli avvisi non ci sono più.
// ============================================================================

export const ALTEZZA_TASTO = 24
export const ANGOLI_VOCE = 4

// Alto 24 px, fondo sage, testo green-mid 11,5 bold, angoli 4, 9 px ai lati.
// Niente contorno e niente verde pieno: il verde pieno è dell'azione.
export function TastoNuovaRichiesta({ testo = '+ Nuova richiesta', className = '' }: { testo?: string; className?: string }) {
  return (
    <Link href="/richieste/nuova" data-nuova-richiesta
      className={`inline-flex items-center justify-center shrink-0 bg-sage text-green-mid ${className}`}
      style={{ height: ALTEZZA_TASTO, padding: '0 9px', borderRadius: ANGOLI_VOCE, fontSize: 11.5, fontWeight: 700 }}>
      {testo}
    </Link>
  )
}
