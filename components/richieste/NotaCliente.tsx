// Nota scritta dal cliente nella richiesta (dal sito o a mano), Ania 07/09/2026:
// prima si leggeva SOLO dentro «Modifica la richiesta» e la nota di Silvana
// («arrivo dopo le 21 dell'11, partenza il 14 mattina») era invisibile.
// Riga sotto le date, nella riga della richiesta, in cima alla pagina della
// proposta e in «Da controllare» in Home. Solo il contenuto della nota in
// ROSSO intenso (#C00000, più vivo del precedente #C0392B) da tutte le parti,
// così non sfugge (Ania, 08/09/2026). Senza nota non compare nulla.
// `piccola`: misura delle righe di «Da controllare» in Home (12,5 px)
// `home`: la veste della Home (Ania, su bozza, 12/09/2026) — la nota è tutta
//   rossa, 13 px semibold, senza «Nota del cliente:» davanti. La usa la riga
//   della richiesta nell'elenco, che deve stare in circa 95 px.
export const ROSSO_NOTA = '#C00000'

export default function NotaCliente({ note, className = '', piccola = false, home = false }: { note: string | null | undefined; className?: string; piccola?: boolean; home?: boolean }) {
  const testo = (note ?? '').trim()
  if (!testo) return null
  if (home) {
    return (
      <p data-nota-cliente className={`text-[13px] leading-snug font-semibold ${className}`} style={{ color: ROSSO_NOTA }}>{testo}</p>
    )
  }
  return (
    <p data-nota-cliente className={`${piccola ? 'text-[12.5px]' : 'text-sm'} text-stone leading-snug ${className}`}>
      Nota del cliente: <span className="font-semibold" style={{ color: ROSSO_NOTA }}>«{testo}»</span>
    </p>
  )
}
