'use client'
// ============================================================================
// «CAMBIA DATE» (17/09/2026): il foglio della scheda nuova per l'arrivo e la
// partenza di una linea (una camera, o il cambio camera in fila). Le notti
// nuove prendono camera, persone e letto della notte più vicina
// (lib/lineeSoggiorno.nottiConDate); sotto si vede l'effetto sul conto, o
// perché così non si può salvare (una notte senza camera libera). «Fatto»
// passa le notti a chi salva, con la funzione della 0053 come dalla striscia.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import CampoData from '@/components/nuova/CampoData'
import { MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import { TITOLO_DATE, ERRORE_DATE, dateLinea, nottiConDate } from '@/lib/lineeSoggiorno'
import type { ContestoNotti, NotteStriscia } from '@/lib/strisciaNotti'

export const FATTO_DATE = 'Fatto'

export default function FoglioDate({ notti, contesto, sottotitolo, contoDopo, onFatto, onChiudi }: {
  notti: NotteStriscia[]
  contesto: ContestoNotti
  /** quale linea («Lena → Ambra · 3 → 7 nov») quando le linee sono più d'una */
  sottotitolo?: string
  /** l'effetto sul conto delle notti nuove, o il motivo per cui così non si salva */
  contoDopo: (bozza: NotteStriscia[]) => { testo: string; guaio: boolean } | null
  onFatto: (notti: NotteStriscia[]) => void
  onChiudi: () => void
}) {
  const adesso = dateLinea(notti)
  const [arrivo, setArrivo] = useState(adesso?.arrivo ?? '')
  const [partenza, setPartenza] = useState(adesso?.partenza ?? '')
  const dateBuone = Boolean(arrivo && partenza && partenza > arrivo)
  const bozza = dateBuone ? nottiConDate(notti, arrivo, partenza, contesto) : notti
  const conto = dateBuone ? contoDopo(bozza) : { testo: ERRORE_DATE, guaio: true }

  return (
    <Foglio titolo={TITOLO_DATE} onChiudi={onChiudi}>
      {sottotitolo && <p data-sottotitolo-date style={{ marginTop: -6, marginBottom: 10, fontSize: 12.5, fontWeight: 600, color: OTTONE }}>{sottotitolo}</p>}
      <CampoData etichetta="Arrivo" valore={arrivo} onValore={setArrivo} dati="arrivo" ottone />
      <CampoData etichetta="Partenza" valore={partenza} onValore={setPartenza} min={arrivo || undefined} dati="partenza" ottone />
      {conto && <p data-conto-dopo style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: conto.guaio ? MATTONE : OTTONE }}>{conto.testo}</p>}
      <PiedeFoglio azione={FATTO_DATE} onAzione={() => { if (dateBuone && !(conto && conto.guaio)) onFatto(bozza) }} onAnnulla={onChiudi} dati="date" />
    </Foglio>
  )
}
