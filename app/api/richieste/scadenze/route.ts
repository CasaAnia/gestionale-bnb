import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { isCronAuthorized } from '@/lib/cronAuth'
import { inviaPushover } from '@/lib/pushover'
import { daNotificare, daChiudere, testoNotifica, OPZIONI_PUSHOVER_SCADENZA, type RichiestaScadenza } from '@/lib/richiesteScadenze'

// Scadenza dell'opzione di 3 ore (06/09/2026). Chiamata ogni 5 minuti da
// pg_cron + pg_net (migrazione 0040) con lo stesso segreto dei cron Vercel:
// funziona anche col gestionale chiuso.
//  1. proposte scadute da più di 3 ore e mai notificate → Pushover con suono
//     diverso e priorità «emergenza» (ripete finché Ania conferma), poi
//     scadenza_notificata_at, così la notifica parte una volta sola;
//  2. scadute da più di 24 ore → stato «chiusa», motivo «scaduta».
// Ogni lettura controlla error: una lettura fallita risponde 500, mai 200.
export const dynamic = 'force-dynamic'

async function esegui(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createAdminClient()
  const adesso = new Date()
  const { data, error } = await supabase.from('richieste')
    .select('id, nome, cognome, stato, arrivo, partenza, proposta_inviata_at, scadenza_notificata_at, proposta_soluzione')
    .eq('stato', 'proposta_inviata').not('proposta_inviata_at', 'is', null)
  if (error) return NextResponse.json({ error: `lettura richieste: ${error.message}` }, { status: 500 })
  const righe = (data ?? []) as unknown as RichiestaScadenza[]
  const base = (process.env.NEXT_PUBLIC_GESTIONALE_URL ?? 'https://gestionale-bnb-tau.vercel.app').replace(/\/$/, '')
  const errori: string[] = []
  let notificate = 0, chiuse = 0

  for (const r of daNotificare(righe, adesso)) {
    const t = testoNotifica(r)
    const esito = await inviaPushover(t.titolo, t.messaggio, `${base}/richieste?apri=${r.id}`, OPZIONI_PUSHOVER_SCADENZA)
    if (!esito.inviato) { errori.push(`pushover ${r.id}: ${esito.motivo ?? ''}`); continue }
    const { error: e2 } = await supabase.from('richieste').update({ scadenza_notificata_at: adesso.toISOString() }).eq('id', r.id)
    if (e2) errori.push(`segna notifica ${r.id}: ${e2.message}`)
    else notificate += 1
  }

  for (const r of daChiudere(righe, adesso)) {
    const { error: e3 } = await supabase.from('richieste')
      .update({ stato: 'chiusa', chiusura_motivo: 'scaduta', chiusa_at: adesso.toISOString() })
      .eq('id', r.id).eq('stato', 'proposta_inviata')
    if (e3) errori.push(`chiusura ${r.id}: ${e3.message}`)
    else chiuse += 1
  }

  return NextResponse.json({ adesso: adesso.toISOString(), aperte: righe.length, notificate, chiuse, errori }, { status: errori.length > 0 ? 207 : 200 })
}

export async function GET(req: NextRequest) { return esegui(req) }
export async function POST(req: NextRequest) { return esegui(req) }
