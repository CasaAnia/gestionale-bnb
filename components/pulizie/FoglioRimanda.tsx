'use client'
// ============================================================================
// «RIMANDA O SALTA» come foglio piccolo (riferimento approvato da Ania il
// 01/10/2026, pulizie-fogli-riferimento.html), in Home e nella pagina
// Pulizie al posto del pannello che si apriva nella scheda. Le date sono
// quelle di sempre (ControlliPulizia):
//   - Rimanda: proposta «domani» dal giorno previsto (o da oggi, se è già
//     passato); «Tra 2 giorni»; «Altra data…» apre il calendario;
//   - Salta questo cambio (solo il cambio delle 4 notti): la prossima fra 4
//     notti dal giorno previsto;
//   - mai una data uguale o prima del giorno previsto.
// Il salvataggio resta quello di ControlliPulizia (registra), qui la veste.
// ============================================================================
import { useState } from 'react'
import FoglioPulizie from './FoglioPulizie'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import { apriSelettore } from '@/components/nuova/CampoData'
import { addDaysStr, type Decisione } from '@/lib/pulizie'
import { giornoLungo } from '@/lib/giornataPulizie'

export const TIPO_RIMANDA: Record<Decisione['tipo'], string> = { soggiorno: 'cambio biancheria', fine_soggiorno: 'cambio ospite', cambio_camera: 'cambio camera' }

export default function FoglioRimanda({ camera, pulizia, oggi, chi, partenza, occupato, errore, salvato, onFineSalvato, onAnnulla, onConferma }: {
  camera: string; pulizia: Decisione; oggi: string
  /** a destra del nome per il cambio biancheria: «Lucia Ferri · 4ª notte» */
  chi?: string
  partenza?: string
  occupato: boolean
  errore?: string | null
  salvato: Salvataggio | null
  onFineSalvato: () => void
  onAnnulla: () => void
  onConferma: (stato: 'rimandata' | 'saltata', data: string) => void
}) {
  const base = pulizia.data_prevista > oggi ? pulizia.data_prevista : oggi
  const [stato, setStato] = useState<'rimandata' | 'saltata'>('rimandata')
  const [data, setData] = useState(addDaysStr(base, 1))
  const minimo = addDaysStr(pulizia.data_prevista, 1)
  const pillola = (n: 1 | 2) => addDaysStr(base, n)
  const altra = stato === 'rimandata' && data !== pillola(1) && data !== pillola(2)
  return <FoglioPulizie dati="rimanda" eyebrow={`Rimanda o salta · ${TIPO_RIMANDA[pulizia.tipo]}`} titolo={camera} destra={pulizia.tipo === 'soggiorno' ? chi : undefined}
    onChiudi={onAnnulla} salvato={salvato} onFineSalvato={onFineSalvato}
    azione="Conferma" onAzione={() => onConferma(stato, data)} salvando={occupato} disabilitato={!data || data <= pulizia.data_prevista || !!salvato}>
    <div data-rimanda-aperto>
      <div className="pul-seg" role="group" aria-label="Rimanda o salta" style={{ marginTop: 14 }}>
        <button type="button" className={stato === 'rimandata' ? 'on' : ''} aria-pressed={stato === 'rimandata'} disabled={occupato}
          onClick={() => { setStato('rimandata'); setData(addDaysStr(base, 1)) }}>Rimanda</button>
        {pulizia.tipo === 'soggiorno' && <button type="button" className={stato === 'saltata' ? 'on' : ''} aria-pressed={stato === 'saltata'} disabled={occupato}
          onClick={() => { setStato('saltata'); setData(addDaysStr(pulizia.data_prevista, 4)) }}>Salta questo cambio</button>}
      </div>
      {stato === 'rimandata' && <div className="pul-qk">
        <button type="button" className={data === pillola(1) ? 'on' : ''} onClick={() => setData(pillola(1))} data-pillola="domani">Domani</button>
        <button type="button" className={data === pillola(2) ? 'on' : ''} onClick={() => setData(pillola(2))} data-pillola="tra-2">Tra 2 giorni</button>
        <span className="relative inline-block">
          <button type="button" className={altra ? 'on' : ''} data-pillola="altra">Altra data…</button>
          <input type="date" aria-label="Altra data" min={minimo} value={data} onChange={e => setData(e.target.value)} onClick={e => apriSelettore(e.currentTarget)}
            style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }} />
        </span>
      </div>}
      <label className="pul-fld">
        <span>{stato === 'rimandata' ? 'Rimanda al' : 'Prossima il'}</span>
        <b data-data-scritta>{data ? giornoLungo(data) : '—'}</b>
        <input type="date" aria-label="Prossima pulizia" min={minimo} value={data} onChange={e => setData(e.target.value)} onClick={e => apriSelettore(e.currentTarget)}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }} />
      </label>
      {partenza && data >= partenza && <p className="pul-nt" data-nessun-altro>Nessun altro cambio prima della partenza del {partenza.split('-').reverse().join('/')}.</p>}
      {errore && <p role="alert" className="pul-errore">{errore}</p>}
    </div>
  </FoglioPulizie>
}
