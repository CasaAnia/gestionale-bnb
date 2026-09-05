import { NextRequest, NextResponse } from 'next/server'
import { inviaPulizieNotification } from '@/lib/puliziePush'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { rispostaErroreCron, statoPerEsitoInvio } from '@/lib/cronLettura'

// Route manuale per testare la notifica "pulizie previste domani" senza
// aspettare il cron delle 16 (che la invia già insieme a quella arrivi,
// vedi /api/push/send). Non è collegata a un cron su vercel.json: il piano
// Vercel Hobby ne consente pochi e sono già usati.
//
// Nota: usa la data del server (UTC). Lanciata a mano tra mezzanotte e le
// 2 di notte italiane calcolerebbe il giorno precedente.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  // Parte 3 (05/09/2026): lettura fallita → 500 col motivo; invio a zero
  // telefoni con errori → 500; mai 200 su un fallimento
  try {
    const result = await inviaPulizieNotification(supabase)
    const status = result.camere > 0 ? statoPerEsitoInvio({ inviate: result.sent, errori: result.errori ?? [] }) : 200
    return NextResponse.json({ ok: status === 200, ...result }, { status })
  } catch (e) {
    const r = rispostaErroreCron(e)
    if (r) return NextResponse.json(r.body, { status: r.status })
    throw e
  }
}
