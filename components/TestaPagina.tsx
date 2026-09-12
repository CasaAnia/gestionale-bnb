'use client'
import type { ReactNode } from 'react'

// ============================================================================
// LA TESTA DELLE PAGINE GRANDI (Calendario, Arrivi, Richieste).
//
// Era scritta uguale in due posti e la terza pagina non ce l'aveva: togliendo
// il titolo dalle Richieste, quella pagina cominciava 41 px più in alto delle
// altre e passando da una all'altra il contenuto saltava (Ania, dal telefono,
// 12/09/2026). Adesso lo spazio in alto è disegnato qui, in un posto solo: se
// un giorno cambia, cambia per tutte e tre insieme.
//
// Com'è fatta:
//  · fascia ferma in cima (sotto la barra dell'app sul telefono, in cima al
//    riquadro sul Mac), 16 px sopra e 8 sotto, fondo crema appena velato;
//  · la riga «← Indietro», che sul telefono non si vede: lì il ritorno è la
//    freccia ‹ della barra in alto (vedi .indietro-barra in globals.css);
//  · la riga del titolo: sul telefono il titolo NON si ripete — lo dice già
//    la barra in alto — ma il suo SPAZIO resta, così ricerca, tabelle ed
//    elenchi stanno dove stanno nelle altre pagine. `titoloNascosto` lo tiene
//    nascosto anche sul Mac (le Richieste, dove Ania non lo vuole più) senza
//    cambiare di un pixel l'ingombro.
// ============================================================================

export const FASCIA = 'shrink-0 sticky top-12 lg:top-0 z-40 px-4 pt-4 pb-2 bg-cream/95 backdrop-blur-sm'

export default function TestaPagina({ titolo, titoloNascosto = false, desktop, indietro, comandi, children, className = '' }: {
  titolo: string
  titoloNascosto?: boolean
  desktop: boolean
  indietro?: ReactNode
  comandi?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div data-testa-pagina className={`${FASCIA} ${className}`}>
      {indietro && <div className="indietro-barra hidden lg:block">{indietro}</div>}
      <div className={`mt-0 lg:mt-4 mb-2 ${desktop ? 'flex items-center gap-4 min-h-[44px]' : 'flex flex-col gap-2'}`}>
        <h1 className={`${titoloNascosto ? 'invisible' : 'max-lg:invisible'} ${desktop ? 'ed-titolo-medio mr-auto' : 'ed-titolo'}`}>{titolo}</h1>
        {comandi}
      </div>
      {children}
    </div>
  )
}
