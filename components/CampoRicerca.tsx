'use client'
import { Search } from 'lucide-react'
// Campo «Cerca nome o telefono…» identico su Calendario, Arrivi e Richieste
// (05/09/2026): stesso bordo dei selettori (#C9BFA8), segnaposto color stone,
// ✕ per svuotare. Sul telefono dritto sta sotto il titolo a tutta larghezza;
// girato e sul Mac a destra del titolo.
// Veste «Maison» (Calendario, 29/09/2026): solo il filo sotto, la lente grigia
// a sinistra, testo 15 px, ✕ a destra quando c'è del testo. Stessa logica.
export default function CampoRicerca({ value, onChange, placeholder = 'Cerca nome o telefono…', className = '', maison = false }:
  { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; maison?: boolean }) {
  if (maison) {
    return (
      <div className={`cal-srch ${className}`} data-campo-ricerca="maison">
        <Search size={14} strokeWidth={1.6} aria-hidden />
        <input type="search" enterKeyHint="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        {value !== '' && <button type="button" className="x" onClick={() => onChange('')} aria-label="Chiudi ricerca">✕</button>}
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-2 min-w-0 border rounded-full px-3 py-1.5 ${className}`} style={{ borderColor: '#C9BFA8' }}>
      <Search size={15} strokeWidth={1.8} aria-hidden style={{ color: 'var(--color-stone)' }} />
      <input type="search" enterKeyHint="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-green-dark placeholder:text-stone [&::-webkit-search-cancel-button]:hidden" />
      {value !== '' && (
        <button type="button" onClick={() => onChange('')} aria-label="Chiudi ricerca"
          className="shrink-0 w-6 h-6 rounded-full bg-cream text-green-dark text-[12px] font-bold leading-none transition-transform duration-100 active:scale-[0.9]">✕</button>
      )}
    </div>
  )
}
