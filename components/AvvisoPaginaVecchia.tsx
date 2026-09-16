'use client'
// ============================================================================
// LA RIGA IN OTTONE sopra le pagine vecchie (16/09/2026): la scheda completa
// (/prenotazioni/<id>) e l'inserimento di prima (/nuova) restano raggiungibili
// scrivendo l'indirizzo a mano, ma nessun link del gestionale ci porta più.
// In cima dicono che sono quelle vecchie e dove si apre quella nuova.
// Sta in un layout, così i due file delle pagine non si toccano.
// ============================================================================
import Link from 'next/link'

export const TESTO_PAGINA_VECCHIA = 'Questa è la pagina vecchia. Quella nuova si apre da'

export default function AvvisoPaginaVecchia({ href, testoLink }: { href: string; testoLink: string }) {
  return (
    <p data-pagina-vecchia className="text-center" style={{ padding: '8px 16px 0', fontSize: 12.5, color: '#A9884E' }}>
      {TESTO_PAGINA_VECCHIA}{' '}
      <Link href={href} className="underline underline-offset-2" style={{ fontWeight: 600, color: '#A9884E' }}>{testoLink}</Link>
    </p>
  )
}
