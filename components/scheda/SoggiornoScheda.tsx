'use client'
// ============================================================================
// LA PARTE «SOGGIORNO» della nuova scheda prenotazione (13/09/2026): sotto la
// striscia delle notti, la riga «Arrivo» (quando, l'orario in una pastiglia
// sage, la navetta), una riga per ogni tratto di camera e, in fondo, i tre
// link «Modifica arrivo · Modifica soggiorno · Arrivi precedenti».
// Sola presentazione: i testi arrivano da lib/schedaPrenotazione.
// ============================================================================
import Link from 'next/link'
import type { ArrivoScheda, TrattoCamera } from '@/lib/schedaPrenotazione'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
export const FONDO_CAMBIO = '#EFE2C7'
export const TESTO_CAMBIO = '#7A5C1E'
export const DA_CHIEDERE = 'orario da chiedere'   // (Ania, 17/09/2026: «orario da chiedere», non solo «da chiedere»)

export function RigaArrivo({ arrivo, etichetta = true, className = '' }: {
  arrivo: ArrivoScheda
  /** sotto il titolo «Arrivo» la parolina a sinistra non serve (17/09/2026) */
  etichetta?: boolean
  className?: string
}) {
  return (
    <div data-riga-arrivo className={`flex items-center ${etichetta ? 'justify-between' : 'justify-start'} gap-3 ${className}`}>
      {etichetta && <span style={{ fontSize: 14, color: 'var(--color-stone)' }}>Arrivo</span>}
      {/* senza virgole: «oggi 🕐 15:10 con navetta» */}
      <span className="flex items-center flex-wrap justify-end" style={{ gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>
        <span>{arrivo.quando}</span>
        {arrivo.orario
          ? <span data-orario className="inline-flex items-center" style={{ gap: 4, background: 'var(--color-sage)', borderRadius: 999, padding: '3px 10px' }}><span aria-hidden>🕐</span>{arrivo.orario}</span>
          : <span data-da-chiedere style={{ color: OTTONE }}>{DA_CHIEDERE}</span>}
        {arrivo.navetta && <span>{arrivo.navetta}</span>}
      </span>
    </div>
  )
}

export function TrattiCameraScheda({ tratti, className = '' }: { tratti: TrattoCamera[]; className?: string }) {
  return (
    <div data-tratti-camera className={className}>
      {tratti.map((t, i) => (
        <div key={t.id} data-tratto={t.id} className="flex items-start justify-between gap-3" style={{ padding: '12px 0', borderTop: i > 0 ? '1px solid var(--color-card-border)' : undefined }}>
          <div className="min-w-0">
            <p className="flex items-center gap-2 min-w-0">
              {t.cambio && (
                <span data-etichetta-cambio className="uppercase shrink-0" style={{ background: FONDO_CAMBIO, color: TESTO_CAMBIO, fontSize: 10, letterSpacing: '1px', borderRadius: 4, padding: '2px 6px', lineHeight: '14px' }}>⇄ cambio</span>
              )}
              <span className="truncate" style={{ fontFamily: GEORGIA, fontSize: 20, lineHeight: '24px', color: 'var(--color-green-dark)' }}>{t.camera}</span>
            </p>
            <p className="mt-0.5 leading-snug" style={{ fontSize: 13, color: 'var(--color-stone)' }}>{t.dettaglio}</p>
          </div>
          <span className="shrink-0" style={{ fontSize: 15, color: 'var(--color-stone)', lineHeight: '24px' }}>{t.prezzo}</span>
        </div>
      ))}
    </div>
  )
}

// «Modifica soggiorno» non c'è più (Ania, 13/09/2026): camera e letto di ogni
// notte si cambiano dalla striscia, toccando la notte. Restano «Modifica
// arrivo» e «Arrivi precedenti».
export function LinkSoggiorno({ hrefArrivo, onArrivo, onArriviPrecedenti, arriviAperti, className = '' }: {
  hrefArrivo?: string | null
  onArrivo?: () => void
  onArriviPrecedenti: () => void
  arriviAperti: boolean
  className?: string
}) {
  const verde = { fontSize: 14, fontWeight: 600, color: 'var(--color-green-mid)' }
  // «Modifica arrivo» e, di seguito, «Arrivi precedenti»: se a 390 px non ci
  // sta, scende su una riga sua ALLINEATO A SINISTRA.
  return (
    <div data-link-soggiorno className={`flex flex-wrap items-center ${className}`} style={{ gap: '0 12px', fontSize: 14 }}>
      <span className="flex items-center whitespace-nowrap" style={{ gap: 8 }}>
        {onArrivo
          ? <button type="button" onClick={onArrivo} className="py-2 -my-2" style={verde}>Modifica arrivo</button>
          : <Link href={hrefArrivo ?? '#'} className="py-2 -my-2" style={verde}>Modifica arrivo</Link>}
      </span>
      <button type="button" onClick={onArriviPrecedenti} aria-expanded={arriviAperti} className="py-2 -my-2 whitespace-nowrap" style={{ fontSize: 14, color: 'var(--color-stone)' }}>
        {arriviAperti ? 'Chiudi arrivi precedenti' : 'Arrivi precedenti'}
      </button>
    </div>
  )
}
