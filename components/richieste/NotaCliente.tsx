// Nota scritta dal cliente nella richiesta (dal sito o a mano), Ania 07/09/2026:
// prima si leggeva SOLO dentro «Modifica la richiesta» e la nota di Silvana
// («arrivo dopo le 21 dell'11, partenza il 14 mattina») era invisibile.
// Riga discreta sotto le date, nella scheda della richiesta e in cima alla
// pagina della proposta. Senza nota non compare nulla.
export default function NotaCliente({ note, className = '' }: { note: string | null | undefined; className?: string }) {
  const testo = (note ?? '').trim()
  if (!testo) return null
  return (
    <p data-nota-cliente className={`text-sm text-green-dark leading-snug ${className}`}>
      <span className="text-stone">Nota del cliente:</span> «{testo}»
    </p>
  )
}
