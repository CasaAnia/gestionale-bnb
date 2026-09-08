// Nota scritta dal cliente nella richiesta (dal sito o a mano), Ania 07/09/2026:
// prima si leggeva SOLO dentro «Modifica la richiesta» e la nota di Silvana
// («arrivo dopo le 21 dell'11, partenza il 14 mattina») era invisibile.
// Riga sotto le date, nella scheda della richiesta, in cima alla pagina della
// proposta e in «Da controllare» in Home. Solo il contenuto della nota in
// ROSSO intenso (#C00000, più vivo del precedente #C0392B) da tutte le parti,
// così non sfugge (Ania, 08/09/2026). Senza nota
// non compare nulla.
// `piccola`: misura delle righe di «Da controllare» in Home (12,5 px)
export default function NotaCliente({ note, className = '', piccola = false }: { note: string | null | undefined; className?: string; piccola?: boolean }) {
  const testo = (note ?? '').trim()
  if (!testo) return null
  return (
    <p data-nota-cliente className={`${piccola ? 'text-[12.5px]' : 'text-sm'} text-stone leading-snug ${className}`}>
      Nota del cliente: <span className="font-semibold" style={{ color: '#C00000' }}>«{testo}»</span>
    </p>
  )
}
