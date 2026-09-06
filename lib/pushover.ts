// Avviso SONORO su Pushover (app «CasAnia» sul telefono di Ania): la notifica
// web push su iPhone arriva muta, Pushover suona anche a telefono bloccato.
// Stesso invio già usato dal sito per le prenotazioni (repo sito-casaania,
// app/api/prenota/route.ts). Chiavi PUSHOVER_TOKEN / PUSHOVER_USER nelle
// variabili d'ambiente; se mancano non si invia nulla e lo si dice.
// Opzioni (06/09/2026, scadenza delle proposte): suono diverso e priorità 2
// («emergenza»: Pushover ripete finché Ania non conferma; retry/expire in secondi)
export type OpzioniPushover = { sound?: string; priority?: 0 | 1 | 2; retry?: number; expire?: number; url_title?: string }

export async function inviaPushover(titolo: string, messaggio: string, url: string, opzioni: OpzioniPushover = {}): Promise<{ inviato: boolean; motivo?: string }> {
  const token = (process.env.PUSHOVER_TOKEN ?? '').trim()
  const user = (process.env.PUSHOVER_USER ?? '').trim()
  if (!token || !user) return { inviato: false, motivo: 'PUSHOVER_TOKEN/PUSHOVER_USER non configurati' }
  try {
    const priority = opzioni.priority ?? 1
    const form = new URLSearchParams({
      token, user, title: titolo, message: messaggio,
      priority: String(priority), sound: opzioni.sound ?? 'persistent', url, url_title: opzioni.url_title ?? 'Apri nel gestionale',
      ...(priority === 2 ? { retry: String(opzioni.retry ?? 60), expire: String(opzioni.expire ?? 3600) } : {}),
    })
    const r = await fetch('https://api.pushover.net/1/messages.json', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return { inviato: false, motivo: `Pushover HTTP ${r.status}` }
    return { inviato: true }
  } catch (e) {
    return { inviato: false, motivo: (e as Error)?.message?.slice(0, 80) ?? 'errore' }
  }
}
