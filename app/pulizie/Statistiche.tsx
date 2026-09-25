'use client'
// Statistiche approvate il 25/09/2026 (riferimento app/anteprima-pulizie,
// vista «Statistiche»), sui dati confermati. Stime storiche, rinvii e salti
// restano separati, sotto, come prima: mai sommati ai confermati.
import { useMemo, useState } from 'react'
import TempiFuoriCamera from '@/components/TempiFuoriCamera'
import { VOCI_DOTAZIONE } from '@/lib/dotazionePulizie'
import { interventiDaTabelle, statistichePulizie, oreMinuti, csvInterventi } from '@/lib/pulizieDotazioneStatistiche'
import { resocontoPulizie, TIPI_PULIZIA } from '@/lib/pulizieResoconto'
import { addDaysStr, type CameraPulizie, type PrenotazionePulizie, type Decisione } from '@/lib/pulizie'

const dataBreve = (s: string) => s.split('-').reverse().join('/')

export default function StatistichePulizie({ rooms, bookings, events, recuperi, td, nomeCamera }: {
  rooms: CameraPulizie[]; bookings: PrenotazionePulizie[]; events: Decisione[]; recuperi: Record<string, unknown>[] | null; td: string
  nomeCamera: (bookingId: string) => string | null
}) {
  const [inizio, setInizio] = useState(`${td.slice(0, 7)}-01`)
  const [fine, setFine] = useState(td)
  const [camera, setCamera] = useState('')
  const [fuori, setFuori] = useState<number | null>(null)
  const nome = (id: string) => rooms.find(r => r.id === id)?.name.split(' ').slice(-1)[0] ?? 'Camera non disponibile'
  const periodoValido = !!inizio && !!fine && inizio <= fine
  const fineEsclusa = fine ? addDaysStr(fine, 1) : ''
  const interventi = useMemo(() => interventiDaTabelle(events as Parameters<typeof interventiDaTabelle>[0], recuperi), [events, recuperi])
  const report = periodoValido ? statistichePulizie(interventi, inizio, fineEsclusa, camera) : null
  const storico = periodoValido ? resocontoPulizie(rooms, bookings, events, null, inizio, fineEsclusa, td) : null
  function esporta() {
    if (!report) return
    const blob = new Blob([csvInterventi(report.righe, nome)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `Casa-Ania-pulizie-${inizio}-${fine}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const senzaMisura = report ? report.senzaMisura.lenzuolo_sotto + report.senzaMisura.lenzuolo_sopra : 0
  return <section id="statistiche" className="scroll-mt-20" data-resoconto-pulizie>
    <div className="flex flex-wrap gap-3 mb-5"><label className="text-xs">Dal<input className="ed-campo block mt-1" type="date" value={inizio} max={td} onChange={e => setInizio(e.target.value)} /></label><label className="text-xs">Al<input className="ed-campo block mt-1" type="date" value={fine} max={td} onChange={e => setFine(e.target.value)} /></label><label className="text-xs">Camera<select className="ed-campo block mt-1" value={camera} onChange={e => setCamera(e.target.value)}><option value="">Tutte le camere</option>{rooms.map(r => <option key={r.id} value={r.id}>{nome(r.id)}</option>)}</select></label></div>
    {!report ? <p role="alert">Controlla le date del periodo.</p> : <>
      {recuperi === null && <p role="status" className="text-sm text-stone mb-3">Recuperi non disponibili in questo momento: le colonne dei recuperi restano vuote.</p>}
      <div className="grid grid-cols-2 gap-5 border-y border-card-border py-5"><div><p className="ed-sezione">Pulizie confermate</p><p className="font-serif text-4xl mt-2" data-interventi={report.interventi}>{report.interventi}</p><p className="text-xs mt-1 text-stone">su {report.camereDistinte} camere distinte</p></div><div><p className="ed-sezione">Tempo registrato</p><p className="font-serif text-3xl mt-2" data-minuti-camere={report.minuti}>{report.conDurata ? oreMinuti(report.minuti) : '—'}</p><p className="text-xs mt-1 text-stone">durata nota per {report.conDurata} su {report.interventi} interventi</p></div></div>
      <div className="py-4 border-b border-card-border">{report.perTipo.map(t => <p key={t.tipo} className="flex justify-between text-sm py-1" data-tipo={t.tipo}><span>{TIPI_PULIZIA[t.tipo]}</span><strong>{t.n}</strong></p>)}</div>
      {!camera ? <TempiFuoriCamera giorno={td} oggi={td} dal={inizio} al={fine} minutiCamere={report.minuti} riepilogo nomeCamera={nomeCamera} onTotale={setFuori} />
        : <p className="text-xs text-stone mt-4">Con una camera scelta si vede solo il suo tempo: il lavoro fuori dalle camere non si attribuisce a una camera.</p>}
      {!camera && fuori !== null && <p className="text-xs text-stone">Totale lavoro = {report.minuti} min nelle camere (durata nota per {report.conDurata} su {report.interventi}) + {fuori} min fuori dalle camere.</p>}
      <h2 className="font-serif text-2xl mt-6">Letti rifatti e completi asciugamani</h2><p className="text-xs text-stone mt-1">Dotazione documentata per {report.conAssetto} su {report.interventi} interventi.</p>
      <div className="grid grid-cols-3 gap-3 py-4"><p><strong className="font-serif text-3xl block" data-matrimoniali>{report.matrimoniali}</strong><span className="text-sm">Matrimoniali</span></p><p><strong className="font-serif text-3xl block" data-singoli>{report.singoli}</strong><span className="text-sm">Singoli</span></p><p><strong className="font-serif text-3xl block" data-completi>{report.completi}</strong><span className="text-sm">Completi asciugamani</span></p></div>
      <h2 className="font-serif text-2xl mt-5">Recuperato e da lavare</h2><p className="text-xs text-stone mt-1 mb-3">Bilancio completo per {report.conLavaggio} su {report.interventi} interventi. Recuperi annotati su {report.conRecuperi}. Ogni pezzo recuperato evita un pezzo da lavare.</p>
      <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px] gap-x-1 text-xs py-2 border-b border-card-border"><span>Pezzi</span><span className="text-right">Dotazione</span><span className="text-right">Recuperati</span><span className="text-right">Da lavare*</span></div>
      {VOCI_DOTAZIONE.map(([k, label]) => <div key={k} className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px] gap-x-1 text-sm py-3 border-b border-card-border" data-voce={k}><span>{label}</span><span className="text-right">{report.conAssetto ? report.dotazione[k] : '—'}</span><span className="text-right text-green-mid">{report.conRecuperi ? report.recuperi[k] : '—'}</span><span className="text-right">{report.conLavaggio ? report.lavaggio[k] : '—'}</span></div>)}
      {senzaMisura > 0 && <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px] gap-x-1 text-sm py-3 border-b border-card-border" data-voce="senza_misura"><span>Lenzuola senza misura (storico)</span><span className="text-right">—</span><span className="text-right text-green-mid">{senzaMisura}</span><span className="text-right">—</span></div>}
      <p className="text-xs text-stone mt-3">*Solo gli interventi con dotazione e recuperi annotati. «Non annotato» non significa zero.{senzaMisura > 0 ? ' Le lenzuola senza misura vengono dallo storico: non si distribuiscono fra singoli e matrimoniali.' : ''}</p>
      <p className="text-sm mt-4">Recupero sul totale: {report.percentualeRecupero === null ? 'non calcolabile su tutti gli interventi' : `${report.percentualeRecupero.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`}. Tempo medio: {report.minutiMedi === null ? 'non disponibile' : `${report.minutiMedi.toLocaleString('it-IT', { maximumFractionDigits: 1 })} minuti, sui soli interventi con durata`}.</p>
      {report.daCorreggere.length > 0 && <p role="alert" className="text-sm text-red-800 mt-3">{report.daCorreggere.length} {report.daCorreggere.length === 1 ? 'intervento ha' : 'interventi hanno'} recuperi oltre la dotazione: riaprili dal Registro e correggili. Sono esclusi dal bucato.</p>}
      {storico && <details className="text-xs text-stone border-t border-card-border py-3 mt-5"><summary className="cursor-pointer">Rinvii, salti e stime dello storico · separati dai confermati</summary>
        <p className="mt-2">{storico.spostate.length} pulizie spostate · {storico.numeroRinvii} rinvii · {storico.saltate.length} saltate. Non sono lavori eseguiti.</p>
        {storico.spostate.map((g, i) => <p key={i} className="mt-1">{nome(g.roomId)} · dal {dataBreve(g.prevista)} al {dataBreve(g.prossima)} · {g.rinvii.length} rinvii</p>)}
        {storico.saltate.map((r, i) => <p key={`s${i}`} className="mt-1">{nome(r.room_id)} · saltata la pulizia del {dataBreve(r.data_prevista)}</p>)}
        {storico.stime.length > 0 && <><p className="mt-3">{storico.stime.length} interventi ricostruiti dallo storico: stime del vecchio sistema, possono cambiare se si correggono le prenotazioni.</p>{storico.stime.map((r, i) => <p key={`t${i}`} className="mt-1">{dataBreve(r.date)} · {nome(r.roomId)} · {TIPI_PULIZIA[r.tipo]}</p>)}</>}
      </details>}
      <button type="button" className="ed-pillola-contorno mt-4" onClick={esporta}>Esporta resoconto</button>
    </>}
  </section>
}
