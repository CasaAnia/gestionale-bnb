// ============================================================================
// INCASSI PER CASSA (quando i soldi arrivano), SPESE E SALDO — per mese.
// Regola già in produzione (buildReceipts del 24/07/2026): se una prenotazione
// ha righe in `payments`, contano quelle nel loro giorno; se non ne ha, si
// presume il saldo alla consegna delle chiavi (primo check-in) quando
// `pagato` è vero o l'arrivo è passato e non è un bonifico in attesa. Qui i
// due contributi restano DISTINTI (registrati / presunti) e le incoerenze fra
// `bookings.pagato` e le righe reali vengono segnalate, mai corrette.
// ============================================================================
import { cent, prenotazioneValida, type PagamentoStat, type PrenotazioneStat, type SpesaStat } from './tipi.ts'
import { nelMese } from './periodo.ts'

export type Incoerenza = {
  tipo: 'pagato_senza_righe' | 'pagato_ma_incompleto' | 'saldato_ma_non_segnato' | 'pagamenti_oltre_il_totale' | 'pagamento_senza_prenotazione'
  soggiorno: string           // group_id oppure id
  totaleCent: number
  pagatoCent: number
  nomi?: string
}

type Soggiorno = { chiave: string; segmenti: PrenotazioneStat[]; totaleCent: number; primoArrivo: string; pagato: boolean; bonifico: boolean; nomi: string }

function soggiorni(prenotazioni: PrenotazioneStat[]): Soggiorno[] {
  const gruppi = new Map<string, PrenotazioneStat[]>()
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const k = b.group_id || b.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  return [...gruppi.entries()].map(([chiave, segmenti]) => ({
    chiave, segmenti,
    totaleCent: segmenti.reduce((s, b) => s + cent(b.total_amount), 0),
    primoArrivo: segmenti.map(b => b.check_in).sort()[0],
    pagato: segmenti.some(b => !!b.pagato),
    bonifico: segmenti.some(b => !!b.bonifico),
    nomi: [...new Set(segmenti.map(b => b.guest_name).filter(Boolean))].join(', '),
  }))
}

export type IncassiMese = {
  mese: string
  registratiCent: number      // righe di payments con paid_on nel mese
  presuntiCent: number        // saldo alla consegna delle chiavi, senza righe
  totaleCent: number
  incoerenze: Incoerenza[]
}

export function incassiMese(mese: string, prenotazioni: PrenotazioneStat[], pagamenti: PagamentoStat[], oggi: string): IncassiMese {
  const perPrenotazione = new Map<string, PagamentoStat[]>()
  for (const p of pagamenti) { if (!perPrenotazione.has(p.booking_id)) perPrenotazione.set(p.booking_id, []); perPrenotazione.get(p.booking_id)!.push(p) }
  const idNoti = new Set(prenotazioni.map(b => b.id))
  let registrati = 0, presunti = 0
  const incoerenze: Incoerenza[] = []
  for (const s of soggiorni(prenotazioni)) {
    const righe = s.segmenti.flatMap(b => perPrenotazione.get(b.id) ?? [])
    const pagatoCent = righe.reduce((x, p) => x + cent(p.amount), 0)
    if (righe.length > 0) {
      registrati += righe.filter(p => nelMese(p.paid_on, mese)).reduce((x, p) => x + cent(p.amount), 0)
      if (pagatoCent > s.totaleCent) incoerenze.push({ tipo: 'pagamenti_oltre_il_totale', soggiorno: s.chiave, totaleCent: s.totaleCent, pagatoCent, nomi: s.nomi })
      else if (s.pagato && pagatoCent < s.totaleCent) incoerenze.push({ tipo: 'pagato_ma_incompleto', soggiorno: s.chiave, totaleCent: s.totaleCent, pagatoCent, nomi: s.nomi })
      else if (!s.pagato && pagatoCent === s.totaleCent && s.totaleCent > 0) incoerenze.push({ tipo: 'saldato_ma_non_segnato', soggiorno: s.chiave, totaleCent: s.totaleCent, pagatoCent, nomi: s.nomi })
    } else {
      const presunto = s.pagato || (!s.bonifico && s.primoArrivo <= oggi)
      if (presunto && nelMese(s.primoArrivo, mese)) presunti += s.totaleCent
      if (s.pagato) incoerenze.push({ tipo: 'pagato_senza_righe', soggiorno: s.chiave, totaleCent: s.totaleCent, pagatoCent: 0, nomi: s.nomi })
    }
  }
  for (const p of pagamenti) {
    if (!idNoti.has(p.booking_id)) incoerenze.push({ tipo: 'pagamento_senza_prenotazione', soggiorno: p.booking_id, totaleCent: 0, pagatoCent: cent(p.amount) })
  }
  return { mese, registratiCent: registrati, presuntiCent: presunti, totaleCent: registrati + presunti, incoerenze }
}

export function speseMeseCent(mese: string, spese: SpesaStat[]): number {
  return spese.filter(s => nelMese(s.expense_date, mese)).reduce((x, s) => x + cent(s.amount), 0)
}

export function saldoCassa(mese: string, prenotazioni: PrenotazioneStat[], pagamenti: PagamentoStat[], spese: SpesaStat[], oggi: string): { mese: string; incassiCent: number; speseCent: number; saldoCent: number; incoerenze: Incoerenza[] } {
  const inc = incassiMese(mese, prenotazioni, pagamenti, oggi)
  const sp = speseMeseCent(mese, spese)
  return { mese, incassiCent: inc.totaleCent, speseCent: sp, saldoCent: inc.totaleCent - sp, incoerenze: inc.incoerenze }
}
