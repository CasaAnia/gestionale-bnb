import { Clock } from 'lucide-react'
import { scadenzaProposta, type Richiesta } from '@/lib/richieste'

// Riga del timer della proposta (3 ore dal «Sì, inviata»), sotto i dettagli:
// icona orologio + «Proposta inviata · scade tra 2 h 15 min» in verde finché
// manca tempo, «Proposta inviata · scaduta 20 min fa» in ottone dopo. Sulle
// richieste in attesa non disegna nulla. `adesso` arriva da useAdesso, così il
// testo si aggiorna ogni minuto senza ricaricare.
export default function RigaScadenza({ r, adesso, className = '' }: { r: Pick<Richiesta, 'stato' | 'proposta_inviata_at'>; adesso: Date; className?: string }) {
  const s = scadenzaProposta(r, adesso)
  if (!s) return null
  return (
    <p className={`inline-flex items-center gap-1.5 text-[13px] font-semibold leading-snug ${s.scaduta ? 'text-brass' : 'text-green-mid'} ${className}`}>
      <Clock size={13} strokeWidth={2} aria-hidden className="shrink-0" />
      <span>{s.testo}</span>
    </p>
  )
}
