import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inviaPulizieNotification } from '@/lib/puliziePush'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Route manuale per testare la notifica "camere da pulire domani" senza
// aspettare il cron delle 16 (che la invia già insieme a quella arrivi,
// vedi /api/push/send). Non è collegata a un cron su vercel.json: il piano
// Vercel Hobby ne consente solo 2 e sono già usati da send/orario.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const result = await inviaPulizieNotification(supabase, tomorrowStr)
  return NextResponse.json(result)
}
