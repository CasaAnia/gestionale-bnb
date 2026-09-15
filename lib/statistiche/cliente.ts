// Storico del cliente: «soggiorni» conta i SOGGIORNI, non le righe. Un
// soggiorno è quello del conto unico: prenotazione_id, se manca group_id, se
// manca la riga da sola (corretto il 15/09/2026).
// dei segmenti di un cambio camera; il totale speso è il valore delle
// prenotazioni confermate/completate; le annullate si contano a parte.
import { cent, identitaSoggiorno, prenotazioneValida, type PrenotazioneStat } from './tipi.ts'

export type StoricoCliente = { soggiorni: number; segmenti: number; totaleSpesoCent: number; annullate: number }

export function storicoCliente(prenotazioni: PrenotazioneStat[]): StoricoCliente {
  const valide = prenotazioni.filter(prenotazioneValida)
  const gruppi = new Set(valide.map(identitaSoggiorno))
  return {
    soggiorni: gruppi.size,
    segmenti: valide.length,
    totaleSpesoCent: valide.reduce((s, b) => s + cent(b.total_amount), 0),
    annullate: prenotazioni.filter(b => b.status === 'annullata').length,
  }
}
