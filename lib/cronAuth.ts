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
export function isCronAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const header = req.headers.get('authorization')
  if (header === `Bearer ${expected}`) return true

  return req.nextUrl.searchParams.get('secret') === expected
}
