// Messaggi WhatsApp condivisi fra la scheda prenotazione (sezione Messaggi)
// e la Home «Da controllare» (ritocchi del 07/09/2026): il testo «Richiesta
// orario» vive SOLO qui, così i due bottoni mandano parole identiche.
// Funzioni pure, senza Supabase: si provano con `node --test`.
import { nomeOspite, nomePerMessaggio } from './guestName.ts'

// Testo di «Richiesta orario» (era in app/prenotazioni/[id]/page.tsx,
// buildWhatsappMsg, tipo richiesta_orario): spostato, non copiato.
export function messaggioRichiestaOrario(name: string): string {
  return `Gentile ${name},

il suo arrivo si avvicina e vorrei organizzare al meglio la sua accoglienza. 😊

Quando le sarà possibile, può indicarmi anche indicativamente a che ora pensa di arrivare?

Le ricordo che il check-in è previsto dalle 15:00 alle 20:00.

Se pensa di arrivare prima delle 15:00 o dopo le 20:00, mi avvisi pure per tempo, così possiamo organizzarci.

🏠 Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

A presto,
Ania`
}

// Numero per WhatsApp dal telefono della scheda cliente, come nella scheda
// prenotazione: solo cifre, prefisso 39 se manca; null senza numero.
export function numeroWhatsAppPrenotazione(phone: string | null | undefined): string | null {
  const raw = (phone || '').replace(/\D/g, '')
  return raw ? (raw.startsWith('39') ? raw : `39${raw}`) : null
}

// Lo stesso link wa.me della scheda (waHref): numero + testo già scritto
export function waHrefTesto(numero: string, testo: string): string {
  return testo ? `https://wa.me/${numero}?text=${encodeURIComponent(testo)}` : `https://wa.me/${numero}`
}

export type LinkWhatsApp = { href: string; numero: string; testo: string }

// «Richiesta orario» per una prenotazione: stesso nome dell'ospite, stesso
// testo, stesso link della sezione Messaggi. null senza numero di telefono.
export function whatsappRichiestaOrario(b: { guest_name?: string | null; guests?: { full_name?: string | null; phone?: string | null } | null }): LinkWhatsApp | null {
  const numero = numeroWhatsAppPrenotazione(b.guests?.phone)
  if (!numero) return null
  const testo = messaggioRichiestaOrario(nomePerMessaggio(nomeOspite(b)))
  return { href: waHrefTesto(numero, testo), numero, testo }
}
