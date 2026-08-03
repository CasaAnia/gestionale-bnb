import { createBrowserClient } from '@supabase/ssr'

// Client del browser. Usa createBrowserClient (non createClient) perché deve
// leggere e scrivere il cookie di sessione: è quel cookie che fa arrivare a
// Supabase il ruolo "authenticated", senza il quale le policy RLS bloccano
// ogni lettura.
// Vedi pulisciChiave in lib/supabaseAdmin.ts: un a capo incollato per sbaglio
// dentro la chiave fa fallire ogni richiesta.
const pulisci = (v: string | undefined) => (v ?? '').replace(/\s+/g, '')

export const supabase = createBrowserClient(
  pulisci(process.env.NEXT_PUBLIC_SUPABASE_URL),
  pulisci(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
)
