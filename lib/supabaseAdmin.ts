import { createClient } from '@supabase/supabase-js'

// Client per le route server (cron delle notifiche push). Usa la service role
// key, che scavalca le policy RLS: i cron girano senza nessun utente loggato,
// quindi con la anon key dopo l'attivazione di RLS leggerebbero zero righe.
//
// Questa chiave non deve MAI finire in un file importato dal browser: niente
// prefisso NEXT_PUBLIC_, e si importa solo dentro app/api/.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY mancante: aggiungila alle variabili ambiente su Vercel e in .env.local'
    )
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
