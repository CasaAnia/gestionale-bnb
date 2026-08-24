import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { inviaATutti } from '@/lib/inviaPush'
import { registraPush } from '@/lib/pushLog'
import { attive, addDaysStr, todayStr } from '@/lib/pulizie'

// Cron delle 15 UTC (17:00 italiane d'estate): arrivi di domani ancora
// senza orario, per ricordarsi di chiederlo.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const tomorrowStr = addDaysStr(todayStr(), 1)

  // Solo prenotazioni di domani SENZA orario di arrivo. Solo confermate:
  // le richieste "in attesa" non sono ospiti (audit 24/08/2026).
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(name), guests(full_name, phone)')
    .eq('check_in', tomorrowStr)
    .neq('status', 'annullata')
    .is('check_in_time', null)

  const senzaOrario = attive(bookings || [])
  if (senzaOrario.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Tutti gli arrivi di domani hanno l\'orario' })
  }

  const lines = senzaOrario.map((b: any) => {
    const camera = b.rooms?.name || 'Camera'
    const ospite = b.guest_name || b.guests?.full_name || 'Ospite'
    const phone = b.guests?.phone ? ` 📞 ${b.guests.phone}` : ''
    return `• ${camera}: ${ospite}${phone}`
  })

  const titolo = `⏰ Orario mancante per domani`
  const corpo = `Chiedi l'orario a:\n${lines.join('\n')}`

  const esito = await inviaATutti(supabase, { title: titolo, body: corpo, url: '/prenotazioni' })
  await registraPush(supabase, 'orario', titolo, corpo, { giorno: tomorrowStr }, esito.inviate)

  return NextResponse.json({ sent: esito.inviate, bookings: senzaOrario.length })
}
