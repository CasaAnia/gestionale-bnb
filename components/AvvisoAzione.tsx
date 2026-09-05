// Messaggio vicino a un'azione che non è riuscita (salvataggio o lettura):
// testo verde scuro su crema, nessun colore acceso, mai alert del browser.
// Con `onRiprova` mostra anche il tasto per ripetere l'azione.
export default function AvvisoAzione({ testo, onRiprova, className }: { testo: string; onRiprova?: () => void; className?: string }) {
  return (
    <div role="alert" className={`scheda-in rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center justify-between gap-3 ${className || ''}`}
      style={{ background: '#F6F2EA', border: '1px solid #C9BFA8', color: '#1F3D2F' }}>
      <span>{testo}</span>
      {onRiprova && (
        <button type="button" onClick={onRiprova}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold shadow-sm transition-transform duration-100 active:scale-[0.97]"
          style={{ color: '#1F3D2F' }}>
          Riprova
        </button>
      )}
    </div>
  )
}
