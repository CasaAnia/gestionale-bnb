'use client'
// ============================================================================
// «CAMBIO CAMERA» (17/09/2026): il foglio della scheda nuova, accanto a
// «Cambia date». Da quale notte, in quale camera: tutte le notti da lì alla
// fine passano nella camera scelta (lib/lineeSoggiorno.cambiaCameraDaLi, con
// la regola del foglietto della notte). Le camere proposte sono libere in
// tutte quelle notti. «Fatto» passa le notti a chi salva, con la 0053.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import { Etichetta, FilaPastiglie, Pastiglia, MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import { TITOLO_CAMBIO_CAMERA, DA_QUALE_NOTTE, IN_QUALE_CAMERA, NESSUNA_CAMERA_LIBERA_DA_LI, nottiDaCuiCambiare, camereDaLi, cambiaCameraDaLi } from '@/lib/lineeSoggiorno'
import { etichettaNotteBreve, type ContestoNotti, type NotteStriscia } from '@/lib/strisciaNotti'

export const FATTO_CAMBIO = 'Salva'   // (Ania, 17/09/2026: «Salva», non «Fatto»)

export default function FoglioCambioCamera({ notti, contesto, sottotitolo, contoDopo, onFatto, onChiudi }: {
  notti: NotteStriscia[]
  contesto: ContestoNotti
  /** quale linea («Lena → Ambra · 3 → 7 nov») quando le linee sono più d'una */
  sottotitolo?: string
  /** il motivo per cui così non si può salvare, se c'è */
  contoDopo: (bozza: NotteStriscia[]) => { testo: string; guaio: boolean } | null
  onFatto: (notti: NotteStriscia[]) => void
  onChiudi: () => void
}) {
  const scelte = nottiDaCuiCambiare(notti)
  const [daNotte, setDaNotte] = useState<string | null>(scelte[0]?.iso ?? null)
  const [cameraId, setCameraId] = useState<string | null>(null)
  const libere = daNotte ? camereDaLi(notti, daNotte, contesto) : []
  const camera = libere.find(c => c.id === cameraId) ?? null
  const bozza = daNotte && camera ? cambiaCameraDaLi(notti, daNotte, camera, contesto) : null
  const conto = bozza ? contoDopo(bozza) : null

  return (
    <Foglio titolo={TITOLO_CAMBIO_CAMERA} onChiudi={onChiudi}>
      {sottotitolo && <p data-sottotitolo-cambio style={{ marginTop: -6, marginBottom: 10, fontSize: 12.5, fontWeight: 600, color: OTTONE }}>{sottotitolo}</p>}
      <Etichetta testo={DA_QUALE_NOTTE} ottone primo />
      <FilaPastiglie>
        {scelte.map(n => (
          <Pastiglia key={n.iso} dati={`da-notte-${n.iso}`} acceso={daNotte === n.iso} onClick={() => { setDaNotte(n.iso); setCameraId(null) }}>{etichettaNotteBreve(n.iso)}</Pastiglia>
        ))}
      </FilaPastiglie>
      <Etichetta testo={IN_QUALE_CAMERA} ottone />
      {libere.length === 0
        ? <p data-nessuna-camera-da-li style={{ fontSize: 13, color: MATTONE }}>{NESSUNA_CAMERA_LIBERA_DA_LI}</p>
        : <FilaPastiglie>
          {libere.map(c => (
            <Pastiglia key={c.id} dati={`camera-${c.name}`} acceso={cameraId === c.id} onClick={() => setCameraId(c.id)}>{c.name}</Pastiglia>
          ))}
        </FilaPastiglie>}
      {conto && conto.guaio && <p data-conto-dopo style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: MATTONE }}>{conto.testo}</p>}
      <PiedeFoglio azione={FATTO_CAMBIO} onAzione={() => { if (bozza && !(conto && conto.guaio)) onFatto(bozza) }} onAnnulla={onChiudi} dati="cambio-camera" />
    </Foglio>
  )
}
