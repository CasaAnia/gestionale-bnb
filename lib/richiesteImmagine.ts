// Linea del soggiorno per l'immagine della proposta (pezzo 6): i segmenti
// disponibili come blocchi separati e le notti scoperte come spazi vuoti.
// Logica pura, condivisa fra testo e immagine: le date sono le stesse del
// messaggio (lib/richiesteTesti.dalAl) e un caso C non deve MAI sembrare un
// soggiorno continuo.
import { giorniTra } from './richiesteCalendario.ts'

export type BloccoSoggiorno<S> =
  | { tipo: 'camera'; segmento: S; arrivo: string; partenza: string; notti: number }
  | { tipo: 'vuoto'; arrivo: string; partenza: string; notti: string[] }

const giornoDopo = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)

// Segmenti (ordinati per arrivo) + notti non disponibili → blocchi in ordine di
// tempo. Le notti scoperte contigue formano un unico vuoto; il vuoto va da quella
// notte al giorno dopo l'ultima, così «dal 14 al 15 settembre» = 1 notte.
export function lineaSoggiorno<S extends { arrivo: string; partenza: string }>(segmenti: S[], nottiScoperte: string[]): BloccoSoggiorno<S>[] {
  const ordinati = [...segmenti].sort((a, b) => a.arrivo.localeCompare(b.arrivo))
  const blocchi: BloccoSoggiorno<S>[] = ordinati.map(s => ({ tipo: 'camera' as const, segmento: s, arrivo: s.arrivo, partenza: s.partenza, notti: giorniTra(s.arrivo, s.partenza).length }))
  const coperte = new Set(ordinati.flatMap(s => giorniTra(s.arrivo, s.partenza)))
  const scoperte = [...new Set(nottiScoperte)].filter(g => !coperte.has(g)).sort()
  let corrente: string[] = []
  const chiudi = () => {
    if (corrente.length === 0) return
    blocchi.push({ tipo: 'vuoto', arrivo: corrente[0], partenza: giornoDopo(corrente[corrente.length - 1]), notti: corrente })
    corrente = []
  }
  for (const g of scoperte) {
    if (corrente.length > 0 && giornoDopo(corrente[corrente.length - 1]) !== g) chiudi()
    corrente.push(g)
  }
  chiudi()
  return blocchi.sort((a, b) => a.arrivo.localeCompare(b.arrivo))
}
