'use client'
import { useEffect, useState } from 'react'
import { MOTIVI_RIFIUTO_SCELTE, type MotivoRifiuto } from '@/lib/motivoRifiuto'
import { formatDateRichiesta, nomeCompleto, type Richiesta } from '@/lib/richieste'

// «Perché la rifiuti?» (07/09/2026): finestra prima di chiudere una richiesta.
// Quattro bottoni larghi uno sotto l'altro, «Rifiuta» (verde pieno) attivo
// solo dopo aver scelto un motivo. Velo e foglio come le altre finestre
// (ed-velo / ed-foglio): dal basso sul telefono, centrata sul Mac.
type Props = {
  richiesta: Pick<Richiesta, 'nome' | 'cognome' | 'arrivo' | 'partenza' | 'camera_id' | 'rooms'>
  occupato?: boolean
  onConferma: (motivo: MotivoRifiuto) => void
  onAnnulla: () => void
}

export default function RifiutaConMotivo({ richiesta, occupato = false, onConferma, onAnnulla }: Props) {
  const [motivo, setMotivo] = useState<MotivoRifiuto | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !occupato) onAnnulla() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAnnulla, occupato])
  const camera = richiesta.camera_id ? (richiesta.rooms?.name ?? 'camera scelta') : 'qualsiasi camera'
  const titolo = 'Perché la rifiuti?'
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="velo-in absolute inset-0 ed-velo" onClick={() => { if (!occupato) onAnnulla() }} />
      <div className="scheda-in relative ed-foglio rounded-2xl shadow-lg p-5 w-full max-w-sm">
        <p className="ed-titolo-medio">{titolo}</p>
        <p className="text-sm text-stone mt-1">{nomeCompleto(richiesta)} · {formatDateRichiesta(richiesta)} · {camera}</p>
        <div className="mt-4 space-y-2" role="group" aria-label="Motivo">
          {MOTIVI_RIFIUTO_SCELTE.map(s => {
            const attivo = motivo === s.codice
            return (
              <button key={s.codice} type="button" onClick={() => setMotivo(s.codice)} aria-pressed={attivo} disabled={occupato} data-motivo={s.codice}
                className={`w-full min-h-[48px] text-left rounded-xl px-4 py-3 text-[15px] font-medium border transition-colors ${attivo ? 'bg-green-mid text-cream-text border-green-mid' : 'bg-white text-green-dark border-[#C9BFA8]'}`}>
                {s.testo}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onAnnulla} disabled={occupato}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-green-dark bg-white border disabled:opacity-50" style={{ borderColor: '#C9BFA8' }}>
            Annulla
          </button>
          <button type="button" onClick={() => { if (motivo) onConferma(motivo) }} disabled={occupato || !motivo}
            className="flex-1 rounded-xl py-3 text-sm font-semibold bg-green-mid text-cream-text disabled:opacity-50 active:opacity-80">
            {occupato ? 'Un attimo…' : 'Rifiuta'}
          </button>
        </div>
      </div>
    </div>
  )
}
