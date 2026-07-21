// Notifica push "camere da pulire domani": partenze (check-out) + cambio
// biancheria ogni NOTTI_CAMBIO notti per gli ospiti in corso. Stessa logica
// di /pulizie (app/pulizie/page.tsx), riscritta qui in modo indipendente e
// senza stato React perché deve girare lato server (cron + route di test).
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:amerigogranata@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const NOTTI_CAMBIO = 4

function addDaysStr(s: string, n: number) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Prolungamenti: stesso ospite, stessa camera, date contigue = un unico soggiorno.
// Stessa definizione usata in /pulizie.
function continuaIn(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && x.room_id === b.room_id && b.guest_id && x.guest_id === b.guest_id && x.check_in === b.check_out) || null
}
function continuaDa(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && x.room_id === b.room_id && b.guest_id && x.guest_id === b.guest_id && x.check_out === b.check_in) || null
}

export type RigaPulizia = { shortName: string; motivo: string }

// Camere da pulire nel giorno `giorno` (YYYY-MM-DD): partenza quel giorno
// e/o cambio biancheria in scadenza quel giorno (o già scaduto) per un
// ospite ancora presente. Rispetta linen_next_date se è stato spostato
// a mano dalla pagina Pulizie (rimane valido finché non arriva la scadenza).
export function calcolaPulizie(rooms: any[], bookings: any[], giorno: string): RigaPulizia[] {
  const righe: RigaPulizia[] = []
  for (const room of rooms) {
    const motivi: string[] = []

    const partenza = bookings.find(b => b.room_id === room.id && b.check_out === giorno && !continuaIn(bookings, b))
    if (partenza) motivi.push('partenza')

    const inCorso = bookings.find(b => b.room_id === room.id && b.check_in <= giorno && b.check_out > giorno)
    if (inCorso) {
      let inizio = inCorso
      const tratto = [inCorso]
      for (let prev = continuaDa(bookings, inizio); prev; prev = continuaDa(bookings, prev)) { inizio = prev; tratto.push(prev) }
      let fine = inCorso
      for (let next = continuaIn(bookings, fine); next; next = continuaIn(bookings, next)) { fine = next; tratto.push(next) }
      const salvata = inCorso.linen_next_date ?? tratto.map(b => b.linen_next_date).filter(Boolean).sort().slice(-1)[0]
      const due = salvata ?? addDaysStr(inizio.check_in, NOTTI_CAMBIO)
      if (due <= giorno && due < fine.check_out) motivi.push('cambio biancheria')
    }

    if (motivi.length > 0) {
      righe.push({ shortName: room.name.split(' ').slice(-1)[0], motivo: motivi.join(' + ') })
    }
  }
  return righe
}

// Calcola le pulizie del giorno indicato e invia la notifica push a tutti gli
// iscritti. Riutilizzata dal cron giornaliero (/api/push/send) e dalla route
// di test manuale (/api/push/pulizie).
export async function inviaPulizieNotification(supabase: any, giorno: string) {
  const [{ data: rooms }, { data: bookings }] = await Promise.all([
    supabase.from('rooms').select('*').eq('active', true),
    supabase.from('bookings').select('*').neq('status', 'annullata'),
  ])

  const righe = calcolaPulizie(rooms || [], bookings || [], giorno)
  if (righe.length === 0) return { sent: 0, camere: 0, message: 'Nessuna pulizia in programma' }

  const lines = righe.map(r => `• ${r.shortName}: ${r.motivo}`)
  const titolo = `🧹 ${righe.length} ${righe.length === 1 ? 'camera' : 'camere'} da pulire domani`
  const corpo = lines.join('\n')

  const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
  if (!subs || subs.length === 0) return { sent: 0, camere: righe.length, error: 'Nessuna subscription' }

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: titolo, body: corpo, url: '/pulizie' })
      )
      sent++
    } catch (e) {
      // subscription scaduta, ignora
    }
  }
  return { sent, camere: righe.length }
}
