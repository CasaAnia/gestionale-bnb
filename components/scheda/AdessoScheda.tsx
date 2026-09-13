'use client'
// ============================================================================
// LA PARTE «ADESSO» della scheda (14/09/2026): quello che c'è da fare subito
// su una prenotazione appena presa — mandare la conferma, e se aspetta un
// bonifico anche i dati per farlo.
//
// Si vede finché la conferma non è partita (booking_whatsapp_log) e la
// cliente non è ancora andata via; dopo sparisce da sé e resta la scheda di
// sempre. I messaggi sono quelli di MessaggiScheda, non ne nasce nessuno qui.
// ============================================================================
import { TESTO_CONFERMA_IMMAGINE } from './MessaggiScheda'

export const TITOLO_ADESSO = 'Adesso'
export const DATI_BONIFICO = 'Dati bonifico'

export default function AdessoScheda({ onConfermaImmagine, hrefBonifico, onBonifico, className = '' }: {
  onConfermaImmagine: () => void
  /** il link wa.me già pronto, per aprire in una scheda nuova */
  hrefBonifico: string | null
  onBonifico: (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    <section data-adesso className={className}>
      <p className="ed-sezione">{TITOLO_ADESSO}</p>
      <div className="flex flex-wrap items-center mt-3" style={{ gap: 8 }}>
        <button type="button" data-adesso-conferma onClick={onConfermaImmagine}
          style={{ minHeight: 38, borderRadius: 999, padding: '0 16px', fontSize: 13, fontWeight: 600, background: 'var(--color-green-mid)', color: 'var(--color-cream)' }}>
          {TESTO_CONFERMA_IMMAGINE}
        </button>
        {hrefBonifico && (
          <a data-adesso-bonifico href={hrefBonifico} target="_blank" rel="noreferrer" onClick={onBonifico}
            className="inline-flex items-center justify-center"
            style={{ minHeight: 38, borderRadius: 999, padding: '0 16px', fontSize: 13, fontWeight: 600, background: 'var(--color-sage)', color: 'var(--color-green-mid)' }}>
            {DATI_BONIFICO}
          </a>
        )}
      </div>
    </section>
  )
}
