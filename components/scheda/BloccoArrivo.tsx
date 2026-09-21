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
// Il riquadro grigio del disegno qui non c'è: nel gestionale lo stile è
// quello editoriale deciso da Ania il 06/09/2026 (niente riquadri, etichette
// in ottone maiuscolo e fili sottili). Gerarchia e raggruppamenti sono quelli
// del riferimento, con i caratteri veri di casa.
//
// Sola presentazione: le parole arrivano tutte da lib/arrivo.
// ============================================================================
import type { VoceArrivo } from '@/lib/arrivo'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'

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
    <div data-blocco-arrivo className={className}>
      <Gruppo etichetta={etichettaArrivo} voce={arrivo} dati="arrivo" />
      <div style={{ borderTop: '1px solid var(--color-card-border)', margin: '14px 0' }} />
      <Gruppo etichetta="Navetta" voce={navetta} dati="navetta" />
    </div>
  )
}
