'use client'

// ============================================================================
// L'INTERRUTTORE A PILLOLA, UNO SOLO PER TUTTO IL GESTIONALE
// (Ania, dal telefono, 12/09/2026).
//
// «Mese | 2 settimane» del Calendario e «Reale | Presunta» delle Richieste
// devono essere lo STESSO oggetto: pillola col contorno d'ottone chiaro, fondo
// trasparente, la voce scelta in verde pieno col testo crema. Erano disegnati
// in due punti diversi e stavano divergendo: adesso il disegno sta qui e le
// due pagine lo usano, così non possono più allontanarsi.
//
// Misure (quelle del Calendario, che Ania ha approvato): contorno 1 px
// #C9BFA8, 2 px di bordo interno, parole 11 px semibold green-dark con 8 px
// ai lati e 4 sopra e sotto; la scelta su green-mid col testo crema.
// Dal Mac (`grande`) le parole sono un filo più larghe, come prima.
//
// L'area che si tocca è alta 44 px: il riempimento in più sta fuori dal
// disegno (margine negativo), così la pillola resta bassa com'è.
// ============================================================================

export const BORDO_PILLOLA = '#C9BFA8'
export const ALTEZZA_TOCCO = 44

export default function InterruttorePillola<T extends string>({ voci, scelta, onScegli, nome, dati, grande = false, className = '' }: {
  voci: readonly (readonly [T, string])[]
  scelta: T
  onScegli: (v: T) => void
  nome: string
  dati?: string
  grande?: boolean
  className?: string
}) {
  return (
    <div role="group" aria-label={nome} data-interruttore={dati}
      className={`inline-flex rounded-full border p-0.5 ${className}`} style={{ borderColor: BORDO_PILLOLA }}>
      {voci.map(([v, label]) => {
        const presa = scelta === v
        return (
          <button key={v} type="button" onClick={() => onScegli(v)} aria-pressed={presa}
            className="inline-flex items-center py-[10px] -my-[10px] rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid">
            <span className={`rounded-full whitespace-nowrap font-semibold transition-colors ${grande ? 'px-3 py-1 text-xs' : 'px-2 py-1 text-[11px]'} ${presa ? 'bg-green-mid text-cream-text' : 'text-green-dark'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
