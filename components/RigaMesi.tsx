'use client'
import type { MeseCliccabile } from '@/lib/mesiCliccabili'

// Riga «Oggi · set ott nov …» sotto i calendari, identica su Calendario,
// Arrivi e Richieste (05/09/2026): un tocco su un mese porta il calendario lì,
// il mese acceso segue quello che si sta guardando. Scorre di lato se non ci sta.
export default function RigaMesi({ mesi, attivo, onMese, onOggi, nota, className = '' }:
  { mesi: MeseCliccabile[]; attivo?: string | null; onMese: (m: MeseCliccabile) => void; onOggi: () => void; nota?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar ${className}`}>
      <button type="button" onClick={onOggi}
        className="shrink-0 rounded-full border border-green-mid bg-white text-green-mid text-[13px] font-bold px-3.5 py-1.5 active:bg-sage">Oggi</button>
      <span className="shrink-0 w-px h-5 mx-2" style={{ background: '#D6CFBD' }} />
      {mesi.map(m => (
        <span key={m.chiave} className="inline-flex items-center shrink-0">
          {m.nuovoAnno && <span className="font-serif text-[11px] text-brass px-2 tracking-wider">{m.anno}</span>}
          <button type="button" onClick={() => onMese(m)} aria-pressed={attivo === m.chiave}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${attivo === m.chiave ? 'bg-green-mid text-cream-text' : 'text-green-dark hover:bg-sage'}`}>{m.label}</button>
        </span>
      ))}
      {nota && <span className="shrink-0 text-[13px] text-stone ml-2">{nota}</span>}
    </div>
  )
}
