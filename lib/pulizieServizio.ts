'use client'
import { supabase } from './supabase'
import { eseguiOperazionePulizia, type RichiestaPulizia, type RispostaPulizia } from './pulizieOperazioni'

export async function inviaOperazionePulizia(camera: string, richiesta: RichiestaPulizia | null) {
  try {
    return await eseguiOperazionePulizia(camera, richiesta, window.localStorage, async (id, r) => {
      const esito = await supabase.rpc('gestisci_pulizia', { p_operazione: id, p_richiesta: r })
      return { data: esito.data as RispostaPulizia | null, error: esito.error }
    }, () => crypto.randomUUID())
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
