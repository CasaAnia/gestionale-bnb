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
  cambiaCamera, cambiaLetto, nonDormeQui, LETTO_NON_DISPONIBILE,
  type ContestoNotti, type NotteStriscia,
} from '@/lib/strisciaNotti'
import { tintaCamera } from '@/components/StrisciaNottiCamere'

const OTTONE = '#A9884E'
export const MATTONE = '#8C3B2E'
export const FONDO_MATTONE = '#F6E4DE'
export const BORDO_MATTONE = '#EAD3CC'
export const TITOLO_CAMERE = 'Camere libere questa notte'
export const TITOLO_LETTO = 'Letto in più questa notte'
export const NON_DORME_QUI = 'Non dorme qui'
export const NESSUNA_CAMERA_LIBERA = 'Questa notte non è libera nessuna camera'

const titoletto = { fontSize: 9, letterSpacing: '1.5px', color: OTTONE, textTransform: 'uppercase' as const }

function Pastiglia({ acceso, spenta, onClick, children }: { acceso: boolean; spenta?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={spenta ? undefined : onClick} disabled={spenta} aria-pressed={acceso}
      style={{
        minHeight: 38, borderRadius: 999, padding: '0 14px', fontSize: 13, fontWeight: 600,
        background: acceso ? 'var(--color-sage)' : '#fff',
        color: spenta ? '#B9B6AD' : acceso ? 'var(--color-green-mid)' : 'var(--color-green-dark)',
        border: acceso ? `1.5px solid ${OTTONE}` : '1px solid var(--color-card-border)',
      }}>{children}</button>
  )
}

export default function FoglioNotte({ notti, iso, contesto, onFatto, onChiudi }: {
  notti: NotteStriscia[]
  iso: string
  contesto: ContestoNotti
  /** «Fatto»: la striscia com'è diventata (la pagina salva e ricalcola il conto) */
  onFatto: (notti: NotteStriscia[]) => void
  onChiudi: () => void
}) {
  const [bozza, setBozza] = useState(notti)
  const notte = bozza.find(n => n.iso === iso)
  if (!notte) return null
  const libere = camereDellaNotte(iso, contesto)
  const scelta = libere.find(c => c.id === notte.cameraId) ?? null
  const avviso = notte.dentro ? avvisoCapienza(scelta, notte.persone) : null
  const lettoLibero = lettoDisponibileNotte(iso, notte.cameraId, contesto)

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
                  minHeight: 38, borderRadius: 999, padding: '0 14px', fontSize: 13, fontWeight: 600,
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

      {/* ── Il letto in più ───────────────────────────────────────────── */}
      <p className="mt-4" style={titoletto}>{TITOLO_LETTO}</p>
      <div data-letto-notte className="flex flex-wrap items-center mt-2" style={{ gap: 8 }}>
        <Pastiglia acceso={!notte.letto} onClick={() => setBozza(b => cambiaLetto(b, iso, false, contesto))}>No</Pastiglia>
        <Pastiglia acceso={notte.letto} spenta={!lettoLibero && !notte.letto} onClick={() => setBozza(b => cambiaLetto(b, iso, true, contesto))}>
          Sì · {prezzoLettoNotte(scelta, contesto.ospiti)}
        </Pastiglia>
        {!lettoLibero && !notte.letto && <span data-letto-non-disponibile style={{ fontSize: 11.5, color: 'var(--color-stone)' }}>{LETTO_NON_DISPONIBILE}</span>}
      </div>

      {/* ── Toglie la notte dal soggiorno ─────────────────────────────── */}
      <button type="button" data-non-dorme className="mt-4 py-2 -my-0" onClick={() => setBozza(b => nonDormeQui(b, iso))}
        style={{ fontSize: 13.5, fontWeight: 600, color: notte.dentro ? MATTONE : 'var(--color-stone)' }}>
        {notte.dentro ? NON_DORME_QUI : `${NON_DORME_QUI} ✓`}
      </button>

      {/* ── Fatto e Annulla ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-5 mb-1" style={{ gap: 12 }}>
        <button type="button" data-annulla onClick={onChiudi} className="py-2 -my-2" style={{ fontSize: 14, color: 'var(--color-stone)' }}>Annulla</button>
        <button type="button" data-fatto onClick={() => onFatto(bozza)}
          style={{ minHeight: 40, borderRadius: 999, padding: '0 22px', fontSize: 14, fontWeight: 600, background: 'var(--color-green-mid)', color: 'var(--color-cream)' }}>Fatto</button>
      </div>
    </Foglio>
  )
}
