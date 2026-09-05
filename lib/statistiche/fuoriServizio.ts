// Periodi di FUORI SERVIZIO per camera: intervalli [da, a) con motivo. Le
// notti chiuse si contano UNA volta anche se gli intervalli si sovrappongono
// (R7). Oggi nessuna tabella li registra: la struttura è in tipi.ts
// (FuoriServizio) e la proposta SQL in supabase/proposte/0034 (non applicata).
import type { CameraStat, FuoriServizio } from './tipi.ts'
import { nottiTra } from './periodo.ts'

// Riga di room_closures come arriva dal database → FuoriServizio
export type RigaChiusura = { room_id: string; da: string; a: string; motivo?: string | null }
export function mappaChiusure(righe: RigaChiusura[] | null | undefined): FuoriServizio[] {
  return (righe ?? []).filter(r => !!r.room_id && !!r.da && !!r.a && r.a > r.da).map(r => ({ room_id: r.room_id, da: r.da, a: r.a, motivo: r.motivo ?? null }))
}

// Finestra in cui la camera è vendibile dentro [da, a): fra in_servizio_dal
// e fuori_servizio_dal (R12: l'archivio è una data, non riscrive il passato).
// null se la camera non è mai vendibile nel periodo. Senza date, il flag
// active = false esclude la camera per intero (limite dichiarato).
export function finestraCamera(c: CameraStat, da: string, a: string): { da: string; a: string } | null {
  if (!c.in_servizio_dal && !c.fuori_servizio_dal && c.active === false) return null
  const inizio = c.in_servizio_dal && c.in_servizio_dal > da ? c.in_servizio_dal : da
  const fine = c.fuori_servizio_dal && c.fuori_servizio_dal < a ? c.fuori_servizio_dal : a
  return fine > inizio ? { da: inizio, a: fine } : null
}

// Giorni vendibili della camera dentro [da, a): finestra meno le notti chiuse
export function giorniVendibiliCamera(c: CameraStat, da: string, a: string, fuoriServizio: FuoriServizio[] = []): number {
  const f = finestraCamera(c, da, a)
  if (!f) return 0
  const giorni = nottiTra(f.da, f.a)
  return Math.max(0, giorni - Math.min(giorni, nottiChiuse(fuoriServizio, c.id, f.da, f.a)))
}

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
