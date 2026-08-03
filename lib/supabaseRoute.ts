import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Client per le route handler chiamate dal browser dell'utente loggato
// (es. /api/push/subscribe). Legge il cookie di sessione, così le query
// partono col ruolo "authenticated" e passano le policy RLS.
//
// Da usare al posto del client admin ogni volta che la richiesta arriva da
// una persona: il service role scavalcherebbe RLS e renderebbe l'endpoint
// scrivibile da chiunque.
export async function createRouteClient() {
  const cookieStore = await cookies()

  return createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\s+/g, ''),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/\s+/g, ''),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Il rinnovo della sessione lo fa già proxy.ts; qui può fallire
            // se la risposta è già stata inviata, e va bene così.
          }
        },
      },
    }
  )
}
