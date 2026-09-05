// «Segna come pagato» e coerenza fra il flag `pagato` e i movimenti di
// `payments`. Il movimento del saldo = totale del soggiorno (tutti i
// segmenti di un cambio camera) meno i movimenti già registrati; se non resta
// nulla, si aggiorna solo il flag. Le incongruenze si elencano, mai correggono.
import { cent, prenotazioneValida, type PagamentoStat, type PrenotazioneStat } from './tipi.ts'
import { incassiMese, type Incoerenza } from './cassa.ts'

export type MetodoPagamento = 'contanti' | 'bonifico' | 'carta' | 'altro'
export const METODI_PAGAMENTO: { chiave: MetodoPagamento; label: string }[] = [
  { chiave: 'contanti', label: 'Contanti' },
  { chiave: 'bonifico', label: 'Bonifico' },
  { chiave: 'carta', label: 'Carta' },
  { chiave: 'altro', label: 'Altro' },
]

// Quanto manca al saldo, in centesimi (0 se già coperto o oltre)
export function saldoMancanteCent(segmenti: PrenotazioneStat[], pagamenti: PagamentoStat[]): number {
  const ids = new Set(segmenti.map(b => b.id))
  const totale = segmenti.reduce((s, b) => s + cent(b.total_amount), 0)
  const registrati = pagamenti.filter(p => ids.has(p.booking_id)).reduce((s, p) => s + cent(p.amount), 0)
  return Math.max(0, totale - registrati)
}

// Il movimento da scrivere prima del flag: null se non c'è saldo da registrare
export function movimentoSaldo(segmenti: PrenotazioneStat[], pagamenti: PagamentoStat[], oggi: string, metodo: MetodoPagamento, bookingId: string): { booking_id: string; amount: number; method: MetodoPagamento; paid_on: string } | null {
  const mancante = saldoMancanteCent(segmenti, pagamenti)
  if (mancante <= 0) return null
  return { booking_id: bookingId, amount: mancante / 100, method: metodo, paid_on: oggi }
}

export type Incongruenza = Incoerenza

// Pagato senza movimenti, pagato ma incompleto, saldato ma non segnato,
// movimenti sopra il totale, movimento senza prenotazione. Indipendente dal mese.
export function incongruenzePagamenti(prenotazioni: PrenotazioneStat[], pagamenti: PagamentoStat[]): Incongruenza[] {
  return incassiMese('1970-01', prenotazioni.filter(prenotazioneValida), pagamenti, '1970-01-01').incoerenze
}
