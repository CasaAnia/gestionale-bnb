import { NextRequest, NextResponse } from 'next/server'
import { inviaPulizieNotification } from '@/lib/puliziePush'
import { inviaATutti } from '@/lib/inviaPush'
import { registraPush } from '@/lib/pushLog'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { attive, addDaysStr, todayStr } from '@/lib/pulizie'
import { suffissoNavettaNotifica } from '@/lib/navetta'
import { type Riga, pretendi, rispostaErroreCron, statoPerEsitoInvio } from '@/lib/cronLettura'

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

  // Parte 3 (05/09/2026): ogni lettura controlla error; una lettura fallita
  // risponde 500 con il motivo, mai 200 con «nessun arrivo domani».
  try {
  // --- Notifica arrivi di domani ---
  // Solo prenotazioni confermate: le richieste "in attesa" dal sito non
  // sono ospiti (Caso 2 dell'audit del 24/08/2026).
  const bookings = pretendi<Riga[]>(await supabase
    .from('bookings')
    .select('*, rooms(name), guests(full_name)')
    .eq('check_in', tomorrowStr)
    .neq('status', 'annullata'), 'leggere gli arrivi di domani')

  const arriviDomani = attive(bookings)

  // Ospiti già in struttura che domani si spostano (cambio camera): per loro
  // la navetta non ha senso, non va segnalata come "da definire".
  const uscite = pretendi<Riga[]>(await supabase
    .from('bookings')
    .select('guest_id, status')
    .eq('check_out', tomorrowStr)
    .neq('status', 'annullata'), 'leggere le partenze di domani')
  const inCasa = new Set(attive(uscite).map((b: any) => b.guest_id).filter(Boolean))

  let arrivi: any = { sent: 0, message: 'Nessun arrivo domani' }
  let statoArrivi = 200
  if (arriviDomani.length > 0) {
    const lines = arriviDomani.map((b: any) => {
      const camera = b.rooms?.name || 'Camera'
      const ospite = b.guest_name || b.guests?.full_name || 'Ospite'
      const orario = b.check_in_time ? ` 🕐 ${b.check_in_time}` : ''
      const letto = b.extra_bed ? ' 🛏 +letto' : ''
      const navetta = inCasa.has(b.guest_id) ? '' : suffissoNavettaNotifica(b)
      return `• ${camera}: ${ospite}${orario}${letto}${navetta}`
    })

    const titolo = `🏠 ${arriviDomani.length} ${arriviDomani.length === 1 ? 'arrivo' : 'arrivi'} domani`
    const corpo = lines.join('\n')
    const esito = await inviaATutti(supabase, { title: titolo, body: corpo, url: '/calendario' })
    await registraPush(supabase, 'arrivi', titolo, corpo, { giorno: tomorrowStr }, esito.inviate)
    arrivi = { sent: esito.inviate, bookings: arriviDomani.length, rimosse: esito.rimosse, errori: esito.errori }
    statoArrivi = statoPerEsitoInvio(esito)
  }

  // --- Notifica pulizie in scadenza domani ---
  const pulizie = await inviaPulizieNotification(supabase, oggi)
  const statoPulizie = pulizie.camere > 0 ? statoPerEsitoInvio({ inviate: pulizie.sent, errori: pulizie.errori ?? [] }) : 200

  return NextResponse.json({ ok: statoArrivi === 200 && statoPulizie === 200, arrivi, pulizie }, { status: Math.max(statoArrivi, statoPulizie) })
  } catch (e) {
    const r = rispostaErroreCron(e)
    if (r) return NextResponse.json(r.body, { status: r.status })
    throw e
  }
}
