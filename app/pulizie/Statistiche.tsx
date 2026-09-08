'use client'
import { useEffect, useMemo, useState } from 'react'
import ControlliPulizia from '@/components/ControlliPulizia'
import AvvisoAzione from '@/components/AvvisoAzione'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { type Recupero, type VoceBiancheria } from '@/lib/biancheria'
import { confrontaDecisioni, addDaysStr, type CameraPulizie, type PrenotazionePulizie, type Decisione } from '@/lib/pulizie'
import { confrontoPeriodoPulizie, csvPulizie, periodoPulizie, resocontoPulizie, TIPI_PULIZIA, type PeriodoPulizie } from '@/lib/pulizieResoconto'

const dataBreve = (s: string) => s.split('-').reverse().join('/')
const numero = (n: number | null) => n === null ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: 1 })

export default function Statistiche({ rooms, bookings, events, td }: { rooms: CameraPulizie[]; bookings: PrenotazionePulizie[]; events: Decisione[]; td: string }) {
  const [tipo, setTipo] = useState<PeriodoPulizie>('mese')
  const [offset, setOffset] = useState(0)
  const [lettura, setLettura] = useState<{ chiave: string; righe: Recupero[] } | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [tentativo, setTentativo] = useState(0)
  const [camera, setCamera] = useState('')
  const [voce, setVoce] = useState<VoceBiancheria | ''>('')
  const [intervento, setIntervento] = useState('')
  const [registro, setRegistro] = useState(false)
  const ids = events.filter(e => e.stato === 'fatta' && e.id).map(e => e.id!).sort().join(',')
  const recuperi = lettura?.chiave === `${ids}:${tentativo}` ? lettura.righe : null
  useEffect(() => {
    let viva = true
    leggiRecuperiDellePulizie(ids ? ids.split(',') : []).then(r => {
      if (!viva) return
      if (r.errore || !r.tabella) setErrore(r.errore || 'Non riesco a leggere la biancheria recuperata.')
      else { setErrore(null); setLettura({ chiave: `${ids}:${tentativo}`, righe: r.righe }) }
    }).catch(() => { if (viva) setErrore('Non riesco a leggere la biancheria recuperata.') })
    return () => { viva = false }
  }, [ids, tentativo])
  const periodo = periodoPulizie(tipo, offset, td), precedente = confrontoPeriodoPulizie(tipo, offset, td)
  const report = useMemo(() => resocontoPulizie(rooms, bookings, events, recuperi, periodo.da, periodo.fino, td), [rooms, bookings, events, recuperi, periodo.da, periodo.fino, td])
  const confronto = useMemo(() => resocontoPulizie(rooms, bookings, events, recuperi, precedente.da, precedente.fino, td), [rooms, bookings, events, recuperi, precedente.da, precedente.fino, td])
  const nome = (id: string) => rooms.find(r => r.id === id)?.name.split(' ').slice(-1)[0] ?? 'Camera non disponibile'
  const ultimaId = (id: string) => events.filter(e => e.room_id === id).sort((a, b) => confrontaDecisioni(b, a))[0]?.id ?? null
  const label = tipo === 'mese' ? new Date(`${periodo.da}T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : tipo === 'anno' ? periodo.da.slice(0, 4) : `${dataBreve(periodo.da)} – ${dataBreve(addDaysStr(periodo.fino, -1))}`
  function apri(cam = '', v: VoceBiancheria | '' = '', t = '') { setCamera(cam); setVoce(v); setIntervento(t); setRegistro(true) }
  function esporta() {
    const blob = new Blob([csvPulizie(report, rooms)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `Casa-Ania-pulizie-${periodo.da}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const righe = report.righe.filter(r => (!camera || r.pulizia.room_id === camera) && (!voce || (r.recupero?.[voce] ?? 0) > 0) && (!intervento || r.pulizia.tipo === intervento))
  return <section id="statistiche" className="mt-8 scroll-mt-20" data-resoconto-pulizie>
    <h2 className="ed-titolo-medio">Il resoconto delle pulizie</h2>
    <p className="ed-sotto mb-4">Interventi confermati e biancheria recuperata</p>
    <div className="flex flex-wrap gap-2 mb-3">{(['settimana', 'mese', 'anno'] as const).map(t => <button type="button" key={t} onClick={() => { setTipo(t); setOffset(0); setRegistro(false) }} className={tipo === t ? 'ed-pillola capitalize' : 'ed-pillola-contorno capitalize'}>{t}</button>)}</div>
    <div className="flex items-center justify-between gap-3 mb-4">
      <button type="button" className="ed-pillola-contorno" aria-label="Periodo precedente" onClick={() => { setOffset(x => x - 1); setRegistro(false) }}>‹</button>
      <p className="font-serif text-xl text-green-dark capitalize text-center">{label}</p>
      <button type="button" className="ed-pillola-contorno disabled:opacity-40" aria-label="Periodo successivo" disabled={offset >= 0} onClick={() => { setOffset(x => x + 1); setRegistro(false) }}>›</button>
    </div>
    <div className="grid grid-cols-2 gap-4 border-t border-brass pt-3">
      <button type="button" className="text-left" onClick={() => apri()}><span className="ed-sezione">Interventi confermati</span><span className="ed-numero block mt-2" data-totale-interventi>{report.fatte.length}</span></button>
      <button type="button" className="text-left" onClick={() => apri()} disabled={recuperi === null}><span className="ed-sezione">Pezzi recuperati</span><span className="ed-numero block mt-2" data-totale-recuperi>{numero(report.pezzi)}</span></button>
    </div>
    {errore && <AvvisoAzione testo={errore} onRiprova={() => setTentativo(x => x + 1)} className="mt-3" />}
    <p className="text-xs text-stone mt-2">{report.conRecuperi === null ? (errore ? 'Recuperi non disponibili.' : 'Lettura dei recuperi…') : `${report.conRecuperi} interventi con recuperi su ${report.fatte.length} confermati.`}</p>
    <div className="flex flex-wrap gap-x-4 gap-y-2 py-3">{report.perTipo.map(t => <button type="button" key={t.tipo} className="text-xs text-stone underline underline-offset-4" onClick={() => apri('', '', t.tipo)}>{TIPI_PULIZIA[t.tipo]} · {t.n}</button>)}</div>
    <p className="text-xs text-stone border-t border-card-border py-3">Confronto con {dataBreve(precedente.da)} – {dataBreve(addDaysStr(precedente.fino, -1))}: {confronto.fatte.length} interventi confermati ({confronto.stime.length} stimati a parte), {numero(confronto.pezzi)} pezzi. Notti occupate: {report.notti} nel periodo scelto, {confronto.notti} nel precedente.</p>
    {report.stime.length > 0 && <details className="text-xs text-stone border-t border-card-border py-3"><summary className="cursor-pointer">{report.stime.length} interventi ricostruiti dallo storico, separati dai confermati</summary><p className="mt-2">Sono stime del vecchio sistema; possono cambiare se si correggono le prenotazioni.</p>{report.stime.map((r, i) => <p key={i} className="mt-1">{dataBreve(r.date)} · {nome(r.roomId)} · {TIPI_PULIZIA[r.tipo]}</p>)}</details>}
    <div className="ed-riga py-4"><p className="ed-sezione mb-2">Per camera</p>
      <div className="grid grid-cols-[1fr_70px_65px_50px] text-[11px] text-stone mb-1"><span>Camera</span><span className="text-right">Interventi</span><span className="text-right">Pezzi</span><span className="text-right">Notti</span></div>
      {report.perCamera.map(r => <button type="button" key={r.room.id} onClick={() => apri(r.room.id)} className="grid grid-cols-[1fr_70px_65px_50px] w-full text-left py-2 border-t border-card-border text-sm"><span className="font-serif text-green-dark">{nome(r.room.id)}</span><span className="text-right">{r.interventi}</span><span className="text-right text-green-mid">{numero(r.pezzi)}</span><span className="text-right text-stone">{r.notti}</span></button>)}
    </div>
    <div className="ed-riga py-4"><p className="ed-sezione mb-2">Che cosa hai recuperato</p>
      {report.perVoce ? <div className="grid grid-cols-2 gap-x-5">{report.perVoce.map(v => <button type="button" key={v.chiave} onClick={() => apri('', v.chiave)} className="flex justify-between text-left gap-2 py-2 text-sm border-b border-card-border"><span className="text-stone">{v.etichetta}</span><span className="text-green-mid font-semibold">{v.n}</span></button>)}</div> : <p className="text-xs text-stone">{errore ? 'Conteggi non disponibili.' : 'Caricamento…'}</p>}
    </div>
    <details className="ed-riga py-4"><summary className="cursor-pointer"><span className="ed-sezione">Spostamenti e salti</span><p className="text-sm text-green-dark mt-2">{report.spostate.length} pulizie spostate · {report.numeroRinvii} rinvii · {report.saltate.length} saltate</p></summary>
      <p className="text-xs text-stone mt-2">Rinvio complessivo medio: {numero(report.rinvioMedio)} giorni. Il periodo è quello della prima data prevista.</p>
      {report.spostate.map((g, i) => <p key={i} className="text-xs mt-2">{nome(g.roomId)} · dal {dataBreve(g.prevista)} al {dataBreve(g.prossima)} · {g.rinvii.length} rinvii, {g.giorni} giorni</p>)}
      {report.saltate.map((r, i) => <p key={`s${i}`} className="text-xs mt-2">{nome(r.room_id)} · saltata la pulizia del {dataBreve(r.data_prevista)}</p>)}
    </details>
    <details className="ed-riga py-4"><summary className="cursor-pointer"><span className="ed-sezione">Cadenza effettiva</span><p className="text-sm text-green-dark mt-2">{report.cadenza === null ? 'Servono almeno due cambi nello stesso soggiorno' : `In media ${numero(report.cadenza)} notti tra i cambi`}</p></summary>
      <p className="text-xs text-stone mt-2">Intervalli fra due cambi confermati nella stessa camera e nello stesso soggiorno. Conta il periodo in cui è stato fatto il secondo.</p>
      {report.intervalli.map((r, i) => <p key={i} className="text-xs mt-2">{nome(r.roomId)} · {dataBreve(r.da)} → {dataBreve(r.a)} · {r.notti} notti</p>)}
    </details>
    {report.avvisi.map(a => <AvvisoAzione key={a} testo={a} className="mt-2" />)}
    <div className="flex flex-wrap gap-2 mt-4"><button type="button" className="ed-pillola" onClick={() => { if (registro) setRegistro(false); else apri() }}>{registro ? 'Chiudi registro' : 'Apri registro del periodo'}</button><button type="button" className="ed-pillola-contorno" onClick={esporta} disabled={recuperi === null}>Esporta resoconto</button></div>
    {registro && <div className="mt-4" data-registro-mese>
      <div className="flex flex-wrap gap-2 mb-3"><select className="ed-campo text-xs max-w-full" aria-label="Filtra camera" value={camera} onChange={e => setCamera(e.target.value)}><option value="">Tutte le camere</option>{rooms.map(r => <option key={r.id} value={r.id}>{nome(r.id)}</option>)}</select>
        <select className="ed-campo text-xs max-w-full" aria-label="Filtra recupero" value={voce} onChange={e => setVoce(e.target.value as VoceBiancheria | '')}><option value="">Tutti i recuperi</option>{report.perVoce?.map(v => <option key={v.chiave} value={v.chiave}>{v.etichetta}</option>)}</select>
        <select className="ed-campo text-xs max-w-full" aria-label="Filtra intervento" value={intervento} onChange={e => setIntervento(e.target.value)}><option value="">Tutti gli interventi</option>{report.perTipo.map(v => <option key={v.tipo} value={v.tipo}>{TIPI_PULIZIA[v.tipo]}</option>)}</select></div>
      <p className="text-xs text-stone mb-2">{righe.length} interventi · {numero(recuperi === null ? null : righe.reduce((n, r) => n + (voce ? r.recupero?.[voce] ?? 0 : r.pezzi ?? 0), 0))} pezzi{voce ? ' del tipo scelto' : ''}</p>
      {righe.map((r, i) => <div key={r.pulizia.id ?? i} className="py-3 border-t border-card-border"><p className="font-serif text-lg text-green-dark">{nome(r.pulizia.room_id)} · {dataBreve(r.pulizia.data_effettiva || r.pulizia.data_prevista)}</p><p className="text-xs text-stone">{TIPI_PULIZIA[r.pulizia.tipo]}</p>
        <ControlliPulizia camera={nome(r.pulizia.room_id)} oggi={td} pulizia={r.pulizia} ultimaId={ultimaId(r.pulizia.room_id)} persone={r.pulizia.persone_servite ?? (Number(bookings.find(b => b.id === r.pulizia.booking_id)?.num_guests) || null)} onSalvato={() => setTentativo(x => x + 1)} />
        {r.recupero?.updated_at && <p className="text-[11px] text-stone mt-2">Recupero aggiornato il {new Date(r.recupero.updated_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</p>}
      </div>)}
    </div>}
  </section>
}
