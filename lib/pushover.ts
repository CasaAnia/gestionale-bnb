// Avviso SONORO su Pushover (app «CasAnia» sul telefono di Ania): la notifica
// web push su iPhone arriva muta, Pushover suona anche a telefono bloccato.
// Stesso invio già usato dal sito per le prenotazioni (repo sito-casaania,
// app/api/prenota/route.ts). Chiavi PUSHOVER_TOKEN / PUSHOVER_USER nelle
// variabili d'ambiente; se mancano non si invia nulla e lo si dice.
export async function inviaPushover(titolo: string, messaggio: string, url: string): Promise<{ inviato: boolean; motivo?: string }> {
  const token = (process.env.PUSHOVER_TOKEN ?? '').trim()
  const user = (process.env.PUSHOVER_USER ?? '').trim()
  if (!token || !user) return { inviato: false, motivo: 'PUSHOVER_TOKEN/PUSHOVER_USER non configurati' }
  try {
    const form = new URLSearchParams({
      token, user, title: titolo, message: messaggio,
      priority: '1', sound: 'persistent', url, url_title: 'Apri nel gestionale',
    })
    const r = await fetch('https://api.pushover.net/1/messages.json', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return { inviato: false, motivo: `Pushover HTTP ${r.status}` }
    return { inviato: true }
  } catch (e) {
    return { inviato: false, motivo: (e as Error)?.message?.slice(0, 80) ?? 'errore' }
  }
}
