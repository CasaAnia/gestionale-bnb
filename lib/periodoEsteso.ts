// ============================================================================
// IL PERIODO PER ESTESO della riga del periodo dal Mac (components/RigaPeriodo,
// Ania, 29/09/2026): il mese sempre per esteso.
//   «15 – 28 novembre 2026» · «27 settembre – 10 ottobre 2026»
//   «28 dicembre 2026 – 10 gennaio 2027» · a «Mese» «Novembre 2026»
//   un giorno solo: «martedì 29 settembre 2026»
// ============================================================================
import { MESI_LUNGHI, GIORNI_LUNGHI } from './dateItaliane.ts'

const pezzi = (iso: string) => { const [a, m, g] = iso.slice(0, 10).split('-').map(Number); return { a, m, g } }

export function giornoEsteso(iso: string): string {
  const { a, m, g } = pezzi(iso)
  if (!a || !m || !g) return ''
  return `${GIORNI_LUNGHI[new Date(a, m - 1, g).getDay()].toLowerCase()} ${g} ${MESI_LUNGHI[m - 1]} ${a}`
}

export function periodoEsteso(dal: string, al: string): string {
  if (!dal || !al) return ''
  if (dal === al) return giornoEsteso(dal)
  const d = pezzi(dal), z = pezzi(al)
  if (d.a === z.a && d.m === z.m) return `${d.g} – ${z.g} ${MESI_LUNGHI[z.m - 1]} ${z.a}`
  if (d.a === z.a) return `${d.g} ${MESI_LUNGHI[d.m - 1]} – ${z.g} ${MESI_LUNGHI[z.m - 1]} ${z.a}`
  return `${d.g} ${MESI_LUNGHI[d.m - 1]} ${d.a} – ${z.g} ${MESI_LUNGHI[z.m - 1]} ${z.a}`
}

/** «2026-11» (o una data del mese) → «Novembre 2026» */
export function meseEsteso(chiave: string): string {
  const { a, m } = pezzi(chiave.length === 7 ? `${chiave}-01` : chiave)
  if (!a || !m) return ''
  const nome = MESI_LUNGHI[m - 1]
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${a}`
}

/** «28 dic 2026 – 10 gen 2027»: il periodo scrive due anni (la riga del
 *  periodo del telefono lo scrive più piccolo, 20 px, perché stia su una riga) */
export const periodoAScavalloDAnno = (etichetta: string) => (etichetta.match(/\b\d{4}\b/g) ?? []).length > 1
