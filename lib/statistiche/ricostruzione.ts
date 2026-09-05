// ============================================================================
// R6 (revisione Codex di f4d5474) — RICOSTRUZIONE UNA TANTUM degli incassi
// storici. Regola di Casa Ania: si è sempre pagato all'arrivo, alla consegna
// delle chiavi; non è mai esistito un soggiorno non pagato. Per ogni
// soggiorno confermato/completato con pagato = true e movimenti che NON
// coprono il totale si prepara UN movimento: data = giorno di arrivo,
// importo = totale meno i movimenti già registrati, metodo «all'arrivo
// (ricostruito)», origine 'ricostruito' (contrassegno) e una chiave
// stabile derivata dal soggiorno: rilanciare la ricostruzione non crea
// doppioni (la chiave è unica e, dopo la scrittura, il totale è coperto).
// Solo funzioni pure: la scrittura è la RPC ricostruisci_incassi (proposta
// 0033), in un'unica transazione, dietro il tasto di conferma di Ania.
// ============================================================================
import { cent, prenotazioneValida, type PagamentoStat, type PrenotazioneStat } from './tipi.ts'

export const METODO_RICOSTRUITO = "all'arrivo (ricostruito)"
export const ORIGINE_RICOSTRUITO = 'ricostruito'
export const ETICHETTA_INCASSI_REGISTRATI = 'Incassi registrati'
export const AVVISO_STORICO_DA_RICOSTRUIRE = 'storico da ricostruire'

export type MotivoRicostruzione = 'pagato_senza_movimenti' | 'concluso_non_segnato'

export type MovimentoRicostruito = {
  chiave_operazione: string
  motivo: MotivoRicostruzione
  booking_id: string
  amount: number            // euro, due decimali
  paid_on: string
  method: string
  origine: 'ricostruito'
  // per la schermata di conferma
  soggiorno: string
  nomi: string
  arrivo: string
  partenza: string
  totaleCent: number
  registratiCent: number
}

// UUID deterministico (versione 5-like, senza SHA: FNV-1a a 128 bit sulla
// chiave del soggiorno) — la stessa prenotazione dà sempre la stessa chiave.
export function chiaveRicostruzione(soggiorno: string): string {
  const testo = `ricostruzione:${soggiorno}`
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x9e3779b9, h4 = 0x7f4a7c15
  for (let i = 0; i < testo.length; i++) {
    const c = testo.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (c + 1), 0x01000193) >>> 0
    h3 = Math.imul(h3 ^ (c + 2), 0x01000193) >>> 0
    h4 = Math.imul(h4 ^ (c + 3), 0x01000193) >>> 0
  }
  const hex = [h1, h2, h3, h4].map(h => h.toString(16).padStart(8, '0')).join('')
  // versione 5 e variante RFC nel formato 8-4-4-4-12
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

// Soggiorno escluso dal piano perché non ancora concluso (in corso o futuro)
export type SoggiornoEscluso = { soggiorno: string; nomi: string; arrivo: string; partenza: string; mancanteCent: number; perche: 'in_corso' | 'futuro' }

export type PianoRicostruzione = { movimenti: MovimentoRicostruito[]; totaleCent: number; esclusi: SoggiornoEscluso[] }

// R9: entrano nel piano TUTTI i soggiorni confermati/completati CONCLUSI
// (partenza ≤ oggi) con movimenti che non coprono il totale — segnati pagati
// o no (regola di Ania: ogni soggiorno svolto è stato pagato all'arrivo) —
// distinti per motivo; quelli in corso o futuri restano fuori e si elencano.
export function pianoRicostruzione(prenotazioni: PrenotazioneStat[], pagamenti: PagamentoStat[], oggi: string): PianoRicostruzione {
  const perPrenotazione = new Map<string, number>()
  for (const p of pagamenti) perPrenotazione.set(p.booking_id, (perPrenotazione.get(p.booking_id) ?? 0) + cent(p.amount))
  const gruppi = new Map<string, PrenotazioneStat[]>()
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const k = b.group_id || b.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  const movimenti: MovimentoRicostruito[] = []
  const esclusi: SoggiornoEscluso[] = []
  for (const [soggiorno, segmenti] of gruppi) {
    const ordinati = [...segmenti].sort((x, y) => x.check_in.localeCompare(y.check_in))
    const totale = segmenti.reduce((s, b) => s + cent(b.total_amount), 0)
    const registrati = segmenti.reduce((s, b) => s + (perPrenotazione.get(b.id) ?? 0), 0)
    const mancante = totale - registrati
    if (mancante <= 0) continue
    const arrivo = ordinati[0].check_in
    const partenza = ordinati.map(b => b.check_out).sort().slice(-1)[0]
    const nomi = [...new Set(segmenti.map(b => b.guest_name).filter(Boolean))].join(', ')
    if (partenza > oggi) {
      esclusi.push({ soggiorno, nomi, arrivo, partenza, mancanteCent: mancante, perche: arrivo <= oggi ? 'in_corso' : 'futuro' })
      continue
    }
    movimenti.push({
      chiave_operazione: chiaveRicostruzione(soggiorno),
      motivo: segmenti.some(b => !!b.pagato) ? 'pagato_senza_movimenti' : 'concluso_non_segnato',
      booking_id: ordinati[0].id,
      amount: mancante / 100,
      paid_on: ordinati[0].check_in,
      method: METODO_RICOSTRUITO,
      origine: ORIGINE_RICOSTRUITO,
      soggiorno,
      nomi,
      arrivo,
      partenza,
      totaleCent: totale,
      registratiCent: registrati,
    })
  }
  movimenti.sort((x, y) => x.arrivo.localeCompare(y.arrivo))
  esclusi.sort((x, y) => x.arrivo.localeCompare(y.arrivo))
  return { movimenti, totaleCent: movimenti.reduce((s, m) => s + Math.round(m.amount * 100), 0), esclusi }
}

// Il client manda alla RPC SOLO identità e chiavi del piano approvato (R9)
export function vociPerRpc(piano: PianoRicostruzione): { soggiorno: string; chiave: string }[] {
  return piano.movimenti.map(m => ({ soggiorno: m.soggiorno, chiave: m.chiave_operazione }))
}

// Esito strutturato della RPC ricostruisci_incassi, convalidato dal client
export type EsitoRicostruzione = { scritti: number; saltati: number; nulla: number; esiti: { soggiorno: string; chiave: string; esito: 'scritto' | 'gia_presente' | 'nulla_da_scrivere'; importo: number }[] }
export function validaEsitoRicostruzione(x: unknown, attesi: number): EsitoRicostruzione | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const n = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)
  const scritti = n(o.scritti), saltati = n(o.saltati), nulla = n(o.nulla)
  if (scritti === null || saltati === null || nulla === null || !Array.isArray(o.esiti)) return null
  if (scritti + saltati + nulla !== attesi || o.esiti.length !== attesi) return null
  const esiti: EsitoRicostruzione['esiti'] = []
  for (const e of o.esiti as Record<string, unknown>[]) {
    if (!e || typeof e.soggiorno !== 'string' || typeof e.chiave !== 'string') return null
    if (e.esito !== 'scritto' && e.esito !== 'gia_presente' && e.esito !== 'nulla_da_scrivere') return null
    const importo = typeof e.importo === 'number' ? e.importo : Number(e.importo)
    if (!Number.isFinite(importo)) return null
    esiti.push({ soggiorno: e.soggiorno, chiave: e.chiave, esito: e.esito, importo })
  }
  return { scritti, saltati, nulla, esiti }
}

// Finché il piano non è vuoto la voce si chiama «Incassi registrati» con l'avviso
export function etichettaIncassi(movimentiDaRicostruire: number): { etichetta: string; avviso: string | null } {
  return movimentiDaRicostruire > 0 ? { etichetta: ETICHETTA_INCASSI_REGISTRATI, avviso: AVVISO_STORICO_DA_RICOSTRUIRE } : { etichetta: 'Incassi', avviso: null }
}
