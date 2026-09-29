import type { ReactNode } from 'react'

// ============================================================================
// LA RIGA DEL PERIODO DAL MAC (Ania, 29/09/2026), una sola per tutte le
// pagine con le frecce su un periodo (Calendario, Arrivi, Richieste,
// Statistiche, Spese): a sinistra il periodo in Cormorant 30 px col mese per
// esteso (lib/periodoEsteso), allineato al margine del contenuto; a destra,
// uno dietro l'altro a 10 px, ‹ · la pillola «Mese | 2 settimane» (dove c'è)
// · ›. Le frecce come sempre, senza cerchi. Solo dal Mac (hidden lg:flex):
// dal telefono ogni pagina tiene la sua riga. Misure in app/maison.css
// (.riga-periodo), divise per lo zoom delle pagine vecchie (--zoom-pagina).
// ============================================================================
export default function RigaPeriodo({ etichetta, onPrec, onSucc, etichettaPrec, etichettaSucc, succDisabilitato = false, pillola, onEtichetta, titoloEtichetta, className = '' }: {
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
  className?: string
}) {
  return (
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
  )
}
