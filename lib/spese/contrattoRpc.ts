// ============================================================================
// Il ClienteContratto REALE come FACTORY (stesso schema di
// revisioneClient): riceve un client Supabase-compatibile e lega le
// quattro RPC del contratto. NON è importato dalle pagine operative:
// serve al collaudo isolato (scripts/collaudo-contratto) e, dopo le
// autorizzazioni, al futuro cablaggio.
// Regole del trasporto:
//  · un errore RESTITUITO diventa { errore, codice } — il CODICE
//    (SQLSTATE, quando il gateway lo riporta) è l'unica prova di
//    rifiuto che validaRisposta accetta: senza, la pendenza resta;
//  · la risposta della RPC viene passata COM'È a validaRisposta /
//    validaEsitoGiornale: ogni convalida vive lì, mai qui.
// ============================================================================
import type { ClienteContratto } from './contrattoRevisione.ts'

type RispostaRpc = { data: unknown; error: { message: string; code?: string } | null }
export type SupabaseContratto = {
  rpc(nome: string, argomenti: Record<string, unknown>): Promise<RispostaRpc>
}

const resa = ({ data, error }: RispostaRpc): unknown =>
  error ? { errore: error.message, ...(error.code ? { codice: error.code } : {}) } : data

export function creaClienteContrattoRpc(supabase: SupabaseContratto): ClienteContratto {
  return {
    async salvaRevisione(p) {
      return resa(await supabase.rpc('salva_revisione', {
        p_op_key: p.op_key, p_document_id: p.document_id,
        p_base_rev: p.base_rev, p_modifiche: p.modifiche,
      })) as never
    },
    async confermaRevisione(p) {
      return resa(await supabase.rpc('conferma_revisione', {
        p_op_key: p.op_key, p_document_id: p.document_id,
        p_base_rev: p.base_rev, p_correzioni: p.correzioni,
      })) as never
    },
    async scartaRevisione(p) {
      return resa(await supabase.rpc('scarta_revisione', {
        p_op_key: p.op_key, p_document_id: p.document_id,
        p_base_rev: p.base_rev, p_motivo: p.motivo,
      })) as never
    },
    async esitoRevisione(opKey) {
      const r = await supabase.rpc('esito_revisione', { p_op_key: opKey })
      // qui un errore NON è un esito: si LANCIA, così il recupero lo
      // classifica «illeggibile» e conserva la pendenza
      if (r.error) throw new Error(`${r.error.message}${r.error.code ? ` [${r.error.code}]` : ''}`)
      return r.data as never
    },
  }
}
