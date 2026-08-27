// Periodi del modulo spese (estratti da SpeseTracker.tsx in Fase 1 —
// stessa logica, stessi risultati; solo resi funzioni pure).

export type PeriodMode = 'mese' | 'settimana' | 'anno' | 'intervallo'

// Primo e ultimo giorno del mese YYYY-MM
export function monthRange(m: string): [string, string] {
  const [y, mo] = m.split('-').map(Number)
  const last = new Date(y, mo, 0).getDate()
  return [`${m}-01`, `${m}-${String(last).padStart(2, '0')}`]
}

// Il mese a distanza `offset` da `month` (es. -1 = mese precedente)
export function monthKey(month: string, offset: number): string {
  const [y, mo] = month.split('-').map(Number)
  const d = new Date(y, mo - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const monthLabel = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString('it-IT', { month: 'long' })

// 7 giorni a partire dalla data scelta (inizio = data, non il lunedì).
// Date locali, non UTC: sennò la settimana parte un giorno prima.
export function weekRange(d: string): [string, string] {
  const dt = new Date(d + 'T00:00:00')
  const end = new Date(dt); end.setDate(dt.getDate() + 6)
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return [fmt(dt), fmt(end)]
}

// "5 ago" da una data YYYY-MM-DD
export const giornoBreve = (s: string) => `${Number(s.slice(-2))} ${monthLabel(s.slice(0, 7)).slice(0, 3)}`

// Estremi del periodo scelto coi bottoni Mese/Settimana/Anno/Dal–al
export function periodoRange(
  isMese: boolean, periodMode: PeriodMode,
  { month, year, weekAnchor, fromDate, toDate }: { month: string; year: string; weekAnchor: string; fromDate: string; toDate: string },
): [string, string] {
  return isMese ? monthRange(month)
    : periodMode === 'settimana' ? weekRange(weekAnchor)
    : periodMode === 'anno' ? [`${year}-01-01`, `${year}-12-31`]
    : [fromDate || '0000-01-01', toDate || '9999-12-31']
}

// Etichetta parlante del periodo ("a agosto", "dal 5 ago al 11 ago", …)
export function periodoLabel(
  isMese: boolean, periodMode: PeriodMode,
  { month, year, fromDate, toDate }: { month: string; year: string; fromDate: string; toDate: string },
  periodStart: string, periodEnd: string,
): string {
  return isMese ? `a ${monthLabel(month)}`
    : periodMode === 'settimana' ? `dal ${giornoBreve(periodStart)} al ${giornoBreve(periodEnd)}`
    : periodMode === 'anno' ? `nel ${year}`
    : (fromDate || toDate) ? `dal ${fromDate ? giornoBreve(fromDate) : 'inizio'} al ${toDate ? giornoBreve(toDate) : 'oggi'}` : 'in totale'
}

// Ritmo €/giorno e previsione a fine mese (solo mese corrente)
export function ritmoEPrevisione(totMese: number, month: string, oggi: Date) {
  const isCurrentMonth = month === oggi.toISOString().slice(0, 7)
  const daysInMonth = Number(monthRange(month)[1].slice(-2))
  const giorniPassati = isCurrentMonth ? oggi.getDate() : daysInMonth
  const mediaGiorno = totMese / Math.max(1, giorniPassati)
  const previsione = mediaGiorno * daysInMonth
  return { isCurrentMonth, daysInMonth, giorniPassati, mediaGiorno, previsione }
}
