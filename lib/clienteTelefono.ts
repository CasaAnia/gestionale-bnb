// ============================================================================
// CLIENTE RICONOSCIUTO DAL NUMERO (Ania, 07/09/2026): «Errore creazione
// cliente: duplicate key value violates unique constraint guests_phone_key»
// nella Nuova prenotazione. Il numero di telefono identifica la scheda
// (guests.phone è UNIQUE): quando la ricerca per nome non trova la scheda
// (nome scritto diverso da come è salvato) e Ania scrive il numero di un
// cliente già in archivio, oppure quando la scheda è appena stata creata
// dalla prima camera e si aggiunge un cambio camera, il gestionale NON deve
// creare una seconda scheda: riconosce quella esistente e la usa.
// Funzioni pure; la lettura sta in lib/clienteTelefonoDati.
// ============================================================================
import { normalizzaTelefono } from './whatsapp.ts'
import { normalizzaNome } from './guestName.ts'
import { conIniziali } from './maiuscole.ts'

// Solo cifre, col prefisso 39 aggiunto ai numeri italiani senza prefisso
export function cifreTelefono(raw: string | null | undefined): string {
  return normalizzaTelefono(raw).numero
}

// Stesso numero anche se salvato in forme diverse («+39 333 000 0001»,
// «393330000001», «3330000001»): confronto sulle cifre, con o senza il 39.
export function stessoNumero(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = cifreTelefono(a), cb = cifreTelefono(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  const senza = (c: string) => (c.startsWith('39') && c.length > 9 ? c.slice(2) : c)
  return senza(ca) === senza(cb)
}

// Schema ilike per PostgREST che trova il numero in qualunque forma salvata:
// le ultime 9 cifre separate da «%» («%3%3%3%0%0%0%0%0%0%1%»). Chi legge
// riverifica poi con stessoNumero, così un'interposizione di cifre non
// inganna. Null con meno di 6 cifre (troppo poco per cercare).
export function schemaRicercaTelefono(raw: string | null | undefined): string | null {
  const cifre = cifreTelefono(raw)
  if (cifre.length < 6) return null
  return '%' + cifre.slice(-9).split('').join('%') + '%'
}

// Fra le righe lette, la scheda con davvero lo stesso numero (la più recente prima)
export function schedaConNumero<T extends { phone?: string | null }>(righe: T[], raw: string | null | undefined): T | null {
  return righe.find(g => stessoNumero(g.phone, raw)) ?? null
}

// Il nome scritto nel modulo resta su QUESTA prenotazione (bookings.guest_name)
// se è diverso da quello della scheda riconosciuta: la scheda non si rinomina
// (figlio che prenota per il genitore, coniugi con lo stesso numero).
export function nomeSuPrenotazione(scritto: string | null | undefined, scheda: string | null | undefined): string | null {
  const s = conIniziali(scritto)
  if (!s) return null
  return normalizzaNome(s) === normalizzaNome(scheda) ? null : s
}

// Riga sotto «Cliente trovato» che spiega cos'è successo
export function testoClienteRiconosciuto(scheda: { full_name?: string | null; phone?: string | null }, nomeSu: string | null): string {
  const chi = (scheda.full_name || '').trim() || 'una scheda senza nome'
  const base = `Numero già in archivio: uso la scheda di ${chi}.`
  return nomeSu ? `${base} «${nomeSu}» resta come nome di questa prenotazione, la scheda non cambia.` : base
}
