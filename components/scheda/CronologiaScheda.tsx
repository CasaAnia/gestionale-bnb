'use client'
// ============================================================================
// LA CRONOLOGIA della scheda prenotazione (13/09/2026): una riga per ogni
// cosa successa, dalla più vecchia — a sinistra quando, a destra che cosa.
// Dal 28/09/2026 sta in fondo alla linguetta «Messaggi», nella veste del
// riferimento (docs/design/scheda-riferimento.html, telefono 4): griglia
// 78 px / resto, filo sotto ogni riga, i messaggi partiti in verde.
//
// Le modifiche le scrive il database (booking_events, proposta 0042); se la
// proposta non è applicata la parte lo dice e non finge un registro vuoto.
// ============================================================================
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
        ? <p className="np-hint">Il registro delle modifiche non è ancora acceso su questo database.</p>
        : righe.length === 0
          ? <p data-cronologia-vuota className="np-hint">Ancora niente da raccontare.</p>
          : righe.map(r => (
            <div key={r.id} data-riga-storia={r.messaggio ? 'messaggio' : 'modifica'} className="sch-storia">
              <span className="quando">{r.quando}</span>
              <span className={r.messaggio ? 'inviato' : ''}>{r.cosa}</span>
            </div>
          ))}
      <p className="np-hint">{NOTA_CRONOLOGIA}</p>
    </div>
  )
}
