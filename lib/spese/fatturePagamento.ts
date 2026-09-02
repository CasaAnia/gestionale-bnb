// ============================================================================
// PAGAMENTO di una fattura APPROVATA (Fase 5) — la RPC paga_fattura della
// 0020 è atomica e IDEMPOTENTE per documento: crea le spese sorelle una
// volta sola con expense_date = paid_at = data reale del pagamento; una
// ripetizione restituisce le spese già create. Qui:
//  · data e metodo si controllano PRIMA di inviare (metodo obbligatorio e
//    valido, data reale e non futura);
//  · un doppio tocco sulla stessa fattura NON parte (presidio per documento);
//  · gli esiti sono onesti: errore RESTITUITO = rifiuto; errore di rete,
//    eccezione o risposta senza spese = INCERTO (chiudi e ricontrolla — la
//    RPC è idempotente, ma non si riprova alla cieca).
// ============================================================================
import { METODI_VALIDI } from './fatture.ts'
import { dataIsoValida } from './revisione.ts'
import type { ClienteRevisione } from './revisioneScrittura.ts'

export type RichiestaPagamento = { dataPagamento: string | null; metodo: string | null }

export type EsitoPagamento =
  | { ok: true; ids: string[] }
  | { ok: false; errore: string; incerto?: boolean }

export function blocchiPagamento(r: RichiestaPagamento, oggi: string): string[] {
  const blocchi: string[] = []
  if (!r.dataPagamento) blocchi.push('manca la data del pagamento')
  else if (!dataIsoValida(r.dataPagamento)) blocchi.push('la data del pagamento non è valida')
  else if (r.dataPagamento > oggi) blocchi.push('la data del pagamento è nel futuro: si segna pagata quando il denaro è uscito')
  if (!r.metodo || !(METODI_VALIDI as readonly string[]).includes(r.metodo))
    blocchi.push('per Casa Ania il metodo di pagamento è obbligatorio')
  return blocchi
}

const rete = (msg: string) => /fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)

export const MESSAGGIO_PAGAMENTO_IN_CORSO = 'il pagamento di questa fattura è già in corso: attendi l\'esito, non riprovare'

export function creaPagatore(cliente: Pick<ClienteRevisione, 'pagaFattura'>) {
  const inCorso = new Set<string>()
  return {
    inCorso: (documentId: string) => inCorso.has(documentId),
    async paga(documentId: string, richiesta: RichiestaPagamento, oggi: string): Promise<EsitoPagamento> {
      const blocchi = blocchiPagamento(richiesta, oggi)
      if (blocchi.length) return { ok: false, errore: blocchi.join(' · ') }
      if (inCorso.has(documentId)) return { ok: false, errore: MESSAGGIO_PAGAMENTO_IN_CORSO }
      inCorso.add(documentId)
      try {
        const r = await cliente.pagaFattura(documentId, richiesta.dataPagamento!, richiesta.metodo!, [])
        if (r.errore) {
          if (rete(r.errore))
            return { ok: false, incerto: true, errore: `pagamento dall'esito incerto (${r.errore}): NON riprovare alla cieca — chiudi e ricontrolla: se la fattura risulta pagata è andata (la RPC è idempotente)` }
          return { ok: false, errore: r.errore }
        }
        if (!r.ids || r.ids.length === 0)
          return { ok: false, incerto: true, errore: 'il pagamento non ha restituito le spese create: verifica lo stato della fattura prima di riprovare' }
        return { ok: true, ids: r.ids }
      } catch (e) {
        const msg = String((e as Error).message ?? e)
        // QUALSIASI eccezione a richiesta partita è esito ignoto
        return { ok: false, incerto: true, errore: `pagamento dall'esito incerto (${msg}): NON riprovare alla cieca — chiudi e ricontrolla: se la fattura risulta pagata è andata (la RPC è idempotente)` }
      } finally { inCorso.delete(documentId) }
    },
  }
}
