'use client'
// La riga del periodo di Registro e Statistiche (riferimento del 01/10/2026):
// a sinistra il periodo in Cormorant 26, a destra «‹ SETT. | MESE | DAL–AL ›»;
// con DAL–AL sotto i due campi a filo «Dal» e «Al». Le regole: lib/periodoPulizie.
import { apriSelettore } from '@/components/nuova/CampoData'
import { cambiaModo, dataPiena, etichettaPeriodo, sposta, type ModoPeriodo, type Periodo } from '@/lib/periodoPulizie'

const VOCI: [ModoPeriodo, string][] = [['sett', 'Sett.'], ['mese', 'Mese'], ['dal_al', 'Dal–al']]

export default function PeriodoPulizie({ periodo, oggi, onPeriodo }: { periodo: Periodo; oggi: string; onPeriodo: (p: Periodo) => void }) {
  const dopo = sposta(periodo, 1)
  return <>
    <div className="pul-per" data-periodo={periodo.modo}>
      <b data-etichetta-periodo>{etichettaPeriodo(periodo)}</b>
      <span>
        <button type="button" className="fr" aria-label="Periodo prima" onClick={() => onPeriodo(sposta(periodo, -1))}>‹</button>
        <span className="pll" role="group" aria-label="Periodo">{VOCI.map(([k, l]) => <button type="button" key={k} className={periodo.modo === k ? 'on' : ''} aria-pressed={periodo.modo === k} onClick={() => onPeriodo(cambiaModo(k, oggi))}>{l}</button>)}</span>
        <button type="button" className="fr" aria-label="Periodo dopo" disabled={dopo.dal > oggi} onClick={() => onPeriodo(dopo)}>›</button>
      </span>
    </div>
    {periodo.modo === 'dal_al' && <div className="pul-dd">
      {(['dal', 'al'] as const).map(k => <label key={k}><small>{k === 'dal' ? 'Dal' : 'Al'}</small><b>{dataPiena(periodo[k])}</b>
        <input type="date" aria-label={k === 'dal' ? 'Dal' : 'Al'} value={periodo[k]} max={k === 'dal' ? periodo.al : undefined} min={k === 'al' ? periodo.dal : undefined}
          onChange={e => { if (e.target.value) onPeriodo({ ...periodo, [k]: e.target.value }) }} onClick={e => apriSelettore(e.currentTarget)}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }} /></label>)}
    </div>}
  </>
}

/** Le pillole dei filtri: «Tutte», una per camera attiva, (nel Registro) «Spazi comuni» */
export function FiltriPulizie({ voci, scelta, onScegli }: { voci: { chiave: string; nome: string }[]; scelta: string; onScegli: (k: string) => void }) {
  return <div className="pul-flt" role="group" aria-label="Filtro">{voci.map(v => <button type="button" key={v.chiave} className={scelta === v.chiave ? 'on' : ''} aria-pressed={scelta === v.chiave} onClick={() => onScegli(v.chiave)} data-filtro={v.chiave}>{v.nome}</button>)}</div>
}
