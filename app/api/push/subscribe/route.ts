import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
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
