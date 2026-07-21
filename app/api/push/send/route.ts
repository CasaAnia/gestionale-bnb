import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { inviaPulizieNotification } from '@/lib/puliziePush'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

webpush.setVapidDetails(
  'mailto:amerigogranata@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function GET(req: NextRequest) {
  // Verifica secret per sicurezza
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Calcola domani
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // --- Notifica arrivi di domani ---
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(name), guests(full_name)')
    .eq('check_in', tomorrowStr)
    .neq('status', 'annullata')

  let arrivi: any = { sent: 0, message: 'Nessun arrivo domani' }
  if (bookings && bookings.length > 0) {
    const lines = bookings.map((b: any) => {
      const camera = b.rooms?.name || 'Camera'
      const ospite = b.guests?.full_name || 'Ospite'
      const orario = b.check_in_time ? ` 🕐 ${b.check_in_time}` : ''
      const letto = b.extra_bed ? ' 🛏 +letto' : ''
      return `• ${camera}: ${ospite}${orario}${letto}`
    })

    const titolo = `🏠 ${bookings.length} ${bookings.length === 1 ? 'arrivo' : 'arrivi'} domani`
    const corpo = lines.join('\n')

    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    let sent = 0
    if (subs && subs.length > 0) {
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            JSON.parse(sub.subscription),
            JSON.stringify({ title: titolo, body: corpo, url: '/calendario' })
          )
          sent++
        } catch (e) {
          // subscription scaduta, ignora
        }
      }
    }
    arrivi = { sent, bookings: bookings.length }
  }

  // --- Notifica camere da pulire domani (partenze + cambio biancheria ogni 4 notti) ---
  const pulizie = await inviaPulizieNotification(supabase, tomorrowStr)

  return NextResponse.json({ arrivi, pulizie })
}
