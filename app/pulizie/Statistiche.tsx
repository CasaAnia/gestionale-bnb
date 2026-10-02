'use client'
// ============================================================================
// Statistiche delle pulizie nella veste approvata da Ania il 01/10/2026
// (pulizie-registro-statistiche-riferimento.html): periodo «‹ SETT. | MESE |
// DAL–AL ›», filtri per camera, tre numeri col confronto, quanto dura per
// tipo, per camera, spazi comuni, come si usano le camere, completi usati,
// mandati a lavare, biancheria, rinvii e salti, esporta, prova lavanderia.
// I conti: lib/statistichePulizieNuove (sopra quelli di sempre). Le parti
// che c'erano già (stime storiche, recuperi oltre la dotazione, lenzuola
// senza misura) restano in fondo, separate dalle pulizie confermate.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import PeriodoPulizie, { FiltriPulizie } from '@/components/pulizie/PeriodoPulizie'
import ProvaLavanderia from '@/components/pulizie/ProvaLavanderia'
import { leggiFuoriCamera, type FuoriCameraSql } from '@/lib/pulizieTempiDati'
import { osservaAggiornamentiPulizie } from '@/lib/aggiornamentiPulizie'
import { interventiDaTabelle, csvInterventi } from '@/lib/pulizieDotazioneStatistiche'
import { resocontoPulizie, TIPI_PULIZIA } from '@/lib/pulizieResoconto'
import { periodoIniziale, giorniContati, precedente, testoConfronto, type Periodo } from '@/lib/periodoPulizie'
import { statisticheNuove, ore, NOTA_MEDIE } from '@/lib/statistichePulizieNuove'
import { addDaysStr, type CameraPulizie, type PrenotazionePulizie, type Decisione } from '@/lib/pulizie'

const dataBreve = (s: string) => s.split('-').reverse().join('/')
const Barra = ({ quota }: { quota: number }) => <div className="bar2"><i style={{ width: `${Math.max(0, Math.min(100, quota * 100))}%` }} /></div>

export default function StatistichePulizie({ rooms, bookings, events, recuperi, td }: {
  rooms: CameraPulizie[]; bookings: PrenotazionePulizie[]; events: Decisione[]; recuperi: Record<string, unknown>[] | null; td: string
  nomeCamera?: (bookingId: string) => string | null
}) {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoIniziale(td))
  const [camera, setCamera] = useState('tutte')
  const [tempi, setTempi] = useState<FuoriCameraSql[] | null>(null)
  const [erroreTempi, setErroreTempi] = useState('')
  const [giro, setGiro] = useState(0)
  const nome = (id: string) => rooms.find(r => r.id === id)?.name.split(' ').slice(-1)[0] ?? 'Camera non disponibile'
  const contati = giorniContati(periodo, td)
  const prima = contati ? precedente(periodo, td) : null
  const leggiDal = prima && prima.dal < periodo.dal ? prima.dal : periodo.dal
  useEffect(() => osservaAggiornamentiPulizie(window, () => setGiro(x => x + 1)), [])
  useEffect(() => {
    let viva = true
    void leggiFuoriCamera(leggiDal, contati?.al ?? periodo.al).then(r => { if (!viva) return; setTempi(r.righe); setErroreTempi(r.errore ?? '') })
    return () => { viva = false }
  }, [leggiDal, contati?.al, periodo.al, giro])
  const interventi = useMemo(() => interventiDaTabelle(events as Parameters<typeof interventiDaTabelle>[0], recuperi), [events, recuperi])
  const roomId = camera === 'tutte' ? '' : camera
  const S = useMemo(() => contati ? statisticheNuove({ interventi, tempi: tempi ?? [], rinvii: events.filter(e => e.stato !== 'fatta'), dal: contati.dal, al: contati.al, prima, roomId, nomeCamera: nome }) : null,
    [interventi, tempi, events, contati?.dal, contati?.al, prima?.dal, prima?.al, roomId]) // eslint-disable-line react-hooks/exhaustive-deps
  const storico = contati ? resocontoPulizie(rooms, bookings, events, null, contati.dal, addDaysStr(contati.al, 1), td) : null
  function esporta() {
    if (!S || !contati) return
    const blob = new Blob([csvInterventi(S.base.righe, nome)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `Casa-Ania-pulizie-${contati.dal}-${contati.al}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const attive = rooms.filter(r => r.active !== false)
  const massimoTipo = S ? Math.max(S.rifare.media ?? 0, S.biancheria.media ?? 0) : 0
  const massimoCamera = S ? Math.max(1, ...S.perCamera.map(p => p.minuti)) : 1
  const massimoSpazi = S ? Math.max(1, ...S.spazi.map(p => p.minuti)) : 1
  const senzaMisura = S ? S.base.senzaMisura.lenzuolo_sotto + S.base.senzaMisura.lenzuolo_sopra : 0
  return <section id="statistiche" className="scroll-mt-20" data-resoconto-pulizie>
    <PeriodoPulizie periodo={periodo} oggi={td} onPeriodo={setPeriodo} />
    <FiltriPulizie voci={[{ chiave: 'tutte', nome: 'Tutte' }, ...attive.map(r => ({ chiave: r.id, nome: nome(r.id) }))]} scelta={camera} onScegli={setCamera} />
    {!S || !contati ? <p className="pul-avviso">Questo periodo non è ancora cominciato.</p> : <>
      {recuperi === null && <p role="status" className="pul-avviso">Recuperi non disponibili in questo momento: le colonne dei recuperi restano vuote.</p>}
      {erroreTempi && <p role="status" className="pul-avviso">{erroreTempi}</p>}
      <div className="pul-big3" data-tre-numeri>
        <div><b data-interventi={S.pulizie}>{S.pulizie}</b><small>{S.pulizie === 1 ? 'pulizia' : 'pulizie'}</small></div>
        <div><b data-lavoro={S.lavoro}>{S.lavoro ? ore(S.lavoro) : '—'}</b><small>di lavoro<br />{roomId ? 'senza gli spazi comuni' : 'con gli spazi comuni'}</small></div>
        <div><b data-media={S.aCamera.media ?? ''}>{S.aCamera.media === null ? '—' : `${Math.round(S.aCamera.media)}′`}</b><small>media<br />a camera</small></div>
      </div>
      {S.confronto && <p className={`pul-cmp${S.confronto.meglio ? '' : ' grigio'}`} data-confronto>{S.confronto.testo} {testoConfronto(periodo, td)}</p>}
      {S.aCamera.conMinuti < S.aCamera.n && <p className="pul-nota">Media sulle {S.aCamera.conMinuti} pulizie coi minuti, su {S.aCamera.n}: quelle senza minuti non contano come zero.</p>}
      {contati.al < periodo.al && <p className="pul-nota">Periodo in corso: contati {contati.giorni} {contati.giorni === 1 ? 'giorno' : 'giorni'}, fino a oggi.</p>}

      <p className="pul-sez">Quanto dura, per tipo</p>
      {([['Camera da rifare', 'partenze e cambi camera', S.rifare], ['Biancheria ogni 4 notti', 'con l’ospite che resta', S.biancheria]] as const).map(([t, sotto, m]) => <div key={t} className="pul-br" data-per-tipo={t}>
        <div className="t1"><span>{t}</span><b>{m.media === null ? '—' : `${Math.round(m.media)}′`}<small>· {m.n} {m.n === 1 ? 'volta' : 'volte'}</small></b></div>
        <p className="pul-chi" style={{ marginTop: 0 }}>{sotto}{m.conMinuti < m.n ? ` · media su ${m.conMinuti} coi minuti` : ''}</p>
        <Barra quota={massimoTipo && m.media !== null ? m.media / massimoTipo : 0} />
      </div>)}

      <p className="pul-sez">Per camera</p>
      {S.perCamera.length === 0 && <p className="pul-nota">Nessuna pulizia in questo periodo.</p>}
      {S.perCamera.map(p => <div key={p.roomId} className="pul-br" data-per-camera={p.nome}>
        <div className="t1"><span>{p.nome}</span><b>{p.n}<small>· {p.minuti ? ore(p.minuti) : 'minuti non annotati'}</small></b></div>
        <Barra quota={p.minuti / massimoCamera} />
      </div>)}

      <p className="pul-sez">Spazi comuni</p>
      {roomId ? <p className="pul-nota" data-spazi-non-attribuiti>Il tempo degli spazi comuni non si attribuisce a una camera: si vede con «Tutte».</p>
        : tempi === null ? <p className="pul-nota">Tempi non disponibili.</p>
        : S.spazi.map(s => <div key={s.voce} className="pul-br" data-spazi-stat={s.voce}>
          <div className="t1"><span>{s.nome}</span><b>{s.minuti ? ore(s.minuti) : '—'}</b></div>
          <Barra quota={s.minuti / massimoSpazi} />
        </div>)}

      <p className="pul-sez">Come si usano le camere</p>
      {S.uso.length === 0 && <p className="pul-nota">Nessuna pulizia coi letti segnati in questo periodo.</p>}
      {S.uso.map(u => <div key={u.roomId} className="pul-cfg" data-uso={u.nome}>
        <div className="t1"><span>{u.nome}</span><small>{u.tipo ? `${u.tipo} · ` : ''}{u.volte} {u.volte === 1 ? 'volta' : 'volte'}</small></div>
        <div className="rw2">{u.pillole.map(p => <i key={p.testo}><b>{p.n}</b>{p.testo}</i>)}</div>
      </div>)}

      <p className="pul-sez">Completi usati</p>
      <div className="pul-cu" data-completi>
        <span className="h k" /><span className="h">Lenzuola<br />matrimoniali</span><span className="h">Lenzuola<br />singole</span><span className="h">Asciugamani</span>
        {/* Con meno di 4 settimane di pulizie segnate (Ania, 02/10/2026): i totali veri, niente medie */}
        {S.pocheDati ? <span style={{ display: 'contents' }} data-nel-periodo>
          <span className="k">nel periodo</span>
          <span><b>{S.completi.totali.matrimoniali}</b></span><span><b>{S.completi.totali.singole}</b></span><span><b>{S.completi.totali.asciugamani}</b></span>
        </span> : (['settimana', 'mese', 'anno'] as const).map(k => <span key={k} style={{ display: 'contents' }}>
          <span className="k">{k === 'settimana' ? 'a settimana' : k === 'mese' ? 'al mese' : 'all’anno'}</span>
          <span><b>{Math.round(S.completi.matrimoniali[k])}</b></span><span><b>{Math.round(S.completi.singole[k])}</b></span><span><b>{Math.round(S.completi.asciugamani[k])}</b></span>
        </span>)}
      </div>
      {S.pocheDati && <p className="pul-chi" data-nota-medie>{NOTA_MEDIE}</p>}
      <p className="pul-chi">{S.pocheDati ? '' : `Medie sul periodo scelto (${S.giorni} ${S.giorni === 1 ? 'giorno' : 'giorni'}). `}La matrimoniale usata da una persona sola conta un completo matrimoniale e un completo asciugamani; il letto in più conta un completo singolo e uno di asciugamani.{S.base.conAssetto < S.pulizie ? ` Letti segnati su ${S.base.conAssetto} pulizie di ${S.pulizie}.` : ''}</p>

      <p className="pul-sez">Mandati a lavare</p>
      <div className="pul-pz h"><span>Pezzo</span><span>Totale</span><span>Recuperati</span><span>{S.pocheDati ? 'Nel periodo' : 'Al mese'}</span></div>
      {S.mandati.map(m => <div key={m.pezzo} className="pul-pz" data-mandati={m.pezzo}><span>{m.nome}</span><span>{m.totale}</span><span>{m.recuperati}</span><span><b>{S.pocheDati ? m.aLavare : Math.round(m.alMese)}</b></span></div>)}
      <p className="pul-chi">Totale = pezzi preparati nelle pulizie coi letti segnati; {S.pocheDati ? `nel periodo = totale − recuperati. ${NOTA_MEDIE}` : 'al mese = (totale − recuperati) diviso i giorni del periodo × 30,44.'}{S.base.conRecuperi < S.pulizie ? ` Recuperi annotati su ${S.base.conRecuperi} pulizie di ${S.pulizie}: dove non sono annotati, tutto conta come mandato a lavare.` : ''}</p>

      <p className="pul-sez">Biancheria</p>
      <div className="pul-lin" data-biancheria><div><b>{S.preparati}</b><small>preparati</small></div><div className="g"><b>{S.base.conRecuperi ? S.recuperati : '—'}</b><small>recuperati{S.base.conRecuperi && S.percentuale !== null ? ` · ${Math.round(S.percentuale)}%` : ''}</small></div><div><b>{S.aLavare}</b><small>a lavare</small></div></div>

      <p className="pul-sez">Rinvii e salti</p>
      <p className="pul-chi" data-rinvii>{S.rimandate} {S.rimandate === 1 ? 'rimandata' : 'rimandate'} · {S.saltate} {S.saltate === 1 ? 'cambio saltato' : 'cambi saltati'} · non sono lavori fatti</p>
      <button type="button" className="pul-az" style={{ marginTop: 18 }} onClick={esporta} data-esporta>Esporta il periodo</button>

      <ProvaLavanderia mandati={S.mandati} giorni={S.giorni} pocheDati={S.pocheDati} />

      {(S.base.daCorreggere.length > 0 || senzaMisura > 0 || (storico && (storico.spostate.length + storico.saltate.length + storico.stime.length) > 0)) && <p className="pul-sez">Da sapere</p>}
      {S.base.daCorreggere.length > 0 && <p role="alert" className="pul-errore">{S.base.daCorreggere.length} {S.base.daCorreggere.length === 1 ? 'pulizia ha' : 'pulizie hanno'} recuperi oltre la dotazione: riaprile dal Registro e correggile. Sono escluse dal bucato.</p>}
      {senzaMisura > 0 && <p className="pul-chi" data-senza-misura>Lenzuola senza misura nello storico: {senzaMisura} recuperate. Non si distribuiscono fra singoli e matrimoniali.</p>}
      {storico && (storico.spostate.length + storico.saltate.length + storico.stime.length) > 0 && <details className="pul-chi" style={{ marginTop: 8 }}><summary className="cursor-pointer">Rinvii dettagliati e stime dello storico · separati dalle pulizie confermate</summary>
        {storico.spostate.map((g, i) => <p key={i} className="mt-1">{nome(g.roomId)} · dal {dataBreve(g.prevista)} al {dataBreve(g.prossima)} · {g.rinvii.length} rinvii</p>)}
        {storico.saltate.map((r, i) => <p key={`s${i}`} className="mt-1">{nome(r.room_id)} · saltata la pulizia del {dataBreve(r.data_prevista)}</p>)}
        {storico.stime.length > 0 && <><p className="mt-3">{storico.stime.length} interventi ricostruiti dallo storico: stime del vecchio sistema, non sono pulizie confermate e non entrano nei numeri sopra.</p>{storico.stime.map((r, i) => <p key={`t${i}`} className="mt-1">{dataBreve(r.date)} · {nome(r.roomId)} · {TIPI_PULIZIA[r.tipo]}</p>)}</>}
      </details>}
    </>}
  </section>
}
