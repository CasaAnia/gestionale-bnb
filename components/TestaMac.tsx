import type { ReactNode } from 'react'

// ============================================================================
// LA TESTA DELLE PAGINE DAL MAC (29/09/2026, Ania), per le pagine che non
// usano TestaPagina: come la barra del telefono. Niente titolo grande, niente
// sottotitolo, niente «← Indietro» (basta il menu a sinistra): in cima la
// sola scrittina maiuscoletta col nome della pagina, col bordo alto a 64 px
// come il marchio «Casa Ania» della colonna, e i comandi (la ricerca, «+
// Nuova») a destra sulla stessa riga, centrati sulla scrittina. Solo dal Mac:
// dal telefono il nome lo dice la barra in alto e la pagina resta com'è.
// Misure in app/maison.css (.testa-mac-scritta). Le pagine vecchie dal Mac
// sono ingrandite del 20% (MainContainer, --zoom-pagina): le misure si
// dividono per lo zoom, così a schermo restano quelle vere.
// ============================================================================
export default function TestaMac({ titolo, comandi, contenitore = 16 }: {
  titolo: string
  comandi?: ReactNode
  /** lo spazio che il contenitore ha già sopra (p-4 = 16, py-6 = 24): la testa aggiunge il resto fino a 64 */
  contenitore?: number
}) {
  return (
    <div data-testa-mac className="hidden lg:block testa-mac-blocco">
      <div className="relative" style={{ marginTop: `calc(64px / var(--zoom-pagina, 1) - ${contenitore}px)` }}>
        <h1 className="testa-mac-scritta">{titolo}</h1>
        {comandi && <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3">{comandi}</div>}
      </div>
    </div>
  )
}
