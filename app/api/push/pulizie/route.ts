import { NextRequest, NextResponse } from 'next/server'
import { inviaPulizieNotification } from '@/lib/puliziePush'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'

// Route manuale per testare la notifica "camere da pulire domani" senza
// aspettare il cron delle 16 (che la invia già insieme a quella arrivi,
// vedi /api/push/send). Non è collegata a un cron su vercel.json: il piano
// Vercel Hobby ne consente solo 2 e sono già usati da send/orario.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const result = await inviaPulizieNotification(supabase, tomorrowStr)
  return NextResponse.json(result)
}
