'use client'
// ============================================================================
// IL FOGLIO «MAISON» (riferimento approvato da Ania il 28/09/2026): sale dal
// basso sul telefono, al centro sul Mac. Fondo avorio col filo in alto, la
// maniglia, il titolo in Cormorant e sotto il sottotitolo in maiuscoletto
// ottone. Ha un'ALTEZZA FISSA, quella del suo contenuto più lungo: scegliendo
// opzioni diverse il foglio non cambia misura, lo spazio in più resta vuoto e
// i comandi restano in fondo (regola 3 dell'incarico).
//
// Sopra ci può stare la conferma di salvataggio (SalvatoMaison, scelta B):
// il foglio la mostra quando `salvato` è pieno e si chiude da solo.
// ============================================================================
import { createContext, useContext, useEffect, useRef, type ReactNode, type MouseEvent, type CSSProperties } from 'react'
import { ALTEZZE_SEZIONI, type SezioneFogli } from '@/lib/altezzeFogli'
import { useDesktop } from '@/lib/richiesteVista'
import SalvatoMaison, { type Salvataggio } from './SalvatoMaison'

export const TESTO_ANNULLA_MAISON = 'Annulla'

/** La sezione della pagina (scheda, home, calendario…): tutti i suoi fogli
 *  prendono la stessa altezza, quella del più lungo (regola di Ania del
 *  01/10/2026, lib/altezzeFogli ALTEZZE_SEZIONI). Senza sezione vale
 *  l'altezza del foglio. */
export const SezioneFogliContesto = createContext<SezioneFogli | null>(null)

export default function FoglioMaison({ titolo, sottotitolo, altezza, altezzaPropria = false, onChiudi, salvato = null, onFineSalvato, dati, children, piede, testa, larghezzaDesktop, veloChiaro = false, onVelo }: {
  titolo: string
  /** al posto del titolo in Cormorant: una testa disegnata dal chiamante (il foglietto del calendario) */
  testa?: ReactNode
  /** dal Mac, la larghezza del foglio al centro (440 px se non detto) */
  larghezzaDesktop?: number
  /** il velo appena velato, così sotto si vede ancora il calendario (catena in evidenza) */
  veloChiaro?: boolean
  /** il tocco sul velo: se non detto, chiude */
  onVelo?: (e: MouseEvent<HTMLDivElement>) => void
  sottotitolo?: string
  /** l'altezza fissa del foglio sul telefono, in px (mai oltre il 92% dello schermo) */
  altezza: number
  /** tiene la sua altezza anche dentro una sezione (i fogli delle Pulizie, che hanno la loro) */
  altezzaPropria?: boolean
  onChiudi: () => void
  /** pieno dopo un salvataggio riuscito: compare la spunta e il foglio si chiude */
  salvato?: Salvataggio | null
  /** chiamato quando la conferma ha finito (dopo 1,2 s) */
  onFineSalvato?: () => void
  dati?: string
  children: ReactNode
  /** i comandi in fondo, sempre al loro posto */
  piede?: ReactNode
}) {
  const desktop = useDesktop()
  const sezione = useContext(SezioneFogliContesto)
  const alto = sezione && !altezzaPropria ? ALTEZZE_SEZIONI[sezione] : altezza
  const foglio = useRef<HTMLDivElement>(null)
  const chiudi = useRef(onChiudi)
  useEffect(() => { chiudi.current = onChiudi }, [onChiudi])
  // Il fuoco entra nel foglio all'apertura e torna al comando che l'ha aperto.
  useEffect(() => {
    const prima = document.activeElement as HTMLElement | null
    foglio.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudi.current() }
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); prima?.focus?.() }
  }, [])
  return (
    <div className="mz fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={titolo} data-foglio-maison={dati}
      style={larghezzaDesktop ? ({ '--foglio-w': `${larghezzaDesktop}px` } as CSSProperties) : undefined}>
      <div className={`mz-velo velo-in ${veloChiaro ? 'chiaro' : ''}`} onClick={salvato ? undefined : (onVelo ?? onChiudi)} />
      <div ref={foglio} tabIndex={-1} className={`mz-foglio scheda-in outline-none ${desktop ? 'desktop' : ''}`}
        style={desktop ? undefined : { height: `min(${alto}px, 92dvh)` }}>
        {testa ?? <h2>{titolo}{sottotitolo && <small>{sottotitolo}</small>}</h2>}
        <div className="corpo">{children}</div>
        {piede}
        {salvato && <SalvatoMaison salvato={salvato} onFine={onFineSalvato ?? onChiudi} />}
      </div>
    </div>
  )
}

/** I due comandi in fondo: «Annulla» tenue e l'azione piena, angoli vivi. */
export function PiedeMaison({ azione, onAzione, onAnnulla, salvando = false, testoSalvando = 'Salvo…', disabilitato = false, totale, dati, testoAnnulla = TESTO_ANNULLA_MAISON }: {
  azione: string
  onAzione: () => void
  onAnnulla: () => void
  salvando?: boolean
  testoSalvando?: string
  disabilitato?: boolean
  /** a sinistra: «3 pezzi recuperati» e simili */
  totale?: ReactNode
  dati?: string
  testoAnnulla?: string
}) {
  return (
    <div className="mz-foot" data-piede-foglio>
      {totale ? <span className="tot">{totale}</span> : <span />}
      <span className="acts">
        <button type="button" className="mz-lnk q" data-annulla-foglio onClick={onAnnulla} disabled={salvando}>{testoAnnulla}</button>
        <button type="button" className="mz-cta" data-azione-foglio={dati} onClick={onAzione} disabled={salvando || disabilitato}>{salvando ? testoSalvando : azione}</button>
      </span>
    </div>
  )
}
