// Mesi e giorni come stringhe ISO, senza fuso orario (come lib/richiesteCalendario).
const due = (n: number) => String(n).padStart(2, '0')

export function giorniDelMese(mese: string): number {
  const [a, m] = mese.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}
export function primoGiorno(mese: string): string { return `${mese}-01` }
export function primoGiornoDopo(mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  const tot = a * 12 + m
  return `${Math.floor(tot / 12)}-${due((tot % 12) + 1)}-01`
}
export function spostaGiorni(iso: string, delta: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + delta * 86400000).toISOString().slice(0, 10)
}
export function nottiTra(arrivo: string, partenza: string): number {
  const n = Math.round((Date.parse(partenza + 'T00:00:00Z') - Date.parse(arrivo + 'T00:00:00Z')) / 86400000)
  return Number.isFinite(n) && n > 0 ? n : 0
}
// Notti di [arrivo, partenza) che cadono in [da, a)
export function nottiNellIntervallo(arrivo: string, partenza: string, da: string, a: string): number {
  const s = arrivo > da ? arrivo : da
  const e = partenza < a ? partenza : a
  return e > s ? nottiTra(s, e) : 0
}
export const nelMese = (iso: string | null | undefined, mese: string) => !!iso && iso.slice(0, 7) === mese
