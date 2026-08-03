import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { inviaATutti } from '@/lib/inviaPush'

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

  const esito = await inviaATutti(supabase, {
    title: '🏠 Casa Ania Rozzano',
    body: 'Test notifica! Le notifiche funzionano.',
    url: '/calendario',
  })

  // Risposta esplicita: dice quanti telefoni hanno ricevuto, quanti indirizzi
  // scaduti sono stati ripuliti e cosa è andato storto sugli altri, invece di
  // fermarsi al primo errore come faceva prima.
  return NextResponse.json({
    inviate: esito.inviate,
    rimosseScadute: esito.rimosse,
    errori: esito.errori,
    suggerimento:
      esito.inviate === 0 && esito.rimosse > 0
        ? 'Le sottoscrizioni erano scadute e sono state rimosse: riattiva le notifiche da Impostazioni.'
        : esito.inviate === 0 && esito.errori.length === 0
          ? 'Nessun telefono registrato: attiva le notifiche da Impostazioni.'
          : undefined,
  })
}
