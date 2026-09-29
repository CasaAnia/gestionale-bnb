import type { ReactNode } from 'react'
import { periodoAScavalloDAnno } from '@/lib/periodoEsteso'

// ============================================================================
// LA RIGA DEL PERIODO (Ania, 29/09/2026), una sola per tutte le pagine con
// le frecce su un periodo (Calendario, Arrivi, Richieste, Statistiche, Spese).
//
// Dal Mac: a sinistra il periodo in Cormorant 30 px col mese per esteso
// (lib/periodoEsteso), allineato al margine del contenuto; a destra, uno
// dietro l'altro a 10 px, ‹ · la pillola «Mese | 2 settimane» (dove c'è) · ›.
// Le frecce come sempre, senza cerchi. Misure in app/maison.css
// (.riga-periodo), divise per lo zoom delle pagine vecchie (--zoom-pagina).
//
// Dal telefono (novità 14a delle Richieste «Maison», 29/09/2026), per le
// pagine che passano `telefono` (Calendario, Arrivi, Richieste): il periodo a
// sinistra in Cormorant 20 px col mese abbreviato («28 set – 11 ott 2026», su
// una riga sola) e a destra «‹ · Mese | 2 settimane · ›» attaccati, 8 px fra
// l'uno e l'altro (.riga-periodo-tel). Le altre pagine dal telefono tengono
// la loro riga di sempre.
//
// Ritocchi del 29/09/2026 (A2): la pillola del telefono più piccola («Mese |
// 2 sett.», 9,5 px, 4 × 8) e il periodo più grande, Cormorant 24 px: è la
// misura più grande a cui «28 set – 11 ott 2026» (e ogni periodo dentro lo
// stesso anno) sta su una riga a 390 px (misurata: da 24 in giù, sta già a
// 24). A cavallo d'anno («28 dic 2026 – 10 gen 2027») a 24 non sta: lì 20 px,
// la più grande che ci sta.
// ============================================================================

export default function RigaPeriodo({ etichetta, onPrec, onSucc, etichettaPrec, etichettaSucc, succDisabilitato = false, pillola, onEtichetta, titoloEtichetta, telefono, className = '' }: {
  etichetta: string
  onPrec: () => void
  onSucc: () => void
  etichettaPrec: string
  etichettaSucc: string
  succDisabilitato?: boolean
  /** l'interruttore «Mese | 2 settimane», dove c'è */
  pillola?: ReactNode
  /** tocco sul periodo (Statistiche: torna a oggi) */
  onEtichetta?: () => void
  titoloEtichetta?: string
  /** la riga del telefono: il periodo col mese abbreviato e la sua pillola */
  telefono?: { etichetta: string; pillola?: ReactNode }
  className?: string
}) {
  return (
    <>
      <div data-riga-periodo data-senza-sottolinea className={`riga-periodo hidden lg:flex ${className}`}>
        {onEtichetta
          ? <button type="button" className="per" onClick={onEtichetta} title={titoloEtichetta}>{etichetta}</button>
          : <span className="per">{etichetta}</span>}
        <span className="dx">
          <button type="button" className="ar" onClick={onPrec} aria-label={etichettaPrec}>‹</button>
          {pillola}
          <button type="button" className="ar" onClick={onSucc} aria-label={etichettaSucc} disabled={succDisabilitato}>›</button>
        </span>
      </div>
      {telefono && (
        <div data-riga-periodo-telefono data-riga-navigazione data-senza-sottolinea className={`riga-periodo-tel lg:hidden ${className}`}>
          <span className={`per ${periodoAScavalloDAnno(telefono.etichetta) ? 'due-anni' : ''}`}>{telefono.etichetta}</span>
          <span className="dx">
            <button type="button" className="ar" onClick={onPrec} aria-label={etichettaPrec}>‹</button>
            {telefono.pillola}
            <button type="button" className="ar" onClick={onSucc} aria-label={etichettaSucc} disabled={succDisabilitato}>›</button>
          </span>
        </div>
      )}
    </>
  )
}
