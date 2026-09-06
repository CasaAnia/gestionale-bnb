'use client'
// Segnare una pulizia FATTA da fuori dalla pagina Pulizie (Home «Da
// controllare», 06/09/2026): una riga nella tabella cleanings, stessa forma
// di quella scritta dalla pagina (lib/pulizie.Decisione). Esito controllato
// con lib/scritturaSicura: lo schermo cambia solo se il server ha scritto.
import { supabase } from './supabase'
import { scriviPoiAggiorna } from './scritturaSicura'
import type { Decisione, TipoPulizia } from './pulizie'

export type PuliziaDaSegnare = { room_id: string; booking_id: string | null; tipo: TipoPulizia; data_prevista: string }

export async function segnaPuliziaFatta(p: PuliziaDaSegnare, data_effettiva: string): Promise<{ errore: string | null; riga: Decisione | null }> {
  const riga: Decisione = { room_id: p.room_id, booking_id: p.booking_id, tipo: p.tipo, stato: 'fatta', data_prevista: p.data_prevista, data_effettiva, prossima_data: null, cambio_biancheria: true }
  let scritta: Decisione | null = null
  const errore = await scriviPoiAggiorna(
    async () => {
      const res = await supabase.from('cleanings').insert(riga).select().single()
      if (!res.error && res.data) scritta = res.data as Decisione
      return res
    },
    () => {},
  )
  return { errore, riga: errore ? null : scritta }
}
