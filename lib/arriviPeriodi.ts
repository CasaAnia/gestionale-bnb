import { riepilogoPeriodi } from './periodiPrenotazione.ts'
import { MESI_LUNGHI } from './dateItaliane.ts'

type RigaArrivo = { id: string; check_in: string; check_out: string; status?: string | null; rooms?: { name?: string | null } | null }

/** Un rientro dopo una pausa ha un arrivo proprio. Il semplice cambio camera
 * dentro un soggiorno continuo non aggiunge un secondo arrivo in struttura. */
export function arriviDeiPeriodi<T extends RigaArrivo>(righe: T[]): T[] {
  const attive = righe.filter(r => r.status !== 'annullata').sort((a, b) => a.check_in.localeCompare(b.check_in) || a.id.localeCompare(b.id))
  return riepilogoPeriodi(attive).periodi.map(p => attive.find(r => r.check_in === p.arrivo)!)
}

export function etichettaArrivoPeriodo(riga: RigaArrivo): string {
  const [anno, mese, giorno] = riga.check_in.split('-').map(Number)
  return `Arrivo ${giorno} ${MESI_LUNGHI[mese - 1]} ${anno} · ${riga.rooms?.name || 'Camera'}`
}
