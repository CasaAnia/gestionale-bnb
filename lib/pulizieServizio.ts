'use client'
import { supabase } from './supabase'
import { eseguiOperazionePulizia, type RichiestaPulizia, type RispostaPulizia } from './pulizieOperazioni'

export async function inviaOperazionePulizia(camera: string, richiesta: RichiestaPulizia | null) {
  try {
    return await eseguiOperazionePulizia(camera, richiesta, window.localStorage, async (id, r) => {
      const esito = await supabase.rpc('gestisci_pulizia', { p_operazione: id, p_richiesta: r })
      return { data: esito.data as RispostaPulizia | null, error: esito.error }
    }, nuovoIdOperazione)
  } catch {
    return { errore: 'Non riesco a conservare il salvataggio su questo dispositivo.', risposta: null }
  } finally { window.dispatchEvent(new Event('pulizie-salvataggi')) }
}

export async function leggiPersonePulizia(bookingId: string | null): Promise<number | null> {
  if (!bookingId) return null
  try {
  const r = await supabase.from('bookings').select('num_guests').eq('id', bookingId).maybeSingle()
  return !r.error && Number.isInteger(r.data?.num_guests) && r.data!.num_guests > 0 ? r.data!.num_guests : null
  } catch { return null }
}

// randomUUID esiste solo su https e localhost: l'anteprima aperta dal
// telefono sulla rete di casa (http) usa getRandomValues, sempre presente.
export function nuovoIdOperazione(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
