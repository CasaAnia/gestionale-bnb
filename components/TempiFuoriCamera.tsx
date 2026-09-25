'use client'
// «Fuori dalle camere» approvato il 25/09/2026 (riferimento
// TempiFuoriCameraProva), sul database: un totale per giornata e attività;
// il timer si riporta dentro quel totale in modo esplicito e, al
// salvataggio, riparte da zero nella stessa transazione. Non crea pulizie.
import { useCallback, useEffect, useState } from 'react'
import TimerPulizia from './TimerPulizia'
import { leggiFuoriCamera, salvaFuoriCamera, useTimerPulizie, type FuoriCameraSql } from '@/lib/pulizieTempiDati'
import { osservaAggiornamentiPulizie } from '@/lib/aggiornamentiPulizie'
import { ATTIVITA_FUORI, chiaveTimerFuori, totaleProposto, type AttivitaFuori } from '@/lib/tempoPulizie'

export default function TempiFuoriCamera({ giorno, oggi, dal, al, minutiCamere = 0, riepilogo = false, nomeCamera, onVaiA, onTotale }: {
  giorno: string; oggi: string; dal?: string; al?: string; minutiCamere?: number; riepilogo?: boolean
  nomeCamera: (bookingId: string) => string | null; onVaiA?: (chiave: string) => void
  onTotale?: (minuti: number | null) => void
}) {
  const [righe, setRighe] = useState<FuoriCameraSql[] | null>(null)
  const [attivita, setAttivita] = useState<AttivitaFuori>('area_comune')
  const [minuti, setMinuti] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [riportato, setRiportato] = useState<number | null>(null)
  const [lettura, setLettura] = useState(0)
  const timer = useTimerPulizie()
  const da = dal ?? giorno, a = al ?? giorno
  useEffect(() => osservaAggiornamentiPulizie(window, () => setLettura(x => x + 1)), [])
  useEffect(() => {
    let viva = true
    leggiFuoriCamera(da, a).then(r => {
      if (!viva) return
      setRighe(r.righe); setErrore(r.errore ?? '')
    })
    return () => { viva = false }
  }, [da, a, lettura])
  const salvata = righe?.find(r => r.data === giorno && r.attivita === attivita) ?? null
  const totale = righe ? righe.reduce((s, r) => s + r.minuti, 0) : null
  useEffect(() => { onTotale?.(totale) }, [onTotale, totale])
  const chiave = chiaveTimerFuori(giorno, attivita)
  const t = timer.timer.find(x => x.chiave === chiave) ?? null
  // Il campo mostra il totale salvato finché non lo si cambia.
  const [campoDi, setCampoDi] = useState('')
  const campoChiave = `${giorno}|${attivita}|${salvata?.versione ?? 0}`
  if (campoDi !== campoChiave && righe) { setCampoDi(campoChiave); setMinuti(salvata ? String(salvata.minuti) : ''); setRiportato(null) }

  const riporta = useCallback((_: number, trascorsi: number) => {
    const p = totaleProposto(salvata?.minuti ?? null, trascorsi, minuti)
    setMinuti(String(p.minuti)); setRiportato(trascorsi); setMessaggio(p.testo)
  }, [salvata, minuti])

  async function salva() {
    const n = Number(minuti)
    if (minuti.trim() === '' || !Number.isInteger(n) || n < 0 || n > 1440) { setMessaggio('Inserisci da 0 a 1440 minuti.'); return }
    if (t?.avviato_at) { setMessaggio('Ferma il timer prima di salvare il tempo.'); return }
    if (t && t.trascorsi > 0 && riportato !== t.trascorsi) { setMessaggio('Il timer ha minuti non ancora riportati: premi «Ferma e riporta i minuti» oppure azzeralo.'); return }
    setSalvando(true); setMessaggio('')
    try {
      const e = await salvaFuoriCamera(giorno, attivita, n, salvata?.versione ?? null, t?.trascorsi ?? 0)
      if (e.errore) { setMessaggio(e.errore); setLettura(x => x + 1); return }
      setMessaggio(e.verificato ? 'Tempo salvato (verificato dopo una risposta persa). Un nuovo salvataggio aggiorna il totale di questa attività nella giornata.' : 'Tempo salvato. Un nuovo salvataggio aggiorna il totale di questa attività nella giornata.')
      setLettura(x => x + 1)
    } finally { setSalvando(false) }
  }

  const etichettaGiorno = giorno === oggi ? 'oggi' : `del ${giorno.split('-').reverse().join('/')}`
  return <section className="mt-7 border-t border-card-border pt-5" data-fuori-camera={giorno}><h2 className="font-serif text-2xl">Fuori dalle camere</h2><p className="text-sm text-stone mt-2">Tempo separato per pulizia degli spazi e piegatura. Non aggiunge pulizie al conteggio delle camere.</p>
    {errore && <p role="alert" className="text-sm text-red-800 mt-2">{errore}</p>}
    {ATTIVITA_FUORI.map(([k, label]) => { const sue = righe?.filter(r => r.attivita === k) ?? []; return <p key={k} className="flex justify-between text-sm py-2" data-attivita={k}><span>{label}</span><span>{righe === null ? '—' : sue.length ? `${sue.reduce((s, r) => s + r.minuti, 0)} min` : 'Non annotato'}</span></p> })}
    <p className="font-serif text-xl my-3" data-totale-fuori={totale ?? ''}>Fuori camera: {totale === null ? '—' : `${totale} min`}{riepilogo && <> · Totale registrato: {totale === null ? '—' : `${minutiCamere + totale} min`}</>}</p>
    {!riepilogo && <><label className="text-sm">Attività<select className="ed-campo block mt-2" value={attivita} onChange={e => { setAttivita(e.target.value as AttivitaFuori); setMessaggio('') }}>{ATTIVITA_FUORI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <TimerPulizia key={chiave} chiave={chiave} nome={ATTIVITA_FUORI.find(([k]) => k === attivita)![1]} onMinuti={riporta} nomeCamera={nomeCamera} onVaiA={onVaiA} />
      <label className="block text-sm">Minuti totali dell’attività {etichettaGiorno}<input className="ed-campo block mt-2 w-24" type="number" inputMode="numeric" min="0" max="1440" value={minuti} onChange={e => setMinuti(e.target.value)} /></label>
      {salvata && <p className="text-xs text-stone mt-2">Salvati finora: {salvata.minuti} min. Il valore del campo sostituisce il totale della giornata.</p>}
      <button type="button" className="ed-pillola mt-3 disabled:opacity-40" disabled={salvando || righe === null} onClick={() => void salva()}>{salvando ? 'Salvo…' : 'Salva tempo fuori camera'}</button></>}
    {messaggio && <p role="status" className="text-sm mt-3">{messaggio}</p>}</section>
}
