// Il legame sottile col browser: il ClienteRevisione vero è costruito
// dalla factory di revisioneClient (testata coi servizi finti) sul client
// Supabase condiviso (chiave anon + sessione).
import { supabase } from '@/lib/supabase'
import { creaClienteRevisione, type SupabaseRevisione } from './revisioneClient'
import type { ClienteRevisione } from './revisioneScrittura'

export const clienteRevisioneSupabase: ClienteRevisione =
  creaClienteRevisione(supabase as unknown as SupabaseRevisione)
