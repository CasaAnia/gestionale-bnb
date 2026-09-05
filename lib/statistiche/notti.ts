// ============================================================================
// NOTTI VENDUTE, NOTTI DISPONIBILI, OCCUPAZIONE, ADR, RevPAR — per mese.
// Denominatore = camere ATTIVE × giorni del mese, meno le notti delle camere
// fuori servizio nel mese (mai «4 × giorni» fisso). Contano solo le
// prenotazioni confermate/completate. Denaro in centesimi.
// ============================================================================
import { cent, prenotazioneValida, type CameraStat, type FuoriServizio, type PrenotazioneStat } from './tipi.ts'
import { giorniDelMese, nottiNellIntervallo, nottiTra, primoGiorno, primoGiornoDopo } from './periodo.ts'

export function nottiDisponibili(mese: string, camere: CameraStat[], fuoriServizio: FuoriServizio[] = []): { totali: number; perCamera: Record<string, number>; chiuse: number } {
  const da = primoGiorno(mese), a = primoGiornoDopo(mese)
  const giorni = giorniDelMese(mese)
  const perCamera: Record<string, number> = {}
  let chiuse = 0
  for (const c of camere.filter(x => x.active !== false)) {
    const fs = fuoriServizio.filter(f => f.room_id === c.id).reduce((s, f) => s + nottiNellIntervallo(f.da, f.a, da, a), 0)
    const disponibili = Math.max(0, giorni - Math.min(giorni, fs))
    perCamera[c.id] = disponibili
    chiuse += giorni - disponibili
  }
  return { totali: Object.values(perCamera).reduce((s, n) => s + n, 0), perCamera, chiuse }
}

export function nottiVendute(mese: string, prenotazioni: PrenotazioneStat[]): { totali: number; perCamera: Record<string, number> } {
  const da = primoGiorno(mese), a = primoGiornoDopo(mese)
  const perCamera: Record<string, number> = {}
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const n = nottiNellIntervallo(b.check_in, b.check_out, da, a)
    if (n > 0) perCamera[b.room_id] = (perCamera[b.room_id] ?? 0) + n
  }
  return { totali: Object.values(perCamera).reduce((s, n) => s + n, 0), perCamera }
}

// Ricavo di COMPETENZA di una prenotazione nel mese: il totale diviso sulle
// notti, in centesimi interi, con il resto sulle prime notti (nessun float)
export function ricavoCompetenzaCent(b: PrenotazioneStat, mese: string): number {
  if (!prenotazioneValida(b)) return 0
  const notti = nottiTra(b.check_in, b.check_out)
  if (notti === 0) return 0
  const totale = cent(b.total_amount)
  const base = Math.floor(totale / notti), resto = totale - base * notti
  const da = primoGiorno(mese), a = primoGiornoDopo(mese)
  let somma = 0
  for (let i = 0; i < notti; i++) {
    const giorno = new Date(Date.parse(b.check_in + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)
    if (giorno >= da && giorno < a) somma += base + (i < resto ? 1 : 0)
  }
  return somma
}

export type IndiciMese = {
  mese: string
  nottiDisponibili: number
  nottiVendute: number
  nottiChiuse: number
  occupazionePerMille: number     // 0–1000 (es. 750 = 75,0 %)
  ricaviCompetenzaCent: number
  adrCent: number                 // ricavo medio per notte venduta
  revparCent: number              // ricavo per notte disponibile
}

export function indiciMese(mese: string, camere: CameraStat[], prenotazioni: PrenotazioneStat[], fuoriServizio: FuoriServizio[] = []): IndiciMese {
  const disp = nottiDisponibili(mese, camere, fuoriServizio)
  const vend = nottiVendute(mese, prenotazioni)
  const ricavi = prenotazioni.reduce((s, b) => s + ricavoCompetenzaCent(b, mese), 0)
  return {
    mese,
    nottiDisponibili: disp.totali,
    nottiVendute: vend.totali,
    nottiChiuse: disp.chiuse,
    occupazionePerMille: disp.totali > 0 ? Math.round(vend.totali * 1000 / disp.totali) : 0,
    ricaviCompetenzaCent: ricavi,
    adrCent: vend.totali > 0 ? Math.round(ricavi / vend.totali) : 0,
    revparCent: disp.totali > 0 ? Math.round(ricavi / disp.totali) : 0,
  }
}
