// Custodia prima di scrivere: il recupero resta in Home anche quando la
// bolletta è già pagata e soltanto la commissione è ancora da completare.
import type { FatturaDaPagare, SceltaFattura } from './fatturaPagata.ts'
import type { Eccezione } from './daControllare.ts'
export type TentativoFattura = { fattura: FatturaDaPagare; scelta: SceltaFattura }
type Deposito = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
const PREFISSO = 'ca_fattura_pendente_'
const browser = () => localStorage
export const ERRORE_CUSTODIA_FATTURA = 'Non riesco a conservare il salvataggio su questo dispositivo. Nessuna scrittura avviata: riapri il gestionale e riprova.'
export function leggiTentativoFattura(id: string, deposito: () => Deposito = browser): TentativoFattura | null {
  try {
    const t = JSON.parse(deposito().getItem(PREFISSO + id) || 'null') as TentativoFattura | null
    return t?.fattura?.documentoId === id && Number.isInteger(t.fattura.importoCent) && typeof t.scelta?.importo === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(t.scelta.giorno) && ['contanti', 'bonifico'].includes(t.scelta.metodo) ? t : null
  } catch { return null }
}
export function custodisciFattura(t: TentativoFattura, deposito: () => Deposito = browser): boolean {
  try {
    const d = deposito(), k = PREFISSO + t.fattura.documentoId, testo = JSON.stringify(t)
    const prima = d.getItem(k)
    if (prima && prima !== testo) return false // non sovrascrivere un tentativo irrisolto
    d.setItem(k, testo)
    return d.getItem(k) === testo
  } catch { return false }
}
export function dimenticaFattura(t: TentativoFattura, deposito: () => Deposito = browser): boolean {
  try {
    const d = deposito(), k = PREFISSO + t.fattura.documentoId
    if (d.getItem(k) !== JSON.stringify(t)) return d.getItem(k) === null
    d.removeItem(k)
    return d.getItem(k) === null
  } catch { return false }
}
export function fattureInSospeso(deposito: () => Deposito = browser): TentativoFattura[] {
  try {
    const d = deposito(), fuori: TentativoFattura[] = []
    for (let i = 0; i < d.length; i++) {
      const k = d.key(i)
      if (!k?.startsWith(PREFISSO)) continue
      const t = leggiTentativoFattura(k.slice(PREFISSO.length), deposito)
      if (t) fuori.push(t)
    }
    return fuori
  } catch { return [] }
}
export function aggiungiFattureInSospeso(voci: Eccezione[], tentativi = fattureInSospeso()): Eccezione[] {
  const ids = new Set(tentativi.map(t => t.fattura.documentoId))
  return [...voci.filter(e => !e.fattura || !ids.has(e.fattura.documentoId)), ...tentativi.map(({ fattura: f, scelta }): Eccezione => ({
    chiave: `fattura:${f.documentoId}`, tipo: 'fattura', urgenza: 'normale', data: scelta.giorno,
    titolo: f.nome, motivo: 'Salvataggio da verificare o completare su questo dispositivo.',
    bottone: 'Verifica salvataggio', etichetta: 'Bolletta da verificare', rimandabile: false,
    destinazione: { tipo: 'fattura', documentoId: f.documentoId },
    fattura: { ...f, numero: f.numero ?? null, gruppoId: f.gruppoId ?? null, pdf: voci.find(e => e.fattura?.documentoId === f.documentoId)?.fattura?.pdf ?? null, dataTesto: '', scaduta: false },
  }))]
}
