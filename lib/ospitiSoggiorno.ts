// Presentazione soltanto: non unisce o modifica le righe salvate.
// Un unico soggiorno nella stessa camera, senza pause, con ospiti variabili.
import { giorniSoggiorno, personePerNottePrenotazione, type CameraTariffa } from './prezzoNotti.ts'
export type TrattoOspiti = {
  room_id?: string | null; check_in: string; check_out: string
  num_guests?: number | string | null; persone_notti?: number[] | null
  extra_bed?: boolean | null; extra_bed_dates?: string[] | null; discount_type?: string | null; discount_value?: number | string | null
  rooms?: CameraTariffa & { id?: string | null; bathroom_type?: string | null } | null
}
export type PeriodoOspiti = { arrivo: string; partenza: string; persone: number }
export function ospitiSoggiorno(segmenti: TrattoOspiti[], personeNotti: { giorno: string; persone: number }[] = []): PeriodoOspiti[] | null {
  if (!segmenti.length) return null
  const s = [...segmenti].sort((a, b) => a.check_in.localeCompare(b.check_in))
  const room = s[0].room_id ?? s[0].rooms?.id
  // Mai inferire identità da nomi, né fondere camere contemporanee o pause.
  if (s.length > 1 && (!room || s.some(x => (x.room_id ?? x.rooms?.id) !== room))) return null
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1].check_out !== s[i].check_in) return null
    // Altri cambiamenti di allestimento/condizioni non sono un cambio ospiti.
    if (!!s[i].extra_bed !== !!s[0].extra_bed || (s[i].discount_type || null) !== (s[0].discount_type || null)
      || Number(s[i].discount_value || 0) !== Number(s[0].discount_value || 0)
      || s[i].rooms?.bathroom_type !== s[0].rooms?.bathroom_type) return null
  }
  const esplicite = new Map(personeNotti.map(x => [x.giorno, x.persone]))
  const periodi: PeriodoOspiti[] = []
  for (const tratto of s) {
    const giorni = giorniSoggiorno(tratto.check_in, tratto.check_out)
    if (!giorni.length) return null
    const salvate = personePerNottePrenotazione(tratto.rooms, tratto)
    for (const [i, giorno] of giorni.entries()) {
      const persone = Number(esplicite.get(giorno) ?? tratto.persone_notti?.[i] ?? salvate[i])
      if (!Number.isInteger(persone) || persone < 1) return null
      const fine = new Date(Date.parse(giorno + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10)
      const ultimo = periodi.at(-1)
      if (ultimo && ultimo.persone === persone && ultimo.partenza === giorno) ultimo.partenza = fine
      else periodi.push({ arrivo: giorno, partenza: fine, persone })
    }
  }
  return periodi.length > 1 ? periodi : null
}
export function periodoOspitiTesto(p: PeriodoOspiti, breve = false): string {
  // Il periodo elenca le notti dormite: la partenza non è una notte.
  const ultima = new Date(Date.parse(p.partenza + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
  const data = (iso: string, giornoSolo = false) => new Date(iso + 'T12:00:00Z').toLocaleDateString('it-IT', giornoSolo ? { day: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: breve ? 'short' : 'long', ...(p.arrivo.slice(0, 4) !== ultima.slice(0, 4) ? { year: 'numeric' as const } : {}), timeZone: 'UTC' })
  const periodo = p.arrivo === ultima ? data(p.arrivo) : `${data(p.arrivo, p.arrivo.slice(0, 7) === ultima.slice(0, 7))}–${data(ultima)}`
  return breve ? periodo + '.' : periodo
}
