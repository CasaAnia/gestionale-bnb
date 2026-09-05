'use client'
import type { Msg } from '@/lib/spese/types'

// Scheda 💬 Domanda: la chat sulle spese, con le domande veloci pronte.
// (Estratta da SpeseTracker.tsx in Fase 1: identica; il motore delle
// risposte vive in lib/spese/domanda.ts.)
export default function DomandaTab({ chat, domanda, setDomanda, domandeVeloci, onChiedi }: {
  chat: Msg[]
  domanda: string
  setDomanda: (v: string) => void
  domandeVeloci: string[]
  onChiedi: (q: string) => void
}) {
  return (
    <>
      <div className="flex flex-col gap-2.5 mb-3">
        {chat.length === 0 && (
          <div className="self-start max-w-[88%] bg-white border border-[#C9BFA8] shadow-sm rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed">
            Chiedimi quello che vuoi sulle vostre spese: una persona, una voce, un negozio, un mese… anche insieme. 💬
          </div>
        )}
        {chat.map((b, i) => (
          <div key={i} className={b.io
            ? 'self-end max-w-[88%] bg-green-mid text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed'
            : 'self-start max-w-[88%] bg-white border border-[#C9BFA8] shadow-sm rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed'}>
            {b.t}
          </div>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 mb-2">
        {domandeVeloci.map(q => (
          <button key={q} onClick={() => onChiedi(q)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm border bg-white text-green-mid border-card-border transition active:scale-[0.97]">
            {q}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={domanda} onChange={e => setDomanda(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onChiedi(domanda) }}
          placeholder="Scrivi (o detta) la domanda…"
          className="flex-1 border border-[#C9BFA8] shadow-sm rounded-xl p-2.5 text-sm bg-white" />
        <button onClick={() => onChiedi(domanda)} disabled={!domanda.trim()}
          className="bg-green-mid text-white rounded-xl px-4 font-bold disabled:opacity-40">➤</button>
      </div>
    </>
  )
}
