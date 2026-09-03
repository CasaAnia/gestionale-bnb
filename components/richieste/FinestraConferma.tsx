'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { ETICHETTA_CASO, type Soluzione } from '@/lib/richiesteProposta'
import { richiesteInConflitto, erroreDiDisponibilita, conLettoExtra, type RichiestaConProposta } from '@/lib/richiesteConferma'
import { confermaRichiesta, scegliSoluzioneInviata } from '@/lib/richiesteDati'
import { prezzo as fmtPrezzo, dalAl } from '@/lib/richiesteTesti'
import { nomeCompleto, formatIntervallo, nottiRichiesta, riassuntoPersone, type Richiesta } from '@/lib/richieste'

// «Creare la prenotazione?»: bottom sheet sul telefono, finestra su desktop.
// Riepilogo della soluzione INVIATA, altre richieste aperte sulle stesse date
// (spuntate = rifiutate in cascata), chiamata alla sola RPC.
type Props = {
  richiesta: RichiestaConProposta
  aperte: Richiesta[]
  layout: 'desktop' | 'mobile'
  onChiudi: () => void
  onCreata: (prenotazioneId: string) => void
}

const BORDO = '#C9BFA8'
const OTTONE = '#A9884E'

export default function FinestraConferma({ richiesta, aperte, layout, onChiudi, onCreata }: Props) {
  // Pezzo 9: se il messaggio elencava più camere (caso A), Ania sceglie qui
  // quella accettata dal cliente; la scelta diventa proposta_soluzione PRIMA
  // della RPC (che legge solo quella). Nessuna preselezione se ce n'è più di una.
  const alternative: Soluzione[] = (richiesta as { proposta_alternative?: Soluzione[] | null }).proposta_alternative ?? []
  const piuCamere = alternative.length > 1
  const [scelta, setScelta] = useState<number | null>(piuCamere ? null : 0)
  const sol = piuCamere ? (scelta === null ? null : alternative[scelta]) : (richiesta.proposta_soluzione ?? null)
  const conflitti = useMemo(() => (sol ? richiesteInConflitto(sol, aperte, richiesta.id) : []), [sol, aperte, richiesta.id])
  const [spuntate, setSpuntate] = useState<Set<string>>(() => new Set(conflitti.map(c => c.id)))
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !occupato) onChiudi() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChiudi, occupato])

  async function crea() {
    if (occupato) return          // secondo tocco: niente doppioni (e la RPC è idempotente)
    setErrore(null); setOccupato(true)
    if (piuCamere) {
      if (!sol) { setErrore('Scegli la camera accettata dal cliente.'); setOccupato(false); return }
      const scelto = await scegliSoluzioneInviata(richiesta.id, sol)
      if (scelto.error) { setErrore(`Camera non registrata: ${scelto.error}`); setOccupato(false); return }
    }
    const r = await confermaRichiesta(richiesta.id, [...spuntate])
    if (r.error || !r.prenotazioneId) { setErrore(r.error || 'Conferma non riuscita.'); setOccupato(false); return }
    onCreata(r.prenotazioneId)
  }

  const corpo = (
    <>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[17px] text-green-dark" style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}>Creare la prenotazione?</p>
        <button type="button" onClick={onChiudi} disabled={occupato} aria-label="Chiudi" className="w-9 h-9 -mr-2 flex items-center justify-center text-stone disabled:opacity-40"><X size={18} strokeWidth={2} aria-hidden /></button>
      </div>
      <p className="text-sm text-green-dark">{nomeCompleto(richiesta)} · {richiesta.persone_per_notte ? riassuntoPersone(richiesta.arrivo, richiesta.persone_per_notte) : `${richiesta.persone} ${richiesta.persone === 1 ? 'persona' : 'persone'}`}</p>

      {piuCamere && (
        <div className="mt-3" role="group" aria-label="Camera accettata dal cliente">
          <p className="text-xs font-semibold text-stone mb-1.5">Il messaggio proponeva {alternative.length} camere: quale ha scelto il cliente?</p>
          <div className="flex flex-wrap gap-2">
            {alternative.map((a, i) => (
              <button key={i} type="button" onClick={() => setScelta(i)} aria-pressed={scelta === i} disabled={occupato}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${scelta === i ? 'bg-green-mid text-cream-text' : 'bg-white text-green-dark border border-card-border'}`}>
                {a.segmenti[0]?.camera.name} · {fmtPrezzo(a.prezzoTotale)} €
              </button>
            ))}
          </div>
        </div>
      )}

      {sol ? (
        <div className="mt-3 bg-cream rounded-xl p-3 text-sm text-green-dark">
          <p className="text-xs font-semibold text-stone mb-1.5">Soluzione inviata · {ETICHETTA_CASO[sol.caso]}</p>
          <ul className="space-y-1">
            {sol.segmenti.map((s, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span><span className="font-medium">{s.camera.name}</span> {dalAl(s.arrivo, s.partenza)}</span>
                <span className="shrink-0 text-brass font-semibold">{s.notti === 1 ? '1 notte' : `${s.notti} notti`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 pt-2 border-t-[0.5px] border-border-soft flex items-baseline justify-between">
            <span>{conLettoExtra(sol) ? 'Con letto aggiuntivo · ' : ''}Totale</span>
            <span className="font-semibold">{fmtPrezzo(sol.prezzoTotale)} €</span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold" style={{ color: OTTONE }}>{piuCamere ? 'Scegli la camera accettata dal cliente.' : 'Nessuna proposta inviata: prima va inviata una proposta.'}</p>
      )}

      {conflitti.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-stone mb-1.5">Altre richieste per le stesse date · Rifiuta anche queste</p>
          <ul className="space-y-1.5">
            {conflitti.map(c => (
              <li key={c.id}>
                <label className="flex items-start gap-2.5 text-sm text-green-dark">
                  <input type="checkbox" checked={spuntate.has(c.id)} disabled={occupato}
                    onChange={e => setSpuntate(prev => { const n = new Set(prev); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n })}
                    className="mt-0.5 h-4 w-4 accent-[#2D6A4F]" />
                  <span><span className="font-medium">{nomeCompleto(c)}</span> · {formatIntervallo(c.arrivo, c.partenza)} · {nottiRichiesta(c)} {nottiRichiesta(c) === 1 ? 'notte' : 'notti'} · {c.rooms?.name || 'qualsiasi camera'}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {errore && (
        <div role="alert" className="mt-3 text-sm font-semibold" style={{ color: OTTONE }}>
          {errore}
          {erroreDiDisponibilita(errore) && (
            <p className="mt-1 font-normal">
              <Link href={`/richieste/${richiesta.id}/proposta`} className="underline underline-offset-2">Prepara una nuova proposta</Link>
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onChiudi} disabled={occupato}
          className="flex-1 rounded-xl py-3 text-sm font-semibold text-green-dark bg-white border disabled:opacity-50" style={{ borderColor: BORDO }}>Annulla</button>
        <button type="button" onClick={crea} disabled={occupato || !sol} aria-busy={occupato}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-green-mid text-cream-text disabled:opacity-60 active:opacity-80">
          {occupato && <span aria-hidden className="inline-block w-4 h-4 rounded-full border-2 border-cream-text/40 border-t-cream-text animate-spin" />}
          {occupato ? 'Creo…' : 'Crea prenotazione'}
        </button>
      </div>
    </>
  )

  if (layout === 'mobile') {
    return (
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Creare la prenotazione?">
        <div className="velo-in absolute inset-0 bg-green-dark/30" onClick={() => { if (!occupato) onChiudi() }} />
        <div className="scheda-in absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto shadow-lg">
          <div className="w-10 h-1 rounded-full bg-border-soft mx-auto mb-3" aria-hidden />
          {corpo}
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Creare la prenotazione?">
      <div className="velo-in absolute inset-0 bg-green-dark/30" onClick={() => { if (!occupato) onChiudi() }} />
      <div className="scheda-in relative bg-white rounded-2xl shadow-lg p-5 w-full max-w-md max-h-[85vh] overflow-y-auto">{corpo}</div>
    </div>
  )
}
