'use client'
// Valutazione del cliente (tre voci) + interruttore «Vuole ricevuta» a sé
// (08/09/2026, sera). Stesso stile dei bottoni esistenti; nessun colore nuovo.
import { VALUTAZIONI, ETICHETTA_RICEVUTA, type Valutazione } from '@/lib/valutazione'

export default function CampoValutazione({ valutazione, ricevuta, onChange, titolo = 'Valutazione cliente' }: {
  valutazione: Valutazione
  ricevuta: boolean
  onChange: (v: { valutazione: Valutazione; ricevuta: boolean }) => void
  titolo?: string | null
}) {
  return (
    <div data-valutazione={valutazione} data-ricevuta={ricevuta ? 'si' : 'no'}>
      <button type="button" role="switch" aria-checked={ricevuta} onClick={() => onChange({ valutazione, ricevuta: !ricevuta })}
        className="w-full flex items-center justify-between rounded-lg border border-card-border bg-white px-3 py-2 text-sm mb-3">
        <span className="font-medium text-green-dark">{ETICHETTA_RICEVUTA}</span>
        <span className={`relative inline-block w-10 h-6 rounded-full transition-colors ${ricevuta ? 'bg-green-mid' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ricevuta ? 'translate-x-4' : ''}`} />
        </span>
      </button>
      {titolo && <p className="text-sm font-semibold mb-2">{titolo}</p>}
      <div className="grid grid-cols-3 gap-2">
        {VALUTAZIONI.map(v => (
          <button key={v.chiave} type="button" onClick={() => onChange({ valutazione: v.chiave, ricevuta })} aria-pressed={valutazione === v.chiave}
            className={`text-xs py-2 px-3 rounded-lg font-medium border transition-colors ${valutazione === v.chiave ? 'bg-green-mid text-white border-green-mid' : 'bg-white text-gray-600 border-card-border'}`}>
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
