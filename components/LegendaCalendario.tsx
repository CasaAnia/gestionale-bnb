'use client'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { VOCI_LEGENDA, ICONE_LEGENDA, OPACITA_ARRIVATA, type VoceLegenda } from '@/lib/calendarioMobile'
import { LARGHEZZA_FOGLIETTO_MAC } from '@/lib/calendarioFoglietto'

// Legenda del Calendario: <PannelloLegenda />, dal 29/09/2026 (calendario
// «Maison») si apre toccando «LEGENDA» sotto «Oggi» ed è un foglio dal basso
// ad altezza fissa (FoglioMaison), con la riga delle icone e «Chiudi».
// Dal Mac lo stesso foglio, centrato a 620 px: la vecchia legenda in riga
// sotto i mesi non c'è più (Ania, 29/09/2026).
// Gli Arrivi (29/09/2026) usano la stessa legenda con le loro voci
// (VOCI_LEGENDA_ARRIVI): `voci`, `icone`, `titolo`, `altezza` e `dati`.
export const ALTEZZA_LEGENDA = 470

const quadretto = (v: VoceLegenda, lato: number) => ({
  width: lato, height: lato, borderRadius: 3, background: v.tratteggiata ? 'transparent' : v.colore,
  // il tratteggio verde delle richieste dal sito, quello d'ottone delle Richieste (29/09/2026)
  border: v.tratteggiata ? `1.5px dashed ${v.colore === 'white' ? '#2D6A4F' : v.colore}` : undefined, flex: 'none' as const,
  opacity: v.attenuata ? OPACITA_ARRIVATA : undefined,
})

export function PannelloLegenda({ onChiudi, voci = VOCI_LEGENDA, icone = ICONE_LEGENDA, titolo = 'Legenda del calendario', altezza = ALTEZZA_LEGENDA, dati = 'legenda-calendario' }: {
  onChiudi: () => void; voci?: VoceLegenda[]; icone?: string; titolo?: string; altezza?: number; dati?: string
}) {
  return (
    <FoglioMaison titolo={titolo} altezza={altezza} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC} onChiudi={onChiudi} dati={dati}
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
