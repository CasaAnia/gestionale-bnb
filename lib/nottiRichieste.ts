// Giorni ISO: ogni voce è la notte che inizia in quel giorno, partenza esclusa.
// null/assente mantiene la richiesta tradizionale per l'intero intervallo.
export type DateRichiesta = { arrivo: string; partenza: string; notti_richieste?: string[] | null }
export const giornoDopo = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
export function nottiDelPeriodo(arrivo: string, partenza: string): string[] {
  const out: string[] = []
  for (let t = Date.parse(arrivo + 'T00:00:00Z'), fine = Date.parse(partenza + 'T00:00:00Z'); t < fine; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}
export function selezioneNottiValida(valore: unknown, arrivo: string, partenza: string): valore is string[] {
  if (!Array.isArray(valore) || valore.length === 0 || valore.length > 30) return false
  return valore.every((n, i) => {
    if (typeof n !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(n) || n < arrivo || n >= partenza) return false
    const t = Date.parse(n + 'T00:00:00Z')
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === n && (i === 0 || valore[i - 1] < n)
  })
}
export function nottiDellaRichiesta(r: DateRichiesta): string[] {
  if (r.notti_richieste == null) return nottiDelPeriodo(r.arrivo, r.partenza)
  if (!selezioneNottiValida(r.notti_richieste, r.arrivo, r.partenza)) throw new Error('Selezione delle notti non valida: ricontrollare la richiesta.')
  return [...r.notti_richieste]
}
export function periodiDelleNotti(notti: string[]): { arrivo: string; partenza: string }[] {
  const out: { arrivo: string; partenza: string }[] = []
  for (const n of [...new Set(notti)].sort()) {
    const ultimo = out.at(-1)
    if (ultimo?.partenza === n) ultimo.partenza = giornoDopo(n)
    else out.push({ arrivo: n, partenza: giornoDopo(n) })
  }
  return out
}
export function elencoNotti(notti: string[]): string {
  const gruppi = new Map<string, string[]>()
  for (const n of [...new Set(notti)].sort()) {
    const mese = n.slice(0, 7)
    if (!gruppi.has(mese)) gruppi.set(mese, [])
    gruppi.get(mese)!.push(String(Number(n.slice(8))))
  }
  return [...gruppi].map(([mese, giorni]) => `${giorni.length < 2 ? giorni[0] : giorni.slice(0, -1).join(', ') + ' e ' + giorni.at(-1)} ${new Date(mese + '-01T00:00:00Z').toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`).join('; ')
}
