// Storico del cliente: «soggiorni» conta i SOGGIORNI (group_id), non le righe
// dei segmenti di un cambio camera; il totale speso è il valore delle
// prenotazioni confermate/completate; le annullate si contano a parte.
import { cent, prenotazioneValida, type PrenotazioneStat } from './tipi.ts'

export type StoricoCliente = { soggiorni: number; segmenti: number; totaleSpesoCent: number; annullate: number }

export function storicoCliente(prenotazioni: PrenotazioneStat[]): StoricoCliente {
  const valide = prenotazioni.filter(prenotazioneValida)
  const gruppi = new Set(valide.map(b => b.group_id || b.id))
  return {
    soggiorni: gruppi.size,
    segmenti: valide.length,
    totaleSpesoCent: valide.reduce((s, b) => s + cent(b.total_amount), 0),
    annullate: prenotazioni.filter(b => b.status === 'annullata').length,
  }
}
