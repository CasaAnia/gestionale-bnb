'use client'
import { useEffect, useState } from 'react'

// Piccola finestra di conferma (usata per «Rifiuta»): velo + scheda centrata,
// stesse animazioni della finestra «richiesta dal sito».
type Props = {
  titolo: string
  testo?: string
  conferma: string
  annulla?: string
  occupato?: boolean
  // Scelta facoltativa a chip (es. motivo del rifiuto); «Altro» apre un campo breve.
  scelte?: string[]
  onConferma: (scelta?: string) => void
  onAnnulla: () => void
}

export default function ConfermaDialog({ titolo, testo, conferma, annulla = 'Annulla', occupato = false, scelte, onConferma, onAnnulla }: Props) {
  const [scelta, setScelta] = useState<string | null>(null)
  const [altro, setAltro] = useState('')
  const motivo = scelta === 'Altro' ? (altro.trim() || 'Altro') : scelta ?? undefined
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onAnnulla() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAnnulla])
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="velo-in absolute inset-0 bg-green-dark/30" onClick={onAnnulla} />
      <div className="scheda-in relative bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm">
        <p className="text-[15px] font-medium text-green-dark leading-snug">{titolo}</p>
        {testo && <p className="text-sm text-stone mt-1.5">{testo}</p>}
        {scelte && scelte.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-stone mb-1.5">Motivo (facoltativo)</p>
            <div className="flex flex-wrap gap-1.5">
              {scelte.map(v => (
                <button key={v} type="button" onClick={() => setScelta(s => (s === v ? null : v))} aria-pressed={scelta === v} disabled={occupato}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${scelta === v ? 'bg-green-mid text-cream-text' : 'bg-white text-stone border border-card-border'}`}>
                  {v}
                </button>
              ))}
            </div>
            {scelta === 'Altro' && (
              <input value={altro} onChange={e => setAltro(e.target.value)} maxLength={80} placeholder="Due parole…" autoFocus
                className="mt-2 w-full bg-white border border-card-border rounded-lg p-2.5 text-sm focus:outline-none focus:border-green-mid" />
            )}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onAnnulla} disabled={occupato}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-green-dark bg-white border disabled:opacity-50" style={{ borderColor: '#C9BFA8' }}>
            {annulla}
          </button>
          <button type="button" onClick={() => onConferma(motivo)} disabled={occupato}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-green-mid text-cream-text disabled:opacity-50 active:opacity-80">
            {occupato ? 'Un attimo…' : conferma}
          </button>
        </div>
      </div>
    </div>
  )
}
