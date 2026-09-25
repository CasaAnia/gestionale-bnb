'use client'
import { useEffect, useState } from 'react'
import TimerPuliziaProva from './TimerPuliziaProva'
const CHIAVE = 'casa-ania:fuori-camera-prova:v1'
const ATTIVITA = ['Area comune', 'Corridoio', 'Piegatura biancheria']
type Riga = { data: string; attivita: string; minuti: number }
export default function TempiFuoriCameraProva({ giorno, dal, al, minutiCamere = 0, riepilogo = false }: { giorno: string; dal?: string; al?: string; minutiCamere?: number; riepilogo?: boolean }) {
 const [righe, setRighe] = useState<Riga[]>([]), [attivita, setAttivita] = useState(ATTIVITA[0]), [minuti, setMinuti] = useState(''), [messaggio, setMessaggio] = useState('')
 useEffect(() => { const t = setTimeout(() => { try { setRighe(JSON.parse(localStorage.getItem(CHIAVE) || '[]')) } catch { setMessaggio('Non riesco a leggere i tempi fuori camera.') } }, 0); return () => clearTimeout(t) }, [])
 const selezione = righe.filter(r => r.data >= (dal ?? giorno) && r.data <= (al ?? giorno))
 const totale = selezione.reduce((s, r) => s + r.minuti, 0)
 function salva() {
  if (!Number.isInteger(Number(minuti)) || Number(minuti) <= 0 || Number(minuti) > 1440) { setMessaggio('Inserisci da 1 a 1440 minuti.'); return }
  try {
   const timer = JSON.parse(localStorage.getItem('casa-ania:timer-prova:v1') || '{}')[`${giorno}|${attivita}`]
   if (timer?.avviato != null) { setMessaggio('Ferma il timer prima di salvare il tempo.'); return }
   const attuali: Riga[] = JSON.parse(localStorage.getItem(CHIAVE) || '[]')
   const nuove = [...attuali.filter(r => r.data !== giorno || r.attivita !== attivita), { data: giorno, attivita, minuti: Number(minuti) }]
   const testo = JSON.stringify(nuove); localStorage.setItem(CHIAVE, testo)
   if (localStorage.getItem(CHIAVE) !== testo) throw new Error()
   setRighe(nuove); setMessaggio('Tempo salvato. Un nuovo salvataggio aggiorna il totale di questa attività nella giornata.')
  } catch { setMessaggio('Non riesco a salvare i minuti.') }
 }
 return <section className="mt-7 border-t border-card-border pt-5"><h2 className="font-serif text-2xl">Fuori dalle camere</h2><p className="text-sm text-stone mt-2">Tempo separato per pulizia degli spazi e piegatura. Non aggiunge pulizie al conteggio delle camere.</p>
 {ATTIVITA.map(a => <p key={a} className="flex justify-between text-sm py-2"><span>{a}</span><span>{selezione.some(r => r.attivita === a) ? `${selezione.filter(r => r.attivita === a).reduce((s, r) => s + r.minuti, 0)} min` : 'Non annotato'}</span></p>)}
 <p className="font-serif text-xl my-3">Fuori camera: {totale} min{riepilogo && <> · Totale registrato: {minutiCamere + totale} min</>}</p>
 {!riepilogo && <><label className="text-sm">Attività<select className="ed-campo block mt-2" value={attivita} onChange={e => { setAttivita(e.target.value); setMinuti(String(righe.find(r => r.data === giorno && r.attivita === e.target.value)?.minuti ?? '')); setMessaggio('') }}>{ATTIVITA.map(a => <option key={a}>{a}</option>)}</select></label>
 <TimerPuliziaProva key={`${giorno}|${attivita}`} id={`${giorno}|${attivita}`} nome={attivita} onMinuti={n => setMinuti(String(n))} />
 <label className="block text-sm">Minuti totali dell’attività oggi<input className="ed-campo block mt-2 w-24" type="number" min="1" max="1440" value={minuti} onChange={e => setMinuti(e.target.value)} /></label><button className="ed-pillola mt-3" onClick={salva}>Salva tempo fuori camera</button></>}
 {messaggio && <p role="status" className="text-sm mt-3">{messaggio}</p>}</section>
}
