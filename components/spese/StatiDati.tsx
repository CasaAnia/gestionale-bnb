'use client'
// Stati non-pronti del nuovo guscio (Fase 3.1): caricamento, vuoto, errore.
// Componenti condivisi da tutte le sezioni.
import { CircleAlert, RotateCcw, Inbox } from 'lucide-react'
import { TEMA as t } from './tema'

// scheletro neutro mentre i dati arrivano: nessun testo, solo forme
export function Caricamento() {
  return (
    <div className="flex flex-col gap-3 animate-pulse" role="status" aria-label="Sto caricando">
      {[88, 150, 120].map((h, i) => (
        <div key={i} style={{ height: h, background: t.carta, borderRadius: t.r, border: t.bordoCarta }}>
          <div className="m-4 h-3 w-24" style={{ background: t.velo, borderRadius: 99 }} />
          <div className="mx-4 h-6 w-36" style={{ background: t.velo, borderRadius: 99 }} />
        </div>
      ))}
    </div>
  )
}

export function Vuoto({ titolo, dettaglio }: { titolo: string; dettaglio?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center px-6">
      <span className="grid place-items-center w-12 h-12" style={{ background: t.velo, color: t.sub, borderRadius: 99 }}>
        <Inbox size={22} />
      </span>
      <p className="text-[15px] font-bold" style={{ color: t.inchiostro }}>{titolo}</p>
      {dettaglio && <p className="text-[13px] leading-snug" style={{ color: t.sub }}>{dettaglio}</p>}
    </div>
  )
}

export function Errore({ messaggio, riprova }: { messaggio: string; riprova?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-14 text-center px-6" role="alert">
      <span className="grid place-items-center w-12 h-12" style={{ background: t.terraTenue, color: t.rosso, borderRadius: 99 }}>
        <CircleAlert size={22} />
      </span>
      <p className="text-[15px] font-bold" style={{ color: t.inchiostro }}>Qualcosa non ha funzionato</p>
      <p className="text-[13px] leading-snug max-w-[36ch]" style={{ color: t.sub }}>
        {messaggio} I tuoi dati sono al sicuro: è solo la pagina che non li ha ricevuti.
      </p>
      {riprova && (
        <button onClick={riprova}
          className="mt-1 min-h-11 px-5 text-[14px] font-bold text-white inline-flex items-center gap-2"
          style={{ background: t.verde, borderRadius: t.rPill }}>
          <RotateCcw size={15} /> Riprova
        </button>
      )}
    </div>
  )
}
