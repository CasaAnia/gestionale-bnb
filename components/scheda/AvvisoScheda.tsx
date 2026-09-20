'use client'
// ============================================================================
// L'AVVISO DI «DA CONTROLLARE» NELLA SCHEDA PRENOTAZIONE (20/09/2026 sera,
// punto 3 approvato da Ania: «Da controllare, con informazioni precise»).
// Variante esplicita della schedina della proposta (SchedinaControllo, che
// resta com'è per i suoi usi): riquadro bianco con la barretta dorata a
// sinistra e un'ombra leggera sullo stesso lato, l'etichetta di che cosa è
// (PAGAMENTO, DOCUMENTO…), il titolo in grassetto, il dettaglio con gli
// importi in grassetto che non si spezzano, e UN comando di testo.
//
// Misure e colori sono quelli del riferimento approvato
// (avvisi-approvati-riferimento.html, colonna «DOPO · PROPOSTA PUNTO 3») e
// valgono SOLO qui. Il carattere NO: resta quello del gestionale (Nunito
// Sans, ereditato dal corpo pagina), come chiesto da Ania — il mockup usava
// Arial e non fa testo. I comandi hanno la veste condivisa .ed-azione con le
// misure del riferimento (13 px, filo a 3 px), come nel conto della scheda.
//
// Componente di sola presentazione: chi lo usa decide quali voci esistono.
// ============================================================================
import Link from 'next/link'
import type { CSSProperties } from 'react'

// I colori del riferimento
export const AVVISO = {
  bordo: '#e4e4df',
  barra: '#b49965',
  etichetta: '#a38c61',
  testo: '#30483b',
  parole: '#586558',       // le parole intorno agli importi («Ricevuti … · restano …»)
  descrizione: '#73796f',  // la descrizione ordinaria («Nessun documento caricato.»)
  ombra: '-3px 2px 7px rgba(99,82,49,.08)',
} as const

export type ParteAvviso = { testo: string; forte?: boolean }

export type AvvisoSchedaProps = {
  etichetta: string
  titolo: string
  /** la descrizione piana (peso 400) */
  dettaglio?: string | null
  /** in alternativa: la descrizione a pezzi, con gli importi in grassetto */
  parti?: ParteAvviso[] | null
  link?: { testo: string; href: string } | null
  /** in alternativa al link: un comando della pagina («Aggiungi pagamento» apre il foglio qui) */
  azione?: { testo: string; onClick: () => void } | null
  className?: string
}

// il comando: veste .ed-azione con le misure del riferimento (13 px, peso 600,
// filo a 3 px, riga alta come il testo); la zona di tocco resta comoda: il
// padding la allarga e il margine negativo la rimangia nel disegno
const COMANDO: CSSProperties = {
  minHeight: 0, padding: '6px 0', margin: '-6px 0',
  fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: AVVISO.testo,
  textDecoration: 'underline', textDecorationColor: 'currentColor', textUnderlineOffset: 3,
}
// gli importi: grassetto 600, mai spezzati fra numero e «€», cifre in colonna
const IMPORTO: CSSProperties = { fontWeight: 600, color: AVVISO.testo, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

export default function AvvisoScheda({ etichetta, titolo, dettaglio = null, parti = null, link = null, azione = null, className = '' }: AvvisoSchedaProps) {
  return (
    <div data-avviso-scheda className={`relative bg-white overflow-hidden ${className}`}
      style={{ border: `1px solid ${AVVISO.bordo}`, borderRadius: 10, padding: '14px 15px 16px', boxShadow: AVVISO.ombra }}>
      <span aria-hidden className="absolute left-0 top-0 bottom-0" style={{ width: 2, background: AVVISO.barra }} />
      <p data-etichetta style={{ fontSize: 10, letterSpacing: '1.3px', textTransform: 'uppercase', color: AVVISO.etichetta, marginBottom: 6 }}>{etichetta}</p>
      <p data-titolo style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, color: AVVISO.testo, marginBottom: 5 }}>{titolo}</p>
      {parti && parti.length > 0
        ? <p data-dettaglio style={{ fontSize: 14, lineHeight: 1.5, color: AVVISO.parole }}>
          {parti.map((p, i) => (p.forte ? <strong key={i} style={IMPORTO}>{p.testo}</strong> : <span key={i}>{p.testo}</span>))}
        </p>
        : dettaglio && <p data-dettaglio style={{ fontSize: 13, lineHeight: 1.5, color: AVVISO.descrizione }}>{dettaglio}</p>}
      {link && (
        <p className="flex" style={{ marginTop: 9 }}>
          <Link href={link.href} className="ed-azione" style={COMANDO}>{link.testo}</Link>
        </p>
      )}
      {azione && (
        <p className="flex" style={{ marginTop: 9 }}>
          <button type="button" onClick={azione.onClick} className="ed-azione" style={COMANDO}>{azione.testo}</button>
        </p>
      )}
    </div>
  )
}
