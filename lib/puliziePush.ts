// Notifica push "pulizie di domani".
//
// Dopo l'audit del 24/08/2026 questo file non contiene più una copia della
// logica: il calcolo vive in lib/pulizie.ts, lo stesso identico della pagina
// Pulizie. Qui restano solo la composizione del messaggio e l'invio.
//
// Regole del pop-up (fissate con Ania):
//  - si notifica SOLO ciò che scade domani, con motivo, prossimo arrivo e
//    priorità; niente messaggi generici;
//  - gli arretrati compaiono in coda come "in ritardo di N giorni", mai
//    più rietichettati "domani" ogni sera (Caso 1 dell'audit);
//  - se domani non scade nulla, nessuna notifica (gli arretrati restano
//    visibili nella pagina Pulizie);
//  - ogni invio viene registrato in push_log con i dati usati per il
//    calcolo, così un pop-up strano si spiega a posteriori.
import { calcolaNotifica, todayStr, type Notifica } from './pulizie'
import { inviaATutti } from './inviaPush'
import { registraPush } from './pushLog'

// Calcola le pulizie in scadenza domani e invia la notifica.
// `oggi` di default è la data corrente (il cron gira alle 14 UTC = pomeriggio
// italiano, quindi la data UTC coincide con quella italiana).
export async function inviaPulizieNotification(supabase: any, oggi?: string) {
  const giorno = oggi ?? todayStr()
  const [{ data: rooms }, { data: bookings }, { data: events }] = await Promise.all([
    supabase.from('rooms').select('*').eq('active', true),
    supabase.from('bookings').select('*, guests(full_name)').neq('status', 'annullata'),
    // Tabella dello storico (migrazione 0018): finché non esiste, `data`
    // arriva null e il calcolo usa solo linen_next_date (vecchio comportamento)
    supabase.from('cleanings').select('*'),
  ])

  const notifica: Notifica = calcolaNotifica(rooms || [], bookings || [], events || [], giorno)

  if (notifica.domani.length === 0) {
    return { sent: 0, camere: 0, message: 'Nessuna pulizia in scadenza domani', inRitardo: notifica.inRitardo.length }
  }

  const lines = notifica.domani.map(r => `• ${r.testo}`)
  if (notifica.inRitardo.length > 0) {
    lines.push('Ancora da fare:')
    for (const r of notifica.inRitardo) lines.push(`• ${r.testo}`)
  }

  const n = notifica.domani.length
  const titolo = `🧹 ${n} ${n === 1 ? 'pulizia prevista' : 'pulizie previste'} domani`
  const corpo = lines.join('\n')

  const esito = await inviaATutti(supabase, { title: titolo, body: corpo, url: '/pulizie' })
  await registraPush(supabase, 'pulizie', titolo, corpo, { giorno, notifica }, esito.inviate)

  return { sent: esito.inviate, camere: n, inRitardo: notifica.inRitardo.length, rimosse: esito.rimosse, errori: esito.errori }
}
