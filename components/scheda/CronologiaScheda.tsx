'use client'
// ============================================================================
// LA PARTE «CRONOLOGIA» della nuova scheda prenotazione (13/09/2026): una riga
// per ogni cosa successa, dalla più vecchia — a sinistra quando, a destra che
// cosa. I messaggi partiti dal gestionale hanno il fumetto e sono in verde.
//
// Le modifiche le scrive il database (booking_events, proposta 0042); se la
// proposta non è applicata la parte lo dice e non finge un registro vuoto.
// ============================================================================
import { MessageCircle } from 'lucide-react'
import { NOTA_CRONOLOGIA, type RigaStoria } from '@/lib/schedaConto'

export default function CronologiaScheda({ righe, registrata = true, className = '' }: {
  righe: RigaStoria[]
  /** false = proposta 0042 non applicata: il registro non è acceso */
  registrata?: boolean
  className?: string
}) {
  return (
    <div data-cronologia className={className}>
      {!registrata
        ? <p style={{ fontSize: 13, color: 'var(--color-stone)' }}>Il registro delle modifiche non è ancora acceso su questo database.</p>
        : righe.length === 0
          ? <p data-cronologia-vuota style={{ fontSize: 13, color: 'var(--color-stone)' }}>Ancora niente da raccontare.</p>
          : <div className="ed-lista">
            {righe.map(r => (
              <div key={r.id} data-riga-storia={r.messaggio ? 'messaggio' : 'modifica'}
                className="flex items-baseline justify-between gap-3" style={{ padding: '9px 0' }}>
                <span className="shrink-0" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>{r.quando}</span>
                <span className="min-w-0 text-right inline-flex items-baseline justify-end gap-1.5"
                  style={{ fontSize: 14, color: r.messaggio ? 'var(--color-green-mid)' : 'var(--color-green-dark)' }}>
                  {r.messaggio && <MessageCircle size={13} strokeWidth={2.2} aria-hidden className="self-center shrink-0" />}
                  <span className="min-w-0">{r.cosa}</span>
                </span>
              </div>
            ))}
          </div>}
      <p className="mt-2 leading-snug" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>{NOTA_CRONOLOGIA}</p>
    </div>
  )
}
