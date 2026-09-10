'use client'
import { usePathname } from 'next/navigation'
import { useAzioneIndietro } from './BackContext'

// Titolo di sezione mostrato nella barra in alto su mobile (match per prefisso)
const SECTION_TITLES: [string, string][] = [
  ['/calendario', 'Calendario'],
  ['/richieste/nuova', 'Nuova richiesta'],
  ['/richieste', 'Richieste'],
  ['/arrivi', 'Arrivi'],
  ['/pulizie', 'Pulizie'],
  ['/prenotazioni', 'Prenotazioni'],
  ['/nuova', 'Nuova prenotazione'],
  ['/clienti', 'Clienti'],
  ['/spese-famiglia', 'Spese Famiglia'],
  ['/spese', 'Spese B&B'],
  ['/statistiche', 'Report'],
  ['/impostazioni', 'Impostazioni'],
]

export default function MobileTopBar() {
  const pathname = usePathname()
  const indietro = useAzioneIndietro()
  if (pathname === '/login') return null
  const entry = SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))
  const title = entry ? entry[1] : 'Casa Ania'
  return (
    <header className="barra-alta lg:hidden fixed top-0 left-0 right-0 z-40 bg-cream/95 backdrop-blur-sm h-12 flex items-center justify-center">
      {/* Freccia di ritorno: c'è solo dove la pagina ha davvero un indietro.
          Sta fuori dal flusso (absolute) così il titolo resta al centro dello
          schermo, e occupa 48x48 per essere comoda da toccare. */}
      {indietro && (
        <button
          type="button"
          onClick={indietro.chiama}
          aria-label={indietro.label}
          className="absolute left-0 top-0 h-12 w-12 flex items-center justify-center text-green-dark active:text-green-mid transition-colors rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green-mid"
        >
          <span aria-hidden="true" className="text-[30px] font-semibold leading-none -mt-[3px]">‹</span>
        </button>
      )}
      <span className="font-serif text-lg text-green-dark">{title}</span>
    </header>
  )
}
