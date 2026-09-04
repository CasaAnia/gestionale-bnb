'use client'
// Campo «Cerca nome o telefono…» identico su Calendario, Arrivi e Richieste
// (05/09/2026): stesso bordo dei selettori (#C9BFA8), segnaposto color stone,
// ✕ per svuotare. Sul telefono dritto sta sotto il titolo a tutta larghezza;
// girato e sul Mac a destra del titolo.
export default function CampoRicerca({ value, onChange, placeholder = 'Cerca nome o telefono…', className = '' }:
  { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 bg-white border rounded-full px-3 py-1.5 ${className}`} style={{ borderColor: '#C9BFA8' }}>
      <span aria-hidden className="text-[13px]">🔎</span>
      <input type="search" enterKeyHint="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-green-dark placeholder:text-stone [&::-webkit-search-cancel-button]:hidden" />
      {value !== '' && (
        <button type="button" onClick={() => onChange('')} aria-label="Chiudi ricerca"
          className="shrink-0 w-6 h-6 rounded-full bg-cream text-green-dark text-[12px] font-bold leading-none transition-transform duration-100 active:scale-[0.9]">✕</button>
      )}
    </div>
  )
}
