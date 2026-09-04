// ============================================================================
// IMBUTO DELLE RICHIESTE: richieste → proposte inviate → confermate →
// rifiutate, per canale e per origine; motivi del rifiuto; tempo mediano di
// risposta (created_at → proposta_inviata_at); quota di composizioni manuali
// e di prezzi a mano fra le proposte inviate. Una richiesta «in attesa» non è
// mai una conferma. Il chiamante decide quali richieste passare (es. per mese
// di creazione).
// ============================================================================
import type { RichiestaStat } from './tipi.ts'

export type ContiImbuto = { richieste: number; proposteInviate: number; confermate: number; rifiutate: number; inAttesa: number }

const conti = (lista: RichiestaStat[]): ContiImbuto => ({
  richieste: lista.length,
  // proposta inviata almeno una volta: stato proposta_inviata oppure chiusa dopo una proposta
  proposteInviate: lista.filter(r => r.stato === 'proposta_inviata' || (!!r.proposta_inviata_at && (r.stato === 'confermata' || r.stato === 'rifiutata'))).length,
  confermate: lista.filter(r => r.stato === 'confermata').length,
  rifiutate: lista.filter(r => r.stato === 'rifiutata').length,
  inAttesa: lista.filter(r => r.stato === 'in_attesa').length,
})

function perChiave(lista: RichiestaStat[], chiave: (r: RichiestaStat) => string): Record<string, ContiImbuto> {
  const out: Record<string, ContiImbuto> = {}
  const gruppi = new Map<string, RichiestaStat[]>()
  for (const r of lista) { const k = chiave(r); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k)!.push(r) }
  for (const [k, v] of gruppi) out[k] = conti(v)
  return out
}

export function mediana(valori: number[]): number | null {
  if (valori.length === 0) return null
  const s = [...valori].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

export type Imbuto = {
  totale: ContiImbuto
  perCanale: Record<string, ContiImbuto>
  perOrigine: Record<string, ContiImbuto>      // richieste dal sito: origine (utm) o «diretto»
  motiviRifiuto: Record<string, number>
  tempoRispostaMedianoMinuti: number | null    // created_at → proposta_inviata_at
  proposteConSoluzione: number
  composizioniManuali: number
  prezziManuali: number
  quotaManualiPerMille: number                 // composizioni manuali / proposte con soluzione
  quotaPrezziManualiPerMille: number
}

export function imbutoRichieste(richieste: RichiestaStat[]): Imbuto {
  const tempi = richieste
    .filter(r => r.proposta_inviata_at && r.created_at)
    .map(r => Math.round((Date.parse(r.proposta_inviata_at!) - Date.parse(r.created_at)) / 60000))
    .filter(m => Number.isFinite(m) && m >= 0)
  const motivi: Record<string, number> = {}
  for (const r of richieste.filter(x => x.stato === 'rifiutata')) {
    const m = (r.motivo_rifiuto || 'non indicato').trim()
    motivi[m] = (motivi[m] ?? 0) + 1
  }
  const conSoluzione = richieste.filter(r => r.proposta_soluzione && (r.stato === 'proposta_inviata' || r.stato === 'confermata' || r.stato === 'rifiutata'))
  const manuali = conSoluzione.filter(r => r.proposta_soluzione?.manuale === true).length
  const prezzi = conSoluzione.filter(r => (r.proposta_soluzione?.segmenti ?? []).some(s => s.prezzo_manuale === true)).length
  return {
    totale: conti(richieste),
    perCanale: perChiave(richieste, r => r.canale || 'sconosciuto'),
    perOrigine: perChiave(richieste.filter(r => r.canale === 'web'), r => (r.origine || 'diretto').trim() || 'diretto'),
    motiviRifiuto: motivi,
    tempoRispostaMedianoMinuti: mediana(tempi),
    proposteConSoluzione: conSoluzione.length,
    composizioniManuali: manuali,
    prezziManuali: prezzi,
    quotaManualiPerMille: conSoluzione.length ? Math.round(manuali * 1000 / conSoluzione.length) : 0,
    quotaPrezziManualiPerMille: conSoluzione.length ? Math.round(prezzi * 1000 / conSoluzione.length) : 0,
  }
}
