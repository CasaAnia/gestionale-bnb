// ============================================================================
// I GIORNI COMINCIANO A ROMA (15/09/2026)
//
// Le letture chiedevano gli eventi con «2026-09-01T00:00:00», senza dire in
// quale fuso: il database lo legge come UTC, cioè le 02:00 italiane d'estate.
// Gli eventi fra mezzanotte e le due finivano quindi nel giorno sbagliato —
// e sui confini del periodo, fuori dal conto. Nell'archivio ce ne sono: per
// esempio il 29 agosto alle 22:32 UTC, che a Roma sono le 00:32 del 30.
//
// Qui si calcola l'inizio del giorno a Roma, ora legale compresa, senza
// librerie: si chiede a Intl che ora era a Roma in quell'istante e si ricava
// lo scarto. Nessun orologio nascosto: la data arriva da chi chiama.
// ============================================================================

/** Lo scarto di Roma da UTC in quell'istante, in minuti (+120 d'estate) */
export function scartoRoma(quando: Date): number {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(quando).map(x => [x.type, x.value]))
  const aRoma = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second))
  return Math.round((aRoma - Math.floor(quando.getTime() / 1000) * 1000) / 60000)
}

const dueCifre = (n: number) => String(Math.abs(n)).padStart(2, '0')

/** «2026-09-01» → «2026-09-01T00:00:00+02:00»: la mezzanotte vera di Roma */
export function inizioGiornoRoma(giorno: string): string {
  // si parte dall'istante UTC di quella mezzanotte e si corregge con lo scarto
  const provvisorio = new Date(`${giorno}T00:00:00Z`)
  const scarto = scartoRoma(provvisorio)
  const segno = scarto >= 0 ? '+' : '-'
  return `${giorno}T00:00:00${segno}${dueCifre(Math.trunc(scarto / 60))}:${dueCifre(scarto % 60)}`
}

/** L'istante in cui comincia quel giorno a Roma */
export function istanteInizioGiornoRoma(giorno: string): Date {
  return new Date(inizioGiornoRoma(giorno))
}

/** Un evento cade in [da, a) contando i giorni come li conta Roma? */
export function dentroIlPeriodoRoma(quando: string, da: string, a: string): boolean {
  const t = new Date(quando).getTime()
  if (Number.isNaN(t)) return false
  return t >= istanteInizioGiornoRoma(da).getTime() && t < istanteInizioGiornoRoma(a).getTime()
}
