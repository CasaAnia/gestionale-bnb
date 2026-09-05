'use client'
import type { MeseCliccabile } from '@/lib/mesiCliccabili'

// Riga «Oggi · set ott nov …» sotto i calendari, identica su Calendario,
// Arrivi e Richieste (05/09/2026): un tocco su un mese porta il calendario lì,
// il mese acceso segue quello che si sta guardando.
//
// Disposizione (richiesta di Ania, 05/09/2026, telefono e Mac, dritto e girato):
// «Oggi» sta FERMO, centrato esattamente sotto la colonna delle camere del
// calendario sopra (`colonna` = larghezza di quella colonna in px, più il
// bordo di 1 px del riquadro); il trattino sta proprio in fondo alla colonna,
// nel prolungamento della sua riga di separazione; i mesi scorrono di lato
// nello spazio che resta.
export const BORDO_RIQUADRO = 1
const COLORE_TRATTINO = '#D6CFBD'

export default function RigaMesi({ mesi, attivo, onMese, onOggi, nota, colonna, className = '' }:
  { mesi: MeseCliccabile[]; attivo?: string | null; onMese: (m: MeseCliccabile) => void; onOggi: () => void; nota?: string; colonna: number; className?: string }) {
  const larghezzaOggi = BORDO_RIQUADRO + colonna
  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative shrink-0 flex items-center justify-center self-stretch" style={{ width: larghezzaOggi, minWidth: larghezzaOggi }}>
        <button type="button" onClick={onOggi}
          className="rounded-full border border-green-mid bg-white text-green-mid text-[13px] font-bold px-3 py-1.5 active:bg-sage">Oggi</button>
        <span aria-hidden className="absolute top-1/2 -translate-y-1/2 right-0 h-5" style={{ width: 2, background: COLORE_TRATTINO }} />
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar pl-2">
        {mesi.map(m => (
          <span key={m.chiave} className="inline-flex items-center shrink-0">
            {m.nuovoAnno && <span className="font-serif text-[11px] text-brass px-2 tracking-wider">{m.anno}</span>}
            <button type="button" onClick={() => onMese(m)} aria-pressed={attivo === m.chiave}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${attivo === m.chiave ? 'bg-green-mid text-cream-text' : 'text-green-dark hover:bg-sage'}`}>{m.label}</button>
          </span>
        ))}
        {nota && <span className="shrink-0 text-[13px] text-stone ml-2">{nota}</span>}
      </div>
    </div>
  )
}
