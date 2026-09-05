// ============================================================================
// SIGNIFICATI SEPARATI su un intervallo [da, a) di giorni ISO — «Statistiche,
// numeri corretti» (05/09/2026). Sono le QUATTRO voci mostrate identiche in
// Home e Statistiche:
//   - Ricavi per soggiorno: valore delle prenotazioni confermate ripartito
//     sulle notti dormite (competenza), in centesimi interi;
//   - Incassi: movimenti di `payments` per data di pagamento (paid_on);
//   - Spese: per data di pagamento della spesa (paid_at, altrimenti expense_date);
//   - Saldo di cassa: incassi meno spese dello stesso intervallo.
// Più: notti vendute/vendibili con le camere ATTIVE (mai «4 × giorni»),
// occupazione con anomalia sopra il 100 %, ADR, RevPAR, notti libere,
// camere occupate oggi, soggiorni da incassare. Contano solo le prenotazioni
// confermate/completate: in_attesa e annullate mai. Nessun import di Supabase.
// ============================================================================
import { cent, prenotazioneValida, type CameraStat, type FuoriServizio, type PagamentoStat, type PrenotazioneStat } from './tipi.ts'
import { nottiNellIntervallo, nottiTra, spostaGiorni } from './periodo.ts'

export type Intervallo = { da: string; a: string }   // [da, a)

export type SpesaPagata = { expense_date: string; amount: number | string; paid_at?: string | null }

export const dataPagamentoSpesa = (s: SpesaPagata): string => s.paid_at || s.expense_date

const dentro = (giorno: string | null | undefined, da: string, a: string) => !!giorno && giorno >= da && giorno < a

// Ricavo di competenza di una prenotazione notte per notte: totale diviso
// sulle notti in centesimi interi, resto sulle prime notti (mai un float).
export function ricavoPerNotteCent(b: PrenotazioneStat): { giorno: string; cent: number }[] {
  if (!prenotazioneValida(b)) return []
  const notti = nottiTra(b.check_in, b.check_out)
  if (notti === 0) return []
  const totale = cent(b.total_amount)
  const base = Math.floor(totale / notti), resto = totale - base * notti
  const out: { giorno: string; cent: number }[] = []
  for (let i = 0; i < notti; i++) out.push({ giorno: spostaGiorni(b.check_in, i), cent: base + (i < resto ? 1 : 0) })
  return out
}

// --- le quattro voci ---------------------------------------------------------

export function ricaviSoggiornoCent(prenotazioni: PrenotazioneStat[], da: string, a: string): number {
  let somma = 0
  for (const b of prenotazioni) for (const n of ricavoPerNotteCent(b)) if (dentro(n.giorno, da, a)) somma += n.cent
  return somma
}

export function incassiCent(pagamenti: PagamentoStat[], da: string, a: string): number {
  return pagamenti.filter(p => dentro(p.paid_on, da, a)).reduce((s, p) => s + cent(p.amount), 0)
}

export function speseCent(spese: SpesaPagata[], da: string, a: string): number {
  return spese.filter(s => dentro(dataPagamentoSpesa(s), da, a)).reduce((x, s) => x + cent(s.amount), 0)
}

export type Cassa = { ricaviCent: number; incassiCent: number; speseCent: number; saldoCent: number }

export function cassaIntervallo(prenotazioni: PrenotazioneStat[], pagamenti: PagamentoStat[], spese: SpesaPagata[], da: string, a: string): Cassa {
  const ricavi = ricaviSoggiornoCent(prenotazioni, da, a)
  const incassi = incassiCent(pagamenti, da, a)
  const sp = speseCent(spese, da, a)
  return { ricaviCent: ricavi, incassiCent: incassi, speseCent: sp, saldoCent: incassi - sp }
}

// --- notti, occupazione, indici ---------------------------------------------

export const giorniIntervallo = (da: string, a: string) => Math.max(0, nottiTra(da, a))

// Notti vendibili = per ogni giorno le camere attive, meno le notti fuori
// servizio (struttura FuoriServizio, oggi vuota: vedi docs/bozza-room_closures.sql)
export function nottiVendibili(da: string, a: string, camere: CameraStat[], fuoriServizio: FuoriServizio[] = []): { totali: number; perCamera: Record<string, number> } {
  const giorni = giorniIntervallo(da, a)
  const perCamera: Record<string, number> = {}
  for (const c of camere.filter(x => x.active !== false)) {
    const chiuse = fuoriServizio.filter(f => f.room_id === c.id).reduce((s, f) => s + nottiNellIntervallo(f.da, f.a, da, a), 0)
    perCamera[c.id] = Math.max(0, giorni - Math.min(giorni, chiuse))
  }
  return { totali: Object.values(perCamera).reduce((s, n) => s + n, 0), perCamera }
}

export function nottiVenduteIntervallo(da: string, a: string, prenotazioni: PrenotazioneStat[]): { totali: number; perCamera: Record<string, number> } {
  const perCamera: Record<string, number> = {}
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const n = nottiNellIntervallo(b.check_in, b.check_out, da, a)
    if (n > 0) perCamera[b.room_id] = (perCamera[b.room_id] ?? 0) + n
  }
  return { totali: Object.values(perCamera).reduce((s, n) => s + n, 0), perCamera }
}

export const TESTO_ANOMALIA_OCCUPAZIONE = 'sovrapposizione da controllare'

export type Occupazione = {
  nottiVendute: number
  nottiVendibili: number
  nottiLibere: number
  perMille: number          // vendute / vendibili in ‰ (può superare 1000)
  percento: number          // arrotondato, NON bloccato a 100
  anomalia: boolean         // vendute > vendibili → «sovrapposizione da controllare»
}

export function occupazioneIntervallo(da: string, a: string, camere: CameraStat[], prenotazioni: PrenotazioneStat[], fuoriServizio: FuoriServizio[] = []): Occupazione {
  const vendibili = nottiVendibili(da, a, camere, fuoriServizio).totali
  const vendute = nottiVenduteIntervallo(da, a, prenotazioni).totali
  const perMille = vendibili > 0 ? Math.round(vendute * 1000 / vendibili) : 0
  return {
    nottiVendute: vendute,
    nottiVendibili: vendibili,
    nottiLibere: Math.max(0, vendibili - vendute),
    perMille,
    percento: Math.round(perMille / 10),
    anomalia: vendibili > 0 && vendute > vendibili,
  }
}

// Indici del periodo (per l'incarico successivo): occupazione = notti vendute
// ÷ notti vendibili; ADR = ricavi camere ÷ notti vendute; RevPAR = ricavi
// camere ÷ notti vendibili; notti libere = vendibili − vendute.
export type IndiciIntervallo = Occupazione & { ricaviCent: number; adrCent: number; revparCent: number }

export function indiciIntervallo(da: string, a: string, camere: CameraStat[], prenotazioni: PrenotazioneStat[], fuoriServizio: FuoriServizio[] = []): IndiciIntervallo {
  const occ = occupazioneIntervallo(da, a, camere, prenotazioni, fuoriServizio)
  const ricavi = ricaviSoggiornoCent(prenotazioni, da, a)
  return {
    ...occ,
    ricaviCent: ricavi,
    adrCent: occ.nottiVendute > 0 ? Math.round(ricavi / occ.nottiVendute) : 0,
    revparCent: occ.nottiVendibili > 0 ? Math.round(ricavi / occ.nottiVendibili) : 0,
  }
}

// Camere occupate in una notte (quella di `giorno`): prenotazioni valide che la coprono
export function camereOccupate(giorno: string, prenotazioni: PrenotazioneStat[]): number {
  return new Set(prenotazioni.filter(b => prenotazioneValida(b) && b.check_in <= giorno && b.check_out > giorno).map(b => b.room_id)).size
}

// --- da incassare -------------------------------------------------------------

export type DaIncassare = { id: string; chiave: string; nomi: string; dovutoCent: number; ricevutoCent: number; residuoCent: number }

// Soggiorni (group_id) con movimenti registrati ma non ancora saldati: residuo
// sopra i 50 centesimi. I segmenti di un cambio camera sono un unico soggiorno.
export function daIncassare(prenotazioni: PrenotazioneStat[], pagamenti: PagamentoStat[]): DaIncassare[] {
  const perPrenotazione = new Map<string, number>()
  for (const p of pagamenti) perPrenotazione.set(p.booking_id, (perPrenotazione.get(p.booking_id) ?? 0) + cent(p.amount))
  const gruppi = new Map<string, PrenotazioneStat[]>()
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const k = b.group_id || b.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  const out: DaIncassare[] = []
  for (const [chiave, segmenti] of gruppi) {
    const ordinati = [...segmenti].sort((x, y) => x.check_in.localeCompare(y.check_in))
    const dovuto = segmenti.reduce((s, b) => s + cent(b.total_amount), 0)
    const ricevuto = segmenti.reduce((s, b) => s + (perPrenotazione.get(b.id) ?? 0), 0)
    const residuo = dovuto - ricevuto
    if (ricevuto > 0 && residuo > 50) out.push({ id: ordinati[0].id, chiave, nomi: [...new Set(segmenti.map(b => b.guest_name).filter(Boolean))].join(', '), dovutoCent: dovuto, ricevutoCent: ricevuto, residuoCent: residuo })
  }
  return out.sort((x, y) => y.residuoCent - x.residuoCent)
}
