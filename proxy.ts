import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// In Next 16 il file si chiama proxy.ts (prima era middleware.ts) e la
// funzione esportata deve chiamarsi proxy.
//
// Due compiti:
//  1. rinnovare il cookie di sessione Supabase a ogni richiesta, altrimenti
//     dopo un'ora scade e ti ritrovi sloggata;
//  2. rimandare a /login chi non ha una sessione valida.
//
// Attenzione: questo è solo il cancello davanti alle pagine. La protezione
// vera dei dati sono le policy RLS su Supabase (vedi supabase/rls.sql):
// senza quelle, chiunque abbia la chiave anon può leggere il database
// scavalcando del tutto l'interfaccia.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\s+/g, ''),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/\s+/g, ''),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
          // Le risposte che impostano cookie di sessione non devono essere
          // messe in cache da Vercel, o la sessione di una persona finirebbe
          // servita a un'altra.
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
        },
      },
    }
  )

  // getUser() e non getSession(): getSession si fida del cookie così com'è,
  // getUser lo fa validare dal server Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Così dopo il login torna dove stava andando.
    url.searchParams.set('da', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Tutto tranne:
     * - api      → le route push si autenticano da sole col CRON_SECRET
     * - _next/static, _next/image → file statici e immagini
     * - manifest, service worker, icone e immagini: il telefono li carica
     *   anche prima del login, e se li blocchiamo la PWA non si installa
     */
    '/((?!api|_next/static|_next/image|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)',
  ],
}
