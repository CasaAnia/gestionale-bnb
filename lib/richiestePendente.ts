// Custodia dell'offerta aperta in WhatsApp: la conferma usa solo questa copia,
// mai camere, prezzi o condizioni ricalcolati al ritorno nell'app.
import type { Soluzione } from './richiesteProposta.ts'
import type { CondizioniSalvate } from './richiesteDati.ts'

export type PropostaPendente = {
  testo: string
  condizioni: CondizioniSalvate
  soluzione: Soluzione | null // null: vecchio formato, non confermabile
  alternative: Soluzione[] | null
  confermataIl?: string // custodita al primo «Sì», anche se la risposta si perde
  impronta?: ImprontaRichiesta // com'era la richiesta quando il messaggio è partito
}

// ── L'impronta della richiesta (11/09/2026) ─────────────────────────────────
// L'attesa di «L'hai inviata?» vive nel browser e sopravvive al ricaricamento
// dell'app. Se nel frattempo Ania MODIFICA la richiesta (date, persone,
// camera, notti scelte), quel messaggio parla di una richiesta che non esiste
// più: va buttato, altrimenti la pagina resta ferma sul testo vecchio e le
// camere non si possono più toccare. Qui si conserva com'era la richiesta al
// momento dell'invio, per accorgersene alla riapertura.
export type ImprontaRichiesta = {
  arrivo: string
  partenza: string
  persone: number
  camera_id: string | null
  persone_per_notte: number[] | null
  notti_richieste: string[] | null
}
type DatiRichiesta = { arrivo: string; partenza: string; persone: number; camera_id?: string | null; persone_per_notte?: number[] | null; notti_richieste?: string[] | null }

export const improntaRichiesta = (r: DatiRichiesta): ImprontaRichiesta => ({
  arrivo: r.arrivo,
  partenza: r.partenza,
  persone: Number(r.persone),
  camera_id: r.camera_id ?? null,
  persone_per_notte: r.persone_per_notte ?? null,
  notti_richieste: r.notti_richieste ?? null,
})

// La richiesta è cambiata da quando il messaggio è partito? Un pendente
// vecchio, senza impronta, non si può giudicare: si lascia com'è.
export function richiestaCambiata(p: PropostaPendente | null, r: DatiRichiesta | null | undefined): boolean {
  if (!p?.impronta || !r) return false
  return JSON.stringify(p.impronta) !== JSON.stringify(improntaRichiesta(r))
}
export const chiavePendente = (id: string) => `ca_proposta_pendente_${id}`
type Memoria = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const oggetto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const data = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const soluzioneValida = (s: unknown): s is Soluzione => {
  if (!oggetto(s) || !['completa', 'cambio', 'manca_mezzo', 'manca_estremo', 'completo'].includes(String(s.caso))
    || !Array.isArray(s.segmenti) || !numero(s.prezzoTotale) || !numero(s.nottiTotali) || !numero(s.nottiCoperte)
    || !Array.isArray(s.nottiMancanti) || !s.nottiMancanti.every(data)) return false
  if (s.caso !== 'completo' && !s.segmenti.length) return false
  return s.segmenti.every(x => oggetto(x) && oggetto(x.camera) && typeof x.camera.id === 'string' && typeof x.camera.name === 'string'
    && data(x.arrivo) && data(x.partenza) && x.arrivo < x.partenza
    && numero(x.notti) && numero(x.prezzoNotte) && numero(x.lettoTotale) && numero(x.totale)
    && (x.prezziNottiCentesimi === undefined || (Array.isArray(x.prezziNottiCentesimi) && x.prezziNottiCentesimi.length === x.notti && x.prezziNottiCentesimi.every(numero))))
}
const condizioniValide = (c: unknown): c is CondizioniSalvate => oggetto(c)
  && [null, 'arrivo', 'caparra', 'completo', 'personalizzata'].includes(c.condizione_pagamento as string | null)
  && (c.caparra_centesimi === null || numero(c.caparra_centesimi))
  && (c.condizione_testo === null || typeof c.condizione_testo === 'string') && typeof c.amelia_alternativa === 'boolean'

export function serializzaPendente(p: PropostaPendente): string { return JSON.stringify(p) }

// Un vecchio pendente conserva il testo leggibile, ma non inventa la camera.
export function leggiPendente(grezzo: string | null | undefined): PropostaPendente | null {
  if (!grezzo) return null
  let v: unknown
  try { v = JSON.parse(grezzo) } catch { return null }
  if (!oggetto(v) || typeof v.testo !== 'string' || !condizioniValide(v.condizioni)) return null
  const alternativeValide = v.alternative === null || (Array.isArray(v.alternative) && v.alternative.length > 1 && v.alternative.every(soluzioneValida))
  const completa = soluzioneValida(v.soluzione) && alternativeValide
  if (v.confermataIl !== undefined && (typeof v.confermataIl !== 'string' || !Number.isFinite(Date.parse(v.confermataIl)))) return null
  return { testo: v.testo, condizioni: v.condizioni, soluzione: completa ? v.soluzione as Soluzione : null,
    alternative: completa ? v.alternative as Soluzione[] | null : null,
    ...(typeof v.confermataIl === 'string' ? { confermataIl: v.confermataIl } : {}),
    ...(oggetto(v.impronta) ? { impronta: v.impronta as unknown as ImprontaRichiesta } : {}) }
}

export function datiPerConferma(p: PropostaPendente | null): (PropostaPendente & { soluzione: Soluzione }) | null {
  return p?.soluzione ? { ...p, soluzione: p.soluzione } : null
}

// Un secondo tocco o un'altra scheda non possono sostituire un invio da chiarire.
export function custodisciPendente(memoria: Memoria, chiave: string, p: PropostaPendente, precedente: PropostaPendente | null = null): void {
  const prima = memoria.getItem(chiave)
  if (prima !== (precedente ? serializzaPendente(precedente) : null)) throw new Error('C’è già un invio da chiarire. Riapri questa pagina prima di continuare.')
  const testo = serializzaPendente(p)
  memoria.setItem(chiave, testo)
  if (memoria.getItem(chiave) !== testo) throw new Error('La copia della proposta non è stata conservata nel browser.')
}

export function eliminaPendente(memoria: Memoria, chiave: string): void {
  memoria.removeItem(chiave)
  if (memoria.getItem(chiave) !== null) throw new Error('La risposta non è stata conservata nel browser. Riprova.')
}

// ── La riga di «L'hai inviata?» (Ania, 11/09/2026) ──────────────────────────
// Dice le camere DAVVERO proposte nel messaggio, nell'ordine del messaggio,
// con le date e come paga: «Lena, Ambra e Allegra · 29 → 31 ott · all'arrivo».
// Con una camera sola: «Lena · 29 → 31 ott · all'arrivo».
// Legge SOLO quello che è stato custodito al momento dell'invio: mai camere o
// condizioni ricalcolate al ritorno nell'app.
const MESI_RIGA = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const pezziData = (iso: string) => { const [a, m, g] = iso.split('-').map(Number); return { a, m, g } }

// «29 → 31 ott» · «31 ott → 2 nov» · «30 dic 2026 → 2 gen 2027»
export function periodoRiga(arrivo: string, partenza: string): string {
  const A = pezziData(arrivo), P = pezziData(partenza)
  if (A.a !== P.a) return `${A.g} ${MESI_RIGA[A.m - 1]} ${A.a} → ${P.g} ${MESI_RIGA[P.m - 1]} ${P.a}`
  if (A.m !== P.m) return `${A.g} ${MESI_RIGA[A.m - 1]} → ${P.g} ${MESI_RIGA[P.m - 1]}`
  return `${A.g} → ${P.g} ${MESI_RIGA[A.m - 1]}`
}

// «Lena» · «Lena e Ambra» · «Lena, Ambra e Allegra»
export function elencoCamere(nomi: string[]): string {
  if (nomi.length <= 1) return nomi.join('')
  return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`
}

const COME_PAGA: Record<string, string> = {
  arrivo: "all'arrivo",
  caparra: 'caparra',
  completo: 'pagamento completo',
  personalizzata: 'condizioni scritte a mano',
}
const euroRiga = (cent: number) => `${String(Math.round(cent / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`

export function rigaConferma(p: PropostaPendente): string {
  const camere = p.alternative && p.alternative.length > 1
    ? p.alternative.map(s => s.segmenti[0]?.camera.name).filter((x): x is string => !!x)
    : [...new Set((p.soluzione?.segmenti ?? []).map(s => s.camera.name))]
  const segmenti = p.soluzione?.segmenti ?? []
  const pezzi: string[] = []
  if (camere.length) pezzi.push(elencoCamere(camere))
  if (segmenti.length) {
    const arrivo = segmenti.reduce((m, s) => (s.arrivo < m ? s.arrivo : m), segmenti[0].arrivo)
    const partenza = segmenti.reduce((m, s) => (s.partenza > m ? s.partenza : m), segmenti[0].partenza)
    pezzi.push(periodoRiga(arrivo, partenza))
  }
  const tipo = p.condizioni.condizione_pagamento
  if (tipo) {
    const caparra = tipo === 'caparra' && p.condizioni.caparra_centesimi !== null
      ? ` ${euroRiga(p.condizioni.caparra_centesimi)}` : ''
    pezzi.push(`${COME_PAGA[tipo] ?? tipo}${caparra}`)
  }
  return pezzi.join(' · ')
}

// Il messaggio custodito è stato riscritto a mano da Ania? Lo si capisce
// confrontandolo con quello che il generatore avrebbe scritto per la stessa
// soluzione e le stesse condizioni. Chi chiama passa il generatore, così
// questo file resta senza dipendenze dai testi.
export function testoRiscrittoAMano(p: PropostaPendente, rigenera: (p: PropostaPendente) => string): boolean {
  if (!p.soluzione) return false
  try { return p.testo.trim() !== rigenera(p).trim() } catch { return false }
}
