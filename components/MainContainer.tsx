'use client'
import { usePathname } from 'next/navigation'

// Larghezza del contenuto. Quasi tutte le pagine sono centrate a larghezza
// media (moduli e liste si leggono meglio raccolti). Calendario, Arrivi e
// Statistiche restano a piena larghezza: hanno griglie e grafici che chiedono
// spazio.
// Richieste: calendario e lista affiancati chiedono tutta la larghezza.
const FULL_WIDTH = ['/calendario', '/arrivi', '/statistiche', '/richieste']

// Su desktop il contenuto è ingrandito del 20%. Calendario e Arrivi sono
// esclusi: le loro griglie hanno già un ingrandimento proprio (GRID_SCALE).
const NO_ZOOM = ['/calendario', '/arrivi', '/richieste']

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const full = FULL_WIDTH.some(p => pathname.startsWith(p))
  const zoom = !NO_ZOOM.some(p => pathname.startsWith(p))
  return (
    <div className={`mx-auto w-full ${full ? 'max-w-lg lg:max-w-full' : 'max-w-lg lg:max-w-3xl'} ${zoom ? 'lg:[zoom:1.2]' : ''}`}>
      {children}
    </div>
  )
}
