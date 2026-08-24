import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { buildChangeGroups } from '@/lib/roomChanges'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { nomePerMessaggio } from '@/lib/guestName'

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

// Stesso identico testo del pulsante "Ringraziamento" nel dettaglio prenotazione
// (buildWhatsappMsg, type 'ringraziamento'): se si cambia uno, cambiare anche l'altro.
function buildRingraziamentoMsg(name: string) {
  return `Gentile ${name},

grazie per aver soggiornato da noi. È stato un piacere averla come nostra ospite e spero che si sia trovata bene. 🌿

Se ha un momento e le fa piacere, può raccontare la sua esperienza lasciandoci una recensione su Google.

Per noi è davvero importante e può essere utile anche a chi sta cercando un posto dove soggiornare vicino a Humanitas.

⭐ Lascia una recensione:
https://maps.google.com/?cid=12687762198889638693

Grazie ancora per averci scelto.

E se dovesse tornare da queste parti, sarà un piacere accoglierla di nuovo.

Un caro saluto,
Ania`
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

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
    const nome = nomePerMessaggio(b.guest_name || b.guests?.full_name) || 'Ospite'
    const phone = normalizePhone(b.guests.phone)
    const msg = buildRingraziamentoMsg(nome)
    titolo = `🙏 ${nome} è partito/a oggi`
    corpo = `Tocca per mandare subito il ringraziamento su WhatsApp.`
    url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  } else {
    const lines = partenzeVere.map((b: any) => {
      const camera = b.rooms?.name || 'Camera'
      const nome = b.guest_name || b.guests?.full_name || 'Ospite'
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
