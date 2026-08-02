import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseRoute'

export async function POST(req: NextRequest) {
  // Questa route la chiama il browser di chi è loggato, non un cron: usa la
  // sessione e non il service role, altrimenti sarebbe un endpoint di
  // scrittura aperto a chiunque.
  const supabase = await createRouteClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  }

  const subscription = await req.json()
  const endpoint = subscription.endpoint || subscription.keys?.endpoint || null
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: 'endpoint mancante', sub: JSON.stringify(subscription) }, { status: 400 })
  }
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint,
    subscription: JSON.stringify(subscription),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
