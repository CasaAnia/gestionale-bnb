// ============================================================================
// «SEGNA PAGATA» sulle bollette/fatture da pagare (Ania, 30/09/2026).
//
// Dalla voce di «Da controllare» della Home: data (oggi di default), metodo
// (solo contanti o bonifico) e importo pagato (precompilato con la bolletta,
// modificabile per le commissioni). Il pagamento passa SOLO dalle RPC della
// 0020, da utente collegato:
//   · fattura ancora «in_revisione»     → conferma_fattura_pagata
//   · fattura «approvata_da_pagare»      → paga_fattura
// Entrambe creano la spesa definitiva (pari alla bolletta) e sono
// idempotenti: ripetute su una fattura già pagata non creano doppioni.
//
// Se si è pagato DI PIÙ (commissione Mooney, posta…), la differenza è una
// spesa a parte «Commissione pagamento» nello stesso gruppo (Ania,
// 30/09/2026: «spesa a parte»): Casa → Servizi, Casa Ania → Commissioni.
// Non si ripete: la riga ha un id FISSO ricavato dal documento (idCommissione),
// così due salvataggi contemporanei — anche da due telefoni — si scontrano
// sulla chiave primaria e il secondo trova quella del primo (audit Codex R2,
// 30/09/2026). La nota con l'id del documento resta per le commissioni
// salvate prima, che hanno un id qualsiasi.
// Meno della bolletta non si registra (niente pagamenti parziali).
//
// Nessun import di lib/supabase: il client arriva da fuori (test col finto).
// ============================================================================
import { importoInCent } from './pagamentoFoglio.ts'
import { MESSAGGIO_NON_SALVATO, messaggioNonSalvato } from './scritturaSicura.ts'

export const METODI_FATTURA = [
  { chiave: 'contanti', testo: 'Contanti' },
  { chiave: 'bonifico', testo: 'Bonifico' },
] as const
export type MetodoFattura = typeof METODI_FATTURA[number]['chiave']

export type FatturaDaPagare = {
  documentoId: string
  stato: string                 // in_revisione | approvata_da_pagare
  importoCent: number           // la bolletta
  nome: string                  // «Bolletta gas A2A · Via Mincio»
  numero?: string | null
  gruppoId?: string | null      // il gruppo della bozza (per la commissione)
}

type Errore = { message?: string; code?: string } | null
export type SpesaFattura = {
  id: string; amount: number | string; expense_date: string; paid_at: string | null
  payment_method: string | null; group_id: string | null; category_id?: string | null
  notes?: string | null; description?: string | null; subcategory?: string | null
  source?: string | null; expense_nature?: string | null; store?: string | null
}
export type FatturaRiletta = {
  documento: { id: string; kind: string; status: string; doc_total: number | string | null } | null
  bozze: { id: string; status: string; expense_id: string | null; group_id: string | null }[]
  spese: SpesaFattura[]
}
export type ClienteFattura = {
  rpc(nome: string, argomenti: Record<string, unknown>): PromiseLike<{ data?: unknown; error: Errore }>
  leggiFattura(documentoId: string): PromiseLike<{ data: FatturaRiletta | null; error: Errore }>
  categoriaCommissione(gruppoId: string): PromiseLike<{ id: string | null; error: Errore }>
  leggiCommissione(id: string, nota: string): PromiseLike<{ data: SpesaFattura[] | null; error: Errore }>
  inserisciSpesa(riga: Record<string, unknown>): PromiseLike<{ data?: unknown; error: Errore }>
}
export type SceltaFattura = { giorno: string; metodo: MetodoFattura; importo: string }
export const FATTURA_INCERTA = 'Non riesco a confermare il salvataggio. I dati restano qui: verifica prima di riprovare. Puoi chiudere e riaprire il foglio dalla Home.'
export const FATTURA_DIVERSA = 'Il pagamento registrato ha dati diversi. Controlla la bolletta nelle Spese: non ho aggiunto altre spese.'
export const COMMISSIONE_DIVERSA = 'La commissione registrata ha dati diversi. Controllala nelle Spese: non ne ho aggiunta un’altra.'
export const FATTURA_DA_COMPLETARE = 'Il salvataggio non risulta completo. Puoi riprendere lo stesso salvataggio senza creare doppioni.'

export const ERRORE_IMPORTO_FATTURA = 'Scrivi l\'importo pagato, per esempio 127,95'
export const ERRORE_IMPORTO_MINORE = 'L\'importo pagato non può essere minore della bolletta'
export const ERRORE_DATA_FATTURA = 'Scegli il giorno del pagamento'
export const COMMISSIONE_NON_SALVATA = 'Bolletta segnata pagata; la commissione è da verificare. I dati restano qui.'

/** La commissione: quanto pagato oltre la bolletta (0 se niente, null se l'importo non va). */
export function commissioneCent(importoPagato: string, bollettaCent: number): number | null {
  const c = importoInCent(importoPagato)
  if (c == null || c < bollettaCent) return null
  return c - bollettaCent
}

/** Il campo importo all'apertura: «119,00» (con la virgola, come si legge sulla bolletta). */
export const importoIniziale = (cent: number) => (cent / 100).toFixed(2).replace('.', ',')

export const notaCommissione = (f: FatturaDaPagare) =>
  `Commissione del pagamento: ${f.nome}${f.numero ? ` n. ${f.numero}` : ''} (documento ${f.documentoId})`

/** L'id della commissione di un documento: sempre lo stesso uuid per lo stesso
 *  documento (SHA-256 di «commissione-pagamento:<id>», nel formato di un uuid v5). */
export async function idCommissione(documentoId: string): Promise<string> {
  const byte = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`commissione-pagamento:${documentoId}`))).slice(0, 16)
  byte[6] = (byte[6] & 0x0f) | 0x50
  byte[8] = (byte[8] & 0x3f) | 0x80
  const h = [...byte].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export type EsitoFattura = { ok: true; commissioneCent: number } | { ok: false; errore: string; pagata: boolean; incerto?: boolean; riprovabile?: boolean; rifiutata?: boolean; conflitto?: boolean }

function fatturaCorrisponde(r: FatturaRiletta, f: FatturaDaPagare, scelta: SceltaFattura): boolean {
  const d = r.documento
  const bozze = r.bozze.filter(b => ['confermata', 'da_controllare', 'pronta'].includes(b.status))
  const ids = bozze.map(b => b.expense_id)
  return !!d && d.id === f.documentoId && d.kind === 'fattura' && d.status === 'confermato'
    && d.doc_total != null && Math.round(Number(d.doc_total) * 100) === f.importoCent
    && bozze.length > 0 && bozze.every(b => b.status === 'confermata' && !!b.expense_id)
    && new Set(ids).size === ids.length && r.spese.length === ids.length
    && r.spese.every(e => ids.includes(e.id) && Number.isFinite(Number(e.amount)) && Number(e.amount) >= 0
      && e.expense_date === scelta.giorno && e.paid_at === scelta.giorno && e.payment_method === scelta.metodo
      && bozze.find(b => b.expense_id === e.id)?.group_id === e.group_id)
    && r.spese.reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0) === f.importoCent
}

/** Verifica completa anche dopo risposta persa. `soloVerifica` non scrive mai.
 * Un conflitto di chiave non prova che i dati siano quelli richiesti: si rilegge. */
export async function segnaFatturaPagata(
  client: ClienteFattura, f: FatturaDaPagare, scelta: SceltaFattura, soloVerifica = false,
): Promise<EsitoFattura> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scelta.giorno)) return { ok: false, errore: ERRORE_DATA_FATTURA, pagata: false }
  if (importoInCent(scelta.importo) == null) return { ok: false, errore: ERRORE_IMPORTO_FATTURA, pagata: false }
  const extra = commissioneCent(scelta.importo, f.importoCent)
  if (extra == null) return { ok: false, errore: ERRORE_IMPORTO_MINORE, pagata: false }
  if (!METODI_FATTURA.some(m => m.chiave === scelta.metodo)) return { ok: false, errore: MESSAGGIO_NON_SALVATO, pagata: false }
  if (extra > 0 && !f.gruppoId) return { ok: false, errore: 'Prima assegna il gruppo alla bolletta nelle Spese. Nessun pagamento registrato.', pagata: false, rifiutata: true }
  let pagata = false
  try {
    let risposta: { data?: unknown; error: Errore } | null = null
    if (!soloVerifica) {
      const nome = f.stato === 'approvata_da_pagare' ? 'paga_fattura' : 'conferma_fattura_pagata'
      try { risposta = await client.rpc(nome, { p_document_id: f.documentoId, p_data_pagamento: scelta.giorno, p_payment_method: scelta.metodo, p_correzioni: [] }) }
      catch { /* risposta persa: la rilettura decide, mai un falso Non salvato */ }
    }
    const letto = await client.leggiFattura(f.documentoId)
    if (letto.error || !letto.data) return { ok: false, errore: FATTURA_INCERTA, pagata, incerto: true }
    pagata = letto.data.documento?.status === 'confermato'
    if (!pagata) {
      const codice = risposta?.error?.code ?? ''
      const certo = /^(PGRST\d+|[0-9A-Z]{5})$/.test(codice) && !/^(08|57P)/.test(codice)
      if (certo) return { ok: false, errore: messaggioNonSalvato(risposta?.error), pagata: false, rifiutata: true }
      return { ok: false, errore: soloVerifica ? FATTURA_DA_COMPLETARE : FATTURA_INCERTA, pagata: false, incerto: true, riprovabile: soloVerifica }
    }
    if (!fatturaCorrisponde(letto.data, f, scelta)) return { ok: false, errore: FATTURA_DIVERSA, pagata: true, conflitto: true }
    // Se la RPC restituisce gli id, devono essere esattamente quelli riletti.
    // Una risposta persa/malformata si recupera solo dalla lettura completa sopra.
    if (Array.isArray(risposta?.data) && risposta.data.length > 0
      && (risposta.data.length !== letto.data.spese.length || !letto.data.spese.every(e => (risposta!.data as unknown[]).includes(e.id)))) {
      return { ok: false, errore: FATTURA_INCERTA, pagata, incerto: true }
    }
    const id = await idCommissione(f.documentoId)
    const nota = notaCommissione(f)
    const cat = extra > 0 && f.gruppoId ? await client.categoriaCommissione(f.gruppoId) : { id: null, error: null }
    if (cat.error || (extra > 0 && (!f.gruppoId || !cat.id))) return { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata, riprovabile: true }
    const attesa = {
      expense_date: scelta.giorno, amount: extra / 100, group_id: f.gruppoId, category_id: cat.id,
      subcategory: 'Commissioni', store: null, description: 'Commissione pagamento', notes: nota,
      payment_method: scelta.metodo, paid_at: scelta.giorno, expense_nature: 'ordinaria', source: 'manuale',
    }
    const corrisponde = (r: SpesaFattura) => Object.entries(attesa).every(([k, v]) =>
      k === 'amount' ? Math.round(Number(r.amount) * 100) === extra : r[k as keyof SpesaFattura] === v)
    let commissione = await client.leggiCommissione(id, nota)
    if (commissione.error || !commissione.data) return { ok: false, errore: FATTURA_INCERTA, pagata, incerto: true }
    if (extra === 0) return commissione.data.length === 0 ? { ok: true, commissioneCent: 0 } : { ok: false, errore: COMMISSIONE_DIVERSA, pagata, conflitto: true }
    if (commissione.data.length > 0) return commissione.data.length === 1 && corrisponde(commissione.data[0])
      ? { ok: true, commissioneCent: extra } : { ok: false, errore: COMMISSIONE_DIVERSA, pagata, conflitto: true }
    if (soloVerifica) return { ok: false, errore: FATTURA_DA_COMPLETARE, pagata, riprovabile: true }
    let inserita: { data?: unknown; error: Errore } | null = null
    try { inserita = await client.inserisciSpesa({ id, ...attesa }) } catch { /* si rilegge anche dopo errore */ }
    commissione = await client.leggiCommissione(id, nota)
    if (commissione.error || !commissione.data || commissione.data.length === 0) return { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata, incerto: true }
    if (commissione.data.length !== 1 || !corrisponde(commissione.data[0])) return { ok: false, errore: COMMISSIONE_DIVERSA, pagata, conflitto: true }
    if (inserita && !inserita.error && Array.isArray(inserita.data)
      && (inserita.data.length !== 1 || inserita.data[0]?.id !== id || !corrisponde(inserita.data[0]))) {
      return { ok: false, errore: FATTURA_INCERTA, pagata, incerto: true }
    }
    return { ok: true, commissioneCent: extra }
  } catch {
    return { ok: false, errore: FATTURA_INCERTA, pagata, incerto: true }
  }
}

/** La categoria della commissione per gruppo: Casa Ania ha «Commissioni», gli altri «Servizi». */
export const NOMI_CATEGORIA_COMMISSIONE = ['Commissioni', 'Servizi'] as const
