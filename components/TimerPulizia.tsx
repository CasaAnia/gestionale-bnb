'use client'
// Timer approvato il 25/09/2026 (riferimento TimerPuliziaProva), ora sul
// database: gli istanti sono del server, quindi chiudere la scheda,
// ricaricare o cambiare telefono non ferma e non raddoppia il tempo.
// Fermarlo riporta i minuti: la conferma della pulizia resta di Ania.
import { useEffect, useState } from 'react'
import { useTimerPulizie, azioneTimer } from '@/lib/pulizieTempiDati'
import { secondiTimer, minutiTimer, testoCronometro, descriviChiave } from '@/lib/tempoPulizie'

export default function TimerPulizia({ chiave, nome, onMinuti, nomeCamera, onVaiA, compatto = false, maison = false, etichetta }: {
  chiave: string; nome: string; onMinuti: (n: number, trascorsi: number) => void
  nomeCamera: (bookingId: string) => string | null
  onVaiA?: (chiave: string) => void
  compatto?: boolean
  /** il timer pieno nella veste «Maison» (foglio «Pulita e recuperato») */
  maison?: boolean
  /** compatto: la scritta a sinistra delle cifre («Area comune, corridoio e biancheria») */
  etichetta?: string
}) {
  const s = useTimerPulizie()
  const [ora, setOra] = useState(0)
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState('')
  const [attesaRiporto, setAttesaRiporto] = useState(false)
  const t = s.timer.find(x => x.chiave === chiave) ?? null
  const altro = s.timer.find(x => x.chiave !== chiave && x.avviato_at) ?? null
  const inCorso = !!t?.avviato_at
  useEffect(() => {
    const primo = window.setTimeout(() => setOra(Date.now()), 0)
    if (!inCorso) return () => window.clearTimeout(primo)
    const giro = window.setInterval(() => setOra(Date.now()), 1000)
    return () => { window.clearTimeout(primo); window.clearInterval(giro) }
  }, [inCorso])
  const secondi = ora ? secondiTimer(t, ora, s.scarto) : 0
  const pronto = s.stato === 'pronto' && !occupato

  async function esegui(azione: 'avvia' | 'pausa' | 'azzera', su = chiave) {
    setOccupato(true); setErrore('')
    try { const e = await azioneTimer(azione, su, azione === 'azzera' ? t?.versione : undefined); if (e.errore) setErrore(e.errore) }
    finally { setOccupato(false) }
  }
  async function ferma() {
    setOccupato(true); setErrore('')
    try {
      const e = await azioneTimer('pausa', chiave)
      if (e.errore) { setAttesaRiporto(false); setErrore(e.errore); return }
    } finally { setOccupato(false) }
  }
  // Dopo «Ferma» i minuti si riportano dal valore riletto dal server, non dal conteggio locale.
  useEffect(() => {
    if (!attesaRiporto || !t || t.avviato_at) return
    const id = window.setTimeout(() => { setAttesaRiporto(false); onMinuti(minutiTimer(t.trascorsi), t.trascorsi) }, 0)
    return () => window.clearTimeout(id)
  }, [attesaRiporto, t, onMinuti])

  const altroDescritto = altro ? descriviChiave(altro.chiave, nomeCamera) : null
  // Home «Maison» (28/09/2026): cifre in Cormorant e una parola sottolineata,
  // «Avvia» / «Pausa» / «Riprendi»; con un altro timer in corso «Avvia» si
  // attenua e sotto c'è «Un altro timer è in corso: … Metti in pausa».
  if (compatto) return <section className="mz-timer" aria-label={`Timer ${nome}`} data-timer={chiave} data-secondi={secondi} data-in-corso={inCorso ? 1 : 0}>
    <div className="mz-tm">{etichetta && <span className="et">{etichetta}</span>}<b role="timer" aria-live="off">{testoCronometro(secondi).padStart(5, '0')}</b>
      <button type="button" className="mz-lnk q" disabled={!pronto || (!inCorso && !!altro)} onClick={() => void esegui(inCorso ? 'pausa' : 'avvia')}>{inCorso ? 'Pausa' : secondi ? 'Riprendi' : 'Avvia'}</button>
    </div>
    {altroDescritto && <p className="mz-note" data-altro-timer>Un altro timer è in corso: {altroDescritto.nome}. <button type="button" className="mz-lnk q" disabled={occupato} onClick={() => void esegui('pausa', altro!.chiave)}>Metti in pausa</button></p>}
    {s.stato === 'caricamento' && <p className="mz-note">Lettura del timer…</p>}
    {(s.nonSincronizzato || s.errore || errore) && <p role="status" className="mz-errore">{errore || s.errore || 'Timer non sincronizzato: controlla la connessione.'}</p>}
  </section>
  // Dentro il foglio «Pulita e recuperato» (veste «Maison»): stessi comandi del timer pieno, come parole sottolineate
  if (maison) return <section className="mz-timer" style={{ marginTop: 16 }} aria-label={`Timer ${nome}`} data-timer={chiave} data-secondi={secondi} data-in-corso={inCorso ? 1 : 0}>
    <span className="mz-lab">Timer · {nome}</span>
    <div className="mz-tm" style={{ flexWrap: 'wrap', gap: 14 }}><b role="timer" aria-live="off" style={{ fontSize: 24 }}>{testoCronometro(secondi)}</b>
      <button type="button" className="mz-lnk q" disabled={!pronto || (!inCorso && !!altro)} onClick={() => void esegui(inCorso ? 'pausa' : 'avvia')}>{inCorso ? 'Pausa' : secondi ? 'Riprendi' : 'Avvia'}</button>
      <button type="button" className="mz-lnk q" disabled={!pronto || !secondi} onClick={() => { setAttesaRiporto(true); void ferma() }}>Ferma e riporta i minuti</button>
      {!inCorso && secondi > 0 && <button type="button" className="mz-lnk q" disabled={!pronto} onClick={() => void esegui('azzera')}>Azzera timer</button>}
    </div>
    <p className="mz-hint">Il timer continua anche chiudendo la scheda. Fermarlo compila i minuti; la conferma della pulizia resta tua. Minuti arrotondati per eccesso.</p>
    {altroDescritto && <p className="mz-note" data-altro-timer>Un altro timer è in corso: {altroDescritto.nome}. <button type="button" className="mz-lnk q" disabled={occupato} onClick={() => void esegui('pausa', altro!.chiave)}>Metti in pausa · {altroDescritto.nome}</button>
      {onVaiA && <> <button type="button" className="mz-lnk q" onClick={() => onVaiA(altro!.chiave)}>Vai a {altroDescritto.nome}</button></>}</p>}
    {s.stato === 'caricamento' && <p className="mz-note">Lettura del timer…</p>}
    {(s.nonSincronizzato || s.errore) && <p role="status" className="mz-errore">{s.errore ?? 'Timer non sincronizzato: controlla la connessione.'}</p>}
    {errore && <p role="alert" className="mz-errore">{errore}</p>}
  </section>
  return <section className="border-y border-card-border py-4 my-4" aria-label={`Timer ${nome}`} data-timer={chiave} data-secondi={secondi} data-in-corso={inCorso ? 1 : 0}>
    <p className="text-sm">Timer · {nome}</p><p className="font-serif text-3xl my-2" role="timer" aria-live="off">{testoCronometro(secondi)}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="ed-pillola-contorno disabled:opacity-40" disabled={!pronto || (!inCorso && !!altro)} onClick={() => void esegui(inCorso ? 'pausa' : 'avvia')}>{inCorso ? 'Pausa' : secondi ? 'Riprendi' : 'Avvia timer'}</button>
      <button type="button" className="ed-pillola-contorno disabled:opacity-40" disabled={!pronto || !secondi} onClick={() => { setAttesaRiporto(true); void ferma() }}>Ferma e riporta i minuti</button>
      {!inCorso && secondi > 0 && <button type="button" className="ed-pillola-tenue disabled:opacity-40" disabled={!pronto} onClick={() => void esegui('azzera')}>Azzera timer</button>}
    </div>
    <p className="text-xs text-stone mt-2">Il timer continua anche chiudendo la scheda. Fermarlo compila i minuti; la conferma della pulizia resta tua. Minuti arrotondati per eccesso.</p>
    {altroDescritto && <p className="text-sm mt-2" data-altro-timer>Un altro timer è in corso: {altroDescritto.nome}.{' '}
      <button type="button" className="ed-azione" disabled={occupato} onClick={() => void esegui('pausa', altro!.chiave)}>Metti in pausa · {altroDescritto.nome}</button>
      {onVaiA && <>{' '}<button type="button" className="ed-azione ed-azione-tenue" onClick={() => onVaiA(altro!.chiave)}>Vai a {altroDescritto.nome}</button></>}</p>}
    {s.stato === 'caricamento' && <p className="text-xs text-stone mt-2">Lettura del timer…</p>}
    {(s.nonSincronizzato || s.errore) && <p role="status" className="text-sm mt-2 text-red-800">{s.errore ?? 'Timer non sincronizzato: controlla la connessione.'}</p>}
    {errore && <p role="alert" className="text-sm mt-2 text-red-800">{errore}</p>}
  </section>
}
