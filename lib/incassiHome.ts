// ============================================================================
// I SOLDI NELLA HOME «MAISON» (riferimento approvato da Ania il 28/09/2026):
// «Da incassare» con stato, come paga, totale, ricevuti e residuo; «Incassati
// oggi»; le partenze di oggi con un residuo da incassare. Puro, si prova in
// Node. Chi entra in «Da incassare» e con quali cifre lo decide ANCORA
// lib/statistiche.daIncassare (stessa regola di prima, la somma nei numeri
// in cima è la sua): qui si aggiungono solo le parole per la veste nuova.
// ============================================================================
import { daIncassare, cent, identitaSoggiorno, type PagamentoStat, type PrenotazioneStat } from './statistiche/index.ts'
import { nomeConAltri } from './guestName.ts'
import { periodoCompatto, giornoMese } from './dateItaliane.ts'
import { comePagaInParole } from './comePaga.ts'

export type PrenotazioneIncasso = PrenotazioneStat & {
  guest_name?: string | null
  rooms?: { name?: string | null } | null
  guests?: { full_name?: string | null; phone?: string | null } | null
  bonifico?: boolean | null
  accordo_pagamento?: string | null
  group_id?: string | null
}
export type PagamentoIncasso = PagamentoStat & { method?: string | null; paid_on?: string | null }

export type VoceIncasso = {
  id: string
  chiave: string
  nome: string
  camere: string
  date: string
  /** «Partita oggi · bonifico», «In casa · contanti» */
  stato: string
  totaleCent: number
  ricevutiCent: number
  residuoCent: number
  /** «acconto del 20 set» se è arrivato un pagamento solo */
  acconto: string | null
  telefono: string | null
  /** l'accordo aspetta un bonifico: il foglio propone «Bonifico» */
  bonifico: boolean
}

const breve = (nome: string | null | undefined) => String(nome ?? '').split(' ').slice(-1)[0]
// La stessa chiave di «Da incassare»: la prenotazione intera (regola fissa n. 9)
const chiaveDi = identitaSoggiorno
const valida = (b: PrenotazioneIncasso) => b.status === 'confermata' || b.status === 'completata'

/** «Partita oggi», «Partita il 25 set», «In casa», «Arriva il 2 ott» */
export function statoSoggiorno(arrivo: string, partenza: string, oggi: string): string {
  if (partenza === oggi) return 'Partita oggi'
  if (partenza < oggi) return `Partita il ${giornoMese(partenza)}`
  if (arrivo > oggi) return `Arriva il ${giornoMese(arrivo)}`
  return 'In casa'
}

/** «bonifico», «contanti», «caparra del 50%»: il modo in parole, minuscolo */
export const comePagaBreve = (accordo: string | null | undefined, bonifico?: boolean | null) =>
  comePagaInParole(accordo, bonifico).nome.toLowerCase()

/** Le camere nell'ordine del soggiorno: «Amelia», «Lena → Ambra» */
export function camereInFila(segmenti: PrenotazioneIncasso[]): string {
  const nomi: string[] = []
  for (const s of [...segmenti].sort((a, z) => a.check_in.localeCompare(z.check_in))) {
    const n = breve(s.rooms?.name)
    if (n && nomi[nomi.length - 1] !== n) nomi.push(n)
  }
  return nomi.join(' → ')
}

export function vociDaIncassare(prenotazioni: PrenotazioneIncasso[], pagamenti: PagamentoIncasso[], oggi: string): VoceIncasso[] {
  const gruppi = new Map<string, PrenotazioneIncasso[]>()
  for (const b of prenotazioni.filter(valida)) {
    const k = chiaveDi(b)
    if (!gruppi.has(k)) gruppi.set(k, [])
    if (!gruppi.get(k)!.some(x => x.id === b.id)) gruppi.get(k)!.push(b)
  }
  return daIncassare(prenotazioni as PrenotazioneStat[], pagamenti).map(d => {
    const segmenti = (gruppi.get(d.chiave) ?? []).sort((a, z) => a.check_in.localeCompare(z.check_in))
    const primo = segmenti[0] ?? (prenotazioni.find(b => b.id === d.id) as PrenotazioneIncasso)
    const arrivo = segmenti.reduce((m, s) => (s.check_in < m ? s.check_in : m), primo.check_in)
    const partenza = segmenti.reduce((m, s) => (s.check_out > m ? s.check_out : m), primo.check_out)
    const ids = new Set(segmenti.map(s => s.id))
    const suoi = pagamenti.filter(p => ids.has(p.booking_id))
    const accordo = segmenti.find(s => s.accordo_pagamento != null) ?? primo
    return {
      id: d.id, chiave: d.chiave, nome: nomeConAltri(primo) || d.nomi || 'Ospite',
      camere: camereInFila(segmenti.length ? segmenti : [primo]),
      date: periodoCompatto(arrivo, partenza),
      stato: `${statoSoggiorno(arrivo, partenza, oggi)} · ${comePagaBreve(accordo.accordo_pagamento, accordo.bonifico)}`,
      totaleCent: d.dovutoCent, ricevutiCent: d.ricevutoCent, residuoCent: d.residuoCent,
      acconto: suoi.length === 1 && suoi[0].paid_on ? `acconto del ${giornoMese(suoi[0].paid_on)}` : null,
      telefono: primo.guests?.phone?.trim() || null,
      bonifico: !!accordo.bonifico,
    }
  })
}

/** «Totale 360 € · ricevuti 120 € (acconto del 20 set) · resta» — la cifra che resta la mette la pagina, in mattone */
export function rigaConto(v: Pick<VoceIncasso, 'totaleCent' | 'ricevutiCent' | 'acconto'>, euro: (c: number) => string): string {
  return `Totale ${euro(v.totaleCent)} · ricevuti ${euro(v.ricevutiCent)}${v.acconto ? ` (${v.acconto})` : ''} · resta`
}

// ── Le partenze di oggi con un residuo (La giornata, punto 9b) ────────────
export type PartenzaConResiduo = { id: string; nome: string; camera: string; residuoCent: number; bonifico: boolean; booking: PrenotazioneIncasso }

/** Soltanto chi parte oggi e ha ancora qualcosa da pagare: le partenze saldate non compaiono. */
export function partenzeConResiduo(partenzeOggi: PrenotazioneIncasso[], prenotazioni: PrenotazioneIncasso[], pagamenti: PagamentoIncasso[]): PartenzaConResiduo[] {
  const out: PartenzaConResiduo[] = []
  for (const b of partenzeOggi) {
    const k = chiaveDi(b)
    const segmenti = [b, ...prenotazioni.filter(x => x.id !== b.id && valida(x) && chiaveDi(x) === k)]
    const ids = new Set(segmenti.map(s => s.id))
    const dovuto = segmenti.reduce((s, x) => s + cent(x.total_amount), 0)
    const ricevuto = pagamenti.filter(p => ids.has(p.booking_id)).reduce((s, p) => s + cent(p.amount), 0)
    const residuo = dovuto - ricevuto
    if (residuo <= 50) continue
    const accordo = segmenti.find(s => s.accordo_pagamento != null) ?? b
    out.push({ id: b.id, nome: nomeConAltri(b), camera: breve(b.rooms?.name), residuoCent: residuo, bonifico: !!accordo.bonifico || comePagaBreve(accordo.accordo_pagamento, accordo.bonifico) === 'bonifico', booking: b })
  }
  return out
}
export const BONIFICO_ATTESO = 'Bonifico atteso'
export const PAGAMENTO_ATTESO = 'Pagamento atteso'
export const SEGNA_PAGATO = 'Segna pagato'

// ── Incassati oggi ────────────────────────────────────────────────────────
export type IncassoOggi = { id: string; bookingId: string; nome: string; testo: string; importoCent: number }
const metodoInParole = (m: string | null | undefined) => {
  const v = (m ?? '').trim()
  return v === 'bonifico' ? 'bonifico' : v === 'carta' ? 'carta' : v === 'altro' ? 'altro' : 'contanti'
}

/** I pagamenti registrati con la data di oggi: «Giovanni Serra — contanti · saldo completo · 160 €» */
export function incassatiOggi(prenotazioni: PrenotazioneIncasso[], pagamenti: (PagamentoIncasso & { id?: string })[], oggi: string): IncassoOggi[] {
  return pagamenti.filter(p => p.paid_on === oggi).map((p, i) => {
    const b = prenotazioni.find(x => x.id === p.booking_id)
    const k = b ? chiaveDi(b) : p.booking_id
    const segmenti = b ? prenotazioni.filter(x => valida(x) && chiaveDi(x) === k) : []
    const ids = new Set(segmenti.map(s => s.id))
    const dovuto = segmenti.reduce((s, x) => s + cent(x.total_amount), 0)
    const ricevuto = pagamenti.filter(q => ids.has(q.booking_id)).reduce((s, q) => s + cent(q.amount), 0)
    const saldato = segmenti.length > 0 && dovuto - ricevuto <= 50
    return { id: p.id ?? `${p.booking_id}:${i}`, bookingId: p.booking_id, nome: b ? nomeConAltri(b) : 'Ospite', testo: `${metodoInParole(p.method)} · ${saldato ? 'saldo completo' : 'acconto'}`, importoCent: cent(p.amount) }
  })
}
