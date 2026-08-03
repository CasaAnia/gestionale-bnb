import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

type Esito = { inviate: number; rimosse: number; errori: string[] }

// Invia una notifica a tutti i telefoni registrati.
//
// Due comportamenti importanti, entrambi nati da un problema vero:
//
//  1. Un errore su un telefono non ferma gli altri. Prima la route di test
//     usciva al primo errore, quindi bastava una sottoscrizione morta —
//     tipico di un telefono su cui l'app è stata reinstallata — per far
//     sembrare rotte tutte le notifiche.
//
//  2. Le sottoscrizioni scadute vengono cancellate. Quando il servizio push
//     di Apple o Google risponde 404 o 410 significa "questo indirizzo non
//     esiste più": tenerlo in tabella fa solo accumulare errori a ogni invio.
export async function inviaATutti(
  supabase: SupabaseClient,
  payload: { title: string; body: string; url?: string }
): Promise<Esito> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')

  const esito: Esito = { inviate: 0, rimosse: 0, errori: [] }
  if (!subs || subs.length === 0) return esito

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? '/' })
      )
      esito.inviate++
    } catch (e: any) {
      const codice = e?.statusCode
      if (codice === 404 || codice === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        esito.rimosse++
      } else {
        esito.errori.push(`${codice ?? '?'}: ${e?.message ?? 'errore sconosciuto'}`)
      }
    }
  }

  return esito
}
