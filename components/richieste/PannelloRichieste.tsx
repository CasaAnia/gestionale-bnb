'use client'
import { useEffect } from 'react'
import { Globe, Phone, MessageCircle, X } from 'lucide-react'
import {
  CANALE_LABEL, STATO_LABEL, nomeCompleto, nottiRichiesta, formatIntervallo, oraArrivo, avvisoFerma, riassuntoPersone, type Richiesta,
} from '@/lib/richieste'
import type { Ancora } from './CalendarioRichieste'
import AzioniRichiesta from './AzioniRichiesta'
import RigaScadenza from './RigaScadenza'

// Pannello «chi c'è dentro»: bottom sheet sul telefono, popover accanto alla
// barra su desktop. Solo lettura: i pulsanti d'azione arrivano nel pezzo 5.
type Props = {
  gruppo: Richiesta[]
  ancora: Ancora
  layout: 'desktop' | 'mobile'
  adesso: Date
  onChiudi: () => void
  onRifiuta: (r: Richiesta) => void
  onConferma: (r: Richiesta) => void
}

function IconaCanale({ canale }: { canale: Richiesta['canale'] }) {
  const props = { size: 12, strokeWidth: 1.8, 'aria-hidden': true as const, className: 'shrink-0' }
  if (canale === 'web') return <Globe {...props} />
  if (canale === 'whatsapp') return <MessageCircle {...props} />
  return <Phone {...props} />
}

export default function PannelloRichieste({ gruppo, ancora, layout, adesso, onChiudi, onRifiuta, onConferma }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onChiudi() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChiudi])

  const titolo = gruppo.length === 1 ? 'Richiesta' : `${gruppo.length} richieste sovrapposte`
  const elenco = (
    <ul className="divide-y-[0.5px] divide-border-soft">
      {gruppo.map(r => {
        const n = nottiRichiesta(r)
        return (
          <li key={r.id} className="py-2.5 leading-snug">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-[15px] text-green-dark truncate">{nomeCompleto(r)}</p>
              <p className="shrink-0 text-sm font-semibold text-brass">{n === 1 ? '1 notte' : `${n} notti`}</p>
            </div>
            <p className="text-sm text-green-dark mt-0.5">
              {formatIntervallo(r.arrivo, r.partenza)}<span className="text-stone"> · </span>
              {r.persone_per_notte ? riassuntoPersone(r.arrivo, r.persone_per_notte) : `${r.persone} ${r.persone === 1 ? 'persona' : 'persone'}`}<span className="text-stone"> · </span>
              {r.rooms?.name || 'qualsiasi camera'}
            </p>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-stone mt-1">
              <span className="inline-flex items-center gap-1"><IconaCanale canale={r.canale} />{CANALE_LABEL[r.canale]}</span>
              <span aria-hidden>·</span>
              <span>{oraArrivo(r.created_at, adesso)}</span>
              {/* con la proposta inviata lo stato lo dice la riga del timer qui sotto */}
              {r.stato !== 'proposta_inviata' && <><span aria-hidden>·</span><span>{STATO_LABEL[r.stato]}</span></>}
              {avvisoFerma(r, adesso) && <><span aria-hidden>·</span><span className="font-semibold text-brass">{avvisoFerma(r, adesso)}</span></>}
            </p>
            <RigaScadenza r={r} adesso={adesso} className="mt-1" />
            <AzioniRichiesta r={r} onRifiuta={onRifiuta} onConferma={onConferma} compatto />
          </li>
        )
      })}
    </ul>
  )

  if (layout === 'mobile') {
    return (
      <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="velo-in absolute inset-0 bg-green-dark/30" onClick={onChiudi} />
        <div className="scheda-in absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[75dvh] overflow-y-auto shadow-lg">
          <div className="w-10 h-1 rounded-full bg-border-soft mx-auto mb-3" aria-hidden />
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-green-dark">{titolo}</p>
            <button type="button" onClick={onChiudi} aria-label="Chiudi" className="w-9 h-9 -mr-2 flex items-center justify-center text-stone">
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
          {elenco}
        </div>
      </div>
    )
  }

  // Desktop: popover accanto al punto del click, dentro lo schermo
  const W = 320
  const left = Math.max(8, Math.min(ancora.x - 40, window.innerWidth - W - 8))
  const top = Math.min(ancora.y + 10, window.innerHeight - 260)
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="absolute inset-0" onClick={onChiudi} />
      <div className="scheda-in absolute bg-white rounded-xl border border-card-border shadow-lg px-4 pt-3 pb-2 max-h-[60vh] overflow-y-auto" style={{ left, top, width: W }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-green-dark">{titolo}</p>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="w-8 h-8 -mr-2 flex items-center justify-center text-stone">
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {elenco}
      </div>
    </div>
  )
}
