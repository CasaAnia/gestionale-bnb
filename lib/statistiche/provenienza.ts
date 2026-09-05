// ============================================================================
// «DA DOVE ARRIVANO GLI OSPITI» (08/09/2026): per il periodo scelto, soggiorni
// confermati e ricavi per soggiorno (stessa definizione di lib/statistiche:
// competenza sulle notti dormite nel periodo) per provenienza — Altra
// struttura (con sotto ogni struttura), Google, Passaparola, Non so — e, a
// parte, «Già stati da noi» (cliente con un soggiorno concluso prima di questo
// arrivo). Un soggiorno = group_id (cambio camera contato una volta).
// ============================================================================
import { prenotazioneValida, type PrenotazioneStat } from './tipi.ts'
import { ricaviSoggiornoCent } from './intervallo.ts'
import { normalizzaProvenienza, ETICHETTA_PROVENIENZA, type Provenienza } from '../provenienza.ts'
import { eraGiaStato, type SoggiornoStorico } from '../clienteCheTorna.ts'

export type PrenotazioneProvenienza = PrenotazioneStat & SoggiornoStorico & { provenienza?: string | null; struttura_nome?: string | null }

export type RigaProvenienza = { chiave: string; label: string; soggiorni: number; ricaviCent: number; sotto?: RigaProvenienza[] }
export type DaDoveArrivano = { righe: RigaProvenienza[]; giaStati: RigaProvenienza; totale: RigaProvenienza; colonnePresenti: boolean }

const ORDINE: Provenienza[] = ['altra_struttura', 'google', 'passaparola', 'non_so']

export function daDoveArrivano(prenotazioni: PrenotazioneProvenienza[], storico: SoggiornoStorico[], da: string, a: string): DaDoveArrivano {
  const gruppi = new Map<string, PrenotazioneProvenienza[]>()
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const k = b.group_id || b.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  const somma = new Map<string, { soggiorni: number; ricaviCent: number }>()
  const aggiungi = (chiave: string, ricavi: number) => {
    const s = somma.get(chiave) ?? { soggiorni: 0, ricaviCent: 0 }
    somma.set(chiave, { soggiorni: s.soggiorni + 1, ricaviCent: s.ricaviCent + ricavi })
  }
  const strutture = new Map<string, string>()
  let colonnePresenti = false
  for (const segmenti of gruppi.values()) {
    const primo = [...segmenti].sort((x, y) => x.check_in.localeCompare(y.check_in))[0]
    const ricavi = ricaviSoggiornoCent(segmenti, da, a)
    if (ricavi === 0 && !segmenti.some(s => s.check_in < a && s.check_out > da)) continue
    if ('provenienza' in primo) colonnePresenti = true
    const p = normalizzaProvenienza(primo.provenienza)
    aggiungi(p, ricavi)
    if (p === 'altra_struttura' && primo.struttura_nome) {
      const nome = primo.struttura_nome.trim()
      const chiave = `struttura:${nome.toLowerCase()}`
      strutture.set(chiave, nome)
      aggiungi(chiave, ricavi)
    }
    if (eraGiaStato(primo, storico)) aggiungi('gia_stati', ricavi)
    aggiungi('totale', ricavi)
  }
  const riga = (chiave: string, label: string): RigaProvenienza => ({ chiave, label, soggiorni: somma.get(chiave)?.soggiorni ?? 0, ricaviCent: somma.get(chiave)?.ricaviCent ?? 0 })
  const righe = ORDINE.map(p => {
    const r = riga(p, ETICHETTA_PROVENIENZA[p])
    if (p === 'altra_struttura') {
      r.sotto = [...strutture.entries()].map(([k, nome]) => riga(k, nome)).sort((x, y) => y.soggiorni - x.soggiorni || y.ricaviCent - x.ricaviCent || x.label.localeCompare(y.label, 'it'))
    }
    return r
  })
  return { righe, giaStati: riga('gia_stati', 'Già stati da noi'), totale: riga('totale', 'Totale'), colonnePresenti }
}
