// ============================================================================
// «AGGIUNGI CAMERA» (17/09/2026): dalla scheda nuova si aggiunge una camera
// in parallelo alla prenotazione che c'è già, con la pagina di inserimento
// nuova (/nuova-prenotazione?prenotazione=…). Le camere di una prenotazione
// stanno insieme per prenotazione_id (lib/prenotazioneUnica): se la
// prenotazione è vecchia e non ce l'ha, prima si scrive lo stesso legame su
// TUTTE le sue righe — annullate comprese: un tratto annullato non è più
// dovuto, ma il suo incasso resta nel conto (rilievo della revisione del
// 17/09/2026) — in una richiesta sola, poi si va a inserire. La pagina di
// inserimento mette la camera nuova nello stesso legame, tiene ferma la
// cliente, ricontrolla il legame prima di scrivere e NON tocca come paga né
// la caparra: quelli sono della prenotazione, e ci sono già.
// Funzioni pure: la scrittura del legame la fa la scheda con lib/righeDati.
// ============================================================================
export const COMANDO_AGGIUNGI_CAMERA = 'Aggiungi camera'
export const AVVISO_AGGIUNTA = 'Stai aggiungendo una camera a una prenotazione che c’è già: come paga e la caparra restano quelli, il conto le mette insieme.'
export const ERRORE_SENZA_CAMERE = 'Non c’è nessuna camera attiva a cui aggiungerne un’altra.'
export const CLIENTE_DIVERSO = 'La camera in più va alla stessa cliente della prenotazione: per cambiare cliente si usa «Cambia cliente» dalla scheda.'
export const LEGAME_NON_CONFERMATO = 'Non riesco a confermare la prenotazione a cui aggiungere la camera. Riapri la sua scheda e riprova.'

export type RigaLegame = { id: string; status?: string | null; prenotazione_id?: string | null }

/** Il legame da scrivere prima di aggiungere: `ids` sono le righe che ancora
 *  non ce l'hanno (annullate comprese); vuoto se ce l'hanno già tutte. Null
 *  senza camere attive. */
export function legameDaScrivere(righe: RigaLegame[], nuovoId: () => string): { ids: string[]; prenotazioneId: string } | null {
  if (!righe.some(r => r.status !== 'annullata')) return null
  const esistente = righe.find(r => r.prenotazione_id)?.prenotazione_id
  const prenotazioneId = esistente || nuovoId()
  return { prenotazioneId, ids: righe.filter(r => r.prenotazione_id !== prenotazioneId).map(r => r.id) }
}

/** L'indirizzo dell'inserimento nuovo: stessa cliente, stesse date, stesso legame */
export function hrefAggiungiCamera(p: { guestId: string | null | undefined; prenotazioneId: string; arrivo: string; partenza: string }): string {
  const q = new URLSearchParams()
  if (p.guestId) q.set('guest_id', p.guestId)
  q.set('prenotazione', p.prenotazioneId)
  if (p.arrivo) q.set('check_in', p.arrivo)
  if (p.partenza) q.set('check_out', p.partenza)
  return `/nuova-prenotazione?${q.toString()}`
}

/** Prima di scrivere la camera in più: il legame esiste, ha almeno una camera
 *  attiva, ed è tutto della stessa cliente. */
export function legameConfermato(righe: { guest_id?: string | null; status?: string | null }[] | null | undefined, guestId: string): boolean {
  if (!righe || righe.length === 0) return false
  if (!righe.some(r => r.status !== 'annullata')) return false
  return righe.every(r => r.guest_id === guestId)
}
