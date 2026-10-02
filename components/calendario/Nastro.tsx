'use client'
// ============================================================================
// IL NASTRO «MAISON», in pezzi condivisi dal Calendario e dagli Arrivi
// (riferimenti approvati da Ania il 29/09/2026: calendario-riferimento.html e
// arrivi-riferimento.html). Stesse misure e stesse classi (app/maison.css,
// `.cal-*`): la pagina decide cosa scrivere sulle schede e di che colore,
// qui c'è solo il disegno.
//   · RighelloNastro — la riga «lun 28» ferma in alto, domeniche in terra, oggi in verde
//   · FiliNastro     — il filo ottone al 1° del mese e il filo verde di oggi
//   · CorsiaNastro   — la corsia di una camera col suo nome fermo a sinistra
//   · BucoNastro     — il buco libero tratteggiato con le date e il «+»
//   · SchedaNastro   — la scheda: filo a sinistra, taglio obliquo del cambio
//                      camera, testo che resta in vista sulle schede lunghe
// ============================================================================
import type { CSSProperties, DOMAttributes, MouseEvent, ReactNode } from 'react'
import { SCHEDA_H, FILO_SINISTRO, filoObliquo } from '@/lib/calendarioSchede'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function RighelloNastro({ giorni, oggi, colonnaCamere, giorno, altezza }: {
  giorni: Date[]; oggi: string; colonnaCamere: number; giorno: number; altezza: number
}) {
  return (
    <div className="cal-righello" style={{ height: altezza }}>
      <div className="cal-angolo" style={{ width: colonnaCamere, minWidth: colonnaCamere }} />
      {giorni.map((d, i) => {
        const isToday = iso(d) === oggi
        const isSun = d.getDay() === 0
        const sett = d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3)
        return (
          <span key={i} className={`${isSun ? 'dom' : ''} ${isToday ? 'oggi' : ''}`} style={{ width: giorno, minWidth: giorno }}>
            {giorno >= 34 ? `${sett} ${d.getDate()}` : d.getDate()}
          </span>
        )
      })}
    </div>
  )
}

export function FiliNastro({ giorni, indiceOggi, colonnaCamere, giorno, top, altezza }: {
  giorni: Date[]; indiceOggi: number; colonnaCamere: number; giorno: number; top: number; altezza: number
}) {
  const primiDelMese = giorni.map((d, i) => (i > 0 && d.getDate() === 1 ? i : -1)).filter(i => i > 0)
  return (
    <>
      {/* ── FILI DEI MESI: ottone 2 px al 1° del mese, su tutte le righe ── */}
      {primiDelMese.map(i => (
        <div key={`sep-${i}`} className="cal-filo-mese" aria-hidden style={{ left: colonnaCamere + i * giorno - 1, top, height: altezza }} />
      ))}
      {/* ── IL FILO DI OGGI: verde, a tutta altezza sulla colonna di oggi ── */}
      {indiceOggi >= 0 && indiceOggi < giorni.length && (
        <div className="cal-filo-oggi" aria-hidden data-filo-oggi style={{ left: colonnaCamere + indiceOggi * giorno, top, height: altezza }} />
      )}
    </>
  )
}

export function CorsiaNastro({ top, larghezza, altezza, colonnaCamere, nome, descrizione, classe = '', onClick }: {
  top: number; larghezza: number; altezza: number; colonnaCamere: number; nome: string; descrizione?: string
  /** una classe in più sul nome (la riga «Qualsiasi camera» delle Richieste va a capo) */
  classe?: string
  /** il tocco su un giorno libero fuori dai buchi disegnati */
  onClick: (e: MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div className="cal-corsia" style={{ top, width: larghezza, height: altezza }} onClick={onClick}>
      {/* Nome camera: niente numero 01–04, solo il nome (05/09/2026) */}
      <div className={`cal-camera ${classe}`} title={descrizione || ''} style={{ width: colonnaCamere, minWidth: colonnaCamere }} onClick={e => e.stopPropagation()}>
        {nome}
      </div>
    </div>
  )
}

/** Il buco libero: riquadro tratteggiato, «3 → 4 ott» e il «+» */
export function BucoNastro({ chiave, etichetta, riga, left, top, width, testoLeft, testoWidth, onClick, altezza = SCHEDA_H }: {
  chiave: string; etichetta: string; riga: string; left: number; top: number; width: number; testoLeft: number; testoWidth: number
  altezza?: number
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button type="button" className="cal-buco" data-buco={chiave} aria-label={etichetta}
      style={{ left, top, width, height: altezza }} onClick={onClick}>
      <span className="in" style={{ left: testoLeft, width: testoWidth }}>
        <em>{riga}</em>
        <span className="pl" aria-hidden>+</span>
      </span>
    </button>
  )
}

/**
 * La scheda. `cuneoDestra` / `cuneoSinistra` = il colore del filo obliquo sul
 * taglio del cambio camera (il tratto che parte / quello che arriva); il
 * taglio stesso è `clipPath`. Il testo (`children`) sta nello `.tx` che resta
 * in vista quando la scheda comincia fuori, a sinistra.
 */
export function SchedaNastro({ id, dati, classi, top, height, altezzaScheda = SCHEDA_H, left, width, zIndex, onClick, gesti, sito, cutLeft, letto, lettoTratti, fondo, testo, filo, clipPath, cuneoDestra, cuneoSinistra, testoLeft, testoWidth, stileInterno, children }: {
  id: string
  /** attributi data-* in più (data-stato, data-arrivo…) */
  dati?: Record<string, string | number | undefined>
  classi: string
  top: number; height: number; left: number; width: number; zIndex: number
  /** l'altezza disegnata della scheda, per il filo obliquo del cambio camera (normale 72, compatta 44) */
  altezzaScheda?: number
  onClick: (e: MouseEvent<HTMLDivElement>) => void
  /** il dito premuto (Calendario, 02/10/2026): pointer events e contextmenu sul contenitore; con loro la scheda non si seleziona e non apre il menu di iOS */
  gesti?: Pick<DOMAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onPointerLeave' | 'onContextMenu'>
  /** richiesta dal sito da confermare: bordo tratteggiato del colore del filo */
  sito?: boolean
  cutLeft?: boolean
  /** letti extra (quanti letti del pool) */
  letto?: number
  /** il filo rosso in fondo, solo sotto le notti col letto (trattiLetto) */
  lettoTratti?: { left: number; width: number }[]
  fondo: string; testo: string; filo: string
  clipPath?: string
  cuneoDestra?: string
  cuneoSinistra?: string
  testoLeft: number; testoWidth: number
  stileInterno?: CSSProperties
  children: ReactNode
}) {
  return (
    <div data-tocco data-scheda={id} {...Object.fromEntries(Object.entries(dati ?? {}).map(([k, v]) => [`data-${k}`, v]))}
      onClick={onClick} {...gesti} className={`cal-scheda ${classi}${gesti ? ' premibile' : ''}`}
      style={{ top, height, left, width, zIndex, ...(clipPath ? { '--cal-taglio': clipPath, '--cal-raggio': '0' } : {}) } as CSSProperties}>
      <div className={`cal-scheda-in ${sito ? 'sito' : ''} ${cutLeft ? 'cl' : ''}`} data-letto={letto || undefined}
        style={{
          background: fondo, color: testo,
          borderLeftColor: sito ? filo : cutLeft ? 'transparent' : filo,
          ...(sito ? { borderColor: filo } : {}),
          clipPath, borderRadius: clipPath ? 0 : 6,
          ...stileInterno,
        }}>
        {cuneoDestra && <span aria-hidden data-filo-obliquo="uscita" className="cal-cuneo" style={{ background: cuneoDestra, clipPath: filoObliquo('destra', width, altezzaScheda) }} />}
        {cuneoSinistra && <span aria-hidden data-filo-obliquo="arrivo" className="cal-cuneo" style={{ background: cuneoSinistra, clipPath: filoObliquo('sinistra', width, altezzaScheda) }} />}
        <FiloLetto tratti={lettoTratti} bordoSinistro={sito ? 1.5 : FILO_SINISTRO} />
        {/* il testo resta in vista anche quando la scheda comincia fuori, a sinistra */}
        <span className="tx" style={{ left: testoLeft, width: testoWidth }}>
          {children}
        </span>
      </div>
    </div>
  )
}

/**
 * Il filo rosso del letto extra, 3 px in fondo alla scheda, solo sotto le notti
 * col letto (29/09/2026). I tratti sono misurati dal bordo della scheda; dentro
 * il corpo si parte dopo il filo sinistro, e il taglio/gli angoli li rifilano.
 */
export function FiloLetto({ tratti, bordoSinistro }: { tratti?: { left: number; width: number }[]; bordoSinistro: number }) {
  if (!tratti || tratti.length === 0) return null
  return (
    <>
      {tratti.map(t => (
        <span key={t.left} aria-hidden data-filo-letto className="cal-letto" style={{ left: t.left - bordoSinistro, width: t.width }} />
      ))}
    </>
  )
}
