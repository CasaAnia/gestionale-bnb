// La prenotazione contiene camere parallele; il gruppo contiene soltanto
// i periodi di un cambio camera. Non si deducono legami da cliente o date.
export type IdentitaPrenotazione = { id: string; prenotazione_id?: string | null; group_id?: string | null }
export type RigaPrenotazione = IdentitaPrenotazione & {
  status: string; check_in: string; check_out: string; guest_id?: string | null
  total_amount?: number | string | null; bonifico?: boolean | null
  accordo_pagamento?: string | null; caparra_centesimi?: number | null; caparra_entro?: string | null
}
export const chiavePrenotazione = (b: IdentitaPrenotazione) => b.prenotazione_id || b.group_id || b.id
export function filtroPrenotazione(b: IdentitaPrenotazione): { colonna: 'prenotazione_id' | 'group_id' | 'id'; valore: string } {
  return b.prenotazione_id ? { colonna: 'prenotazione_id', valore: b.prenotazione_id }
    : b.group_id ? { colonna: 'group_id', valore: b.group_id } : { colonna: 'id', valore: b.id }
}
export function periodiCamera<T extends RigaPrenotazione>(b: IdentitaPrenotazione, righe: T[]): T[] {
  return righe.filter(r => r.status !== 'annullata' && (b.group_id ? r.group_id === b.group_id : r.id === b.id))
    .sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))
}
export const ERRORE_CONTO_INCOMPLETO = 'Non riesco a leggere tutte le camere della prenotazione. Ricarica la scheda prima di modificare il conto.'
export async function leggiPrenotazioneUnica<T extends RigaPrenotazione>(
  b: T, leggi: (filtro: ReturnType<typeof filtroPrenotazione>) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ righe: T[]; errore: string | null }> {
  try {
    const r = await leggi(filtroPrenotazione(b))
    if (r.error || !r.data?.length || !r.data.some(x => x.id === b.id) ||
      new Set(r.data.map(x => x.id)).size !== r.data.length ||
      r.data.some(x => chiavePrenotazione(x) !== chiavePrenotazione(b) || x.guest_id !== b.guest_id || (x.status !== 'annullata' && (x.total_amount == null || !Number.isFinite(Number(x.total_amount)))))) {
      return { righe: [], errore: ERRORE_CONTO_INCOMPLETO }
    }
    return { righe: r.data.sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id)), errore: null }
  } catch { return { righe: [], errore: ERRORE_CONTO_INCOMPLETO } }
}
// L'incasso di un segmento annullato resta nel conto; il suo prezzo non è più dovuto.
export function contoPrenotazione(righe: RigaPrenotazione[], pagamenti: { booking_id: string; amount: number | string }[]) {
  const ids = new Set(righe.map(r => r.id))
  const valide = righe.filter(r => r.status !== 'annullata')
  if (valide.some(r => r.total_amount == null || !Number.isFinite(Number(r.total_amount)))) throw new Error(ERRORE_CONTO_INCOMPLETO)
  const totaleCent = valide.reduce((s, r) => s + Math.round(Number(r.total_amount) * 100), 0)
  const ricevutiCent = pagamenti.filter(p => ids.has(p.booking_id)).reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0)
  return { totaleCent, ricevutiCent, residuoCent: totaleCent - ricevutiCent }
}
// La caparra è registrata una volta sola. Si legge anche aprendo un'altra camera.
export function accordoPrenotazione<T extends RigaPrenotazione>(righe: T[]): T | undefined {
  const ordinate = [...righe].sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))
  return ordinate.find(r => r.caparra_centesimi != null) || ordinate.find(r => r.accordo_pagamento != null) || ordinate[0]
}
export const haCamereParallele = (righe: IdentitaPrenotazione[]) => new Set(righe.map(r => r.group_id || r.id)).size > 1
