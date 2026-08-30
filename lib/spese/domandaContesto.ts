// ============================================================================
// 3.2B.1 → 3.2B.2 — la Domanda rispetta il CONTESTO VISIBILE (periodo e
// persona selezionati), senza togliere al motore la capacità di capire mesi
// e persone nominati ESPLICITAMENTE nella domanda (che vincono).
// 3.2B.2: gli ALIAS delle etichette ("Teo" → gruppo Matteo, "M e A" →
// Matteo e Ania) valgono anche nella domanda; la nota "sto guardando solo…"
// indica la persona REALMENTE applicata (con la sua etichetta) e compare
// solo quando la domanda non ne nomina una — in ENTRAMBI i rami.
// ============================================================================
import type { ContestoDomanda } from './domanda.ts'
import { rispondi } from './domanda.ts'
import { etichettaPersona } from './adattatore.ts'
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

// le etichette mostrate a schermo valgono anche scritte nella domanda:
// il motore conosce i NOMI dei gruppi, qui si traducono gli alias
function traduciAlias(q: string, gruppi: string[]): string {
  let out = q
  if (gruppi.includes('Matteo e Ania')) out = out.replace(/\bM e A\b/gi, 'Matteo e Ania')
  if (gruppi.includes('Matteo')) out = out.replace(/\bTeo\b/gi, 'Matteo')
  return out
}

export function rispondiNelContesto(q: string, ctx: ContestoDomanda, sel: SelezioneVisibile): string {
  const gruppi = ctx.groups.map(g => g.name)
  const domanda = traduciAlias(q, gruppi)
  const s = strip(domanda)
  const esplicitoPeriodo = nominaUnMese(s) || nominaSempre(s)
  const esplicitaPersona = nominaUnaPersona(s, gruppi)

  // persona selezionata (se la domanda non ne nomina una): filtro a livello
  // di VOCE (riga), coerente col resto delle analisi
  const vociDi = !esplicitaPersona && sel.personaNome
    ? (spese: Parameters<ContestoDomanda['vociDi']>[0]): Voce[] =>
        ctx.vociDi(spese).filter(v => v.g === sel.personaNome)
    : ctx.vociDi
  const notaPersona = !esplicitaPersona && sel.personaNome
    ? ` — sto guardando solo ${etichettaPersona(sel.personaNome)}` : ''

  // periodo: se la domanda non ne nomina uno e la selezione NON è il mese,
  // restringo le righe all'intervallo scelto e lascio lavorare il motore
  // "da sempre" su quell'intervallo (poi correggo l'etichetta)
  if (!esplicitoPeriodo && !sel.isMese) {
    const rows = ctx.rows.filter(r => r.expense_date >= sel.periodStart && r.expense_date <= sel.periodEnd)
    const risposta = rispondi(domanda + ' in tutto', { ...ctx, rows, vociDi })
    return risposta
      .replace(/^Da sempre/, `Nel periodo scelto (${sel.periodLabel})`)
      .replace(/Da sempre/g, `nel periodo scelto (${sel.periodLabel})`)
      + notaPersona
  }

  return rispondi(domanda, { ...ctx, vociDi }) + notaPersona
}
