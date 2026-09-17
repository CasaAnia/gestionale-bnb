// ============================================================================
// «AGGIUNGI CAMERA» (17/09/2026): dalla scheda nuova si aggiunge una camera
// in parallelo alla prenotazione che c'è già, con la pagina di inserimento
// nuova (/nuova-prenotazione?prenotazione=…). Le camere di una prenotazione
// stanno insieme per prenotazione_id (lib/prenotazioneUnica): se la
// prenotazione è vecchia e non ce l'ha, prima si scrive lo stesso legame su
// tutte le sue righe attive, poi si va a inserire. La pagina di inserimento
// mette la camera nuova nello stesso legame e NON tocca come paga né la
// caparra: quelli sono della prenotazione, e ci sono già.
// Funzioni pure: la scrittura del legame la fa la scheda con lib/righeDati.
// ============================================================================
export const COMANDO_AGGIUNGI_CAMERA = 'Aggiungi camera'
export const AVVISO_AGGIUNTA = 'Stai aggiungendo una camera a una prenotazione che c’è già: come paga e la caparra restano quelli, il conto le mette insieme.'
export const ERRORE_SENZA_CAMERE = 'Non c’è nessuna camera attiva a cui aggiungerne un’altra.'

export type RigaLegame = { id: string; status?: string | null; prenotazione_id?: string | null }

/** Il legame da scrivere prima di aggiungere: null se c'è già (si usa quello) */
export function legameDaScrivere(righe: RigaLegame[], nuovoId: () => string): { ids: string[]; prenotazioneId: string } | { prenotazioneId: string; ids: [] } | null {
  const attive = righe.filter(r => r.status !== 'annullata')
  if (attive.length === 0) return null
  const esistente = attive.find(r => r.prenotazione_id)?.prenotazione_id
  if (esistente) return { prenotazioneId: esistente, ids: [] }
  return { prenotazioneId: nuovoId(), ids: attive.map(r => r.id) }
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
