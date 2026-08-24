import { NextRequest, NextResponse } from 'next/server'
import { inviaPulizieNotification } from '@/lib/puliziePush'
import { inviaATutti } from '@/lib/inviaPush'
import { registraPush } from '@/lib/pushLog'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { attive, addDaysStr, todayStr } from '@/lib/pulizie'

// Cron giornaliero delle 14 UTC (16:00 italiane d'estate): notifica arrivi
// di domani + pulizie in scadenza domani. A quell'ora la data UTC coincide
// con quella italiana, quindi todayStr() è corretto.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role: il cron gira senza utente loggato, con la chiave anon le
  // policy RLS non gli farebbero leggere nulla.
  const supabase = createAdminClient()

  const oggi = todayStr()
  const tomorrowStr = addDaysStr(oggi, 1)

  // --- Notifica arrivi di domani ---
  // Solo prenotazioni confermate: le richieste "in attesa" dal sito non
  // sono ospiti (Caso 2 dell'audit del 24/08/2026).
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(name), guests(full_name)')
    .eq('check_in', tomorrowStr)
    .neq('status', 'annullata')

  const arriviDomani = attive(bookings || [])

  let arrivi: any = { sent: 0, message: 'Nessun arrivo domani' }
  if (arriviDomani.length > 0) {
    const lines = arriviDomani.map((b: any) => {
      const camera = b.rooms?.name || 'Camera'
      const ospite = b.guest_name || b.guests?.full_name || 'Ospite'
      const orario = b.check_in_time ? ` 🕐 ${b.check_in_time}` : ''
      const letto = b.extra_bed ? ' 🛏 +letto' : ''
      return `• ${camera}: ${ospite}${orario}${letto}`
    })

    const titolo = `🏠 ${arriviDomani.length} ${arriviDomani.length === 1 ? 'arrivo' : 'arrivi'} domani`
    const corpo = lines.join('\n')
    const esito = await inviaATutti(supabase, { title: titolo, body: corpo, url: '/calendario' })
    await registraPush(supabase, 'arrivi', titolo, corpo, { giorno: tomorrowStr }, esito.inviate)
    arrivi = { sent: esito.inviate, bookings: arriviDomani.length }
  }

  // --- Notifica pulizie in scadenza domani ---
  const pulizie = await inviaPulizieNotification(supabase, oggi)

  return NextResponse.json({ arrivi, pulizie })
}
