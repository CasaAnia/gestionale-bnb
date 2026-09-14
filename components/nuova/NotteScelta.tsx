'use client'
// ============================================================================
// LA NOTTE SCELTA (15/09/2026) — quello che c'era nel foglietto che si apriva
// dal basso, adesso qui sotto la striscia, sempre in vista.
//
// Si tocca una colonnina della striscia e questa parte mostra quella notte:
// tutte le camere (quelle occupate spente), gli ospiti col − e col +, il letto
// in più col suo costo, e «non dorme qui». Toccando un'altra notte cambia,
// toccando di nuovo la stessa si chiude.
//
// Sola presentazione: chi è libero, la capienza e i prezzi restano nelle
// librerie di sempre; qui si mostra e si chiama indietro.
// ============================================================================
import { useState } from 'react'
import { Etichetta, FilaPastiglie, Pastiglia, OTTONE } from './PezziNuova'
import { titoloNotte, LETTO_NON_DISPONIBILE, type CameraStriscia, type NotteStriscia } from '@/lib/strisciaNotti'
import { tintaCamera } from '@/components/StrisciaNottiCamere'

export const CODA_TITOLO = 'camere libere'
export const NESSUNA_CAMERA_LIBERA = 'nessuna camera libera questa notte'
export const NON_DORME_QUI = 'non dorme qui'
export const OPPURE = 'oppure '
export const COME_RIMETTERLA = 'per rimetterla nel soggiorno scegli una camera'
export const SOLO_QUESTA = 'solo questa notte'
export const DA_QUI = 'da qui in poi'
export const ETICHETTA_OSPITI = 'ospiti'
export const ETICHETTA_LETTO = 'letto in più'

const etichettaRiga = { fontSize: 9.5, letterSpacing: '1.4px', color: 'var(--color-stone)' } as const

export default function NotteScelta({
  notte, camere, ospitiPossibili, lettoLibero, prezzoLetto, motivoLetto,
  onCamera, onOspiti, onLetto, onNonDormeQui, className = '',
}: {
  notte: NotteStriscia
  /** TUTTE le camere, con «libera» riferito a questa notte */
  camere: { camera: CameraStriscia; libera: boolean }[]
  /** i numeri di ospiti che questa notte si possono davvero salvare */
  ospitiPossibili: number[]
  lettoLibero: boolean
  /** «10 €» oppure «compreso» */
  prezzoLetto: string
  /** quando il letto serve per forza: «servono 3 posti in Allegra» */
  motivoLetto: string | null
  onCamera: (camera: CameraStriscia) => void
  onOspiti: (quanti: number, daQui: boolean) => void
  onLetto: (acceso: boolean) => void
  onNonDormeQui: () => void
  className?: string
}) {
  // la domanda compare solo dopo aver toccato gli ospiti, come nel foglietto
  const [daQui, setDaQui] = useState(false)
  const [chiesto, setChiesto] = useState(false)

  const libere = camere.filter(c => c.libera)
  const i = ospitiPossibili.indexOf(notte.persone)
  const giu = i > 0 ? ospitiPossibili[i - 1] : ospitiPossibili.filter(v => v < notte.persone).pop() ?? null
  const su = i >= 0 && i < ospitiPossibili.length - 1 ? ospitiPossibili[i + 1] : ospitiPossibili.find(v => v > notte.persone) ?? null
  const cambiaOspiti = (quanti: number) => { setChiesto(true); onOspiti(quanti, daQui) }
  const tasto = { width: 34, height: 34, borderRadius: 999, border: '1px solid var(--color-card-border)', fontSize: 17, color: 'var(--color-green-dark)', background: '#fff' } as const

  return (
    <section data-notte-scelta={notte.iso} className={className}
      style={{ borderTop: '1px solid var(--color-card-border)', paddingTop: 10, marginTop: 10 }}>
      <p data-titolo-notte className="uppercase text-center" style={etichettaRiga}>{titoloNotte(notte.iso)} · {CODA_TITOLO}</p>

      {/* tutte le camere: quelle occupate si vedono, ma non si toccano */}
      {libere.length === 0 && notte.dentro
        ? <p data-nessuna-camera className="text-center" style={{ marginTop: 10, fontSize: 12.5, color: 'var(--color-stone)' }}>{NESSUNA_CAMERA_LIBERA}</p>
        : (
          <FilaPastiglie centrata className="mt-[10px]">
            {camere.map(({ camera, libera }) => (
              <Pastiglia key={camera.id} dati={`notte-camera-${camera.name}`} acceso={notte.cameraId === camera.id}
                spenta={!libera && notte.cameraId !== camera.id} onClick={() => onCamera(camera)}>{camera.name}</Pastiglia>
            ))}
          </FilaPastiglie>
        )}

      {/* ospiti e letto della notte, sulla stessa riga */}
      {notte.dentro && notte.cameraId && (
        <>
          <div className="flex flex-wrap items-center justify-center" style={{ gap: 22, marginTop: 12 }}>
            <span className="flex items-center" style={{ gap: 10 }}>
              <span className="uppercase" style={etichettaRiga}>{ETICHETTA_OSPITI}</span>
              <button type="button" data-notte-ospiti-giu disabled={giu === null} onClick={() => giu !== null && cambiaOspiti(giu)}
                aria-label="Un ospite in meno" style={{ ...tasto, opacity: giu === null ? 0.4 : 1 }}>−</button>
              <span data-notte-ospiti style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, color: 'var(--color-green-dark)', minWidth: 18, textAlign: 'center' }}>{notte.persone}</span>
              <button type="button" data-notte-ospiti-su disabled={su === null} onClick={() => su !== null && cambiaOspiti(su)}
                aria-label="Un ospite in più" style={{ ...tasto, opacity: su === null ? 0.4 : 1 }}>+</button>
            </span>
            <span className="flex flex-wrap items-center" style={{ gap: 8 }}>
              <span className="uppercase" style={etichettaRiga}>{ETICHETTA_LETTO}</span>
              <span data-notte-letto className="flex flex-wrap items-center" style={{ gap: 8 }}>
                <Pastiglia dati="notte-letto-no" acceso={!notte.letto} spenta={Boolean(motivoLetto)} onClick={() => onLetto(false)}>No</Pastiglia>
                <Pastiglia dati="notte-letto-si" acceso={notte.letto} spenta={!lettoLibero && !notte.letto} onClick={() => onLetto(true)}>Sì · {prezzoLetto}</Pastiglia>
                {!lettoLibero && !notte.letto && <span data-notte-letto-non-disponibile style={{ fontSize: 11.5, color: 'var(--color-stone)' }}>{LETTO_NON_DISPONIBILE}</span>}
                {motivoLetto && <span data-notte-letto-serve style={{ fontSize: 11.5, color: 'var(--color-stone)' }}>{motivoLetto}</span>}
              </span>
            </span>
          </div>

          {/* vale solo per questa notte, o da qui alla fine? */}
          {chiesto && (
            <FilaPastiglie centrata className="mt-3">
              <Pastiglia dati="notte-solo-questa" acceso={!daQui} onClick={() => { setDaQui(false); onOspiti(notte.persone, false) }}>{SOLO_QUESTA}</Pastiglia>
              <Pastiglia dati="notte-da-qui" acceso={daQui} onClick={() => { setDaQui(true); onOspiti(notte.persone, true) }}>{DA_QUI}</Pastiglia>
            </FilaPastiglie>
          )}
        </>
      )}

      {/* e se quella notte non dorme qui */}
      <p className="text-center" style={{ marginTop: 12, fontSize: 12, color: 'var(--color-stone)' }}>
        {notte.dentro
          ? <>{OPPURE}<button type="button" data-non-dorme onClick={onNonDormeQui} className="py-2 -my-2" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-green-mid)' }}>{NON_DORME_QUI}</button></>
          : <span data-come-rimetterla style={{ color: OTTONE }}>{COME_RIMETTERLA}</span>}
      </p>
    </section>
  )
}
