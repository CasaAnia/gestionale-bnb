// ============================================================================
// Le righe delle ALTRE schede dello stesso cliente (stesso telefono), per la
// scheda prenotazione (17/11/2026). Letture a pagine e complete: se una non
// arriva intera si torna l'errore, mai una lista a metà che sembra completa
// (lib/statistiche/paginazione). Solo letture.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { raccogliPagine, aBlocchi } from './statistiche/paginazione.ts'
import { schedeStessoTelefono } from './spesoCliente.ts'

export const ERRORE_SCHEDE_GEMELLE = 'Non riesco a leggere le altre schede dello stesso cliente.'

export async function leggiSchedeGemelle(db: SupabaseClient, guestId: string, telefono: string | null | undefined): Promise<{ righe: Record<string, unknown>[]; errore: string | null }> {
  try {
    if (!telefono) return { righe: [], errore: null }
    const schede = await raccogliPagine<{ id: string; phone: string | null }>((da, limite) =>
      db.from('guests').select('id, phone').order('id').range(da, da + limite - 1) as unknown as PromiseLike<{ data: { id: string; phone: string | null }[] | null; error: unknown }>)
    if (schede.error) return { righe: [], errore: ERRORE_SCHEDE_GEMELLE }
    const ids = schedeStessoTelefono(guestId, telefono, schede.data)
    if (ids.length === 0) return { righe: [], errore: null }
    const righe: Record<string, unknown>[] = []
    for (const blocco of aBlocchi(ids)) {
      const r = await raccogliPagine<Record<string, unknown>>((da, limite) =>
        db.from('bookings').select('*, rooms(name), guests(full_name, phone)').in('guest_id', blocco).order('id').range(da, da + limite - 1) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>)
      if (r.error) return { righe: [], errore: ERRORE_SCHEDE_GEMELLE }
      righe.push(...r.data)
    }
    return { righe, errore: null }
  } catch { return { righe: [], errore: ERRORE_SCHEDE_GEMELLE } }
}
