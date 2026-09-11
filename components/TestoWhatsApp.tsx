import { pezziWhatsApp } from '@/lib/testoWhatsApp'

// Mostra un testo di WhatsApp come lo vedrà l'ospite: *così* diventa
// grassetto, _così_ corsivo, gli a capo restano dove sono. Gli asterischi si
// vedono solo qui, cioè non si vedono: il testo vero — quello che parte su
// WhatsApp e quello che si copia — li conserva tutti.
//
// Serve per l'anteprima della proposta e per ogni altra anteprima di un
// messaggio WhatsApp nel gestionale. Le regole stanno in lib/testoWhatsApp.
export default function TestoWhatsApp({ testo, className = '' }: { testo: string | null | undefined; className?: string }) {
  return (
    <span className={`whitespace-pre-wrap ${className}`.trim()}>
      {pezziWhatsApp(testo).map((p, i) => {
        const contenuto = p.corsivo ? <em>{p.testo}</em> : p.testo
        return p.grassetto ? <strong key={i} className="font-bold">{contenuto}</strong> : <span key={i}>{contenuto}</span>
      })}
    </span>
  )
}
