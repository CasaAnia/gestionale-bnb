'use client'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { VOCI_LEGENDA, ICONE_LEGENDA } from '@/lib/calendarioMobile'

// Legenda del Calendario: le stesse voci in due forme.
//  · <VociLegenda /> in riga, in fondo alla pagina dal Mac (come prima).
//  · <PannelloLegenda /> dal telefono: dal 29/09/2026 (calendario «Maison»)
//    si apre toccando «LEGENDA» sotto «Oggi» ed è un foglio dal basso ad
//    altezza fissa (FoglioMaison), con la riga delle icone e «Chiudi».
export const ALTEZZA_LEGENDA = 470

const quadretto = (v: (typeof VOCI_LEGENDA)[number], lato: number) => ({
  width: lato, height: lato, borderRadius: lato > 10 ? 3 : 2, background: v.tratteggiata ? 'transparent' : v.colore,
  border: v.tratteggiata ? '1.5px dashed #2D6A4F' : undefined, flex: 'none' as const,
})

export function VociLegenda() {
  return (
    <div className="cal-leg-riga">
      {VOCI_LEGENDA.map(v => (
        <span key={v.testo}><i style={quadretto(v, 10)} />{v.testo}</span>
      ))}
    </div>
  )
}

export function PannelloLegenda({ onChiudi }: { onChiudi: () => void }) {
  return (
    <FoglioMaison titolo="Legenda del calendario" altezza={ALTEZZA_LEGENDA} onChiudi={onChiudi} dati="legenda-calendario"
      testa={<div className="cal-leg-k">Legenda</div>}
      piede={<div className="cal-fog-ac"><button type="button" className="mz-lnk q" onClick={onChiudi}>Chiudi</button></div>}>
      <div data-legenda>
        {VOCI_LEGENDA.map(v => (
          <div key={v.testo} className="cal-leg-r"><i style={quadretto(v, 14)} />{v.testo}</div>
        ))}
        <p className="cal-leg-ic">{ICONE_LEGENDA}</p>
      </div>
    </FoglioMaison>
  )
}
