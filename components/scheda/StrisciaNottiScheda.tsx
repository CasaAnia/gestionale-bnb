'use client'
// ============================================================================
// LA STRISCIA DELLE NOTTI della nuova scheda prenotazione (13/09/2026): un
// riquadro bianco con una casella per notte — giorno della settimana («Oggi»
// in verde per stanotte), il segno ⇄ sopra il numero nelle notti in cui si
// cambia camera, il numero del giorno in Georgia (sottolineato per oggi), il
// nome della camera e un pallino per ogni ospite di quella notte.
// Toccare una notte apre il foglio «Modifica soggiorno» del tratto (oggi la
// scheda attuale). Sola presentazione: i dati arrivano da
// lib/schedaPrenotazione.caselleSoggiorno.
// ============================================================================
import Link from 'next/link'
import { testoNotti, type CasellaSoggiorno } from '@/lib/schedaPrenotazione'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
export const LARGHEZZA_MINIMA_CASELLA = 44   // px: sotto non si scende, il riquadro scorre di lato

export default function StrisciaNottiScheda({ caselle, hrefNotte, className = '' }: {
  caselle: CasellaSoggiorno[]
  /** dove porta il tocco su una notte (il foglio «Modifica soggiorno» del tratto) */
  hrefNotte: (c: CasellaSoggiorno) => string
  className?: string
}) {
  if (caselle.length === 0) return null
  return (
    <div data-striscia-soggiorno className={`ed-riquadro overflow-hidden ${className}`}>
      <div className="flex items-baseline justify-between gap-3" style={{ padding: '10px 12px 6px' }}>
        <p style={{ fontSize: 12, color: 'var(--color-stone)' }}>le notti, tocca per modificare</p>
        <p className="uppercase shrink-0" style={{ fontSize: 10, letterSpacing: '1.5px', color: OTTONE }}>{testoNotti(caselle.length)}</p>
      </div>
      {/* Le caselle hanno tutte la stessa larghezza; con molte notti il
          riquadro scorre di lato invece di uscire dai margini */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex" style={{ minWidth: caselle.length * LARGHEZZA_MINIMA_CASELLA, borderTop: '1px solid var(--color-card-border)' }}>
          {caselle.map((c, i) => (
            <Link key={c.iso} href={hrefNotte(c)} data-notte={c.iso} data-oggi={c.oggi || undefined} data-cambia={c.cambia || undefined}
              className="flex-1 min-w-0 text-center active:bg-sage transition-colors"
              style={{ padding: '8px 2px 9px', borderLeft: i > 0 ? '1px solid var(--color-card-border)' : undefined }}>
              <p className="truncate" style={{ fontSize: 11, lineHeight: '14px', fontWeight: c.oggi ? 700 : 400, color: c.oggi ? 'var(--color-green-mid)' : 'var(--color-stone)' }}>{c.giorno}</p>
              <p aria-hidden style={{ fontSize: 11, lineHeight: '12px', color: OTTONE, minHeight: 12 }}>{c.cambia ? '⇄' : ''}</p>
              <p style={{ fontFamily: GEORGIA, fontSize: 20, lineHeight: '24px', color: 'var(--color-green-dark)', textDecoration: c.oggi ? 'underline' : undefined, textDecorationColor: OTTONE, textUnderlineOffset: 3 }}>{c.numero}</p>
              <p className="truncate" style={{ fontSize: 11, lineHeight: '14px', marginTop: 2, color: 'var(--color-green-dark)' }}>{c.camera}</p>
              <p aria-label={`${c.persone} ${c.persone === 1 ? 'ospite' : 'ospiti'}`} className="flex justify-center flex-wrap" style={{ gap: 3, marginTop: 5, minHeight: 6 }}>
                {Array.from({ length: c.persone }).map((_, k) => (
                  <span key={k} aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--color-stone)', display: 'inline-block' }} />
                ))}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
