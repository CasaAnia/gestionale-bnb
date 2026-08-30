// ============================================================================
// 3.2B.1 — la Domanda rispetta il CONTESTO VISIBILE (periodo e persona
// selezionati), senza togliere al motore la capacità di capire mesi e
// persone nominati ESPLICITAMENTE nella domanda (che vincono e vengono
// indicati chiaramente nella risposta).
// ============================================================================
import type { ContestoDomanda } from './domanda.ts'
import { rispondi } from './domanda.ts'
import { MESI, strip } from './costanti.ts'
import type { Voce } from './types.ts'

export type SelezioneVisibile = {
  isMese: boolean
  periodStart: string
  periodEnd: string
  periodLabel: string
  personaNome: string | null     // nome del gruppo selezionato in "Di chi"
}

const nominaUnMese = (s: string) => MESI.some(m => s.includes(m))
const nominaSempre = (s: string) =>
  s.includes('sempre') || s.includes('in tutto') || s.includes('tutti gli scontrini') || s.includes('tutti i mesi')
const nominaUnaPersona = (s: string, gruppi: string[]) => gruppi.some(g => s.includes(strip(g)))

export function rispondiNelContesto(q: string, ctx: ContestoDomanda, sel: SelezioneVisibile): string {
  const s = strip(q)
  const esplicitoPeriodo = nominaUnMese(s) || nominaSempre(s)
  const esplicitaPersona = nominaUnaPersona(s, ctx.groups.map(g => g.name))

  // persona selezionata (se la domanda non ne nomina una): filtro a livello
  // di VOCE (riga), coerente col resto delle analisi
  const vociDi = !esplicitaPersona && sel.personaNome
    ? (spese: Parameters<ContestoDomanda['vociDi']>[0]): Voce[] =>
        ctx.vociDi(spese).filter(v => v.g === sel.personaNome)
    : ctx.vociDi

  // periodo: se la domanda non ne nomina uno e la selezione NON è il mese,
  // restringo le righe all'intervallo scelto e lascio lavorare il motore
  // "da sempre" su quell'intervallo (poi correggo l'etichetta)
  if (!esplicitoPeriodo && !sel.isMese) {
    const rows = ctx.rows.filter(r => r.expense_date >= sel.periodStart && r.expense_date <= sel.periodEnd)
    const risposta = rispondi(q + ' in tutto', { ...ctx, rows, vociDi })
    return risposta
      .replace(/^Da sempre/, `Nel periodo scelto (${sel.periodLabel})`)
      .replace(/Da sempre/g, `nel periodo scelto (${sel.periodLabel})`)
      + (sel.personaNome ? ` — sto guardando solo ${sel.personaNome}` : '')
  }

  const risposta = rispondi(q, { ...ctx, vociDi })
  return risposta + (!esplicitaPersona && sel.personaNome ? ` — sto guardando solo ${sel.personaNome}` : '')
}
