import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

// Le chiavi VAPID si configurano qui, una volta per tutti: ogni route che
// invia notifiche passa da inviaATutti, quindi nessuna può dimenticarsele.
// Configurazione pigra (parte 3, 05/09/2026): così il modulo si importa nei
// test senza chiavi e con un finto al posto di web-push.
let vapidConfigurato = false
function inviaConWebPush(sottoscrizione: unknown, corpo: string): Promise<unknown> {
  if (!vapidConfigurato) {
    webpush.setVapidDetails('mailto:amerigogranata@gmail.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    vapidConfigurato = true
  }
  return webpush.sendNotification(sottoscrizione as Parameters<typeof webpush.sendNotification>[0], corpo)
}

export type Esito = { inviate: number; rimosse: number; errori: string[] }
export type Invio = (sottoscrizione: unknown, corpo: string) => Promise<unknown>

// Client minimo usato qui: lettura delle sottoscrizioni e cancellazione di
// quelle scadute. I test passano un finto con la stessa forma.
export type ClientPush = {
  from(tabella: 'push_subscriptions'): {
    select(colonne: string): PromiseLike<{ data: { endpoint: string; subscription: string }[] | null; error: { message?: string } | null }>
    delete(): { eq(colonna: string, valore: string): PromiseLike<{ error: { message?: string } | null }> }
  }
}

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
//
//  3. (parte 3, 05/09/2026) Ogni chiamata a Supabase controlla `error`: una
//     lettura fallita delle sottoscrizioni finisce in `errori` (non «zero
//     telefoni»), una cancellazione fallita viene contata negli errori e
//     NON tra le rimosse, così il log dice cosa è successo davvero.
export async function inviaATutti(
  supabase: SupabaseClient | ClientPush,
  payload: { title: string; body: string; url?: string },
  invia: Invio = inviaConWebPush,
): Promise<Esito> {
  const esito: Esito = { inviate: 0, rimosse: 0, errori: [] }
  const { data: subs, error: erroreLettura } = await (supabase as ClientPush)
    .from('push_subscriptions')
    .select('endpoint, subscription')
  if (erroreLettura) {
    esito.errori.push(`lettura sottoscrizioni: ${erroreLettura.message ?? 'errore sconosciuto'}`)
    return esito
  }
  if (!subs || subs.length === 0) return esito

  for (const sub of subs) {
    try {
      await invia(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? '/' })
      )
      esito.inviate++
    } catch (e: any) {
      const codice = e?.statusCode
      if (codice === 404 || codice === 410) {
        const { error: erroreCancellazione } = await (supabase as ClientPush).from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        if (erroreCancellazione) {
          esito.errori.push(`${codice}: sottoscrizione scaduta ma non cancellata (${erroreCancellazione.message ?? 'errore sconosciuto'})`)
        } else {
          esito.rimosse++
        }
      } else {
        esito.errori.push(`${codice ?? '?'}: ${e?.message ?? 'errore sconosciuto'}`)
      }
    }
  }

  return esito
}
