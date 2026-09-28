'use client'
// ============================================================================
// UNA CAMERA del soggiorno (14/09/2026): date, camera, ospiti, tariffa e la
// striscia delle notti — quella già fatta per la scheda, con in più gli ospiti
// sotto ogni notte. Il cambio camera non ha un tasto suo: si fa toccando una
// notte della striscia.
//
// Veste «Maison» (riferimento del 28/09/2026): arrivo e partenza a filo
// affiancati, sotto le notti in ottone; le camere a pastiglie (occupate
// tratteggiate); ospiti col − e col + a cerchi; accanto la tariffa a notte,
// che NON si scrive più: è il listino per camera e ospiti (punto 12a, lo
// sconto è l'unico modo di cambiare il prezzo).
//
// Sola presentazione: chi è libero, la capienza e i prezzi restano nelle
// librerie di sempre; qui si mostra e si chiama indietro.
// ============================================================================
import StrisciaNottiCamere from '@/components/StrisciaNottiCamere'
import { Etichetta, FilaPastiglie, Pastiglia } from './PezziNuova'
import CampoData from './CampoData'

/** la prima partenza possibile: il giorno dopo l'arrivo */
const giornoDopo = (iso: string) => (iso ? new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : '')
import type { ReactNode } from 'react'
import type { CameraScelta } from '@/lib/nuovaPrenotazione'
import type { CameraStriscia, NotteStriscia } from '@/lib/strisciaNotti'

export const ETICHETTA_CAMERA = 'Camera'
export const ETICHETTA_OSPITI = 'Ospiti'
export const ETICHETTA_TARIFFA = 'Tariffa a notte'
export const ETICHETTA_NOTTI = 'Le notti'

export default function CameraSoggiorno({
  titolo, arrivo, partenza, onArrivo, onPartenza, notti, camere, roomId, onCamera, rigaLibere,
  ospiti, onOspiti, ospitiMax, listino, strisciaNotti, onNotte,
  notteScelta, sottoStriscia, className = '',
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
  /** la tariffa di listino: «80 €» e «di listino · in 2»; null senza camera */
  listino: { testo: string; sotto: string } | null
  strisciaNotti: NotteStriscia[]
  onNotte: (notte: NotteStriscia) => void
  /** la notte scelta: la striscia la segna col contorno d'ottone */
  notteScelta?: string | null
  /** la parte della notte scelta, subito sotto la striscia */
  sottoStriscia?: ReactNode
  className?: string
}) {
  return (
    <section data-camera-soggiorno className={`np-sec ${className}`}>
      <p className="mz-eyebrow">{titolo}</p>

      {/* arrivo e partenza affiancati, sotto le notti in ottone. Il campo è
          quello del telefono (components/nuova/CampoData): si legge «gio 10
          set» e si apre il calendario nativo. La partenza non può venire
          prima dell'arrivo: glielo dice `min`. */}
      <div className="np-g2">
        <CampoData etichetta="Arrivo" valore={arrivo} onValore={onArrivo} dati="arrivo" />
        <CampoData etichetta="Partenza" valore={partenza} onValore={onPartenza} min={giornoDopo(arrivo)} dati="partenza" />
      </div>
      {notti > 0 && <p data-notti-linea className="np-hint o">{notti === 1 ? '1 notte' : `${notti} notti`}</p>}

      {/* la camera: quelle occupate in una qualsiasi notte restano spente */}
      <Etichetta testo={ETICHETTA_CAMERA} />
      <FilaPastiglie>
        {camere.map(({ camera, libera }) => (
          <Pastiglia key={camera.id} dati={`camera-${camera.name}`} acceso={roomId === camera.id} spenta={!libera && roomId !== camera.id}
            onClick={() => onCamera(camera.id)}>{camera.name}</Pastiglia>
        ))}
      </FilaPastiglie>
      {rigaLibere && <p data-camere-libere className="np-hint o">{rigaLibere}</p>}

      {/* ospiti e tariffa affiancati */}
      <div className="np-g2">
        <div>
          <Etichetta testo={ETICHETTA_OSPITI} />
          <div className="np-pm">
            <button type="button" data-ospiti-giu disabled={ospiti <= 1} onClick={() => onOspiti(ospiti - 1)} aria-label="Un ospite in meno">−</button>
            <b data-ospiti>{ospiti}</b>
            <button type="button" data-ospiti-su disabled={ospiti >= ospitiMax} onClick={() => onOspiti(ospiti + 1)} aria-label="Un ospite in più">+</button>
          </div>
        </div>
        <div>
          <Etichetta testo={ETICHETTA_TARIFFA} />
          {/* Il listino di casa, da leggere e basta (punto 12a, 28/09/2026):
              nessun campo, nessun filo sotto. Cambia con camera e ospiti. */}
          <p data-tariffa-listino className="np-listino">
            {listino && <>{listino.testo} <small>{listino.sotto}</small></>}
          </p>
        </div>
      </div>

      {/* Le notti: la striscia della scheda (StrisciaNottiCamere, lo stesso
          pezzo, non una copia) nella veste «Maison», con in più gli ospiti
          sotto ogni notte. Si vede appena ci sono le date, anche prima della
          camera: le notti senza camera restano col «?» e si sistemano
          toccandole. */}
      {strisciaNotti.length > 0 && (
        <>
          <Etichetta testo={ETICHETTA_NOTTI} />
          <StrisciaNottiCamere notti={strisciaNotti} onNotte={onNotte} scelta={notteScelta} ospitiAttesi={ospiti} spiegazione={false} />
          {sottoStriscia}
        </>
      )}
    </section>
  )
}
