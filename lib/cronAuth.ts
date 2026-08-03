import type { NextRequest } from 'next/server'

// Autorizzazione delle route dei cron.
//
// Vercel Cron manda da solo l'header `Authorization: Bearer <CRON_SECRET>`
// quando la variabile CRON_SECRET è configurata nel progetto: è il modo
// giusto, perché il segreto non compare più né in vercel.json né negli URL
// (che finiscono nei log).
//
// Resta accettato anche ?secret= per poter lanciare le notifiche a mano dal
// telefono, ma confrontato con la stessa variabile d'ambiente.

// Il valore incollato nel pannello di Vercel può portarsi dietro spazi o un
// a capo (è già successo con le chiavi Supabase, dove l'a capo stava
// addirittura in mezzo al valore). Qui li togliamo da entrambi i lati del
// confronto, altrimenti l'unico sintomo è un "Unauthorized" inspiegabile.
function pulisci(v: string | null | undefined): string {
  return (v ?? '').replace(/\s+/g, '')
}

export function isCronAuthorized(req: NextRequest): boolean {
  const expected = pulisci(process.env.CRON_SECRET)
  if (!expected) return false

  const header = req.headers.get('authorization') ?? ''
  if (header.startsWith('Bearer ') && pulisci(header.slice(7)) === expected) {
    return true
  }

  return pulisci(req.nextUrl.searchParams.get('secret')) === expected
}
