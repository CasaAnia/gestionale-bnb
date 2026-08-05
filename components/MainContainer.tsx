'use client'
import { usePathname } from 'next/navigation'

// Larghezza del contenuto. Quasi tutte le pagine sono centrate a larghezza
// media (moduli e liste si leggono meglio raccolti). Calendario, Arrivi e
// Statistiche restano a piena larghezza: hanno griglie e grafici che chiedono
// spazio.
const FULL_WIDTH = ['/calendario', '/arrivi', '/statistiche']

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const full = FULL_WIDTH.some(p => pathname.startsWith(p))
  return (
    <div className={`mx-auto w-full ${full ? 'max-w-lg lg:max-w-full' : 'max-w-lg lg:max-w-3xl'}`}>
      {children}
    </div>
  )
}
