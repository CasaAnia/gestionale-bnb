'use client'
import { useEffect } from 'react'

// Piccola finestra di conferma (usata per «Rifiuta»): velo + scheda centrata,
// stesse animazioni della finestra «richiesta dal sito».
type Props = {
  titolo: string
  testo?: string
  conferma: string
  annulla?: string
  occupato?: boolean
  onConferma: () => void
  onAnnulla: () => void
}

export default function ConfermaDialog({ titolo, testo, conferma, annulla = 'Annulla', occupato = false, onConferma, onAnnulla }: Props) {
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
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onAnnulla} disabled={occupato}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-green-dark bg-white border disabled:opacity-50" style={{ borderColor: '#C9BFA8' }}>
            {annulla}
          </button>
          <button type="button" onClick={onConferma} disabled={occupato}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-green-mid text-cream-text disabled:opacity-50 active:opacity-80">
            {occupato ? 'Un attimo…' : conferma}
          </button>
        </div>
      </div>
    </div>
  )
}
