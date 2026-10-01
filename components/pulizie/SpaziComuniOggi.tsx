'use client'
// «Spazi comuni» dopo le camere da fare (riferimento approvato da Ania il
// 01/10/2026, pulizie-riferimento.html, telefono 2): tre righe, una per
// voce, con i minuti di oggi e l'ora dell'ultimo salvataggio, e il comando
// del timer. Quando il timer di una riga è in corso, sotto compare il numero
// grande con «In corso» e «Pausa», come nelle camere (TimerPulizia grande).
// I minuti: tocco → foglio «Spazi comuni · minuti a mano».
import TimerPulizia from '@/components/TimerPulizia'
import { useTimerPulizie, azioneTimer, type FuoriCameraSql } from '@/lib/pulizieTempiDati'
import { chiaveTimerFuori, minutiPerVoce, vociSpaziAttive, type VoceSpazi } from '@/lib/tempoPulizie'
import { oraRoma } from '@/lib/pulizieOggi'
import { useState } from 'react'

export const TITOLO_SPAZI = 'Spazi comuni'
export const LINK_TEMPI_FUORI_PAGINA = 'Tempi fuori dalle camere ↗'

export default function SpaziComuniOggi({ oggi, righe, conAltro, nomeCamera, onVaiA, onMinuti }: {
  oggi: string; righe: FuoriCameraSql[]; conAltro: boolean
  nomeCamera: (bookingId: string) => string | null; onVaiA: (chiave: string) => void
  /** tocco sui minuti di una voce */
  onMinuti?: (voce: VoceSpazi) => void
}) {
  const s = useTimerPulizie()
  const [errore, setErrore] = useState<{ voce: VoceSpazi; testo: string } | null>(null)
  const [occupato, setOccupato] = useState(false)
  const voci = minutiPerVoce(righe.filter(r => r.data === oggi))
  return <article className="pul-card" id="spazi-comuni" data-spazi-comuni>
    <div className="hd"><b>{TITOLO_SPAZI}</b><span className="pul-pr calm">Ogni giorno</span></div>
    {vociSpaziAttive(conAltro).map(([k, label]) => {
      const chiave = chiaveTimerFuori(oggi, k)
      const t = s.timer.find(x => x.chiave === chiave)
      const inCorso = !!t?.avviato_at
      const secondi = t?.trascorsi ?? 0
      const altro = s.timer.find(x => x.chiave !== chiave && x.avviato_at)
      const v = voci[k]
      const testo = v.righe.length && v.minuti > 0 ? `${v.minuti} min${v.ultimo ? ` · ${oraRoma(v.ultimo)?.replace(/^0/, '')}` : ''}` : '—'
      return <div key={k} data-voce-spazi={k}>
        <div className="pul-sc">
          <span>{label}</span>
          {onMinuti ? <button type="button" className="min" data-minuti-spazi={k} onClick={() => onMinuti(k)}>{testo}</button> : <small data-minuti-spazi={k}>{testo}</small>}
          {!inCorso ? <button type="button" className="pul-az" data-comando-spazi={k} disabled={occupato || s.stato !== 'pronto'}
            onClick={async () => { if (altro) { setErrore({ voce: k, testo: 'Un altro timer è in corso: mettilo in pausa prima di avviarne un altro.' }); return }; setOccupato(true); setErrore(null); const e = await azioneTimer('avvia', chiave); setOccupato(false); if (e.errore) setErrore({ voce: k, testo: e.errore }) }}>{secondi ? 'Riprendi' : 'Avvia'}</button> : <span />}
        </div>
        {inCorso && <div className="pul-sc-timer"><TimerPulizia grande chiave={chiave} nome={label} onMinuti={() => onMinuti?.(k)} nomeCamera={nomeCamera} onVaiA={onVaiA} /></div>}
        {errore?.voce === k && <p role="alert" className="pul-errore">{errore.testo}</p>}
      </div>
    })}
    <div className="pul-azioni"><a href="#fuori-camera" className="pul-az" data-link-fuori>{LINK_TEMPI_FUORI_PAGINA}</a></div>
  </article>
}
