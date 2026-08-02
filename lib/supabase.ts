import { createBrowserClient } from '@supabase/ssr'

// Client del browser. Usa createBrowserClient (non createClient) perché deve
// leggere e scrivere il cookie di sessione: è quel cookie che fa arrivare a
// Supabase il ruolo "authenticated", senza il quale le policy RLS bloccano
// ogni lettura.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
