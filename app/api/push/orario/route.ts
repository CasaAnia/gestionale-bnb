import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { inviaATutti } from '@/lib/inviaPush'
import { registraPush } from '@/lib/pushLog'
import { attive, addDaysStr, todayStr } from '@/lib/pulizie'
import { cosaManca } from '@/lib/navetta'

// Cron delle 15 UTC (17:00 italiane d'estate): promemoria delle informazioni
// operative mancanti per gli arrivi di domani. Regola di Ania (24/08/2026):
// parte se manca ALMENO UNA tra orario di arrivo e stato navetta, e per ogni
// ospite dice esattamente cosa manca. Se è tutto definito, nessuna notifica.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const tomorrowStr = addDaysStr(todayStr(), 1)

  // Arrivi di domani (solo confermate: le "in attesa" non sono ospiti) e
  // partenze di domani, per riconoscere i cambi camera: chi si sposta da
  // una camera all'altra è già in struttura, niente da chiedere.
  const [{ data: arriviRaw }, { data: uscite }] = await Promise.all([
    supabase.from('bookings')
      .select('*, rooms(name), guests(full_name, phone)')
      .eq('check_in', tomorrowStr)
      .neq('status', 'annullata'),
    supabase.from('bookings')
      .select('guest_id, status')
      .eq('check_out', tomorrowStr)
      .neq('status', 'annullata'),
  ])

  const inCasa = new Set(attive(uscite || []).map((b: any) => b.guest_id).filter(Boolean))
  const daChiedere = attive(arriviRaw || [])
    .filter((b: any) => !inCasa.has(b.guest_id))
    .map((b: any) => ({ b, manca: cosaManca(b) }))
    .filter(x => x.manca !== null)

  if (daChiedere.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Orario e navetta definiti per tutti gli arrivi di domani' })
  }

  const lines = daChiedere.map(({ b, manca }) => {
    const camera = b.rooms?.name || 'Camera'
    const ospite = b.guest_name || b.guests?.full_name || 'Ospite'
    const phone = b.guests?.phone ? ` 📞 ${b.guests.phone}` : ''
    return `• ${camera}: ${ospite} — ${manca}${phone}`
  })

  const titolo = `⏰ Da definire per domani`
  const corpo = lines.join('\n')

  const esito = await inviaATutti(supabase, { title: titolo, body: corpo, url: '/prenotazioni' })
  await registraPush(supabase, 'orario', titolo, corpo,
    { giorno: tomorrowStr, ospiti: daChiedere.map(({ b, manca }) => ({ id: b.id, manca })) },
    esito.inviate)

  return NextResponse.json({ sent: esito.inviate, bookings: daChiedere.length })
}
