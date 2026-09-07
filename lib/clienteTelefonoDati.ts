// Lettura della scheda cliente dal numero, in qualunque forma sia salvato
// (parte pura in lib/clienteTelefono). Errore di rete → { scheda: null, errore }:
// chi chiama decide se fermarsi o provare a creare la scheda.
import { supabase } from './supabase'
import { messaggioErroreDati } from './connessione'
import { schemaRicercaTelefono, schedaConNumero } from './clienteTelefono'

export async function cercaSchedaPerTelefono<T extends { phone?: string | null }>(raw: string): Promise<{ scheda: T | null; errore: string | null }> {
  const schema = schemaRicercaTelefono(raw)
  if (!schema) return { scheda: null, errore: null }
  const { data, error } = await supabase.from('guests').select('*').ilike('phone', schema).order('created_at', { ascending: false }).limit(20)
  if (error) return { scheda: null, errore: messaggioErroreDati(error, 'cercare il cliente') }
  return { scheda: schedaConNumero((data || []) as T[], raw), errore: null }
}
