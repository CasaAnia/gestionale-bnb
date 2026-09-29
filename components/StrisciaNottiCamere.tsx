'use client'
// ============================================================================
// LA STRISCIA DELLE NOTTI (13/09/2026) — un pezzo solo per tutto il gestionale:
// la scheda prenotazione e, poi, l'inserimento di una nuova prenotazione.
//
// Una colonnina per notte: sopra il giorno, in mezzo la camera di quella notte
// (una tinta per camera), sotto attaccato il quadratino del letto in più.
// Dove la camera cambia rispetto alla notte prima c'è il segno ⇄ d'ottone fra
// le due colonnine. Toccare una notte apre il foglietto (components/FoglioNotte).
// Con tante notti la striscia VA A CAPO (Ania, 20/09/2026, dopo le 24 notti di
// Rosa Macauda: sul telefono se ne vedevano 7, sul Mac 12, e niente diceva che
// continuava a destra). È una griglia CSS: tante colonnine per riga quante ne
// entrano, tutte della stessa misura, così i giorni restano incolonnati anche
// nell'ultima riga più corta; con poche notti crescono fino alla massima.
//
// Sola presentazione: i dati e le regole arrivano da lib/strisciaNotti, il
// salvataggio lo fa la pagina. Nessuna chiamata al database qui dentro.
//
// Il nome del file non è «StrisciaNotti.tsx» perché è già preso dalla striscia
// delle richieste (persone o camera notte per notte, altra cosa).
// ============================================================================
import { Bed } from 'lucide-react'
import { avvisiStriscia, compatta, giornoDellaNotte, riassuntoStriscia, segniDiCambio, titoloNotte, righeMaison, TESTO_LIBERA, type NotteStriscia } from '@/lib/strisciaNotti'
import { useMaison } from '@/components/nuova/PezziNuova'

const OTTONE = '#A9884E'
const ROSSO = '#D40000'
const MATTONE = '#8C3B2E'
const GEORGIA = "Georgia, 'Times New Roman', serif"
export const MATTONE_OSPITI = '#8a4f2f'
export const LARGHEZZA_COLONNINA = 44   // px: sotto non si scende, la striscia va a capo
export const LARGHEZZA_MASSIMA = 72     // px: con due o tre notti le colonnine non diventano lenzuola
export const SPAZIO_COLONNINE = 4
export const SPIEGAZIONE = 'sopra la camera · sotto il letto in più'

// Una tinta per camera, più piena (Ania, 20/09/2026: «troppo tenue, a colpo
// d'occhio non capisco quante camere e quanti cambi»; scelta la versione «A»
// fra due proposte). Amelia rosata, così non si confonde più con Allegra.
export const TINTE_CAMERA: Record<string, { fondo: string; testo: string }> = {
  Lena: { fondo: '#CFE3D6', testo: 'var(--color-green-dark)' },
  Ambra: { fondo: '#D6CFEA', testo: '#3B2F6B' },
  Allegra: { fondo: '#EAD9B0', testo: '#6B4E12' },
  Amelia: { fondo: '#EDD0C5', testo: '#7A3B2E' },
}
export const TINTA_ALTRE = { fondo: '#EDEAE1', testo: 'var(--color-green-dark)' }
export const tintaCamera = (nome: string | null) => (nome && TINTE_CAMERA[nome]) || TINTA_ALTRE

function Giorno({ iso, stretta, oggi }: { iso: string; stretta: boolean; oggi: boolean }) {
  const { giorno, numero } = giornoDellaNotte(iso)
  // la notte di stanotte si riconosce dal verde, come nella striscia di prima
  const stile = { fontSize: 10, lineHeight: '12px', fontWeight: oggi ? 700 : 400, color: oggi ? 'var(--color-green-mid)' : 'var(--color-stone)' }
  // con più di sette notti i due pezzi si incolonnano, così la colonnina resta stretta
  return stretta
    ? <span className="block"><span className="block" style={stile}>{giorno}</span><span className="block" style={stile}>{numero}</span></span>
    : <span className="block" style={stile}>{giorno} {numero}</span>
}

// ── La veste «Maison» (Nuova prenotazione, riferimento del 28/09/2026) ─────
// Una griglia a 7 colonne di larghezza FISSA: una notte = una colonna, mai
// più larga, anche con due notti sole; oltre le 7 va a capo. Sopra i giorni,
// in mezzo un segmento per camera (le notti di fila nella stessa camera sono
// un segmento solo, col nome), ⇄ d'ottone dove la camera cambia; sotto gli
// ospiti della notte e «+letto» in mattone. «fuori» tratteggiato = non dorme
// qui, «?» = notte senza camera. Il tocco su una notte la segna col contorno
// d'ottone (sul numero) e apre NotteScelta. La scheda resta con la sua.
export const PIU_LETTO = '+letto'
export const TESTO_SEGMENTO_FUORI = 'fuori'
export const TESTO_SENZA_CAMERA = '?'

function StrisciaMaison({ notti, onNotte, scelta, conRiassunto = true, className = '' }: { notti: NotteStriscia[]; onNotte?: (notte: NotteStriscia) => void; scelta?: string | null; conRiassunto?: boolean; className?: string }) {
  const cambi = segniDiCambio(notti)
  const avvisi = avvisiStriscia(notti)
  const riassunto = riassuntoStriscia(notti)
  return (
    <div data-striscia-notti data-veste="maison" className={`np-notti ${className}`}>
      {righeMaison(notti).map(riga => (
        <div key={riga.inizio} className="riga" data-riga-notti>
          {riga.notti.map((n, k) => {
            const { giorno, numero } = giornoDellaNotte(n.iso)
            return <span key={`d${n.iso}`} className="d" style={{ gridColumn: k + 1 }}>{giorno} {numero}</span>
          })}
          {riga.segmenti.map(sg => (
            <span key={`s${sg.da}`} data-segmento={sg.tipo} className={`seg ${sg.tipo === 'fuori' ? 'fuori' : sg.tipo === 'senza' ? 'q' : ''}`}
              style={{ gridColumn: `${sg.da + 1} / ${sg.a + 1}`, ...(sg.tipo === 'camera' ? { background: tintaCamera(sg.camera).fondo } : {}) }}>
              {sg.tipo === 'fuori' ? TESTO_SEGMENTO_FUORI : sg.tipo === 'senza' ? TESTO_SENZA_CAMERA : sg.camera}
            </span>
          ))}
          {riga.notti.map((n, k) => cambi[riga.inizio + k] && <span key={`c${n.iso}`} aria-hidden data-segno-cambio className="sw" style={{ gridColumn: k + 1 }}>⇄</span>)}
          {riga.notti.map((n, k) => (
            <span key={`u${n.iso}`} data-ospiti-notte={n.dentro && n.persone > 0 ? n.persone : undefined} className={`u ${n.iso === scelta ? 'sel' : ''}`} style={{ gridColumn: k + 1 }}>
              {n.dentro && n.persone > 0 ? n.persone : ''}{n.dentro && n.letto && <i data-piu-letto>{PIU_LETTO}</i>}
            </span>
          ))}
          {onNotte && riga.notti.map((n, k) => (
            <button key={`t${n.iso}`} type="button" className="tocco" style={{ gridColumn: k + 1 }}
              data-notte={n.iso} data-fuori={!n.dentro || undefined} data-cambia={cambi[riga.inizio + k] || undefined} data-scelta={n.iso === scelta || undefined}
              onClick={() => onNotte(n)}
              aria-label={`${titoloNotte(n.iso)}: ${!n.dentro ? 'non dorme qui' : n.camera ?? 'camera da scegliere'}${n.letto ? ', con letto in più' : ''}. Tocca per cambiare`} />
          ))}
        </div>
      ))}
      {conRiassunto && riassunto && <p data-riassunto-striscia className="np-hint o c">{riassunto}</p>}
      {avvisi.map(a => <p key={a} data-avviso-notte className="np-hint m c">{a}</p>)}
    </div>
  )
}

export default function StrisciaNottiCamere({ notti, oggi, onNotte, scelta, ospitiAttesi, spiegazione = true, riassunto = true, className = '' }: {
  notti: NotteStriscia[]
  /** la data di oggi (YYYY-MM-DD): la notte di stanotte si scrive in verde */
  oggi?: string
  /** il tocco su una notte */
  onNotte?: (notte: NotteStriscia) => void
  /** la notte scelta (YYYY-MM-DD): la sua casella porta il contorno d'ottone */
  scelta?: string | null
  /** quando c'è, sotto ogni notte compaiono gli ospiti; diversi da questo = mattone */
  ospitiAttesi?: number | null
  /** la riga «sopra la camera · sotto il letto in più»: si toglie dove è ovvio */
  spiegazione?: boolean
  /** la riga d'ottone «1 cambio camera · letto in più 1 notte» (veste Maison): la scheda non la mostra, lo dicono già le camere sotto */
  riassunto?: boolean
  className?: string
}) {
  const maison = useMaison()
  if (notti.length === 0) return null
  if (maison) return <StrisciaMaison notti={notti} onNotte={onNotte} scelta={scelta} conRiassunto={riassunto} className={className} />
  const stretta = compatta(notti.length)
  const avvisi = avvisiStriscia(notti)
  const cambi = segniDiCambio(notti)
  return (
    <div data-striscia-notti className={className}>
      {/* la griglia: auto-fit mette per riga tante colonnine da 44 px quante ne
          entrano e le allarga insieme (1fr); la larghezza massima del blocco
          (72 px a notte) fa sì che con poche notti non diventino lenzuola */}
      <div className="grid items-end" style={{ gap: `10px ${SPAZIO_COLONNINE}px`, gridTemplateColumns: `repeat(auto-fit, minmax(${LARGHEZZA_COLONNINA}px, 1fr))`, maxWidth: notti.length * LARGHEZZA_MASSIMA + (notti.length - 1) * SPAZIO_COLONNINE }}>
          {notti.map((n, i) => {
            const tinta = tintaCamera(n.camera)
            const fuori = !n.dentro
            const senzaCamera = n.dentro && !n.camera
            const segnata = n.iso === scelta
            return (
              <button key={n.iso} type="button" data-notte={n.iso} data-oggi={n.iso === oggi || undefined} data-fuori={fuori || undefined} data-cambia={cambi[i] || undefined} data-scelta={segnata || undefined}
                onClick={onNotte ? () => onNotte(n) : undefined} disabled={!onNotte}
                aria-label={`${titoloNotte(n.iso)}: ${fuori ? 'non dorme qui' : n.camera ?? 'camera da scegliere'}${n.letto ? ', con letto in più' : ''}. Tocca per cambiare`}
                className="relative min-w-0 text-left">
                <Giorno iso={n.iso} stretta={stretta} oggi={n.iso === oggi} />
                {/* il segno del cambio camera, fra questa colonnina e quella prima */}
                {cambi[i] && (
                  <span aria-hidden data-segno-cambio className="absolute flex items-center justify-center"
                    style={{ left: -SPAZIO_COLONNINE / 2, top: stretta ? 44 : 32, transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: 999, background: 'var(--color-cream)', color: OTTONE, fontSize: 10, lineHeight: '14px', zIndex: 1 }}>⇄</span>
                )}
                {/* la notte scelta si riconosce dal contorno d'ottone attorno
                    alla casella della camera (Ania, 15/09/2026) */}
                <span data-camera-notte className="block truncate text-center" style={{
                  marginTop: 3, borderRadius: '8px 8px 0 0', padding: '6px 2px', fontSize: 11, lineHeight: '14px', fontWeight: 600,
                  background: fuori ? 'transparent' : senzaCamera ? '#fff' : tinta.fondo,
                  color: fuori ? 'var(--color-stone)' : senzaCamera ? ROSSO : tinta.testo,
                  borderTop: segnata ? `1.5px solid ${OTTONE}` : fuori ? '1px dashed var(--color-border-soft)' : senzaCamera ? `1px dashed ${ROSSO}` : '1px solid transparent',
                  borderLeft: segnata ? `1.5px solid ${OTTONE}` : fuori ? '1px dashed var(--color-border-soft)' : senzaCamera ? `1px dashed ${ROSSO}` : '1px solid transparent',
                  borderRight: segnata ? `1.5px solid ${OTTONE}` : fuori ? '1px dashed var(--color-border-soft)' : senzaCamera ? `1px dashed ${ROSSO}` : '1px solid transparent',
                  borderBottom: 'none',
                }}>{fuori ? TESTO_LIBERA : senzaCamera ? '?' : n.camera}</span>
                <span data-letto-notte data-acceso={n.letto || undefined} className="flex items-center justify-center" style={{
                  borderRadius: '0 0 8px 8px', height: 18,
                  // acceso = verde pieno con il lettino chiaro: si deve vedere a colpo d'occhio (Ania, 17/09/2026)
                  background: n.letto ? 'var(--color-green-mid)' : '#fff',
                  borderTop: 'none',
                  borderRight: segnata ? `1.5px solid ${OTTONE}` : '1px solid var(--color-card-border)',
                  borderBottom: segnata ? `1.5px solid ${OTTONE}` : '1px solid var(--color-card-border)',
                  borderLeft: segnata ? `1.5px solid ${OTTONE}` : '1px solid var(--color-card-border)',
                }}>
                  {/* niente letto dove non c'è una camera: la casella resta vuota */}
                  {n.camera && <Bed size={12} strokeWidth={2.25} aria-hidden style={{ color: n.letto ? 'var(--color-cream)' : '#C4C0B6' }} />}
                </span>
                {/* e nemmeno il numero degli ospiti: si vede solo dove c'è una camera */}
                {ospitiAttesi != null && (
                  <span data-ospiti-notte={n.camera ? n.persone : undefined} className="block text-center" style={{
                    marginTop: 3, fontFamily: GEORGIA, fontSize: 15, lineHeight: '18px',
                    color: !n.camera ? 'transparent' : n.persone === ospitiAttesi ? 'var(--color-green-dark)' : MATTONE_OSPITI,
                  }}>{n.camera ? n.persone : '·'}</span>
                )}
              </button>
            )
          })}
      </div>
      {spiegazione && <p className="text-center" style={{ marginTop: 8, fontSize: 12, color: 'var(--color-stone)' }}>{SPIEGAZIONE}</p>}
      {riassuntoStriscia(notti) && (
        <p data-riassunto-striscia className="text-center" style={{ marginTop: spiegazione ? 2 : 8, fontSize: 12, color: OTTONE }}>{riassuntoStriscia(notti)}</p>
      )}
      {/* Che cosa manca, e basta: «lun 14 e mar 15 senza camera», in mattone
          (Ania, 15/09/2026). Quando tutte le notti hanno una camera qui non
          resta che il riassunto in ottone. */}
      {avvisi.map(a => (
        <p key={a} data-avviso-notte className="text-center font-semibold" style={{ marginTop: 4, fontSize: 12, color: MATTONE }}>{a}</p>
      ))}
    </div>
  )
}
