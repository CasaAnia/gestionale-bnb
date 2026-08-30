// Il ClienteScrittura vero (3.2B → 3.2B.1): Supabase col client del browser
// (chiave anon + sessione, RLS). Ogni operazione controlla l'ERRORE
// RESTITUITO e, dove può toccare zero righe, ritorna quante ne ha toccate.
// Usato SOLO dalle pagine ufficiali — mai dalla preview in sola lettura.
import { supabase } from '@/lib/supabase'
import type { ClienteScrittura } from './scrittura'

export const clienteSupabase: ClienteScrittura = {
  async inserisciSpesa(payload) {
    const { error } = await supabase.from('family_expenses').insert(payload)
    return error ? { errore: error.message } : {}
  },
  async eliminaSpesa(id) {
    const { data, error } = await supabase.from('family_expenses').delete().eq('id', id).select('id')
    return error ? { errore: error.message } : { righe: data?.length ?? 0 }
  },
  async caricaFile(percorso, file, tipo) {
    // upsert: al secondo tentativo sul NOSTRO stesso percorso sovrascrive
    // invece di fallire con "already exists"
    const { error } = await supabase.storage.from('scontrini').upload(percorso, file, { contentType: tipo, upsert: true })
    return error ? { errore: error.message } : {}
  },
  async rimuoviFile(percorso) {
    const { error } = await supabase.storage.from('scontrini').remove([percorso])
    return error ? { errore: error.message } : {}
  },
  async creaDocumento(payload) {
    const { data, error } = await supabase.from('family_documents').insert(payload).select('id').single()
    return error ? { errore: error.message } : { id: (data as { id: string }).id }
  },
  async creaRicevuta(payload) {
    const { error } = await supabase.from('family_receipts').insert(payload)
    return error ? { errore: error.message } : {}
  },
  async ricevutaEsiste(storagePath) {
    const { data, error } = await supabase.from('family_receipts').select('id').eq('storage_path', storagePath).limit(1)
    return error ? { errore: error.message } : { esiste: (data?.length ?? 0) > 0 }
  },
  async ricevutaConSha(sha) {
    const { data, error } = await supabase.from('family_receipts').select('id').eq('file_sha256', sha).limit(1)
    return error ? { errore: error.message } : { esiste: (data?.length ?? 0) > 0 }
  },
  async salvaBudget(ambito, categoria, importo) {
    const { error } = await supabase.from('family_budgets')
      .upsert({ ambito, category_name: categoria, monthly_amount: importo }, { onConflict: 'ambito,category_name' })
    return error ? { errore: error.message } : {}
  },
  async aggiornaBudget(id, importo) {
    const { data, error } = await supabase.from('family_budgets').update({ monthly_amount: importo }).eq('id', id).select('id')
    return error ? { errore: error.message } : { righe: data?.length ?? 0 }
  },
  async eliminaBudget(id) {
    const { data, error } = await supabase.from('family_budgets').delete().eq('id', id).select('id')
    return error ? { errore: error.message } : { righe: data?.length ?? 0 }
  },
}
