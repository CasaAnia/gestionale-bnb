'use client'
// ============================================================================
// IL FOGLIO che si apre sopra la nuova scheda prenotazione (13/09/2026): dal
// basso sul telefono, al centro sul Mac — la stessa veste dei fogli della
// proposta (ed-velo, ed-foglio, scheda-in). Contiene quello che gli si passa.
//
// La veste comune di TUTTI i fogli di modifica (16/09/2026, decisa da Ania):
// fondo crema, angoli in alto arrotondati di 20 px, 22 px di margine ai lati,
// in cima il titolo in Georgia 20. Col titolo `grande` la testa è in Georgia
// 18: è il foglietto della notte della striscia («Sabato 12», 13/09/2026).
//
// In fondo, centrati, ci stanno la pastiglia verde piena con l'azione (alta
// 30 px, testo 12 px) e sotto «Annulla» in 13 px stone: è PiedeFoglio, qui
// sotto, così nessun foglio si ridisegna i suoi due tasti. Chiudendo con
// «Annulla» non cambia niente: il piede chiama solo `onAnnulla`.
// ============================================================================
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDesktop } from '@/lib/richiesteVista'

export const GEORGIA_FOGLIO = "Georgia, 'Times New Roman', serif"
export const MATTONE_FOGLIO = '#8C3B2E'
export const ANGOLI_FOGLIO = 20
export const MARGINE_FOGLIO = 22
export const ALTEZZA_AZIONE = 30
export const TESTO_ANNULLA = 'Annulla'

export default function Foglio({ titolo, grande = false, onChiudi, children }: { titolo: string; grande?: boolean; onChiudi: () => void; children: ReactNode }) {
  const desktop = useDesktop()
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="velo-in absolute inset-0 ed-velo" onClick={onChiudi} />
      <div className={`scheda-in absolute ed-foglio shadow-lg overflow-y-auto ${desktop ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[20px] w-[440px] max-h-[80vh] px-[22px] pt-4 pb-4' : 'left-0 right-0 bottom-0 rounded-t-[20px] px-[22px] pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[88dvh]'}`}>
        {!desktop && <div className="w-10 h-1 rounded-full bg-border-soft mx-auto mb-3" aria-hidden />}
        <div className="flex items-center justify-between mb-3">
          <p data-titolo-foglio className="text-green-dark"
            style={grande
              ? { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, lineHeight: '22px' }
              : { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, lineHeight: '24px' }}>{titolo}</p>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="w-9 h-9 -mr-2 flex items-center justify-center text-stone"><X size={18} strokeWidth={2} aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** I due tasti in fondo a ogni foglio: l'azione in pastiglia piena, centrata,
 *  e sotto «Annulla» (o «Torna indietro»). Con `mattone` la pastiglia è
 *  #8C3B2E: è l'annullamento della prenotazione. */
export function PiedeFoglio({ azione, onAzione, salvando = false, testoSalvando = 'Salvo…', onAnnulla, testoAnnulla = TESTO_ANNULLA, mattone = false, dati }: {
  azione: string
  onAzione: () => void
  salvando?: boolean
  testoSalvando?: string
  onAnnulla: () => void
  testoAnnulla?: string
  mattone?: boolean
  dati?: string
}) {
  return (
    <div data-piede-foglio className="text-center" style={{ marginTop: 22, marginBottom: 2 }}>
      <button type="button" data-azione-foglio={dati} onClick={onAzione} disabled={salvando} className="py-[7px] -my-[7px]"
        style={{
          height: ALTEZZA_AZIONE, borderRadius: 999, padding: '0 18px', fontSize: 12, fontWeight: 600,
          background: mattone ? MATTONE_FOGLIO : 'var(--color-green-mid)', color: 'var(--color-cream)', opacity: salvando ? 0.5 : 1,
        }}>{salvando ? testoSalvando : azione}</button>
      <p style={{ marginTop: 10 }}>
        <button type="button" data-annulla-foglio onClick={onAnnulla} disabled={salvando}
          style={{ minHeight: 44, padding: '0 14px', fontSize: 13, color: 'var(--color-stone)' }}>{testoAnnulla}</button>
      </p>
    </div>
  )
}
