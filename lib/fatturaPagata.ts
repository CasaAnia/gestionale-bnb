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
// Non si ripete: la riconosce la nota con l'id del documento.
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

type Risposta = { data?: unknown; error: { message?: string } | null }
export type ClienteFattura = {
  rpc(nome: string, argomenti: Record<string, unknown>): PromiseLike<Risposta>
  categoriaCommissione(gruppoId: string): PromiseLike<{ id: string | null; error: { message?: string } | null }>
  commissioneGiaRegistrata(nota: string): PromiseLike<{ esiste: boolean; error: { message?: string } | null }>
  inserisciSpesa(riga: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>
}

export const ERRORE_IMPORTO_FATTURA = 'Scrivi l\'importo pagato, per esempio 127,95'
export const ERRORE_IMPORTO_MINORE = 'L\'importo pagato non può essere minore della bolletta'
export const ERRORE_DATA_FATTURA = 'Scegli il giorno del pagamento'
export const COMMISSIONE_NON_SALVATA = 'Bolletta segnata pagata, ma la commissione non è salvata: riprova'

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

export type EsitoFattura = { ok: true; commissioneCent: number } | { ok: false; errore: string; pagata: boolean }

export async function segnaFatturaPagata(
  client: ClienteFattura, f: FatturaDaPagare, scelta: { giorno: string; metodo: MetodoFattura; importo: string },
): Promise<EsitoFattura> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scelta.giorno)) return { ok: false, errore: ERRORE_DATA_FATTURA, pagata: false }
  if (importoInCent(scelta.importo) == null) return { ok: false, errore: ERRORE_IMPORTO_FATTURA, pagata: false }
  const extra = commissioneCent(scelta.importo, f.importoCent)
  if (extra == null) return { ok: false, errore: ERRORE_IMPORTO_MINORE, pagata: false }
  if (!METODI_FATTURA.some(m => m.chiave === scelta.metodo)) return { ok: false, errore: MESSAGGIO_NON_SALVATO, pagata: false }

  // 1. la bolletta: la RPC giusta per lo stato (idempotenti entrambe)
  const nome = f.stato === 'approvata_da_pagare' ? 'paga_fattura' : 'conferma_fattura_pagata'
  try {
    const r = await client.rpc(nome, { p_document_id: f.documentoId, p_data_pagamento: scelta.giorno, p_payment_method: scelta.metodo, p_correzioni: [] })
    if (r.error) return { ok: false, errore: messaggioNonSalvato(r.error), pagata: false }
  } catch (e) {
    return { ok: false, errore: messaggioNonSalvato(e), pagata: false }
  }
  if (extra === 0) return { ok: true, commissioneCent: 0 }

  // 2. la commissione, a parte e una volta sola
  const nota = notaCommissione(f)
  try {
    if (!f.gruppoId) return { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata: true }
    const gia = await client.commissioneGiaRegistrata(nota)
    if (gia.error) return { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata: true }
    if (gia.esiste) return { ok: true, commissioneCent: extra }
    const cat = await client.categoriaCommissione(f.gruppoId)
    if (cat.error) return { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata: true }
    const s = await client.inserisciSpesa({
      expense_date: scelta.giorno, amount: extra / 100, group_id: f.gruppoId, category_id: cat.id,
      subcategory: 'Commissioni', store: null, description: 'Commissione pagamento', notes: nota,
      payment_method: scelta.metodo, paid_at: scelta.giorno, expense_nature: 'ordinaria', source: 'manuale',
    })
    if (s.error) return { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata: true }
  } catch {
    return { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata: true }
  }
  return { ok: true, commissioneCent: extra }
}

/** La categoria della commissione per gruppo: Casa Ania ha «Commissioni», gli altri «Servizi». */
export const NOMI_CATEGORIA_COMMISSIONE = ['Commissioni', 'Servizi'] as const
