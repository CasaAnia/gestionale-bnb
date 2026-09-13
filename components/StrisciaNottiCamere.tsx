'use client'
// ============================================================================
// LA STRISCIA DELLE NOTTI (13/09/2026) — un pezzo solo per tutto il gestionale:
// la scheda prenotazione e, poi, l'inserimento di una nuova prenotazione.
//
// Una colonnina per notte: sopra il giorno, in mezzo la camera di quella notte
// (una tinta per camera), sotto attaccato il quadratino del letto in più.
// Dove la camera cambia rispetto alla notte prima c'è il segno ⇄ d'ottone fra
// le due colonnine. Toccare una notte apre il foglietto (components/FoglioNotte).
//
// Sola presentazione: i dati e le regole arrivano da lib/strisciaNotti, il
// salvataggio lo fa la pagina. Nessuna chiamata al database qui dentro.
//
// Il nome del file non è «StrisciaNotti.tsx» perché è già preso dalla striscia
// delle richieste (persone o camera notte per notte, altra cosa).
// ============================================================================
import { Bed } from 'lucide-react'
import { avvisiStriscia, compatta, giornoDellaNotte, riassuntoStriscia, segniDiCambio, titoloNotte, TESTO_LIBERA, type NotteStriscia } from '@/lib/strisciaNotti'

const OTTONE = '#A9884E'
const ROSSO = '#D40000'
export const LARGHEZZA_COLONNINA = 44   // px: sotto non si scende, la striscia scorre di lato
export const SPAZIO_COLONNINE = 4
export const SPIEGAZIONE = 'sopra la camera · sotto il letto in più'

// Una tinta per camera, chiara e tenue (Ania, 13/09/2026)
export const TINTE_CAMERA: Record<string, { fondo: string; testo: string }> = {
  Lena: { fondo: '#E7EFE9', testo: 'var(--color-green-dark)' },
  Ambra: { fondo: '#EAE7F2', testo: '#463C6B' },
  Allegra: { fondo: '#F3E9DA', testo: '#7A5C1E' },
  Amelia: { fondo: '#F3E9DA', testo: '#7A5C1E' },
}
export const TINTA_ALTRE = { fondo: '#EDEAE1', testo: 'var(--color-green-dark)' }
export const tintaCamera = (nome: string | null) => (nome && TINTE_CAMERA[nome]) || TINTA_ALTRE

function Giorno({ iso, stretta }: { iso: string; stretta: boolean }) {
  const { giorno, numero } = giornoDellaNotte(iso)
  const stile = { fontSize: 10, lineHeight: '12px', color: 'var(--color-stone)' }
  // con più di sette notti i due pezzi si incolonnano, così la colonnina resta stretta
  return stretta
    ? <span className="block"><span className="block" style={stile}>{giorno}</span><span className="block" style={stile}>{numero}</span></span>
    : <span className="block" style={stile}>{giorno} {numero}</span>
}

export default function StrisciaNottiCamere({ notti, onNotte, className = '' }: {
  notti: NotteStriscia[]
  /** il tocco su una notte: apre il foglietto di quella notte */
  onNotte?: (notte: NotteStriscia) => void
  className?: string
}) {
  if (notti.length === 0) return null
  const stretta = compatta(notti.length)
  const avvisi = avvisiStriscia(notti)
  const cambi = segniDiCambio(notti)
  return (
    <div data-striscia-notti className={className}>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex items-end" style={{ gap: SPAZIO_COLONNINE, minWidth: notti.length * LARGHEZZA_COLONNINA + (notti.length - 1) * SPAZIO_COLONNINE }}>
          {notti.map((n, i) => {
            const tinta = tintaCamera(n.camera)
            const fuori = !n.dentro
            const senzaCamera = n.dentro && !n.camera
            return (
              <button key={n.iso} type="button" data-notte={n.iso} data-fuori={fuori || undefined} data-cambia={cambi[i] || undefined}
                onClick={onNotte ? () => onNotte(n) : undefined} disabled={!onNotte}
                aria-label={`${titoloNotte(n.iso)}: ${fuori ? 'non dorme qui' : n.camera ?? 'camera da scegliere'}${n.letto ? ', con letto in più' : ''}. Tocca per cambiare`}
                className="relative flex-1 min-w-0 text-left">
                <Giorno iso={n.iso} stretta={stretta} />
                {/* il segno del cambio camera, fra questa colonnina e quella prima */}
                {cambi[i] && (
                  <span aria-hidden data-segno-cambio className="absolute flex items-center justify-center"
                    style={{ left: -SPAZIO_COLONNINE / 2, top: stretta ? 36 : 24, transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: 999, background: 'var(--color-cream)', color: OTTONE, fontSize: 10, lineHeight: '14px', zIndex: 1 }}>⇄</span>
                )}
                <span data-camera-notte className="block truncate text-center" style={{
                  marginTop: 3, borderRadius: '8px 8px 0 0', padding: '6px 2px', fontSize: 11, lineHeight: '14px', fontWeight: 600,
                  background: fuori ? 'transparent' : senzaCamera ? '#fff' : tinta.fondo,
                  color: fuori ? 'var(--color-stone)' : senzaCamera ? ROSSO : tinta.testo,
                  border: fuori ? '1px dashed var(--color-border-soft)' : senzaCamera ? `1px dashed ${ROSSO}` : '1px solid transparent',
                  borderBottom: 'none',
                }}>{fuori ? TESTO_LIBERA : senzaCamera ? '?' : n.camera}</span>
                <span data-letto-notte data-acceso={n.letto || undefined} className="flex items-center justify-center" style={{
                  borderRadius: '0 0 8px 8px', height: 18,
                  background: n.letto ? 'var(--color-sage)' : '#fff',
                  border: '1px solid var(--color-card-border)', borderTop: 'none',
                }}>
                  <Bed size={12} strokeWidth={2} aria-hidden style={{ color: n.letto ? 'var(--color-green-mid)' : '#C4C0B6' }} />
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-center" style={{ marginTop: 8, fontSize: 12, color: 'var(--color-stone)' }}>{SPIEGAZIONE}</p>
      <p data-riassunto-striscia className="text-center" style={{ marginTop: 2, fontSize: 12, color: OTTONE }}>{riassuntoStriscia(notti)}</p>
      {avvisi.map(a => (
        <p key={a} data-avviso-notte className="text-center font-semibold" style={{ marginTop: 4, fontSize: 12, color: ROSSO }}>{a}</p>
      ))}
    </div>
  )
}
