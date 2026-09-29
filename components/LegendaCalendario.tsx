'use client'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { VOCI_LEGENDA, ICONE_LEGENDA, OPACITA_ARRIVATA, type VoceLegenda } from '@/lib/calendarioMobile'

// Legenda del Calendario: le stesse voci in due forme.
//  · <VociLegenda /> in riga, in fondo alla pagina dal Mac (come prima).
//  · <PannelloLegenda /> dal telefono: dal 29/09/2026 (calendario «Maison»)
//    si apre toccando «LEGENDA» sotto «Oggi» ed è un foglio dal basso ad
//    altezza fissa (FoglioMaison), con la riga delle icone e «Chiudi».
// Gli Arrivi (29/09/2026) usano le stesse due forme con le loro voci
// (VOCI_LEGENDA_ARRIVI): `voci`, `icone`, `titolo`, `altezza` e `dati`.
export const ALTEZZA_LEGENDA = 470

const quadretto = (v: VoceLegenda, lato: number) => ({
  width: lato, height: lato, borderRadius: lato > 10 ? 3 : 2, background: v.tratteggiata ? 'transparent' : v.colore,
  border: v.tratteggiata ? '1.5px dashed #2D6A4F' : undefined, flex: 'none' as const,
  opacity: v.attenuata ? OPACITA_ARRIVATA : undefined,
})

export function VociLegenda({ voci = VOCI_LEGENDA }: { voci?: VoceLegenda[] }) {
  return (
    <div className="cal-leg-riga">
      {voci.map(v => (
        <span key={v.testo}><i style={quadretto(v, 10)} />{v.testo}</span>
      ))}
    </div>
  )
}

export function PannelloLegenda({ onChiudi, voci = VOCI_LEGENDA, icone = ICONE_LEGENDA, titolo = 'Legenda del calendario', altezza = ALTEZZA_LEGENDA, dati = 'legenda-calendario' }: {
  onChiudi: () => void; voci?: VoceLegenda[]; icone?: string; titolo?: string; altezza?: number; dati?: string
}) {
  return (
    <FoglioMaison titolo={titolo} altezza={altezza} onChiudi={onChiudi} dati={dati}
      testa={<div className="cal-leg-k">Legenda</div>}
      piede={<div className="cal-fog-ac"><button type="button" className="mz-lnk q" onClick={onChiudi}>Chiudi</button></div>}>
      <div data-legenda>
        {voci.map(v => (
          <div key={v.testo} className="cal-leg-r"><i style={quadretto(v, 14)} />{v.testo}</div>
        ))}
        <p className="cal-leg-ic">{icone}</p>
      </div>
    </FoglioMaison>
  )
}
