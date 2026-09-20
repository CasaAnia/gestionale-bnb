// ============================================================================
// IL PAGAMENTO SI DIVIDE FRA LE PARTI DEL SOGGIORNO (Ania, 20/09/2026, regola
// fissa n. 9): con un cambio camera o una camera aggiunta la prenotazione ha
// più tratti in fila; un pagamento che non copre tutto va DIVISO in ordine di
// tempo: prima si salda del tutto la prima parte, poi con il resto si passa
// alla parte dopo, e così via finché tutto il soggiorno è coperto.
//
// Il caso di Rosa Macauda: due pagamenti da 400 € erano finiti entrambi sul
// tratto 1→7 set (420 €), che risultava «pagato» con 380 € in più, mentre
// i tratti dopo apparivano tutti da pagare. Dividendo il secondo 400 € in
// 20 + 320 + 60 ogni parte mostra il suo saldo giusto.
//
// Funzioni pure, in centesimi: niente Supabase, niente orologio. Il
// salvataggio sta in lib/pagamentiDati, che scrive una riga per ogni parte
// col contratto di sempre (chiave custodita, rilettura, RPC idempotente).
// ============================================================================
import { euroScheda } from './schedaPrenotazione.ts'

export type TrattoDivisibile = { id: string; status: string; check_in: string; total_amount?: number | string | null }
export type PagamentoTratto = { booking_id: string; amount: number | string }
export type PartePagamento = { booking_id: string; amountCent: number }

const cent = (n: number | string | null | undefined) => Math.round(Number(n || 0) * 100)

/** I tratti che si pagano, in ordine di tempo: gli annullati non sono più dovuti */
export const trattiInOrdine = <T extends TrattoDivisibile>(righe: T[]): T[] =>
  righe.filter(r => r.status !== 'annullata').sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))

/**
 * Divide un pagamento nuovo fra i tratti del soggiorno.
 *
 * Prima si guarda quanto ogni tratto è già coperto: i pagamenti registrati su
 * di lui, fino al suo dovuto; quello che avanza (e i pagamenti finiti su un
 * tratto annullato) «scorre» in avanti sul primo tratto ancora scoperto, come
 * fa già il calendario. Poi il pagamento nuovo riempie, in ordine, quel che
 * resta scoperto. Se va oltre il dovuto di tutto il soggiorno, l'eccedenza
 * resta sull'ultimo tratto. Ogni parte torna con il suo importo in centesimi;
 * la somma delle parti è sempre l'importo intero.
 */
export function dividiPagamentoCent(righe: TrattoDivisibile[], pagamenti: PagamentoTratto[], importoCent: number): PartePagamento[] {
  const importo = Math.round(Number.isFinite(importoCent) ? importoCent : 0)
  if (importo <= 0) return []
  const tratti = trattiInOrdine(righe)
  if (tratti.length === 0) return []
  const idTutti = new Set(righe.map(r => r.id))

  // quanto è già coperto ogni tratto, e quanto avanza da far scorrere
  const dovuto = tratti.map(t => Math.max(0, cent(t.total_amount)))
  const coperto = tratti.map(() => 0)
  let avanzo = 0
  for (const p of pagamenti) {
    if (!idTutti.has(p.booking_id)) continue
    const i = tratti.findIndex(t => t.id === p.booking_id)
    if (i === -1) { avanzo += cent(p.amount); continue }   // su un tratto annullato: conta per il soggiorno
    coperto[i] += cent(p.amount)
  }
  for (let i = 0; i < tratti.length; i++) {
    if (coperto[i] > dovuto[i]) { avanzo += coperto[i] - dovuto[i]; coperto[i] = dovuto[i] }
  }
  for (let i = 0; i < tratti.length && avanzo > 0; i++) {
    const prende = Math.min(avanzo, dovuto[i] - coperto[i])
    coperto[i] += prende
    avanzo -= prende
  }

  // il pagamento nuovo riempie, in ordine, quel che resta scoperto
  const parti: PartePagamento[] = []
  let resto = importo
  for (let i = 0; i < tratti.length && resto > 0; i++) {
    const prende = Math.min(resto, dovuto[i] - coperto[i])
    if (prende > 0) { parti.push({ booking_id: tratti[i].id, amountCent: prende }); resto -= prende }
  }
  if (resto > 0) {
    const ultimo = tratti[tratti.length - 1].id
    const gia = parti.find(p => p.booking_id === ultimo)
    if (gia) gia.amountCent += resto
    else parti.push({ booking_id: ultimo, amountCent: resto })
  }
  return parti
}

/** La nota che ogni parte porta con sé quando il pagamento è stato diviso:
 *  «Parte di un pagamento di 400 €», dopo la nota scritta da Ania se c'è. */
export const NOTA_PARTE = (importoCent: number) => `Parte di un pagamento di ${euroScheda(importoCent)}`
export function notaParte(nota: string, importoCent: number, parti: number): string {
  const pulita = (nota ?? '').trim()
  if (parti <= 1) return pulita
  return [pulita, NOTA_PARTE(importoCent)].filter(Boolean).join(' · ')
}

// ── Il piano custodito sul telefono ─────────────────────────────────────────
// La PWA si ricarica tornando da WhatsApp: se il salvataggio si ferma a metà
// (una parte scritta, l'altra no) il piano delle parti va ricordato, così al
// nuovo tentativo con lo stesso pagamento le parti sono le STESSE e non si
// ricalcolano sui pagamenti nel frattempo cresciuti (che darebbe una somma
// diversa dall'importo). Ogni parte ha poi la sua chiave custodita.
export type PianoPagamento = { amountCent: number; method: string; paid_on: string; parti: PartePagamento[] }

export function pianoValido(x: unknown): x is PianoPagamento {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (!Number.isInteger(o.amountCent) || (o.amountCent as number) <= 0) return false
  if (typeof o.method !== 'string' || typeof o.paid_on !== 'string') return false
  if (!Array.isArray(o.parti) || o.parti.length === 0) return false
  let somma = 0
  for (const p of o.parti as unknown[]) {
    if (!p || typeof p !== 'object') return false
    const q = p as Record<string, unknown>
    if (typeof q.booking_id !== 'string' || !q.booking_id || !Number.isInteger(q.amountCent) || (q.amountCent as number) <= 0) return false
    somma += q.amountCent as number
  }
  return somma === o.amountCent
}

/** Il piano da usare: quello custodito, se è per lo stesso pagamento (importo,
 *  modo, giorno) e le sue parti stanno sui tratti di questa prenotazione;
 *  altrimenti un piano nuovo, diviso sui pagamenti letti adesso. */
export function pianoDaUsare(
  custodito: unknown, righe: TrattoDivisibile[], pagamenti: PagamentoTratto[],
  dati: { amountCent: number; method: string; paid_on: string },
): PianoPagamento {
  const ids = new Set(righe.map(r => r.id))
  if (pianoValido(custodito) && custodito.amountCent === dati.amountCent && custodito.method === dati.method
    && custodito.paid_on === dati.paid_on && custodito.parti.every(p => ids.has(p.booking_id))) return custodito
  return { ...dati, parti: dividiPagamentoCent(righe, pagamenti, dati.amountCent) }
}
