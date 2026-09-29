import type { ReactNode } from 'react'

// ============================================================================
// LA TESTA DELLE PAGINE DAL MAC (29/09/2026, Ania), per le pagine che non
// usano TestaPagina: la stessa di Calendario, Arrivi e Richieste. Niente
// «← Indietro» (basta il menu a sinistra); titolo Cormorant 30 px col bordo
// alto a 64 px, come il marchio «Casa Ania» della colonna; il sottotitolo maiuscoletto d'ottone solo se
// c'è un dato utile; i comandi (la ricerca, «+ Nuova») a destra sulla stessa
// riga. Solo dal Mac: dal telefono il titolo lo dice la barra in alto e la
// pagina resta com'è. Misure in app/maison.css (.testa-mac-*). Le pagine
// vecchie dal Mac sono ingrandite del 20% (MainContainer, --zoom-pagina):
// le misure si dividono per lo zoom, così a schermo restano quelle vere.
// ============================================================================
export default function TestaMac({ titolo, sottotitolo, comandi, contenitore = 16 }: {
  titolo: string
  sottotitolo?: string
  comandi?: ReactNode
  /** lo spazio che il contenitore ha già sopra (p-4 = 16, py-6 = 24): la testa aggiunge il resto fino a 64 */
  contenitore?: number
}) {
  return (
    <div data-testa-mac className="hidden lg:block mb-4">
      <div className="testa-mac-riga flex items-end gap-4" style={{ marginTop: `calc(64px / var(--zoom-pagina, 1) - ${contenitore}px)` }}>
        <div className="mr-auto min-w-0">
          <h1 className="testa-mac-titolo">{titolo}</h1>
          {sottotitolo !== undefined && <p className="testa-mac-sotto">{sottotitolo}</p>}
        </div>
        {comandi && <div className="flex items-center gap-3 shrink-0">{comandi}</div>}
      </div>
    </div>
  )
}
