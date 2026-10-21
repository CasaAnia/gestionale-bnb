'use client'
// ============================================================================
// «QUESTO NUMERO È GIÀ IN ARCHIVIO» (21/10/2026).
// Quando si crea un cliente nuovo e il telefono scritto è già su una o più
// schede (anche salvato in un'altra forma: «+39 333…» contro «333…»), non si
// crea niente: qui compaiono le schede col numero uguale, da toccare per
// usarle. Con più schede sceglie Ania: nessuna associazione automatica.
// Stessa riga in Nuova prenotazione, «Cambia cliente» (foglio e pagina) e
// Nuovo cliente dalla pagina Clienti.
// ============================================================================
import { testoNumeroGiaInArchivio } from '@/lib/clienteTelefono'

export type SchedaStessoNumero = { id: string; full_name?: string | null; phone?: string | null }

export default function SchedeStessoNumero<T extends SchedaStessoNumero>({ schede, onScegli, azione = 'usa questa scheda', className = '' }: {
  schede: T[]
  onScegli: (scheda: T) => void
  azione?: string
  className?: string
}) {
  const testo = testoNumeroGiaInArchivio(schede)
  if (!testo) return null
  return (
    <div data-schede-stesso-numero className={className} role="alert">
      <p style={{ fontSize: 13, color: '#8C3B2E' }}>{testo}</p>
      <ul style={{ marginTop: 6 }}>
        {schede.map(s => (
          <li key={s.id} style={{ marginTop: 10 }}>
            {/* nome e numero su una riga, il comando sotto: sul telefono non esce dal bordo */}
            <span style={{ display: 'block', fontSize: 14, overflowWrap: 'anywhere' }}>{(s.full_name || '').trim() || 'senza nome'} · {s.phone || 'senza telefono'}</span>
            <button type="button" className="mz-lnk" style={{ marginTop: 6 }} data-scheda-stesso-numero={s.id} onClick={() => onScegli(s)}>{azione}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
