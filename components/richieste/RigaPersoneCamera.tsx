// ============================================================================
// PERSONE E CAMERA NELLA SCHEDA DELLA RICHIESTA (Ania, 12/09/2026).
//
// È la stessa riga della testa della proposta (components/TestaCliente), un po'
// più piccola perché qui le schede sono tante e una sotto l'altra: due colonne
// centrate, valore in Georgia e sotto l'etichetta minuta, con un filo d'ottone
// che la stacca da quello che c'è sopra.
//
// La REGOLA di cosa scrivere è la stessa della testa e sta in un posto solo
// (lib/personeTesta): «3» quando le persone non cambiano, «3 → 1» quando
// cambiano, «da 1 a 3» quando i tratti sono troppi; «qualsiasi» oppure il nome
// della camera chiesta.
//
// Qui NON c'è la strisciolina delle notti: resta solo nella testa della
// proposta, dove c'è lo spazio per leggerla.
// ============================================================================
import { personeTesta, cameraTesta } from '@/lib/personeTesta'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const FILO_OTTONE = 'rgba(169,136,78,0.55)'
const VERDE_MESE = '#5B6559'   // le parole di servizio («→», «da», «a»)

const ETICHETTA = { marginTop: 5, fontSize: 9, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--color-stone)' } as const

export default function RigaPersoneCamera({ personeNotti, cameraChiesta = null, className = '' }: {
  /** le persone di ogni notte, in ordine: da qui nasce «3» oppure «3 → 1» */
  personeNotti: number[]
  /** nome della camera chiesta dal cliente; senza, vale «qualsiasi» */
  cameraChiesta?: string | null
  className?: string
}) {
  const pezzi = personeTesta(personeNotti)
  const camera = cameraTesta(cameraChiesta)
  if (pezzi.length === 0) return null
  return (
    <div data-persone-camera className={className} style={{ borderTop: `1px solid ${FILO_OTTONE}`, paddingTop: 11 }}>
      <div className="flex items-start justify-center" style={{ gap: 38 }}>
        <div className="text-center" data-colonna="persone">
          <p className="leading-[1.15]" style={{ fontFamily: GEORGIA, fontWeight: 400 }}>
            {pezzi.map((x, i) => (
              <span key={i} style={x.grande
                ? { fontSize: 21, color: 'var(--color-green-dark)' }
                : { fontSize: 14, color: VERDE_MESE }}>{i > 0 ? ' ' : ''}{x.testo}</span>
            ))}
          </p>
          <p style={ETICHETTA}>persone</p>
        </div>
        <div className="text-center min-w-0" data-colonna="camera">
          <p className="leading-[1.15] truncate" style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: 21, color: 'var(--color-green-dark)' }}>
            {camera.valore}
          </p>
          <p style={ETICHETTA}>{camera.etichetta}</p>
        </div>
      </div>
    </div>
  )
}
