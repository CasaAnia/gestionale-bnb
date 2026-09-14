'use client'
// ============================================================================
// IL FOGLIETTO DELLA NOTTE (13/09/2026): si apre toccando una colonnina della
// striscia e cambia, in un colpo solo, la camera di quella notte e il letto
// in più. Sostituisce il foglio «Modifica soggiorno» a tre passi.
//
// Dentro ci sono solo le camere LIBERE quella notte (le occupate non
// compaiono affatto) e le due pastiglie del letto, col prezzo. Se la camera
// scelta non basta per gli ospiti di quella notte lo dice un avviso, senza
// bloccare; se i due letti di casa sono già impegnati altrove «Sì» resta
// spento con accanto «non disponibile».
//
// Con «Annulla» non cambia niente: la striscia di partenza non si tocca mai,
// si lavora su una copia e «Fatto» la restituisce a chi salva.
// Nessuna chiamata al database qui dentro: camere e prenotazioni vicine
// arrivano dal contesto, le regole da lib/strisciaNotti.
// ============================================================================
import { useState } from 'react'
import Foglio from '@/components/scheda/Foglio'
import {
  camereDellaNotte, avvisoCapienza, lettoDisponibileNotte, prezzoLettoNotte, titoloNotte,
  motivoLettoObbligatorio, lettoObbligatorio,
  cambiaCamera, cambiaLetto, cambiaOspitiNotte, nonDormeQui, LETTO_NON_DISPONIBILE,
  type ContestoNotti, type NotteStriscia,
} from '@/lib/strisciaNotti'
import { tintaCamera } from '@/components/StrisciaNottiCamere'

const OTTONE = '#A9884E'
export const MATTONE = '#8C3B2E'
export const FONDO_MATTONE = '#F6E4DE'
export const BORDO_MATTONE = '#EAD3CC'
export const TITOLO_CAMERE = 'Camere libere questa notte'
export const TITOLO_OSPITI = 'Ospiti questa notte'
export const DOMANDA_DA_QUI = 'da qui in poi'
export const DOMANDA_SOLO_QUESTA = 'solo questa notte'
export const TITOLO_LETTO = 'Letto in più questa notte'
export const NON_DORME_QUI = 'Non dorme qui'
export const NESSUNA_CAMERA_LIBERA = 'Questa notte non è libera nessuna camera'
export const COME_RIMETTERLA = 'per rimetterla nel soggiorno scegli una camera'

// Le pastiglie si toccano su 44 px, la misura chiesta da Ania per i comandi
export const ALTEZZA_PASTIGLIA = 44

const titoletto = { fontSize: 9, letterSpacing: '1.5px', color: OTTONE, textTransform: 'uppercase' as const }

function Pastiglia({ acceso, spenta, onClick, children }: { acceso: boolean; spenta?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={spenta ? undefined : onClick} disabled={spenta} aria-pressed={acceso}
      style={{
        minHeight: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 14px', fontSize: 13, fontWeight: 600,
        background: acceso ? 'var(--color-sage)' : '#fff',
        color: spenta ? '#B9B6AD' : acceso ? 'var(--color-green-mid)' : 'var(--color-green-dark)',
        border: acceso ? `1.5px solid ${OTTONE}` : '1px solid var(--color-card-border)',
      }}>{children}</button>
  )
}

export default function FoglioNotte({ notti, iso, contesto, ospitiPossibili, lettoScelto, onFatto, onChiudi }: {
  notti: NotteStriscia[]
  iso: string
  contesto: ContestoNotti
  /** quando c'è, nel foglietto si scelgono anche gli ospiti di quella notte
   *  (i valori salvabili, decisi da chi apre il foglietto) */
  ospitiPossibili?: (cameraId: string | null) => number[]
  /** l'accordo del letto preso sopra: con l'importo vuoto valgono le regole.
   *  Il costo accanto a «Sì» si rifà a ogni tocco, sugli ospiti di QUESTA notte. */
  lettoScelto?: { importo: number | null; criterio: 'notte' | 'ogni4' | 'totale' }
  /** «Fatto»: la striscia com'è diventata (la pagina salva e ricalcola il conto) */
  onFatto: (notti: NotteStriscia[], daQuiInPoi: boolean) => void
  onChiudi: () => void
}) {
  const [bozza, setBozza] = useState(notti)
  const [daQui, setDaQui] = useState(false)
  const notte = bozza.find(n => n.iso === iso)
  if (!notte) return null
  const libere = camereDellaNotte(iso, contesto)
  const scelta = libere.find(c => c.id === notte.cameraId) ?? null
  const avviso = notte.dentro ? avvisoCapienza(scelta, notte.persone) : null
  const lettoLibero = lettoDisponibileNotte(iso, notte.cameraId, contesto)
  // qui gli ospiti della notte si scelgono a mano? allora il letto non li tocca
  const ospitiAParte = Boolean(ospitiPossibili)
  const serveIlLetto = notte.dentro && lettoObbligatorio(scelta, notte.persone)

  return (
    <Foglio titolo={titoloNotte(iso)} grande onChiudi={onChiudi}>
      {/* ── Le camere libere questa notte ─────────────────────────────── */}
      <p style={titoletto}>{TITOLO_CAMERE}</p>
      {libere.length === 0
        ? <p data-nessuna-camera className="mt-2" style={{ fontSize: 13, color: MATTONE }}>{NESSUNA_CAMERA_LIBERA}</p>
        : <div data-camere-libere className="flex flex-wrap mt-2" style={{ gap: 8 }}>
          {libere.map(c => {
            const acceso = notte.dentro && notte.cameraId === c.id
            const tinta = tintaCamera(c.name)
            return (
              <button key={c.id} type="button" data-camera={c.name} aria-pressed={acceso}
                onClick={() => setBozza(b => cambiaCamera(b, iso, c, contesto))}
                style={{
                  minHeight: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 14px', fontSize: 13, fontWeight: 600,
                  background: acceso ? tinta.fondo : '#fff',
                  color: acceso ? tinta.testo : 'var(--color-green-dark)',
                  border: acceso ? `1.5px solid ${OTTONE}` : '1px solid var(--color-card-border)',
                }}>{c.name}</button>
            )
          })}
        </div>}
      {avviso && (
        <p data-avviso-capienza className="mt-2" style={{ background: FONDO_MATTONE, border: `1px solid ${BORDO_MATTONE}`, borderRadius: 8, padding: '6px 10px', fontSize: 12.5, color: MATTONE }}>{avviso}</p>
      )}

      {/* ── Gli ospiti di questa notte ────────────────────────────────── */}
      {ospitiPossibili && notte.dentro && (() => {
        const valori = ospitiPossibili(notte.cameraId)
        const i = valori.indexOf(notte.persone)
        const giu = i > 0 ? valori[i - 1] : valori.find(v => v < notte.persone) ?? null
        const su = i >= 0 && i < valori.length - 1 ? valori[i + 1] : valori.find(v => v > notte.persone) ?? null
        const cambia = (quanti: number) => setBozza(b => cambiaOspitiNotte(b, iso, quanti, contesto))
        const tasto = { width: 38, height: 38, borderRadius: 999, border: '1px solid var(--color-card-border)', fontSize: 18, color: 'var(--color-green-dark)', background: '#fff' }
        return (
          <div data-ospiti-notte className="mt-4">
            <p style={titoletto}>{TITOLO_OSPITI}</p>
            <div className="flex items-center mt-2" style={{ gap: 12 }}>
              <button type="button" data-ospiti-giu disabled={giu === null} onClick={() => giu !== null && cambia(giu)} aria-label="Un ospite in meno"
                style={{ ...tasto, opacity: giu === null ? 0.4 : 1 }}>−</button>
              <span data-ospiti-quanti style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, color: 'var(--color-green-dark)', minWidth: 22, textAlign: 'center' }}>{notte.persone}</span>
              <button type="button" data-ospiti-su disabled={su === null} onClick={() => su !== null && cambia(su)} aria-label="Un ospite in più"
                style={{ ...tasto, opacity: su === null ? 0.4 : 1 }}>+</button>
            </div>
            {/* vale solo per questa notte, o da qui alla fine? */}
            <div className="flex flex-wrap mt-3" style={{ gap: 8 }} role="group" aria-label="Per quali notti">
              <Pastiglia acceso={!daQui} onClick={() => setDaQui(false)}>{DOMANDA_SOLO_QUESTA}</Pastiglia>
              <Pastiglia acceso={daQui} onClick={() => setDaQui(true)}>{DOMANDA_DA_QUI}</Pastiglia>
            </div>
          </div>
        )
      })()}

      {/* ── Il letto in più ───────────────────────────────────────────── */}
      <p className="mt-4" style={titoletto}>{TITOLO_LETTO}</p>
      <div data-letto-notte className="flex flex-wrap items-center mt-2" style={{ gap: 8 }}>
        <Pastiglia acceso={!notte.letto} spenta={!notte.dentro || serveIlLetto} onClick={() => setBozza(b => cambiaLetto(b, iso, false, contesto, { ospitiAParte }))}>No</Pastiglia>
        <Pastiglia acceso={notte.letto} spenta={!notte.dentro || (!lettoLibero && !notte.letto)} onClick={() => setBozza(b => cambiaLetto(b, iso, true, contesto, { ospitiAParte }))}>
          Sì · {prezzoLettoNotte(scelta, notte.dentro ? notte.persone : contesto.ospiti, lettoScelto)}
        </Pastiglia>
        {notte.dentro && !lettoLibero && !notte.letto && <span data-letto-non-disponibile style={{ fontSize: 11.5, color: 'var(--color-stone)' }}>{LETTO_NON_DISPONIBILE}</span>}
        {/* «No» spento: gli ospiti della notte non ci stanno senza letto, e
            non si abbassano da soli per far posto (Ania, 15/09/2026) */}
        {serveIlLetto && <span data-letto-serve style={{ fontSize: 11.5, color: 'var(--color-stone)' }}>{motivoLettoObbligatorio(scelta, notte.persone)}</span>}
      </div>

      {/* ── Toglie la notte dal soggiorno ─────────────────────────────── */}
      <button type="button" data-non-dorme className="mt-4 block" onClick={() => setBozza(b => nonDormeQui(b, iso))}
        style={{ fontSize: 13.5, fontWeight: 600, minHeight: ALTEZZA_PASTIGLIA, color: notte.dentro ? MATTONE : 'var(--color-stone)' }}>
        {notte.dentro ? NON_DORME_QUI : `${NON_DORME_QUI} ✓`}
      </button>
      {!notte.dentro && <p data-come-rimetterla style={{ marginTop: 2, fontSize: 12, color: 'var(--color-stone)' }}>{COME_RIMETTERLA}</p>}

      {/* ── Fatto e Annulla ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-5 mb-1" style={{ gap: 12 }}>
        <button type="button" data-annulla onClick={onChiudi} style={{ fontSize: 14, minHeight: ALTEZZA_PASTIGLIA, padding: '0 6px', color: 'var(--color-stone)' }}>Annulla</button>
        <button type="button" data-fatto onClick={() => onFatto(bozza, daQui)}
          style={{ minHeight: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 22px', fontSize: 14, fontWeight: 600, background: 'var(--color-green-mid)', color: 'var(--color-cream)' }}>Fatto</button>
      </div>
    </Foglio>
  )
}
