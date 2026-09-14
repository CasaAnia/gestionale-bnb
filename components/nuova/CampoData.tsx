'use client'
// ============================================================================
// IL CAMPO DATA (14/09/2026) — quello del telefono, vestito come le altre
// righe della pagina.
//
// Dentro c'è un <input type="date"> vero e proprio: si apre il calendario del
// telefono, non uno disegnato da noi, e non serve nessuna libreria. L'input
// sta sopra, trasparente e largo quanto la riga, così il tocco arriva a lui;
// sotto si legge la data in italiano, «gio 10 set», in 16 px semibold.
// ============================================================================
import { dataConGiorno } from '@/lib/dateItaliane'
import { RigaCampo } from './PezziNuova'

export const DATA_DA_SCEGLIERE = 'da scegliere'

export default function CampoData({ etichetta, valore, onValore, min, dati, className = '' }: {
  /** l'etichettina della riga: «Arrivo», «Partenza», «Entro il» */
  etichetta: string
  valore: string
  onValore: (v: string) => void
  /** la prima data scegliibile (la partenza non può venire prima dell'arrivo) */
  min?: string
  /** il data-campo per riconoscerlo: «arrivo», «partenza», «entro» */
  dati?: string
  className?: string
}) {
  return (
    <RigaCampo etichetta={etichetta} className={className}>
      <span className="relative block" style={{ marginTop: 3 }}>
        <span data-data-scritta style={{
          display: 'block', fontSize: 16, fontWeight: 600, lineHeight: '22px',
          color: valore ? 'var(--color-green-dark)' : 'var(--color-stone)',
        }}>{dataConGiorno(valore) || DATA_DA_SCEGLIERE}</span>
        {/* l'input vero: invisibile ma sopra, prende il tocco e apre il
            calendario del telefono. Niente riquadro, niente icona. */}
        <input type="date" data-campo={dati} value={valore} min={min}
          onChange={e => onValore(e.target.value)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, border: 'none', background: 'transparent', padding: 0, margin: 0,
            WebkitAppearance: 'none', appearance: 'none',
          }} />
      </span>
    </RigaCampo>
  )
}
