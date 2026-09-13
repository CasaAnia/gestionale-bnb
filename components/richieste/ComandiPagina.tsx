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

export const ALTEZZA_TASTO = 30
export const ANGOLI_TASTO = 6

// Alto 30 px, fondo sage, testo green-mid 13 bold, angoli 6, 12 px ai lati
// (Ania, 13/09/2026: a 24 px era diventato troppo piccolo). Niente contorno e
// niente verde pieno: il verde pieno è dell'azione.
//
// Sotto il calendario sta accanto all'interruttore Reale/Presunta, che è alto
// 30,5 px: adesso sono la stessa cosa, e `items-center` della riga tiene le
// due cose sullo stesso asse.
export function TastoNuovaRichiesta({ testo = '+ Nuova richiesta', className = '' }: { testo?: string; className?: string }) {
  return (
    <Link href="/richieste/nuova" data-nuova-richiesta
      className={`inline-flex items-center justify-center shrink-0 leading-none bg-sage text-green-mid ${className}`}
      style={{ height: ALTEZZA_TASTO, padding: '0 12px', borderRadius: ANGOLI_TASTO, fontSize: 13, fontWeight: 700 }}>
      {testo}
    </Link>
  )
}
