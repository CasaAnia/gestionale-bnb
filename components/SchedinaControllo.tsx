'use client'
// ============================================================================
// SCHEDINA DI «DA CONTROLLARE» (11/09/2026, veste approvata da Ania): una cosa
// sola da guardare prima di rispondere. Riquadro bianco con la barretta in
// ottone a sinistra, l'etichetta di che cosa è, il fatto in una riga, il
// dettaglio sotto e, se serve, un link per andare a vedere.
//
// Componente di sola presentazione: chi la usa decide quali voci esistono.
// ============================================================================
import Link from 'next/link'

const OTTONE = '#A9884E'

export type SchedinaControlloProps = {
  etichetta: string
  titolo: string
  dettaglio?: string | null
  link?: { testo: string; href: string } | null
  /** in alternativa al link: un comando della pagina («Un'altra soluzione») */
  azione?: { testo: string; onClick: () => void } | null
  className?: string
}

const STILE_LINK = { fontSize: 13, fontWeight: 600, color: 'var(--color-green-mid)' }

export default function SchedinaControllo({ etichetta, titolo, dettaglio = null, link = null, azione = null, className = '' }: SchedinaControlloProps) {
  return (
    <div data-schedina-controllo className={`relative bg-white overflow-hidden ${className}`}
      style={{ border: '1px solid var(--color-card-border)', borderRadius: 12, padding: '10px 12px 10px 14px' }}>
      <span aria-hidden className="absolute left-0 top-0 bottom-0" style={{ width: 2, background: OTTONE }} />
      <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: OTTONE }}>{etichetta}</p>
      <p className="mt-1" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>{titolo}</p>
      {dettaglio && <p className="mt-0.5 leading-snug" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>{dettaglio}</p>}
      {link && (
        <p className="mt-1.5">
          <Link href={link.href} className="underline underline-offset-2" style={STILE_LINK}>{link.testo}</Link>
        </p>
      )}
      {azione && (
        <p className="mt-1.5">
          <button type="button" onClick={azione.onClick} className="underline underline-offset-2" style={STILE_LINK}>{azione.testo}</button>
        </p>
      )}
    </div>
  )
}
