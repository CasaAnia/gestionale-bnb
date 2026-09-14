'use client'
// ============================================================================
// UNA CAMERA del soggiorno (14/09/2026): date, camera, ospiti, tariffa e la
// striscia delle notti — quella già fatta per la scheda, con in più gli ospiti
// sotto ogni notte. Il cambio camera non ha un tasto suo: si fa toccando una
// notte della striscia.
//
// Sola presentazione: chi è libero, la capienza e i prezzi restano nelle
// librerie di sempre; qui si mostra e si chiama indietro.
// ============================================================================
import StrisciaNottiCamere from '@/components/StrisciaNottiCamere'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo, OTTONE } from './PezziNuova'
import type { CameraScelta } from '@/lib/nuovaPrenotazione'
import type { CameraStriscia, NotteStriscia } from '@/lib/strisciaNotti'

export const ETICHETTA_CAMERA = 'Camera'
export const ETICHETTA_OSPITI = 'Ospiti'
export const ETICHETTA_TARIFFA = 'Tariffa a notte'
export const ETICHETTA_NOTTI = 'Le notti'

export default function CameraSoggiorno({
  titolo, arrivo, partenza, onArrivo, onPartenza, notti, camere, roomId, onCamera, rigaLibere,
  ospiti, onOspiti, ospitiMax, tariffa, tariffaProposta, onTariffa, strisciaNotti, onNotte, className = '',
}: {
  /** «Soggiorno» per la prima camera, «Camera 2» per quelle dopo */
  titolo: string
  arrivo: string
  partenza: string
  onArrivo: (v: string) => void
  onPartenza: (v: string) => void
  notti: number
  camere: CameraScelta<CameraStriscia>[]
  roomId: string | null
  onCamera: (id: string) => void
  rigaLibere: string
  ospiti: number
  onOspiti: (n: number) => void
  ospitiMax: number
  tariffa: number | null
  tariffaProposta: number | null
  onTariffa: (v: number | null) => void
  strisciaNotti: NotteStriscia[]
  onNotte: (notte: NotteStriscia) => void
  className?: string
}) {
  const tasto = { width: 38, height: 38, borderRadius: 999, border: '1px solid var(--color-card-border)', fontSize: 18, color: 'var(--color-green-dark)', background: '#fff' }
  return (
    <section data-camera-soggiorno className={className}>
      <p className="ed-sezione">{titolo}</p>

      {/* arrivo e partenza affiancati, sotto le notti in ottone */}
      <div className="flex" style={{ gap: 12, marginTop: 12 }}>
        <RigaCampo etichetta="Arrivo" className="flex-1 min-w-0">
          <input type="date" value={arrivo} data-campo="arrivo" onChange={e => onArrivo(e.target.value)} style={stileCampo} />
        </RigaCampo>
        <RigaCampo etichetta="Partenza" className="flex-1 min-w-0">
          <input type="date" value={partenza} data-campo="partenza" onChange={e => onPartenza(e.target.value)} style={stileCampo} />
        </RigaCampo>
      </div>
      {notti > 0 && <p data-notti-linea style={{ marginTop: 6, fontSize: 12, color: OTTONE }}>{notti === 1 ? '1 notte' : `${notti} notti`}</p>}

      {/* la camera: quelle occupate in una qualsiasi notte restano spente */}
      <Etichetta testo={ETICHETTA_CAMERA} />
      <FilaPastiglie>
        {camere.map(({ camera, libera }) => (
          <Pastiglia key={camera.id} dati={`camera-${camera.name}`} acceso={roomId === camera.id} spenta={!libera && roomId !== camera.id}
            onClick={() => onCamera(camera.id)}>{camera.name}</Pastiglia>
        ))}
      </FilaPastiglie>
      {rigaLibere && <p data-camere-libere style={{ marginTop: 8, fontSize: 12, color: OTTONE }}>{rigaLibere}</p>}

      {/* ospiti e tariffa affiancati */}
      <div className="flex flex-wrap" style={{ gap: 22 }}>
        <div>
          <Etichetta testo={ETICHETTA_OSPITI} />
          <div className="flex items-center" style={{ gap: 12 }}>
            <button type="button" data-ospiti-giu disabled={ospiti <= 1} onClick={() => onOspiti(ospiti - 1)} aria-label="Un ospite in meno"
              style={{ ...tasto, opacity: ospiti <= 1 ? 0.4 : 1 }}>−</button>
            <span data-ospiti style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, color: 'var(--color-green-dark)', minWidth: 22, textAlign: 'center' }}>{ospiti}</span>
            <button type="button" data-ospiti-su disabled={ospiti >= ospitiMax} onClick={() => onOspiti(ospiti + 1)} aria-label="Un ospite in più"
              style={{ ...tasto, opacity: ospiti >= ospitiMax ? 0.4 : 1 }}>+</button>
          </div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <Etichetta testo={ETICHETTA_TARIFFA} />
          <RigaCampo etichetta="€ a notte">
            {/* Già scritta appena si sceglie la camera (Ania, 14/09/2026): il
                listino di casa non cambia mai, quello che cambia è lo sconto.
                Resta modificabile a mano; svuotandola torna il listino. */}
            <input type="number" inputMode="decimal" data-campo="tariffa" value={tariffa ?? (tariffaProposta ?? '')}
              onChange={e => onTariffa(e.target.value === '' ? null : Number(e.target.value))} style={stileCampo} />
          </RigaCampo>
        </div>
      </div>

      {/* le notti: la striscia della scheda, con gli ospiti sotto */}
      {strisciaNotti.length > 0 && (
        <>
          <Etichetta testo={ETICHETTA_NOTTI} />
          <StrisciaNottiCamere notti={strisciaNotti} onNotte={onNotte} ospitiAttesi={ospiti} spiegazione={false} />
        </>
      )}
    </section>
  )
}
