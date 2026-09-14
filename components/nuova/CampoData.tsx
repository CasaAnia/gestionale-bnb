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

/** Apre il selettore di data del sistema. Va chiamato dal TOCCO e solo da
 *  quello: senza il tocco i browser lo rifiutano, e chiamarlo anche sul fuoco
 *  lo riapriva appena si chiudeva, lasciando il campo come in trappola. */
export function apriSelettore(el: HTMLInputElement & { showPicker?: () => void }) {
  try { el.showPicker?.() } catch { /* già aperto, o browser che non lo permette */ }
}

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
        {/* L'input vero: invisibile ma sopra, prende il tocco. Sul telefono
            basta toccarlo; sul Mac, invece, toccare il testo di un campo data
            NON apre niente — si apre solo con l'iconcina del calendario, che
            qui è nascosta (Ania, 14/09/2026: «toccandole non succede nulla»).
            Perciò al tocco si chiede noi il selettore del sistema con
            showPicker(). Se il browser non ce l'ha resta il campo di prima.
            L'area del tocco sborda di 8 px sopra e sotto: prende tutta la
            riga, etichetta compresa. */}
        <input type="date" data-campo={dati} value={valore} min={min}
          onChange={e => onValore(e.target.value)}
          onClick={e => apriSelettore(e.currentTarget)}
          style={{
            position: 'absolute', top: -8, bottom: -8, left: 0, right: 0, width: '100%',
            opacity: 0, border: 'none', background: 'transparent', padding: 0, margin: 0,
            WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer',
          }} />
      </span>
    </RigaCampo>
  )
}
