// Periodi di FUORI SERVIZIO per camera: intervalli [da, a) con motivo. Le
// notti chiuse si contano UNA volta anche se gli intervalli si sovrappongono
// (R7). Oggi nessuna tabella li registra: la struttura è in tipi.ts
// (FuoriServizio) e la proposta SQL in supabase/proposte/0034 (non applicata).
import type { FuoriServizio } from './tipi.ts'
import { nottiTra } from './periodo.ts'

// Unione degli intervalli di una camera dentro [da, a): torna i tratti disgiunti
export function tratteChiuse(intervalli: FuoriServizio[], roomId: string, da: string, a: string): { da: string; a: string }[] {
  const tagli = intervalli
    .filter(f => f.room_id === roomId && f.a > f.da)
    .map(f => ({ da: f.da > da ? f.da : da, a: f.a < a ? f.a : a }))
    .filter(t => t.a > t.da)
    .sort((x, y) => x.da.localeCompare(y.da))
  const uniti: { da: string; a: string }[] = []
  for (const t of tagli) {
    const ultimo = uniti[uniti.length - 1]
    if (ultimo && t.da <= ultimo.a) { if (t.a > ultimo.a) ultimo.a = t.a }
    else uniti.push({ ...t })
  }
  return uniti
}

// Notti chiuse di una camera dentro [da, a), senza doppi conteggi
export function nottiChiuse(intervalli: FuoriServizio[], roomId: string, da: string, a: string): number {
  return tratteChiuse(intervalli, roomId, da, a).reduce((s, t) => s + nottiTra(t.da, t.a), 0)
}
