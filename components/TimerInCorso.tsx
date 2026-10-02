'use client'
// Un solo timer in corso alla volta: qui si vede quale, da qualunque
// sezione, e si può raggiungere o mettere in pausa. Mai fermato di nascosto.
import { useEffect, useState } from 'react'
import { useTimerPulizie, azioneTimer } from '@/lib/pulizieTempiDati'
import { descriviChiave, secondiTimer, testoCronometro } from '@/lib/tempoPulizie'

export default function TimerInCorso({ nomeCamera, onVaiA, pagina = false }: { nomeCamera: (bookingId: string) => string | null; onVaiA: (chiave: string) => void
  /** veste della pagina Pulizie nuova (01/10/2026) */
  pagina?: boolean }) {
  const s = useTimerPulizie()
  const [ora, setOra] = useState(0)
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)
  const attivo = s.timer.find(t => t.avviato_at) ?? null
  useEffect(() => {
    if (!attivo) return
    const primo = window.setTimeout(() => setOra(Date.now()), 0)
    const giro = window.setInterval(() => setOra(Date.now()), 1000)
    return () => { window.clearTimeout(primo); window.clearInterval(giro) }
  }, [attivo])
  if (!attivo) return null
  const d = descriviChiave(attivo.chiave, nomeCamera)
  // Pagina Pulizie (01/10/2026): una riga sottile nelle linguette Registro e
  // Statistiche (in «Oggi» il timer si vede già, grande, nella sua scheda)
  if (pagina) return <p className="pul-incorso" role="status" data-timer-in-corso={attivo.chiave}>
    <span>Timer in corso · {d.nome}{d.tipo === 'fuori' ? ` · ${d.data.split('-').reverse().join('/')}` : ''} · <b>{ora ? testoCronometro(secondiTimer(attivo, ora, s.scarto)) : '…'}</b></span>
    <button type="button" className="pul-az" disabled={occupato} onClick={async () => { setOccupato(true); const e = await azioneTimer('pausa', attivo.chiave); setOccupato(false); setErrore(e.errore ?? '') }}>Pausa</button>
    <button type="button" className="pul-az tn" onClick={() => onVaiA(attivo.chiave)}>Vai a {d.nome}</button>
    {s.nonSincronizzato && <span className="pul-errore" style={{ flexBasis: '100%' }}>Timer non sincronizzato: controlla la connessione.</span>}
    {errore && <span className="pul-errore" style={{ flexBasis: '100%' }}>{errore}</span>}
  </p>
  return <p className="text-sm border-b border-card-border pb-3 mb-4" role="status" data-timer-in-corso={attivo.chiave}>
    Timer in corso · {d.nome}{d.tipo === 'fuori' ? ` · ${d.data.split('-').reverse().join('/')}` : ''} · <span className="font-serif">{ora ? testoCronometro(secondiTimer(attivo, ora, s.scarto)) : '…'}</span>{' '}
    <button type="button" className="ed-azione ml-2" disabled={occupato} onClick={async () => { setOccupato(true); const e = await azioneTimer('pausa', attivo.chiave); setOccupato(false); setErrore(e.errore ?? '') }}>Pausa · {d.nome}</button>{' '}
    <button type="button" className="ed-azione ed-azione-tenue ml-2" onClick={() => onVaiA(attivo.chiave)}>Vai a {d.nome}</button>
    {s.nonSincronizzato && <span className="block text-red-800 mt-1">Timer non sincronizzato: controlla la connessione.</span>}
    {errore && <span className="block text-red-800 mt-1">{errore}</span>}
  </p>
}
