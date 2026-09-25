// Dati della pagina Pulizie approvata il 25/09/2026, dalle stesse regole
// della Home (lib/pulizie): funzioni pure, provate in node.
import {
  attive, cicloCambio, confrontaDecisioni, partenzeAperte, soggiornoContinuativo, cambioCameraOut, addDaysStr,
  type Decisione, type PrenotazionePulizie, type TipoPulizia,
} from './pulizie.ts'
import { proponiAssettoDaSoggiorno, type AssettoPulizia } from './dotazionePulizie.ts'

export const lettiTesto = (a: AssettoPulizia) => [a.matrimoniali ? '1 matrimoniale' : '', a.singoli ? `${a.singoli} ${a.singoli === 1 ? 'singolo' : 'singoli'}` : ''].filter(Boolean).join(' + ')
export const completiTesto = (n: number) => `${n} ${n === 1 ? 'completo' : 'completi'} asciugamani`
export const dataNumerica = (s: string) => s.split('-').reverse().join('/')

// Letti preparati da mostrare sulla camera: la proposta del soggiorno.
export function lettiProposti(camera: string, b: PrenotazionePulizie, giorno: string): string {
  const a = proponiAssettoDaSoggiorno(camera, b as Parameters<typeof proponiAssettoDaSoggiorno>[1], giorno)
  if (!a) {
    const n = Number(b.num_guests)
    return Number.isInteger(n) && n === 1 && camera !== 'Amelia' ? `1 matrimoniale uso singolo · federe da scegliere · ${completiTesto(1)}` : 'Letti da confermare'
  }
  return `${lettiTesto(a)}${a.matrimoniali && !a.singoli && a.ospiti === 1 ? ' uso singolo' : ''} · ${completiTesto(a.ospiti)}`
}

// Confermate nel giorno: interventi con quella data effettiva (mai le decisioni).
export const confermateNelGiorno = (events: Decisione[], giorno: string) => events.filter(e => e.stato === 'fatta' && (e.data_effettiva || e.data_prevista) === giorno).length

// Prossime pulizie di ogni camera (dopo oggi): cambi ogni quattro notti,
// partenze rimandate e fine soggiorno. Gli arrivi non sono pulizie.
export type ProssimaPulizia = { roomId: string; data: string; tipo: TipoPulizia; booking: PrenotazionePulizie; rimandata: boolean }
export function prossimePulizie(tutte: PrenotazionePulizie[], roomIds: string[], oggi: string, events: Decisione[]): ProssimaPulizia[] {
  const bookings = attive(tutte)
  const out: ProssimaPulizia[] = []
  for (const roomId of roomIds) {
    const voci: ProssimaPulizia[] = []
    const inCorso = bookings.find(b => b.room_id === roomId && b.check_in <= oggi && b.check_out > oggi)
    if (inCorso) {
      const ciclo = cicloCambio(bookings, inCorso, events)
      if (ciclo.due && ciclo.due > oggi) voci.push({ roomId, data: ciclo.due, tipo: 'soggiorno', booking: inCorso, rimandata: ciclo.rinvii.length > 0 })
      const { fine } = soggiornoContinuativo(bookings, inCorso)
      voci.push({ roomId, data: fine.check_out, tipo: cambioCameraOut(bookings, fine) ? 'cambio_camera' : 'fine_soggiorno', booking: fine, rimandata: false })
    }
    for (const p of partenzeAperte(bookings, roomId, oggi, events).filter(p => p.due > oggi)) voci.push({ roomId, data: p.due, tipo: 'fine_soggiorno', booking: p.partenza, rimandata: true })
    voci.sort((a, b) => a.data.localeCompare(b.data))
    if (voci[0]) out.push(voci[0])
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.roomId.localeCompare(b.roomId))
}

// Rinvii e salti ancora in corso: l'ultima decisione di una pulizia che
// sposta la data a oggi o dopo. Non sono lavori eseguiti.
export function rinviiInCorso(events: Decisione[], oggi: string): Decisione[] {
  const ultime = new Map<string, Decisione>()
  for (const e of [...events].sort(confrontaDecisioni)) ultime.set(`${e.room_id}:${e.booking_id}:${e.tipo}`, e)
  return [...ultime.values()].filter(e => (e.stato === 'rimandata' || e.stato === 'saltata') && !!e.prossima_data && e.prossima_data >= oggi && e.data_prevista >= addDaysStr(oggi, -14))
    .sort((a, b) => String(a.prossima_data).localeCompare(String(b.prossima_data)))
}
