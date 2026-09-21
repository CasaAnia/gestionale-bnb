'use client'
// ============================================================================
// «ARRIVO E NAVETTA» NELLA SCHEDA (21/09/2026) — la seconda superficie del
// riferimento approvato da Ania.
//
// Due gruppi, uno sotto l'altro, divisi da un filo: quello che conta davvero
// in grande (l'ora in struttura), e sotto, piccolo, da dove arriva. Così
// «In struttura circa 16:00–17:00» e «Arriva a Linate alle 15:00» si leggono
// insieme senza potersi scambiare di posto.
//
// IL RIQUADRO C'È (Ania, 21/09/2026 sera, scelta «B» sul confronto
// affiancato): come nel disegno che aveva approvato, grigio chiaro, con i
// due gruppi dentro. È l'eccezione allo stile editoriale del 06/09/2026
// («niente riquadri»), decisa da lei guardando le due versioni una accanto
// all'altra. Grigio, non bianco: il bianco stonerebbe sul fondo crema.
//
// Sola presentazione: le parole arrivano tutte da lib/arrivo.
// ============================================================================
import type { VoceArrivo } from '@/lib/arrivo'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
// Il riquadro scelto da Ania: grigio chiaro sul fondo crema, filo appena
// più scuro, angoli tondi come i fogli
export const FONDO_RIQUADRO = '#F3F2EE'
export const FILO_RIQUADRO = '#E3E0D8'

function Gruppo({ etichetta, voce, dati }: { etichetta: string; voce: VoceArrivo; dati: string }) {
  return (
    <div data-gruppo={dati}>
      <p className="uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: OTTONE, marginBottom: 6 }}>{etichetta}</p>
      <p data-titolo style={{ fontFamily: GEORGIA, fontSize: 20, lineHeight: '25px', color: 'var(--color-green-dark)' }}>{voce.titolo}</p>
      {voce.sotto && <p data-sotto className="mt-0.5" style={{ fontSize: 13.5, lineHeight: '18px', color: 'var(--color-stone)' }}>{voce.sotto}</p>}
    </div>
  )
}

export default function BloccoArrivo({ etichettaArrivo, arrivo, navetta, className = '' }: {
  /** «ARRIVO · OGGI», «ARRIVO · GIO 10 SET»: il giorno resta sotto gli occhi */
  etichettaArrivo: string
  arrivo: VoceArrivo
  navetta: VoceArrivo
  className?: string
}) {
  return (
    <div data-blocco-arrivo className={className}
      style={{ background: FONDO_RIQUADRO, border: `1px solid ${FILO_RIQUADRO}`, borderRadius: 12, padding: '16px 18px' }}>
      <Gruppo etichetta={etichettaArrivo} voce={arrivo} dati="arrivo" />
      <div style={{ borderTop: `1px solid ${FILO_RIQUADRO}`, margin: '14px 0' }} />
      <Gruppo etichetta="Navetta" voce={navetta} dati="navetta" />
    </div>
  )
}
