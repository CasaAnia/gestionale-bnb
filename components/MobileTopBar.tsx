'use client'
import { usePathname } from 'next/navigation'

// Titolo di sezione mostrato nella barra in alto su mobile (match per prefisso)
const SECTION_TITLES: [string, string][] = [
  ['/calendario', 'Calendario'],
  ['/arrivi', 'Arrivi'],
  ['/pulizie', 'Pulizie'],
  ['/prenotazioni', 'Prenotazioni'],
  ['/nuova', 'Nuova prenotazione'],
  ['/clienti', 'Clienti'],
  ['/spese', 'Spese'],
  ['/statistiche', 'Report'],
  ['/impostazioni', 'Impostazioni'],
]

export default function MobileTopBar() {
  const pathname = usePathname()
  const entry = SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))
  const title = entry ? entry[1] : 'Casa Ania'
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-cream/95 backdrop-blur-sm border-b-[0.5px] border-[#E9E2D2] h-12 flex items-center justify-center">
      <span className="font-serif text-lg text-green-dark">{title}</span>
    </header>
  )
}
