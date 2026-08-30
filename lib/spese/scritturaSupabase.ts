// Il ClienteScrittura vero (3.2B): Supabase col client del browser (chiave
// anon + sessione, RLS). Usato SOLO dalle pagine ufficiali /spese e
// /spese-famiglia — mai dalla preview in sola lettura.
import { supabase } from '@/lib/supabase'
import type { ClienteScrittura } from './scrittura'

export const clienteSupabase: ClienteScrittura = {
  async inserisciSpesa(payload) {
    const { error } = await supabase.from('family_expenses').insert(payload)
    return error ? { errore: error.message } : {}
  },
  async caricaFile(percorso, file, tipo) {
    const { error } = await supabase.storage.from('scontrini').upload(percorso, file, { contentType: tipo })
    return error ? { errore: error.message } : {}
  },
  async rimuoviFile(percorso) {
    await supabase.storage.from('scontrini').remove([percorso])
  },
  async creaDocumento(payload) {
    const { data, error } = await supabase.from('family_documents').insert(payload).select('id').single()
    return error ? { errore: error.message } : { id: (data as { id: string }).id }
  },
  async creaRicevuta(payload) {
    const { error } = await supabase.from('family_receipts').insert(payload)
    return error ? { errore: error.message } : {}
  },
}
