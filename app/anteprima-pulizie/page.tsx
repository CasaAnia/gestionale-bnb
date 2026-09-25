'use client'
import { addDaysStr, cicloCambio, type Decisione } from '@/lib/pulizie'
import TimerPuliziaProva from '@/components/TimerPuliziaProva'
import TempiFuoriCameraProva from '@/components/TempiFuoriCameraProva'
import { useEffect, useState } from 'react'
import { VOCI_DOTAZIONE, dotazioneDaAssetto, proponiAssetto, pezziVuoti, totalePezzi, daLavare, salvaNelRegistro, riepilogoDotazione, validaAssetto, type RegistrazionePulizia, type AssettoPulizia } from '@/lib/dotazionePulizie'

const GIORNO = '2026-09-25'
const CHIAVE = 'casa-ania:anteprima-pulizie-v2:solo-prova'
const TIPI = { fine_soggiorno: 'Fine soggiorno', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
const compiti: { id: string; camera: string; ospiti: number; extra: boolean; tipo: RegistrazionePulizia['tipo']; dettaglio: string }[] = [
 { id: 'demo-lena', camera: 'Lena', ospiti: 2, extra: true, tipo: 'fine_soggiorno', dettaglio: 'Due persone · letti separati' },
 { id: 'demo-ambra', camera: 'Ambra', ospiti: 1, extra: false, tipo: 'soggiorno', dettaglio: 'Una persona · matrimoniale uso singolo' },
 { id: 'demo-amelia', camera: 'Amelia', ospiti: 2, extra: true, tipo: 'soggiorno', dettaglio: 'Due persone · due letti singoli' },
 { id: 'demo-allegra', camera: 'Allegra', ospiti: 3, extra: true, tipo: 'cambio_camera', dettaglio: 'Tre persone · matrimoniale e singolo' },
]
const prenotazioniDemo = compiti.map(c => ({ id: c.id, room_id: c.camera, guest_id: c.id, status: 'confermata', check_in: '2026-09-21', check_out: c.tipo === 'soggiorno' ? '2026-09-29' : GIORNO }))
const letti = (a: AssettoPulizia) => [a.matrimoniali ? '1 matrimoniale' : '', a.singoli ? `${a.singoli} ${a.singoli === 1 ? 'singolo' : 'singoli'}` : ''].filter(Boolean).join(' + ')
const ore = (n: number) => `${Math.floor(n / 60)} h ${n % 60} min`
const classe = 'ed-pillola-contorno'
export default function AnteprimaPulizie() {
 const [registro, setRegistro] = useState<RegistrazionePulizia[]>([])
 const [decisioni, setDecisioni] = useState<Decisione[]>([])
 const [giorno, setGiorno] = useState(GIORNO)
 const [pronta, setPronta] = useState(false)
 const [errore, setErrore] = useState('')
 const [vista, setVista] = useState<'oggi' | 'registro' | 'resoconto'>('oggi')
 const [scheda, setScheda] = useState<RegistrazionePulizia | null>(null)
 const [federeScelte, setFedereScelte] = useState(false)
 const [salvando, setSalvando] = useState(false)
 const [recuperoAperto, setRecuperoAperto] = useState(false)
 const [cameraFiltro, setCameraFiltro] = useState('')
 const [inizio, setInizio] = useState('2026-09-01')
 const [fine, setFine] = useState('2026-09-30')
 useEffect(() => {
  const timer = window.setTimeout(() => {
  try {
   const conservati = JSON.parse(localStorage.getItem(CHIAVE) || '{}')
   const dati = Array.isArray(conservati) ? conservati : conservati.registro ?? []
   riepilogoDotazione(dati, '1900-01-01', '2100-01-01'); setRegistro(dati); setDecisioni(conservati.decisioni ?? []); setPronta(true)
  } catch { setErrore('Non riesco a leggere il registro di prova. Non mostro totali incompleti.') }
  }, 0)
  return () => window.clearTimeout(timer)
 }, [])
 const fineEsclusa = fine ? new Date(Date.parse(`${fine}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) : ''
 const periodoValido = inizio && fine && inizio <= fine
 const report = periodoValido ? riepilogoDotazione(registro.filter(r => !cameraFiltro || r.camera === cameraFiltro), inizio, fineEsclusa) : null
 const fatteOggi = registro.filter(r => r.data === giorno)
 const eventi: Decisione[] = [...decisioni, ...registro.map(r => ({ id: r.id, booking_id: r.id, room_id: r.camera, tipo: r.tipo, stato: 'fatta' as const, data_prevista: GIORNO, data_effettiva: r.data, created_at: `${r.data}T23:59:59Z` }))]
 const prossima = (id: string) => {
  const b = prenotazioniDemo.find(b => b.id === id)!
  if (registro.some(r => r.id === id)) return null
  return compiti.find(c => c.id === id)!.tipo === 'soggiorno' ? cicloCambio(prenotazioniDemo, b, eventi).due : GIORNO
 }
 const daFare = compiti.filter(c => prossima(c.id) !== null && prossima(c.id)! <= giorno)
 const future = compiti.filter(c => prossima(c.id) !== null && prossima(c.id)! > giorno)
 function conserva(nuovoRegistro: RegistrazionePulizia[], nuoveDecisioni: Decisione[]) {
  const dati = { registro: nuovoRegistro, decisioni: nuoveDecisioni }
  const serializzati = JSON.stringify(dati)
  localStorage.setItem(CHIAVE, serializzati)
  if (localStorage.getItem(CHIAVE) !== serializzati) throw new Error('Salvataggio non confermato: riprova.')
  setRegistro(structuredClone(nuovoRegistro)); setDecisioni(structuredClone(nuoveDecisioni))
 }
 function sposta(id: string, giorni: number | null) {
  const c = compiti.find(c => c.id === id)!, prevista = prossima(id)
  if (!prevista || c.tipo !== 'soggiorno') return
  const prossimaData = giorni === null ? addDaysStr(prevista, 4) : addDaysStr(giorno, giorni)
  const decisione: Decisione = { id: crypto.randomUUID(), room_id: c.camera, booking_id: id, tipo: 'soggiorno', stato: giorni === null ? 'saltata' : 'rimandata', data_prevista: prevista, prossima_data: prossimaData, data_effettiva: null, created_at: new Date().toISOString() }
  try { conserva(registro, [...decisioni, decisione]); setErrore('') } catch { setErrore('Non riesco a conservare la decisione. Riprova.') }
 }
 function apri(id: string) {
  const salvata = registro.find(r => r.id === id)
  if (salvata) { setScheda(structuredClone(salvata)); setFedereScelte(true); setRecuperoAperto(true) }
  else {
   const c = compiti.find(c => c.id === id)!
   const assetto = proponiAssetto(c.camera, c.ospiti, c.extra, 4)!
   setScheda({ id, camera: c.camera, data: giorno, tipo: c.tipo, assetto, dotazione: dotazioneDaAssetto(assetto), recuperi: null, minuti: null })
   setFedereScelte(c.ospiti !== 1 || c.camera === 'Amelia'); setRecuperoAperto(false)
  }
  setErrore('')
 }
 function cambiaAssetto(campi: Partial<AssettoPulizia>) {
  if (!scheda?.assetto) return
  const assetto = { ...scheda.assetto, ...campi }, problema = validaAssetto(assetto)
  if (problema) { setErrore(problema); return }
  setErrore(''); setScheda({ ...scheda, assetto, dotazione: dotazioneDaAssetto(assetto) })
 }
 function salva() {
  if (!scheda || !federeScelte || salvando) return
  setSalvando(true)
  try {
   const timer = JSON.parse(localStorage.getItem('casa-ania:timer-prova:v1') || '{}')[`${scheda.id}|${scheda.camera}`]
   if (timer?.avviato != null) throw new Error('Ferma il timer prima di confermare la pulizia.')
   const prossimo = salvaNelRegistro(registro, scheda)
   conserva(prossimo, decisioni); setScheda(null); setErrore('')
  } catch (e) { setErrore(e instanceof Error ? e.message : 'Non salvato.') }
  finally { setSalvando(false) }
 }
 const lavaggioScheda = (() => { if (!scheda?.dotazione || !scheda.recuperi) return null; try { return daLavare(scheda.dotazione, scheda.recuperi) } catch { return null } })()
 return <main className="max-w-4xl mx-auto px-4 py-6 pb-28" data-nuove-pulizie>
  <p className="text-xs text-stone mb-3">PROPOSTA DA PROVARE · dati dimostrativi · nessuna modifica al gestionale reale</p>
  <h1 className="ed-titolo">Pulizie</h1>
  <p className="ed-sotto mt-2">Camere, tempo di lavoro e biancheria, nello stesso registro.</p>
  <nav className="flex flex-wrap gap-3 my-6" aria-label="Sezioni pulizie">{(['oggi', 'registro', 'resoconto'] as const).map(v => <button key={v} className={vista === v ? 'ed-pillola capitalize' : `${classe} capitalize`} aria-pressed={vista === v} onClick={() => setVista(v)}>{v === 'resoconto' ? 'Statistiche' : v}</button>)}</nav>
  {errore && <p role="alert" className="text-red-800 my-3">{errore}</p>}
  {!pronta ? <p>Lettura del registro…</p> : <>
  {vista === 'oggi' && <>
   <label className="text-sm">Giorno della prova<select className="ed-campo ml-2" aria-label="Giorno della prova" value={giorno} onChange={e => setGiorno(e.target.value)}>{[0, 1, 2, 3].map(n => <option key={n} value={addDaysStr(GIORNO, n)}>{n === 0 ? "Oggi · 25 settembre" : n === 1 ? "Domani · 26 settembre" : `${25 + n} settembre`}</option>)}</select></label>
   <div className="flex justify-between gap-3 border-y border-card-border py-4 mb-4"><p><strong className="text-2xl font-serif">{daFare.length}</strong> da fare</p><p><strong className="text-2xl font-serif">{fatteOggi.length}</strong> confermate</p></div>
   <p className="ed-sezione mb-2">{giorno.split('-').reverse().join('/')} · giornata di esempio</p>
   {daFare.map(c => {
    const a = proponiAssetto(c.camera, c.ospiti, c.extra, 4)!
    return <article key={c.id} className="ed-riga py-5"><div className="flex justify-between items-baseline gap-3"><h2 className="font-serif text-2xl">{c.camera}</h2><span className="text-xs text-stone">{TIPI[c.tipo]}</span></div><p className="text-sm mt-2">{letti(a)} · {a.ospiti} {a.ospiti === 1 ? 'completo' : 'completi'} asciugamani</p><p className="text-xs text-stone mt-1">{c.dettaglio}</p><button className="ed-pillola mt-4" onClick={() => apri(c.id)}>Registra pulizia · {c.camera}</button>{c.tipo === 'soggiorno' && <div className="flex flex-wrap gap-3 mt-3"><button className={classe} onClick={() => sposta(c.id, 1)}>Domani · {c.camera}</button><button className={classe} onClick={() => sposta(c.id, 2)}>Tra due giorni · {c.camera}</button><button className={classe} onClick={() => sposta(c.id, null)}>Salta questo cambio · {c.camera}</button></div>}</article>
   })}
   <TempiFuoriCameraProva giorno={giorno} />
   {daFare.length === 0 && <p className="font-serif text-xl py-6">Nessuna pulizia da fare nella giornata.</p>}
   {future.length > 0 && <section className="mt-6"><h2 className="font-serif text-2xl">Prossime pulizie</h2>{future.map(c => <p key={c.id} className="py-3 text-sm border-b border-card-border">{c.camera} · {prossima(c.id)!.split('-').reverse().join('/')} · da fare, non ancora eseguita</p>)}</section>}
   {decisioni.length > 0 && <section className="mt-6"><h2 className="font-serif text-2xl">Rinvii e salti</h2>{decisioni.map(d => <p key={d.id} className="py-2 text-sm">{d.room_id} · {d.stato === 'rimandata' ? `rimandata dal ${d.data_prevista} al ${d.prossima_data}` : `saltato il cambio del ${d.data_prevista}`} · esclusa dalle pulizie fatte</p>)}</section>}

  </>}
  {vista === 'registro' && <>
   <h2 className="font-serif text-2xl mb-4">Ogni intervento, con i suoi numeri</h2>
   {!registro.length && <p>Nessuna pulizia di prova registrata.</p>}
   {registro.map(r => <article className="ed-riga py-4" key={r.id}><h3 className="font-serif text-xl">{r.camera} · {r.data.split('-').reverse().join('/')}</h3><p className="text-sm mt-2">{TIPI[r.tipo]} · {r.assetto && letti(r.assetto)}</p><p className="text-sm text-stone mt-1">{r.recuperi ? `${totalePezzi(r.recuperi)} pezzi recuperati` : 'Recuperi non annotati'} · {r.minuti === null ? 'Durata non annotata' : `${r.minuti} minuti effettivi`}</p><button className={`${classe} mt-3`} onClick={() => apri(r.id)}>Riapri · {r.camera}</button></article>)}
  </>}
  {vista === 'resoconto' && <>
   <div className="flex flex-wrap gap-3 mb-5"><label className="text-xs">Dal<input className="ed-campo block mt-1" type="date" value={inizio} onChange={e => setInizio(e.target.value)} /></label><label className="text-xs">Al<input className="ed-campo block mt-1" type="date" value={fine} onChange={e => setFine(e.target.value)} /></label><label className="text-xs">Camera<select className="ed-campo block mt-1" value={cameraFiltro} onChange={e => setCameraFiltro(e.target.value)}><option value="">Tutte le camere</option>{compiti.map(c => <option key={c.camera}>{c.camera}</option>)}</select></label></div>
   {!report ? <p role="alert">Controlla le date del periodo.</p> : <>
   <div className="grid grid-cols-2 gap-5 border-y border-card-border py-5"><div><p className="ed-sezione">Pulizie confermate</p><p className="font-serif text-4xl mt-2" data-interventi>{report.interventi}</p><p className="text-xs mt-1 text-stone">su {report.camereDistinte} camere distinte</p></div><div><p className="ed-sezione">Tempo registrato</p><p className="font-serif text-3xl mt-2">{report.conDurata ? ore(report.minuti) : '—'}</p><p className="text-xs mt-1 text-stone">durata nota per {report.conDurata} su {report.interventi} interventi</p></div></div>
   <div className="py-4 border-b border-card-border">{Object.entries(TIPI).map(([k, label]) => <p key={k} className="flex justify-between text-sm py-1"><span>{label}</span><strong>{report.righe.filter(r => r.tipo === k).length}</strong></p>)}</div>
   {!cameraFiltro && <TempiFuoriCameraProva giorno={giorno} dal={inizio} al={fine} minutiCamere={report.minuti} riepilogo />}
   <h2 className="font-serif text-2xl mt-6">Letti rifatti e completi asciugamani</h2><p className="text-xs text-stone mt-1">Dotazione documentata per {report.conAssetto} su {report.interventi} interventi.</p>
   <div className="grid grid-cols-3 gap-3 py-4"><p><strong className="font-serif text-3xl block">{report.matrimoniali}</strong><span className="text-sm">Matrimoniali</span></p><p><strong className="font-serif text-3xl block">{report.singoli}</strong><span className="text-sm">Singoli</span></p><p><strong className="font-serif text-3xl block">{report.completiAsciugamani}</strong><span className="text-sm">Completi asciugamani</span></p></div>
   <h2 className="font-serif text-2xl mt-5">Recuperato e da lavare</h2><p className="text-xs text-stone mt-1 mb-3">Bilancio completo per {report.conLavaggio} su {report.interventi} interventi. Ogni pezzo recuperato evita un pezzo da lavare.</p>
   <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px] gap-x-1 text-xs py-2 border-b border-card-border"><span>Pezzi</span><span className="text-right">Dotazione</span><span className="text-right">Recuperati</span><span className="text-right">Da lavare*</span></div>
   {VOCI_DOTAZIONE.map(([k, label]) => <div key={k} className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px] gap-x-1 text-sm py-3 border-b border-card-border"><span>{label}</span><span className="text-right">{report.dotazione[k]}</span><span className="text-right text-green-mid">{report.conRecuperi ? report.recuperi[k] : '—'}</span><span className="text-right">{report.conLavaggio ? report.lavaggio[k] : '—'}</span></div>)}
   <p className="text-xs text-stone mt-3">*Solo gli interventi con dotazione e recuperi annotati. «Non annotato» non significa zero.</p>
   <p className="text-sm mt-4">Recupero sul totale: {report.percentualeRecupero === null ? 'non calcolabile su tutti gli interventi' : `${report.percentualeRecupero.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`}. Tempo medio: {report.minutiMedi === null ? 'non disponibile' : `${report.minutiMedi.toLocaleString('it-IT', { maximumFractionDigits: 1 })} minuti, sui soli interventi con durata` }.</p>
   </>}
  </>}
  </>}
  {scheda?.assetto && scheda.dotazione && <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={`Pulizia ${scheda.camera}`}><div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-cream p-5 rounded-2xl shadow-lg">
   <h2 className="font-serif text-2xl">{scheda.camera} · {TIPI[scheda.tipo]}</h2><p className="text-sm text-stone mt-2">Dotazione del soggiorno che stai pulendo. Questi numeri resteranno nel registro.</p>
   <label className="block text-sm mt-4">Fatta il<input className="ed-campo mt-1 block" type="date" max={giorno} value={scheda.data} onChange={e => setScheda({ ...scheda, data: e.target.value })} /></label>
   <div className="grid grid-cols-3 gap-3 mt-4">{([['matrimoniali', 'Matrimoniali'], ['singoli', 'Singoli'], ['ospiti', 'Ospiti']] as const).map(([k, label]) => <label key={k} className="text-xs">{label}<input className="ed-campo w-full mt-1" type="number" min={k === 'ospiti' ? 1 : 0} max={k === 'ospiti' ? 4 : k === 'matrimoniali' ? 1 : 2} value={scheda.assetto![k]} onChange={e => cambiaAssetto({ [k]: Number(e.target.value) })} /></label>)}</div>
   {!!scheda.assetto.matrimoniali && <div className="mt-4"><p className="text-sm mb-2">Federe sul matrimoniale{!federeScelte ? ' · scegli per questa pulizia' : ''}</p><div className="flex gap-3">{([2, 4] as const).map(n => <button key={n} aria-pressed={federeScelte && scheda.assetto!.federeMatrimoniale === n} className={federeScelte && scheda.assetto!.federeMatrimoniale === n ? 'ed-pillola' : classe} onClick={() => { cambiaAssetto({ federeMatrimoniale: n }); setFedereScelte(true) }}>{n} federe</button>)}</div></div>}
   <p className="text-sm mt-3">{scheda.dotazione.federe} federe totali · {scheda.assetto.ospiti} completi asciugamani · 1 tappeto bagno · 1 scendidoccia</p>
   <div className="ed-riga py-4 mt-4"><button className={classe} onClick={() => setRecuperoAperto(!recuperoAperto)}>{recuperoAperto ? 'Chiudi quantità' : 'Segna il recuperato'}</button><button className={`${classe} ml-2 mt-2`} onClick={() => { setScheda({ ...scheda, recuperi: pezziVuoti() }); setRecuperoAperto(false) }}>Niente recuperato</button><p className="text-xs text-stone mt-2">{scheda.recuperi ? `${totalePezzi(scheda.recuperi)} pezzi recuperati` : 'Recuperi non ancora annotati: puoi aggiungerli anche dopo.'}</p></div>
   {recuperoAperto && <div className="flex flex-wrap gap-3 py-3">{VOCI_DOTAZIONE.filter(([k]) => scheda.dotazione![k] > 0 || (scheda.recuperi?.[k] ?? 0) > 0).map(([k, label]) => <button key={k} aria-label={`Recuperati ${label}`} aria-pressed={(scheda.recuperi?.[k] ?? 0) > 0} className={(scheda.recuperi?.[k] ?? 0) > 0 ? 'ed-pillola' : classe} onClick={() => setScheda({ ...scheda, recuperi: { ...(scheda.recuperi ?? pezziVuoti()), [k]: ((scheda.recuperi?.[k] ?? 0) + 1) % (scheda.dotazione![k] + 1) } })}>{label} · {scheda.recuperi?.[k] ?? 0}</button>)}<p className="text-xs text-stone w-full">Un tocco aggiunge un pezzo recuperato; dopo il massimo torna a zero.</p></div>}
   {lavaggioScheda && <p className="text-sm mt-3">{totalePezzi(scheda.dotazione)} preparati − {totalePezzi(scheda.recuperi!)} recuperati = <strong>{totalePezzi(lavaggioScheda)} pezzi da lavare</strong></p>}
   <TimerPuliziaProva key={scheda.id} id={`${scheda.id}|${scheda.camera}`} nome={scheda.camera} onMinuti={n => setScheda({ ...scheda, minuti: n || null })} />
   <label className="block text-sm mt-4">Minuti effettivi <span className="text-stone">· facoltativi</span><input className="ed-campo w-24 block mt-2" type="number" min="1" max="1440" value={scheda.minuti ?? ''} onChange={e => setScheda({ ...scheda, minuti: e.target.value === '' ? null : Number(e.target.value) })} /></label>
   {errore && <p role="alert" className="text-red-800 my-3">{errore}</p>}
   <div className="flex justify-end gap-3 mt-6"><button className={classe} onClick={() => { setScheda(null); setErrore('') }}>Annulla</button><button className="ed-pillola disabled:opacity-40" disabled={!federeScelte || salvando || !scheda.data || scheda.data > giorno} onClick={salva}>{registro.some(r => r.id === scheda.id) ? 'Salva correzione' : 'Conferma pulizia'}</button></div>
  </div></div>}
 </main>
}
