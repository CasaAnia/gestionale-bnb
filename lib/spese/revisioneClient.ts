// ============================================================================
// L'ADATTATORE EFFETTIVO della revisione, come FACTORY testabile (stesso
// schema di registrazioneClient): riceve un client Supabase-compatibile e
// costruisce il ClienteRevisione. L'INSERT delle righe nuove usa il payload
// ESPLICITO delle colonne concesse dalla 0021 — mai l'oggetto dello stato
// com'è (idLocale/stato/id non esistono nel database e farebbero fallire
// tutto). RLS e permessi per colonna della 0021 restano la rete di
// sicurezza a valle. Conferma e scarto passano dalle RPC atomiche della
// 0020: mai insert diretti nelle spese definitive.
// ============================================================================
import { payloadRigaNuova } from './revisione.ts'
import type { ClienteRevisione } from './revisioneScrittura.ts'

type Risposta = { data: unknown; error: { message: string } | null }
export type SupabaseRevisione = {
  from(tabella: string): {
    update(campi: Record<string, unknown>): {
      eq(colonna: string, valore: string): { select(colonne: string): Promise<Risposta> }
    }
    insert(campi: Record<string, unknown>): {
      select(colonne: string): { single(): Promise<Risposta> }
    }
  }
  rpc(nome: string, argomenti: Record<string, unknown>): Promise<Risposta>
}

const conta = (data: unknown, error: { message: string } | null) =>
  error ? { errore: error.message } : { righe: Array.isArray(data) ? data.length : 0 }

export function creaClienteRevisione(supabase: SupabaseRevisione): ClienteRevisione {
  return {
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
        .insert(payloadRigaNuova(riga) as unknown as Record<string, unknown>)
        .select('id').single()
      if (error) return { errore: error.message }
      const id = (data as { id?: string } | null)?.id
      // risposta senza id: NON è un rifiuto ordinario — l'inserimento può
      // essere avvenuto. Il chiamante non deve poterla reinviare da solo.
      if (!id) return { errore: 'la risposta non contiene l\'id della voce inserita', incerto: true }
      return { id }
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
}
