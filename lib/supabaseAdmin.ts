import { createClient } from '@supabase/supabase-js'

// Client per le route server (cron delle notifiche push). Usa la service role
// key, che scavalca le policy RLS: i cron girano senza nessun utente loggato,
// quindi con la anon key dopo l'attivazione di RLS leggerebbero zero righe.
//
// Questa chiave non deve MAI finire in un file importato dal browser: niente
// prefisso NEXT_PUBLIC_, e si importa solo dentro app/api/.
// Toglie ogni spazio, tabulazione e a capo, non solo alle estremità.
// Incollando una chiave nel pannello di Vercel può finirci dentro un a capo
// anche in mezzo (successo davvero sul sito: era alla posizione 15). La chiave
// viene poi messa in un'intestazione HTTP, che non ammette quei caratteri.
// Le chiavi Supabase non contengono spazi, quindi rimuoverli è sicuro.
export function pulisciChiave(v: string | undefined): string {
  return (v ?? '').replace(/\s+/g, '')
}

export function createAdminClient() {
  const key = pulisciChiave(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY mancante: aggiungila alle variabili ambiente su Vercel e in .env.local'
    )
  }

  const url = pulisciChiave(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL mancante')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
