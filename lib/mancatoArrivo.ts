// Il soggiorno non avvenuto libera le notti; il suo credito resta distinto
// dal prezzo originale. Denaro in centesimi, mai un incasso presunto.
export type RigaMancatoArrivo = {
  id: string; status: string; total_amount?: number | string | null
  mancato_arrivo_centesimi?: number | null
  room_id?: string | null; guest_id?: string | null; check_in?: string; check_out?: string
}
export const mancatoArrivo = (r: RigaMancatoArrivo) => r.status === 'annullata' && r.mancato_arrivo_centesimi != null
export function dovutoRigaCent(r: RigaMancatoArrivo): number {
  if (mancatoArrivo(r)) {
    if (!Number.isSafeInteger(r.mancato_arrivo_centesimi) || r.mancato_arrivo_centesimi! < 0) throw new Error('Importo del mancato arrivo non leggibile')
    return r.mancato_arrivo_centesimi!
  }
  if (r.status === 'annullata') return 0
  if (r.total_amount == null || !Number.isFinite(Number(r.total_amount))) throw new Error('Conto non leggibile')
  return Math.round(Number(r.total_amount) * 100)
}
export const fotoMancatoArrivo = (righe: RigaMancatoArrivo[]) => righe.filter(r => r.status !== 'annullata').map(r => ({
  id: r.id, status: r.status, room_id: r.room_id, guest_id: r.guest_id, check_in: r.check_in, check_out: r.check_out,
  totale: Math.round(Number(r.total_amount) * 100),
})).sort((a,b) => a.id.localeCompare(b.id))
export function contoMancatoArrivo(righe: RigaMancatoArrivo[], pagamenti: { booking_id: string; amount: number | string }[]) {
  const ids = new Set(righe.map(r => r.id))
  const originale = righe.filter(r => mancatoArrivo(r) || r.status !== 'annullata').reduce((n,r) => n + Math.round(Number(r.total_amount) * 100),0)
  const dovuto = righe.some(mancatoArrivo) ? righe.reduce((n,r) => n + dovutoRigaCent(r),0) : Math.round(originale / 2)
  const ricevuto = pagamenti.filter(p => ids.has(p.booking_id)).reduce((n,p) => n + Math.round(Number(p.amount)*100),0)
  return { originale, dovuto, ricevuto, residuo: dovuto-ricevuto }
}
