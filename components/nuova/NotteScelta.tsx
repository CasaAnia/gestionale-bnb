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
// Veste «Maison» (28/09/2026): stessi contenuti, pastiglie a filo, ospiti a
// cerchi, il prezzo del letto quello fisso (LETTO_AGGIUNTIVO_A_NOTTE).
//
// Sola presentazione: chi è libero, la capienza e i prezzi restano nelle
// librerie di sempre; qui si mostra e si chiama indietro.
// ============================================================================
import { FilaPastiglie, Pastiglia } from './PezziNuova'
import { titoloNotte, LETTO_NON_DISPONIBILE, type CameraStriscia, type NotteStriscia } from '@/lib/strisciaNotti'

export const CODA_TITOLO = 'camere libere'
export const NESSUNA_CAMERA_LIBERA = 'nessuna camera libera questa notte'
export const NON_DORME_QUI = 'non dorme qui'
export const OPPURE = 'oppure '
export const COME_RIMETTERLA = 'per rimetterla nel soggiorno scegli una camera'
export const SOLO_QUESTA = 'solo questa notte'
export const DA_QUI = 'da qui in poi'
export const ETICHETTA_OSPITI = 'ospiti'
export const ETICHETTA_LETTO = 'letto in più'


export default function NotteScelta({
  notte, camere, ospitiPossibili, lettoLibero, prezzoLetto, motivoLetto,
  domanda, daQui, onCamera, onOspiti, onLetto, onNonDormeQui, className = '',
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
  /** la domanda «solo questa notte / da qui in poi» è a schermo? */
  domanda: boolean
  /** quale delle due è accesa adesso */
  daQui: boolean
  onCamera: (camera: CameraStriscia) => void
  onOspiti: (quanti: number, daQui: boolean) => void
  onLetto: (acceso: boolean) => void
  onNonDormeQui: () => void
  className?: string
}) {
  const libere = camere.filter(c => c.libera)
  const i = ospitiPossibili.indexOf(notte.persone)
  const giu = i > 0 ? ospitiPossibili[i - 1] : ospitiPossibili.filter(v => v < notte.persone).pop() ?? null
  const su = i >= 0 && i < ospitiPossibili.length - 1 ? ospitiPossibili[i + 1] : ospitiPossibili.find(v => v > notte.persone) ?? null
  const cambiaOspiti = (quanti: number) => onOspiti(quanti, daQui)

  return (
    <section data-notte-scelta={notte.iso} className={`np-ns ${className}`}>
      <p data-titolo-notte className="np-lab c">{titoloNotte(notte.iso)} · {CODA_TITOLO}</p>

      {/* tutte le camere: quelle occupate si vedono, ma non si toccano */}
      {libere.length === 0 && notte.dentro
        ? <p data-nessuna-camera className="np-hint c">{NESSUNA_CAMERA_LIBERA}</p>
        : (
          <FilaPastiglie centrata className="np-ns-camere">
            {camere.map(({ camera, libera }) => (
              <Pastiglia key={camera.id} dati={`notte-camera-${camera.name}`} acceso={notte.cameraId === camera.id}
                spenta={!libera && notte.cameraId !== camera.id} onClick={() => onCamera(camera)}>{camera.name}</Pastiglia>
            ))}
          </FilaPastiglie>
        )}

      {/* ospiti e letto della notte, sulla stessa riga */}
      {notte.dentro && notte.cameraId && (
        <>
          <div className="np-row">
            <span className="np-pm piccolo">
              <span className="np-lab">{ETICHETTA_OSPITI}</span>
              <button type="button" data-notte-ospiti-giu disabled={giu === null} onClick={() => giu !== null && cambiaOspiti(giu)} aria-label="Un ospite in meno">−</button>
              <b data-notte-ospiti>{notte.persone}</b>
              <button type="button" data-notte-ospiti-su disabled={su === null} onClick={() => su !== null && cambiaOspiti(su)} aria-label="Un ospite in più">+</button>
            </span>
            <span className="np-row-letto" data-notte-letto>
              <span className="np-lab">{ETICHETTA_LETTO}</span>
              <Pastiglia dati="notte-letto-no" acceso={!notte.letto} spenta={Boolean(motivoLetto)} onClick={() => onLetto(false)}>No</Pastiglia>
              <Pastiglia dati="notte-letto-si" acceso={notte.letto} spenta={!lettoLibero && !notte.letto} onClick={() => onLetto(true)}>Sì · {prezzoLetto}</Pastiglia>
            </span>
          </div>
          {!lettoLibero && !notte.letto && <p data-notte-letto-non-disponibile className="np-hint c">{LETTO_NON_DISPONIBILE}</p>}
          {motivoLetto && <p data-notte-letto-serve className="np-hint c">{motivoLetto}</p>}

          {/* vale solo per questa notte, o da qui alla fine? */}
          {/* le due voci sono una SCELTA: si passa dall'una all'altra quante
              volte si vuole, e vale sempre quella accesa (Ania, 15/09/2026) */}
          {domanda && (
            <FilaPastiglie centrata className="np-ns-domanda">
              <Pastiglia dati="notte-solo-questa" acceso={!daQui} onClick={() => onOspiti(notte.persone, false)}>{SOLO_QUESTA}</Pastiglia>
              <Pastiglia dati="notte-da-qui" acceso={daQui} onClick={() => onOspiti(notte.persone, true)}>{DA_QUI}</Pastiglia>
            </FilaPastiglie>
          )}
        </>
      )}

      {/* e se quella notte non dorme qui */}
      <p className="np-hint c" style={{ marginTop: 12 }}>
        {notte.dentro
          ? <>{OPPURE}<button type="button" data-non-dorme onClick={onNonDormeQui} className="mz-lnk q np-lnk-piccolo">{NON_DORME_QUI}</button></>
          : <span data-come-rimetterla className="np-hint o">{COME_RIMETTERLA}</span>}
      </p>
    </section>
  )
}
