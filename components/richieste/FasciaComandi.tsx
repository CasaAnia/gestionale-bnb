'use client'
import { vociFascia, type VoceFascia } from '@/lib/comandiRichieste'
import type { OrdineRichieste } from '@/lib/richieste'

// ============================================================================
// LA FASCIA DEI COMANDI (Ania, dal telefono, 12/09/2026).
//
// La stessa veste della fascia disegnata per la scheda prenotazione
// (components/FasciaSezioni): un filo d'ottone sottile sopra e uno sotto,
// fondo crema, voci in maiuscolo 10 px color stone, 11 px sopra e sotto,
// distribuite a spazio uguale su tutta la larghezza. La voce accesa è in
// ottone grassetto.
//
//   ARRIVO      DURATA      PERSONE      DA GUARDARE · 3
//
// Le prime tre ordinano l'elenco (una sola accesa); l'ultima accende e spegne
// il filtro delle richieste ferme e porta il numero dentro. Cosa c'è scritto e
// cosa è acceso lo decide lib/comandiRichieste.
//
// Sta in una riga sola anche su uno schermo da 390 px: se non ci sta si
// stringe la SPAZIATURA fra le lettere, mai la misura delle lettere (Ania:
// i filtri piccoli non si leggono).
//
// Ogni voce ha un'area da toccare alta 44 px: il riempimento in più esce dalla
// fascia col margine negativo, così la fascia resta bassa.
// ============================================================================

export const OTTONE = '#A9884E'
export const FILO = 'rgba(169,136,78,0.55)'
export const MISURA_VOCE = 10          // px: non si scende sotto
export const SPAZIATURA = '0.6px'
export const SPAZIATURA_STRETTA = '0.2px'   // solo se le quattro voci non ci stanno
export const ALTEZZA_TOCCO = 44

export default function FasciaComandi({ ordine, onOrdine, ferme, soloDaGuardare, onDaGuardare, stretta = false, className = '' }: {
  ordine: OrdineRichieste
  onOrdine: (v: OrdineRichieste) => void
  ferme: number
  soloDaGuardare: boolean
  onDaGuardare: () => void
  stretta?: boolean
  className?: string
}) {
  const voci = vociFascia({ ordine, ferme, soloDaGuardare })
  const tocca = (v: VoceFascia) => (v.tipo === 'guardare' ? onDaGuardare() : onOrdine(v.chiave))
  return (
    <div data-fascia-comandi className={className}
      style={{ background: 'var(--color-cream)', borderTop: `1px solid ${FILO}`, borderBottom: `1px solid ${FILO}` }}>
      <div className="flex items-center justify-between gap-1 whitespace-nowrap" style={{ paddingTop: 11, paddingBottom: 11 }}>
        {voci.map(v => (
          <button key={v.chiave} type="button" data-voce={v.chiave} aria-pressed={v.accesa} onClick={() => tocca(v)}
            className="shrink-0 uppercase transition-colors py-[15px] -my-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid"
            style={{
              fontSize: MISURA_VOCE,
              letterSpacing: stretta ? SPAZIATURA_STRETTA : SPAZIATURA,
              fontWeight: v.accesa ? 700 : 500,
              color: v.accesa ? OTTONE : 'var(--color-stone)',
            }}>
            {v.testo}
          </button>
        ))}
      </div>
    </div>
  )
}
