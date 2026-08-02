import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'

webpush.setVapidDetails(
  'mailto:amerigogranata@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Solo prenotazioni di domani SENZA orario di arrivo
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(name), guests(full_name, phone)')
    .eq('check_in', tomorrowStr)
    .neq('status', 'annullata')
    .is('check_in_time', null)

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Tutti gli arrivi di domani hanno l\'orario' })
  }

  const lines = bookings.map((b: any) => {
    const camera = b.rooms?.name || 'Camera'
    const ospite = b.guests?.full_name || 'Ospite'
    const phone = b.guests?.phone ? ` 📞 ${b.guests.phone}` : ''
    return `• ${camera}: ${ospite}${phone}`
  })

  const titolo = `⏰ Orario mancante per domani`
  const corpo = `Chiedi l'orario a:\n${lines.join('\n')}`

  const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: titolo, body: corpo, url: '/prenotazioni' })
      )
      sent++
    } catch (e) {}
  }

  return NextResponse.json({ sent, bookings: bookings.length })
}
