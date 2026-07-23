import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { buildChangeGroups } from '@/lib/roomChanges'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

webpush.setVapidDetails(
  'mailto:amerigogranata@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function normalizePhone(p: string) {
  const raw = p.trim().replace(/\D/g, '')
  return raw.startsWith('39') ? raw : `39${raw}`
}

function buildRingraziamentoMsg(name: string) {
  return `Gentile *${name}*,
grazie per aver soggiornato a Casa Granata Humanitas, è stato un piacere ospitarla.
Spero che tutto sia andato bene. Se trova un momento per lasciare una recensione, per me vorrebbe dire moltissimo: https://maps.google.com/?cid=12687762198889638693

E se dovesse ripassare da queste parti, saremo sempre felici di ospitarla di nuovo!

Un caro saluto,
Ania
Casa Granata Humanitas`
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oggi = todayStr()

  // Servono tutte le prenotazioni attive (non solo quelle in partenza oggi) per
  // ricostruire le catene dei cambi camera con la stessa logica del resto dell'app.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, rooms(name), guests(full_name, phone)')
    .neq('status', 'annullata')

  const partenzeOggi = (bookings || []).filter((b: any) => b.check_out === oggi)

  if (partenzeOggi.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Nessuna partenza oggi' })
  }

  // Esclude i cambi camera a metà soggiorno: un segmento che oggi "esce" da una
  // camera per proseguire in un'altra ha un arco uscente nella catena. Restano
  // solo le partenze definitive, cioè gli ultimi segmenti del soggiorno.
  const { edges } = buildChangeGroups(bookings || [])
  const proseguono = new Set(edges.map((e) => e.fromId))
  const partenzeVere = partenzeOggi.filter((b: any) => {
    if (proseguono.has(b.id)) return false
    // Sicurezza extra: se lo stesso ospite ha un'altra prenotazione che inizia
    // proprio oggi (prolungamento nella stessa camera o cambio non concatenato),
    // il soggiorno continua e non è una partenza definitiva.
    const continua = (bookings || []).some(
      (x: any) => x.id !== b.id && b.guest_id && x.guest_id === b.guest_id && x.check_in === b.check_out
    )
    return !continua
  })

  if (partenzeVere.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Solo cambi camera oggi, nessuna vera partenza' })
  }

  const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, partenze: partenzeVere.length, message: 'Nessuna subscription' })
  }

  const conTelefono = partenzeVere.filter((b: any) => b.guests?.phone)

  let titolo: string
  let corpo: string
  let url: string

  if (conTelefono.length === 1 && partenzeVere.length === 1) {
    const b = conTelefono[0]
    const nome = b.guests?.full_name || 'Ospite'
    const phone = normalizePhone(b.guests.phone)
    const msg = buildRingraziamentoMsg(nome)
    titolo = `🙏 ${nome} è partito/a oggi`
    corpo = `Tocca per mandare subito il ringraziamento su WhatsApp.`
    url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  } else {
    const lines = partenzeVere.map((b: any) => {
      const camera = b.rooms?.name || 'Camera'
      const nome = b.guests?.full_name || 'Ospite'
      const senzaTel = b.guests?.phone ? '' : ' (senza telefono)'
      return `• ${camera}: ${nome}${senzaTel}`
    })
    titolo = `🙏 ${partenzeVere.length} ${partenzeVere.length === 1 ? 'partenza' : 'partenze'} oggi da ringraziare`
    corpo = lines.join('\n')
    url = '/prenotazioni'
  }

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: titolo, body: corpo, url })
      )
      sent++
    } catch (e) {
      // subscription scaduta, ignora
    }
  }

  return NextResponse.json({ sent, partenze: partenzeVere.length })
}
