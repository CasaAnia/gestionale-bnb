'use client'
// ============================================================================
// IL FOGLIO che si apre sopra la nuova scheda prenotazione (13/09/2026): dal
// basso sul telefono, al centro sul Mac — la stessa veste dei fogli della
// proposta (ed-velo, ed-foglio, scheda-in). Contiene quello che gli si passa.
// Col titolo `grande` la testa è in Georgia 18: è il foglietto della notte
// della striscia («Sabato 12», 13/09/2026).
// ============================================================================
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDesktop } from '@/lib/richiesteVista'

export default function Foglio({ titolo, grande = false, onChiudi, children }: { titolo: string; grande?: boolean; onChiudi: () => void; children: ReactNode }) {
  const desktop = useDesktop()
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="velo-in absolute inset-0 ed-velo" onClick={onChiudi} />
      <div className={`scheda-in absolute ed-foglio shadow-lg overflow-y-auto ${desktop ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl w-[420px] max-h-[70vh] p-4' : 'left-0 right-0 bottom-0 rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[80dvh]'}`}>
        {!desktop && <div className="w-10 h-1 rounded-full bg-border-soft mx-auto mb-3" aria-hidden />}
        <div className="flex items-center justify-between mb-2">
          <p className={grande ? 'text-green-dark' : 'text-sm font-semibold text-green-dark'}
            style={grande ? { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, lineHeight: '22px' } : undefined}>{titolo}</p>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="w-9 h-9 -mr-2 flex items-center justify-center text-stone"><X size={18} strokeWidth={2} aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
