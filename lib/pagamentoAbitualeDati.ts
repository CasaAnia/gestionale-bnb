// ============================================================================
// La scrittura di `guests.pagamento_abituale` alla prima prenotazione
// (ritocchi del 29/09/2026, D1; le regole in lib/pagamentoAbituale). Si
// scrive SOLO se la cliente è ancora senza valore (il filtro sta anche nella
// query, così due salvataggi insieme non si pestano). Se non riesce — per
// esempio la colonna della 0062 non c'è ancora — la prenotazione è già salva
// e non si blocca niente: si dice solo in console.
// ============================================================================
import { supabase } from './supabase'
import { COLONNA_PAGAMENTO_ABITUALE, type PagamentoAbituale } from './pagamentoAbituale'

export async function salvaPagamentoAbitualeAllaPrima(guestId: string, valore: PagamentoAbituale): Promise<boolean> {
  try {
    const { error } = await supabase.from('guests').update({ [COLONNA_PAGAMENTO_ABITUALE]: valore }).eq('id', guestId).is(COLONNA_PAGAMENTO_ABITUALE, null)
    if (error) { console.warn('pagamento_abituale non salvato:', error.message); return false }
    return true
  } catch (e) {
    console.warn('pagamento_abituale non salvato:', e)
    return false
  }
}
