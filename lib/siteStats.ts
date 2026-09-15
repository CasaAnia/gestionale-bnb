import { dentroIlPeriodoRoma } from './statistiche/confiniRoma.ts'
// «oggi» (06/09/2026, richiesta di Ania): il solo giorno di `now`, per vedere la situazione aggiornata
export type StatsPeriod = 'oggi' | 'settimana' | 'mese' | 'anno'

export type SiteEvent = {
  tipo: string
  pagina: string | null
  fonte: string | null
  campagna: string | null
  created_at: string
}

export type SiteFunnel = {
  visite: number
  paginaPrenota: number
  moduliIniziati: number
  richiesteInviate: number
  errori: number
  nonConcluseStimate: number
  conversioneVisita: number
  conversioneModulo: number
  fontiRichieste: { nome: string; valore: number }[]
  campagneRichieste: { nome: string; valore: number }[]
}

function periodBounds(period: StatsPeriod, now: Date) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (period === 'oggi') {
    // nessuno spostamento: dalla mezzanotte di oggi
  } else if (period === 'settimana') {
    const day = start.getDay()
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  } else if (period === 'mese') {
    start.setDate(1)
  } else {
    start.setMonth(0, 1)
  }

  const end = new Date(start)
  if (period === 'oggi') end.setDate(end.getDate() + 1)
  else if (period === 'settimana') end.setDate(end.getDate() + 7)
  else if (period === 'mese') end.setMonth(end.getMonth() + 1)
  else end.setFullYear(end.getFullYear() + 1)
  return { start, end }
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function ranking(events: SiteEvent[], field: 'fonte' | 'campagna') {
  const counts: Record<string, number> = {}
  for (const event of events) {
    const name = event[field]?.trim()
    if (!name) continue
    counts[name] = (counts[name] || 0) + 1
  }
  return Object.entries(counts)
    .map(([nome, valore]) => ({ nome, valore }))
    .sort((a, b) => b.valore - a.valore || a.nome.localeCompare(b.nome))
}

const giornoRoma = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export function buildSiteFunnel(events: SiteEvent[], period: StatsPeriod, now = new Date()): SiteFunnel {
  // I confini del periodo si contano come li conta Roma, non come li conta il
  // browser di chi guarda: gli eventi fra mezzanotte e le due finivano nel
  // giorno sbagliato (15/09/2026).
  const { start, end } = periodBounds(period, now)
  const da = giornoRoma(start), a = giornoRoma(end)
  const inPeriod = events.filter(event => dentroIlPeriodoRoma(event.created_at, da, a))

  const visite = inPeriod.filter(event => event.tipo === 'visita').length
  const paginaPrenota = inPeriod.filter(event => event.tipo === 'visita' && event.pagina === '/prenota').length
  const moduliIniziati = inPeriod.filter(event => event.tipo === 'modulo_iniziato').length
  const sentEvents = inPeriod.filter(event => event.tipo === 'richiesta_inviata')
  const richiesteInviate = sentEvents.length
  const errori = inPeriod.filter(event => event.tipo === 'richiesta_errore').length

  return {
    visite,
    paginaPrenota,
    moduliIniziati,
    richiesteInviate,
    errori,
    nonConcluseStimate: Math.max(0, moduliIniziati - richiesteInviate),
    conversioneVisita: percent(richiesteInviate, visite),
    conversioneModulo: percent(richiesteInviate, moduliIniziati),
    fontiRichieste: ranking(sentEvents, 'fonte'),
    campagneRichieste: ranking(sentEvents, 'campagna'),
  }
}
