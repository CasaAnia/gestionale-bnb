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
  ['/scheda', 'Prenotazione'],
  ['/nuova', 'Nuova prenotazione'],
  ['/clienti', 'Clienti'],
  ['/spese-famiglia', 'Spese Famiglia'],
  ['/spese', 'Spese B&B'],
  ['/statistiche', 'Report'],
  ['/impostazioni', 'Impostazioni'],
]

// Pagine «Maison» con la barra (29/09/2026, Ania): barra bianca alta 52 px con
// il filo sotto, freccia ‹ sottile e titolo maiuscoletto (stile in
// app/maison.css, .barra-maison). Home, Nuova prenotazione e Scheda restano
// senza barra: hanno la loro testata. Qui si aggiungono le pagine rifatte.
export const PAGINE_MAISON = ['/calendario', '/arrivi']

export default function MobileTopBar() {
  const pathname = usePathname()
  const indietro = useAzioneIndietro()
  // Sulla Home «Maison» (28/09/2026) in cima c'è la striscia con la foto; la
  // «Nuova prenotazione» Maison ha la sua testata con «‹ Indietro», e la
  // scheda prenotazione Maison la sua barra con «‹ Prenotazioni»
  if (pathname === '/login' || pathname === '/' || pathname === '/nuova-prenotazione' || pathname.startsWith('/scheda/')) return null
  const entry = SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))
  const title = entry ? entry[1] : 'Casa Ania'
  if (PAGINE_MAISON.some(p => pathname.startsWith(p))) return (
    <header className="barra-alta barra-maison lg:hidden fixed top-0 left-0 right-0 z-40 h-[52px] flex items-center justify-center">
      {indietro && (
        <button
          type="button"
          onClick={indietro.chiama}
          aria-label={indietro.label}
          className="absolute left-1 top-1 h-11 w-11 flex items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green-mid"
        >
          <span aria-hidden="true" className="freccia">‹</span>
        </button>
      )}
      <span className="titolo">{title}</span>
    </header>
  )
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
