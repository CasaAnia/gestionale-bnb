'use client'
import { useEffect } from 'react'
import { VOCI_LEGENDA } from '@/lib/calendarioMobile'

// Legenda del Calendario (07/09/2026): le stesse voci in due forme.
//  · <VociLegenda /> in riga, in fondo alla pagina dal Mac (come prima).
//  · <PannelloLegenda /> a scomparsa dal bottone «?» in alto a destra: foglio
//    dal basso sul telefono, scheda centrata sul Mac (velo e foglio come le
//    altre finestre), così la griglia non perde spazio.
export function VociLegenda({ verticale = false }: { verticale?: boolean }) {
  return (
    <div className={verticale ? 'flex flex-col gap-2.5' : 'flex flex-wrap gap-3 items-center'}>
      {VOCI_LEGENDA.map(v => (
        <div key={v.testo} className="flex items-center gap-2">
          <div style={{ width: verticale ? 16 : 12, height: verticale ? 16 : 12, borderRadius: 3, background: v.colore, border: v.tratteggiata ? '1.5px dashed #2D6A4F' : undefined, flex: 'none' }} />
          <span className={verticale ? 'text-sm text-green-dark' : 'text-xs text-gray-500'}>{v.testo}</span>
        </div>
      ))}
    </div>
  )
}

export function PannelloLegenda({ onChiudi }: { onChiudi: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onChiudi() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChiudi])
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Legenda del calendario" data-legenda>
      <div className="velo-in absolute inset-0 ed-velo" onClick={onChiudi} />
      <div className="scheda-in relative ed-foglio rounded-2xl shadow-lg p-5 w-full max-w-sm">
        <p className="ed-titolo-medio">Legenda</p>
        <p className="text-xs text-stone mt-1 mb-4">Colori delle barre nel calendario. Le barre tagliate a incastro sono un cambio camera.</p>
        <VociLegenda verticale />
        <button type="button" onClick={onChiudi} className="ed-pillola-contorno w-full mt-5 min-h-[44px] text-sm font-semibold">Chiudi</button>
      </div>
    </div>
  )
}
