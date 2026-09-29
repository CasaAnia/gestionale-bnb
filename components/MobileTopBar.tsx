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

// Barra «Maison» su TUTTE le pagine (29/09/2026, Ania): bianca, alta 52 px
// con il filo sotto, freccia ‹ sottile (area di tocco 44 px) e titolo
// maiuscoletto grigio; stile in app/maison.css, .barra-maison. Home, Nuova
// prenotazione e Scheda restano senza barra: hanno la loro testata.
export default function MobileTopBar() {
  const pathname = usePathname()
  const indietro = useAzioneIndietro()
  // Sulla Home «Maison» (28/09/2026) in cima c'è la striscia con la foto; la
  // «Nuova prenotazione» Maison ha la sua testata con «‹ Indietro», e la
  // scheda prenotazione Maison la sua barra con «‹ Prenotazioni»; la richiesta,
  // la nuova richiesta e la modifica «Maison» (29/09/2026) la loro con «‹ Richieste»
  if (pathname === '/login' || pathname === '/' || pathname === '/nuova-prenotazione' || pathname.startsWith('/scheda/') || pathname.startsWith('/richieste/')) return null
  const entry = SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))
  const title = entry ? entry[1] : 'Casa Ania'
  return (
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
}
