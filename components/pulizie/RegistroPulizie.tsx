'use client'
// Il Registro delle pulizie (riferimento approvato da Ania il 01/10/2026,
// pulizie-registro-statistiche-riferimento.html, «Registro»): periodo,
// filtri, «Un tocco su una riga per correggerla.», i giorni dal più recente.
// Le righe le fa lib/registroPulizie; qui la veste e i tocchi.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import PeriodoPulizie, { FiltriPulizie } from './PeriodoPulizie'
import { leggiFuoriCamera, type FuoriCameraSql } from '@/lib/pulizieTempiDati'
import { osservaAggiornamentiPulizie } from '@/lib/aggiornamentiPulizie'
import { periodoIniziale, type Periodo } from '@/lib/periodoPulizie'
import { registroPulizie, testataGiorno, nomeInDue, type FiltroRegistro, type RigaRegistro } from '@/lib/registroPulizie'
import type { Decisione, PuliziaAutomatica } from '@/lib/pulizie'
import { vociSpaziAttive, type VoceSpazi } from '@/lib/tempoPulizie'
import { useParte0064 } from '@/lib/schema0064Dati'

export const FRASE_REGISTRO = 'Un tocco su una riga per correggerla.'

export default function RegistroPulizie({ camere, events, recuperi, automatiche, oggi, rilettura, nomeCamera, onApri, onApriSpazi, automatica }: {
  /** le camere ATTIVE, per le pillole del filtro */
  camere: { id: string; nome: string }[]
  events: Decisione[]; recuperi: Record<string, unknown>[] | null; automatiche: PuliziaAutomatica[]
  oggi: string; rilettura: number
  nomeCamera: (roomId: string) => string
  onApri: (e: Decisione) => void
  onApriSpazi: (giorno: string, voce: VoceSpazi, righe: FuoriCameraSql[]) => void
  /** i due comandi di sempre delle pulizie automatiche (dalla pagina) */
  automatica: (a: PuliziaAutomatica, chiave: string) => ReactNode
}) {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoIniziale(oggi))
  const [filtro, setFiltro] = useState('tutte')
  const [tempi, setTempi] = useState<FuoriCameraSql[]>([])
  const [erroreTempi, setErroreTempi] = useState('')
  const [giro, setGiro] = useState(0)
  const [giornoSpazi, setGiornoSpazi] = useState(oggi)
  const [aprendoSpazi, setAprendoSpazi] = useState(false)
  const [erroreApertura, setErroreApertura] = useState('')
  const altro = useParte0064('altro')
  async function aggiungiSpazi(voce: VoceSpazi) {
    if (aprendoSpazi || !giornoSpazi || giornoSpazi > oggi) return
    setAprendoSpazi(true); setErroreApertura('')
    try {
      // Leggere il giorno scelto anche se fuori dal periodo visibile:
      // una lettura fallita non equivale a una giornata senza tempi.
      const r = await leggiFuoriCamera(giornoSpazi, giornoSpazi)
      if (r.errore || !r.righe) { setErroreApertura(r.errore || 'Non riesco a leggere i tempi del giorno. Riprova.'); return }
      setPeriodo({ modo: 'dal_al', dal: giornoSpazi, al: giornoSpazi })
      setFiltro('spazi')
      onApriSpazi(giornoSpazi, voce, r.righe)
    } catch { setErroreApertura('Non riesco a leggere i tempi del giorno. Riprova.') }
    finally { setAprendoSpazi(false) }
  }
  useEffect(() => osservaAggiornamentiPulizie(window, () => setGiro(x => x + 1)), [])
  useEffect(() => {
    let viva = true
    void leggiFuoriCamera(periodo.dal, periodo.al).then(r => { if (!viva) return; setTempi(r.righe ?? []); setErroreTempi(r.errore ?? '') })
    return () => { viva = false }
  }, [periodo.dal, periodo.al, giro, rilettura])
  const scelta: FiltroRegistro = filtro === 'tutte' || filtro === 'spazi' ? filtro : { roomId: filtro }
  const giorni = useMemo(() => registroPulizie({ events, recuperi, tempi, automatiche, dal: periodo.dal, al: periodo.al, filtro: scelta, nomeCamera }),
    [events, recuperi, tempi, automatiche, periodo, filtro, nomeCamera]) // eslint-disable-line react-hooks/exhaustive-deps
  const riga = (r: RigaRegistro, giorno: string) => {
    if (r.tipo === 'pulizia') return <button type="button" key={r.chiave} className="pul-rr" data-registro={r.camera} onClick={() => onApri(r.evento)}>
      <span className="h">{r.ora ?? '—'}</span>
      <span className="m"><b>{r.camera}<small>{r.etichetta}</small></b><span>{r.letti}</span></span>
      <span className="r">{r.minuti ? `${r.minuti}′` : '—'}{!r.minuti ? <small className="no">minuti non annotati</small> : r.recuperati ? <small>{r.recuperati} {r.recuperati === 1 ? 'recuperato' : 'recuperati'}</small> : null}</span>
    </button>
    if (r.tipo === 'spazi') { const [uno, due] = nomeInDue(r.nome); return <button type="button" key={r.chiave} className="pul-rr" data-registro-spazi={r.voce} onClick={() => onApriSpazi(giorno, r.voce, tempi.filter(t => t.data === giorno))}>
      <span className="h">{r.ora ?? '—'}</span>
      <span className="m"><b>{uno}{due && <small>{due}</small>}</b><span>spazi comuni{r.cosa ? ` · ${r.cosa}` : ''}</span></span>
      <span className="r">{r.minuti}′</span>
    </button> }
    if (r.tipo === 'rinvio') return <div key={r.chiave} className="pul-rr mu" data-registro-rinvio={r.destra}>
      <span className="h">—</span><span className="m"><b>{r.camera}<small>{r.etichetta}</small></b><span>{r.testo}</span></span><span className="r">{r.destra}</span>
    </div>
    return <div key={r.chiave} className="pul-rr au" data-registro-automatica={r.camera}>
      <span className="m"><b>{r.camera}<small>{r.etichetta} · automatica</small></b></span>
      {automatica(r.auto, r.chiave)}
    </div>
  }
  return <section data-registro-pulizie>
    <PeriodoPulizie periodo={periodo} oggi={oggi} onPeriodo={setPeriodo} />
    <FiltriPulizie voci={[{ chiave: 'tutte', nome: 'Tutte' }, ...camere.map(c => ({ chiave: c.id, nome: c.nome })), { chiave: 'spazi', nome: 'Spazi comuni' }]} scelta={filtro} onScegli={setFiltro} />
    <p className="pul-fix">{FRASE_REGISTRO}</p>
    <details data-aggiungi-spazi-registro>
      <summary className="pul-az">Annota minuti degli spazi comuni</summary>
      <label className="pul-fld"><span>Giorno</span><input type="date" aria-label="Giorno dei minuti" max={oggi} value={giornoSpazi}
        disabled={aprendoSpazi} onChange={e => setGiornoSpazi(e.target.value)} /></label>
      <p className="pul-nota">Scegli il giorno e l’attività, anche se non hai ancora annotato minuti.</p>
      <div className="pul-flt">{vociSpaziAttive(altro.stato === 'si').map(([voce, nome]) => <button type="button" key={voce}
        disabled={aprendoSpazi || !giornoSpazi || giornoSpazi > oggi} onClick={() => void aggiungiSpazi(voce)}>{nome}</button>)}</div>
      {aprendoSpazi && <p role="status" className="pul-nota">Lettura dei tempi…</p>}
      {erroreApertura && <p role="alert" className="pul-errore">{erroreApertura}</p>}
      {altro.stato === 'errore' && <p role="status" className="pul-errore">Non riesco a controllare se «Altro» è disponibile. <button type="button" onClick={altro.riprova}>Riprova</button></p>}
    </details>
    {recuperi === null && <p role="status" className="pul-avviso">Recuperi non disponibili in questo momento: le quantità restano da leggere.</p>}
    {erroreTempi && <p role="status" className="pul-avviso">{erroreTempi}</p>}
    {!giorni.length && <p className="pul-avviso" data-registro-vuoto>Niente in questo periodo.</p>}
    {giorni.map(g => <div key={g.giorno} data-registro-giorno={g.giorno}>
      <div className="pul-gh">{g.titolo}<small>{testataGiorno(g)}</small></div>
      {g.righe.map(r => riga(r, g.giorno))}
    </div>)}
  </section>
}
