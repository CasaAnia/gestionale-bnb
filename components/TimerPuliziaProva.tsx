'use client'
import { useEffect, useState } from 'react'
import { secondiTrascorsi, fermaCronometro, minutiCronometro, type Cronometro } from '@/lib/tempoPulizie'
const CHIAVE = 'casa-ania:timer-prova:v1'
type Timers = Record<string, Cronometro>
export default function TimerPuliziaProva({ id, nome, onMinuti }: { id: string; nome: string; onMinuti: (n: number) => void }) {
 const [timers, setTimers] = useState<Timers>({})
 const [ora, setOra] = useState(0)
 const [pronto, setPronto] = useState(false)
 const [errore, setErrore] = useState('')
 useEffect(() => {
  const leggi = () => { try { setTimers(JSON.parse(localStorage.getItem(CHIAVE) || '{}')); setOra(Date.now()); setPronto(true) } catch { setErrore('Timer non leggibile. Puoi annotare i minuti manualmente.') } }
  const primo = window.setTimeout(leggi, 0)
  const intervallo = window.setInterval(leggi, 1000)
  window.addEventListener('storage', leggi)
  return () => { clearTimeout(primo); clearInterval(intervallo); window.removeEventListener('storage', leggi) }
 }, [])
 const t = timers[id] ?? { trascorsi: 0, avviato: null }
 const altro = Object.entries(timers).find(([k, v]) => k !== id && v.avviato !== null)
 function cambia(azione: 'avvia' | 'pausa' | 'termina') {
  try {
   const tutti: Timers = JSON.parse(localStorage.getItem(CHIAVE) || '{}'), adesso = Date.now()
   const corrente = tutti[id] ?? { trascorsi: 0, avviato: null }
   if (azione === 'avvia' && Object.entries(tutti).some(([k, v]) => k !== id && v.avviato !== null)) throw new Error('Metti in pausa il timer già avviato prima di cambiare attività.')
   const nuovo = azione === 'avvia' ? { ...corrente, avviato: corrente.avviato ?? adesso } : fermaCronometro(corrente, adesso)
   const dati = JSON.stringify({ ...tutti, [id]: nuovo })
   localStorage.setItem(CHIAVE, dati)
   if (localStorage.getItem(CHIAVE) !== dati) throw new Error('Timer non salvato.')
   setTimers(JSON.parse(dati)); setOra(adesso); setErrore('')
   if (azione === 'termina') onMinuti(minutiCronometro(nuovo, adesso))
  } catch (e) { setErrore(e instanceof Error ? e.message : 'Timer non salvato.') }
 }
 const secondi = secondiTrascorsi(t, ora)
 return <section className="border-y border-card-border py-4 my-4" aria-label={`Timer ${nome}`}>
  <p className="text-sm">Timer · {nome}</p><p className="font-serif text-3xl my-2" role="timer">{Math.floor(secondi / 60)}:{String(secondi % 60).padStart(2, '0')}</p>
  <div className="flex flex-wrap gap-3"><button className="ed-pillola-contorno" disabled={!pronto || !!altro} onClick={() => cambia(t.avviato === null ? 'avvia' : 'pausa')}>{t.avviato === null ? secondi ? 'Riprendi' : 'Avvia timer' : 'Pausa'}</button><button className="ed-pillola-contorno" disabled={!pronto || !secondi} onClick={() => cambia('termina')}>Ferma e riporta i minuti</button></div>
  <p className="text-xs text-stone mt-2">Il timer continua anche chiudendo la scheda. Fermarlo compila i minuti; la conferma della pulizia resta tua. Minuti arrotondati per eccesso.</p>
  {altro && <p className="text-sm mt-2">Un altro timer è in corso: {altro[0].split('|').at(-1)}.</p>}{errore && <p role="alert">{errore}</p>}
 </section>
}
