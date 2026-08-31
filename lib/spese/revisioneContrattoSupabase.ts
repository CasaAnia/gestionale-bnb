// Il legame sottile col browser per il PERCORSO A CONTRATTO: come
// revisioneSupabase, ma sul ClienteContratto (le quattro RPC del
// contratto di revisione). NON viene usato finché l'interruttore
// (lib/spese/percorso.ts) resta su 'legacy': in produzione le RPC del
// contratto non esistono prima della transizione autorizzata.
import { supabase } from '@/lib/supabase'
import { creaClienteContrattoRpc, type SupabaseContratto } from './contrattoRpc'
import type { ClienteContratto } from './contrattoRevisione'

export const clienteContrattoSupabase: ClienteContratto =
  creaClienteContrattoRpc(supabase as unknown as SupabaseContratto)
