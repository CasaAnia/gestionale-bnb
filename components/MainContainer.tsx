'use client'
import { usePathname } from 'next/navigation'

// Larghezza del contenuto. Quasi tutte le pagine sono centrate a larghezza
// media (moduli e liste si leggono meglio raccolti). Calendario, Arrivi e
// Statistiche restano a piena larghezza: hanno griglie e grafici che chiedono
// spazio.
// Richieste: calendario e lista affiancati chiedono tutta la larghezza.
const FULL_WIDTH = ['/calendario', '/arrivi', '/statistiche', '/richieste']

// Su desktop il contenuto è ingrandito del 20%. --zoom-pagina lo dice alla
// testa del Mac (TestaMac, .titolo-mac), che si rimpicciolisce di tanto:
// titolo a 30 px e bordo alto a 64 px VERI, come nelle pagine senza zoom. Calendario e Arrivi sono
// esclusi: le loro griglie hanno già un ingrandimento proprio (GRID_SCALE).
const NO_ZOOM = ['/calendario', '/arrivi', '/richieste', '/clienti']   // Clienti Maison (29/09/2026): misure vere anche dal Mac

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const full = FULL_WIDTH.some(p => pathname.startsWith(p))
  // La Home «Maison» (28/09/2026) resta a 768 px centrata, senza ingrandimento;
  // così anche la «Nuova prenotazione» nella stessa veste
  const zoom = pathname !== '/' && pathname !== '/nuova-prenotazione' && !NO_ZOOM.some(p => pathname.startsWith(p))
  return (
    <div className={`mx-auto w-full ${full ? 'max-w-lg lg:max-w-full' : 'max-w-lg lg:max-w-3xl'} ${zoom ? 'lg:[zoom:1.2] lg:[--zoom-pagina:1.2]' : ''}`}>
      {children}
    </div>
  )
}
