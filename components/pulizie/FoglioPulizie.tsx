'use client'
// ============================================================================
// I FOGLI DELLE PULIZIE (regola di Ania del 01/10/2026, riferimento
// docs/design/pulizie-fogli-riferimento.html): «Pulita e recuperato»,
// «Rimanda o salta», «Spazi comuni · minuti a mano» e «Bagagli e partenza»
// hanno TUTTI la stessa altezza — quella del più lungo, il recupero: 690 px su
// un telefono da 390 × 844 — così partono dallo stesso punto e non «saltano»
// passando dall'uno all'altro. I tasti sono sempre due, a tutta larghezza,
// «Annulla» a contorno e l'azione piena (1fr 1.6fr, alti 44), con il bordo
// di sotto a 96 px dal fondo dello schermo. Il contenuto sta in alto; su uno
// schermo più basso scorre DENTRO il foglio e i tasti restano fermi.
// È il FoglioMaison di sempre (velo, fuoco, Esc, conferma «Salvato»): cambia
// la veste, in app/pulizie.css sotto [data-foglio-maison^="pul-"].
// ============================================================================
import type { ReactNode } from 'react'
import FoglioMaison from '@/components/maison/FoglioMaison'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'

export const ALTEZZA_FOGLI_PULIZIE = 690
export const DISTANZA_TASTI_DAL_FONDO = 96

export default function FoglioPulizie({ eyebrow, titolo, destra, sotto, grande = 30, dati, onChiudi, salvato, onFineSalvato, azione, onAzione, salvando = false, disabilitato = false, testoAnnulla = 'Annulla', testoSalvando = 'Salvo…', children }: {
  eyebrow: string
  titolo: string
  /** a destra del titolo: «fatta oggi», «giovedì 1 ottobre»… */
  destra?: ReactNode
  /** sotto il titolo, in grigio */
  sotto?: ReactNode
  /** grandezza del titolo in Cormorant: 30 nei fogli delle pulizie, 28 in «Bagagli e partenza» */
  grande?: 28 | 30
  dati: string
  onChiudi: () => void
  salvato?: Salvataggio | null
  onFineSalvato?: () => void
  azione: string
  onAzione: () => void
  salvando?: boolean
  disabilitato?: boolean
  testoAnnulla?: string
  testoSalvando?: string
  children: ReactNode
}) {
  return (
    <FoglioMaison titolo={titolo} altezza={ALTEZZA_FOGLI_PULIZIE} dati={`pul-${dati}`} onChiudi={salvando || salvato ? () => {} : onChiudi}
      salvato={salvato} onFineSalvato={onFineSalvato}
      testa={<div className="pul-testa">
        <p className="pul-ey">{eyebrow}</p>
        <div className={`pul-tt t${grande}`}><b>{titolo}</b>{destra && <span className="pul-dx">{destra}</span>}</div>
        {sotto && <p className="pul-su">{sotto}</p>}
      </div>}
      piede={<div className="pul-tasti" data-piede-foglio>
        <button type="button" data-annulla-foglio onClick={onChiudi} disabled={salvando}>{testoAnnulla}</button>
        <button type="button" className="p" data-azione-foglio={dati} onClick={onAzione} disabled={salvando || disabilitato}>{salvando ? testoSalvando : azione}</button>
      </div>}>
      {children}
    </FoglioMaison>
  )
}
