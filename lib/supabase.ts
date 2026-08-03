import { createBrowserClient } from '@supabase/ssr'

// Client del browser. Usa createBrowserClient (non createClient) perché deve
// leggere e scrivere il cookie di sessione: è quel cookie che fa arrivare a
// Supabase il ruolo "authenticated", senza il quale le policy RLS bloccano
// ogni lettura.
// trim(): una chiave incollata nel pannello di Vercel può portarsi dietro uno
// spazio o un a capo, che in un'intestazione HTTP fa fallire tutto.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
)
