'use client'
// ============================================================================
// I FOGLI DELLE PULIZIE (regola di Ania del 01/10/2026, riferimento
// docs/design/pulizie-fogli-riferimento.html): «Pulita e recuperato»,
// «Rimanda o salta», «Spazi comuni · minuti a mano» e «Bagagli e partenza»
// hanno TUTTI la stessa altezza — quella del più lungo, il recupero: fino a 790 px su
// telefono (entro il 92% dello schermo) — così partono dallo stesso punto e non «saltano»
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

export const ALTEZZA_FOGLI_PULIZIE = 790
export const DISTANZA_TASTI_DAL_FONDO = 96

export default function FoglioPulizie({ eyebrow, titolo, destra, sotto, grande = 30, dati, onChiudi, onAnnulla, salvato, onFineSalvato, azione, onAzione, salvando = false, disabilitato = false, mattone = false, testoAnnulla = 'Annulla', testoSalvando = 'Salvo…', avviso, children }: {
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
  /** «Annulla» quando non chiude il foglio (la domanda di «Togli» torna alla correzione) */
  onAnnulla?: () => void
  /** l'azione in mattone (togliere una pulizia) */
  mattone?: boolean
  salvato?: Salvataggio | null
  onFineSalvato?: () => void
  azione: string
  onAzione: () => void
  salvando?: boolean
  disabilitato?: boolean
  testoAnnulla?: string
  testoSalvando?: string
  /** il motivo per cui l'azione non è partita, subito sopra i tasti: sul
   *  telefono il contenuto scorre e un avviso in fondo non si vede (02/10/2026,
   *  Ania non riusciva a confermare «Pulita e recuperato» e non sapeva perché) */
  avviso?: ReactNode
  children: ReactNode
}) {
  return (
    <FoglioMaison titolo={titolo} altezza={ALTEZZA_FOGLI_PULIZIE} altezzaPropria dati={`pul-${dati}`} onChiudi={salvando || salvato ? () => {} : onChiudi}
      salvato={salvato} onFineSalvato={onFineSalvato}
      testa={<div className="pul-testa">
        <p className="pul-ey">{eyebrow}</p>
        <div className={`pul-tt t${grande}`}><b>{titolo}</b>{destra && <span className="pul-dx">{destra}</span>}</div>
        {sotto && <p className="pul-su">{sotto}</p>}
      </div>}
      piede={<>{avviso && <p role="alert" className="pul-errore pul-avviso-piede" data-avviso-piede>{avviso}</p>}<div className="pul-tasti" data-piede-foglio>
        <button type="button" data-annulla-foglio onClick={onAnnulla ?? onChiudi} disabled={salvando}>{testoAnnulla}</button>
        <button type="button" className={mattone ? 'p mat' : 'p'} data-azione-foglio={dati} onClick={onAzione} disabled={salvando || disabilitato}>{salvando ? testoSalvando : azione}</button>
      </div></>}>
      {children}
    </FoglioMaison>
  )
}
