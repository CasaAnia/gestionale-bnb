'use client'
// ============================================================================
// LA PARTE «MESSAGGI» della nuova scheda prenotazione (13/09/2026).
//
// In cima l'interruttore «WhatsApp Ania / Business», che è lo STESSO oggetto
// di «Mese | 2 settimane» del calendario (components/InterruttorePillola).
// Poi il tasto pieno «Conferma · immagine e testo», largo quanto la scritta;
// sotto gli otto messaggi in due colonne, tutti uguali (fondo sage, testo
// green-mid, senza contorno); in fondo «Annullamento», col solo contorno.
//
// I testi NON stanno qui: arrivano da lib/messaggiPrenotazione, che li tiene
// identici a quelli della scheda attuale, approvati parola per parola.
// ============================================================================
import InterruttorePillola from '@/components/InterruttorePillola'
import { MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO, type TipoMessaggio } from '@/lib/messaggiPrenotazione'

export const FONDO_TASTO = 'var(--color-sage)'
export const BORDO_ANNULLAMENTO = '#D9B3AC'
export const TESTO_ANNULLAMENTO = '#8C3B2E'
export const TESTO_CONFERMA_IMMAGINE = 'Conferma · immagine e testo'

const TASTO = {
  background: FONDO_TASTO,
  color: 'var(--color-green-mid)',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 999,
  minHeight: 38,
}

export default function MessaggiScheda({ business, onBusiness, onConfermaImmagine, href, onMessaggio, className = '' }: {
  business: boolean
  onBusiness: (v: boolean) => void
  onConfermaImmagine: () => void
  /** il link wa.me già pronto per quel messaggio (per aprire in una scheda nuova) */
  href: (tipo: TipoMessaggio) => string
  onMessaggio: (tipo: TipoMessaggio) => (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    <div data-messaggi className={className}>
      <InterruttorePillola
        voci={[['ania', 'WhatsApp Ania'], ['business', 'Business']] as const}
        scelta={business ? 'business' : 'ania'}
        onScegli={v => onBusiness(v === 'business')}
        nome="Quale WhatsApp"
        dati="whatsapp"
      />

      {/* Il tasto principale: pieno, ma largo quanto la scritta e centrato */}
      <div className="text-center mt-3">
        <button type="button" onClick={onConfermaImmagine} data-conferma-immagine
          className="inline-flex items-center justify-center px-5 transition-transform duration-100 active:scale-[0.97]"
          style={{ background: 'var(--color-green-mid)', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 999, minHeight: 42 }}>
          {TESTO_CONFERMA_IMMAGINE}
        </button>
      </div>

      {/* Gli altri messaggi: due colonne, tutti uguali */}
      <div className="grid grid-cols-2 mt-3" style={{ gap: 8 }}>
        {MESSAGGI_SCHEDA.map(m => (
          <a key={m.tipo} href={href(m.tipo)} onClick={onMessaggio(m.tipo)} target="_blank" rel="noopener noreferrer"
            data-messaggio={m.tipo}
            className="inline-flex items-center justify-center px-3 text-center transition-transform duration-100 active:scale-[0.97]"
            style={TASTO}>
            {m.label}
          </a>
        ))}
      </div>

      {/* L'annullamento sta a parte: si tocca solo volendo */}
      <div className="text-center mt-3">
        <a href={href(MESSAGGIO_ANNULLAMENTO.tipo)} onClick={onMessaggio(MESSAGGIO_ANNULLAMENTO.tipo)} target="_blank" rel="noopener noreferrer"
          data-messaggio="annullamento"
          className="inline-flex items-center justify-center px-5 transition-transform duration-100 active:scale-[0.97]"
          style={{ border: `1px solid ${BORDO_ANNULLAMENTO}`, color: TESTO_ANNULLAMENTO, fontSize: 13, fontWeight: 600, borderRadius: 999, minHeight: 38 }}>
          {MESSAGGIO_ANNULLAMENTO.label}
        </a>
      </div>
    </div>
  )
}
