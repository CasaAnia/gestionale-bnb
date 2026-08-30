// Il ClienteRevisione vero (browser: chiave anon + sessione, RLS e permessi
// per colonna della 0021 fanno da rete di sicurezza — i campi riservati
// verrebbero comunque rifiutati dal database). La conferma e lo scarto
// passano dalle RPC atomiche della 0020: mai insert diretti nelle spese.
import { supabase } from '@/lib/supabase'
import type { ClienteRevisione } from './revisioneScrittura'

const conta = (data: unknown[] | null, error: { message: string } | null) =>
  error ? { errore: error.message } : { righe: data?.length ?? 0 }

export const clienteRevisioneSupabase: ClienteRevisione = {
  async aggiornaDocTotale(documentId, totale) {
    const { data, error } = await supabase.from('family_documents')
      .update({ doc_total: totale }).eq('id', documentId).select('id')
    return conta(data, error)
  },
  async aggiornaBozza(id, campi) {
    const { data, error } = await supabase.from('family_draft_expenses')
      .update(campi).eq('id', id).select('id')
    return conta(data, error)
  },
  async aggiornaRiga(id, campi) {
    const { data, error } = await supabase.from('family_draft_items')
      .update(campi).eq('id', id).select('id')
    return conta(data, error)
  },
  async aggiungiRiga(riga) {
    const { data, error } = await supabase.from('family_draft_items')
      .insert(riga).select('id').single()
    if (error) return { errore: error.message }
    return { id: (data as { id: string }).id }
  },
  async confermaDocumento(documentId, correzioni) {
    const { data, error } = await supabase.rpc('conferma_documento', {
      p_document_id: documentId, p_correzioni: correzioni,
    })
    if (error) return { errore: error.message }
    return { ids: (data as string[]) ?? [] }
  },
  async scartaDocumento(documentId, motivo) {
    const { error } = await supabase.rpc('scarta_documento', {
      p_document_id: documentId, p_motivo: motivo,
    })
    return error ? { errore: error.message } : {}
  },
}
