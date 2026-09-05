// Sconti concessi nel periodo: valore a prezzo pieno, sconti, valore dopo
// sconto — attribuiti pro-quota alle notti dormite nel periodo, dal conto
// unico (lib/conto): con discount_type null lo sconto è SEMPRE zero. Solo
// prenotazioni confermate. Centesimi interi (arrotondamento sul prodotto).
import { contoSoggiorno } from '../conto.ts'
import { cent, prenotazioneValida, type PrenotazioneStat } from './tipi.ts'
import { nottiNellIntervallo, nottiTra } from './periodo.ts'

export type PrenotazioneSconto = PrenotazioneStat & {
  price_per_night?: number | string | null
  extra_bed_total?: number | string | null
  discount_type?: string | null
  discount_value?: number | string | null
}

export function scontiPeriodo(prenotazioni: PrenotazioneSconto[], da: string, a: string): { pienoCent: number; scontiCent: number; valoreCent: number } {
  let pieno = 0, sconti = 0, valore = 0
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const totN = nottiTra(b.check_in, b.check_out)
    if (totN <= 0) continue
    const nel = nottiNellIntervallo(b.check_in, b.check_out, da, a)
    if (nel <= 0) continue
    const v = cent(b.total_amount)
    const s = b.discount_type ? cent(contoSoggiorno(b).sconto) : 0
    valore += Math.round(v * nel / totN)
    sconti += Math.round(s * nel / totN)
    pieno += Math.round((v + s) * nel / totN)
  }
  return { pienoCent: pieno, scontiCent: sconti, valoreCent: valore }
}
