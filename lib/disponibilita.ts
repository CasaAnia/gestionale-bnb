// Disponibilità INDICATIVA delle camere su un intervallo di date.
//
// Conta SOLO le prenotazioni reali (confermate o già completate): le
// prenotazioni annullate e quelle in attesa (richieste dal sito ancora da
// confermare) NON occupano nulla, e nemmeno le altre richieste in coda.
// Usata dal modulo "Nuova richiesta" (pezzo 1) e in seguito dalla proposta
// al cliente e dal collegamento col sito (pezzi 3 e 6).
//
// Regola di sovrapposizione: due soggiorni si sovrappongono se
// check_in < partenza && check_out > arrivo (il giorno di partenza di uno
// può essere il giorno di arrivo dell'altro).
import { ROOM_NUMBER_BY_NAME } from './roomTypes.ts'

export type CameraMinima = { id: string; name: string; active?: boolean }
export type PrenotazioneMinima = { room_id: string; check_in: string; check_out: string; status: string }

export const STATI_CHE_OCCUPANO = new Set(['confermata', 'completata'])

// Notti fra due date ISO (YYYY-MM-DD); 0 se l'intervallo non è valido.
export function notti(arrivo: string, partenza: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivo) || !/^\d{4}-\d{2}-\d{2}$/.test(partenza)) return 0
  const n = Math.round((Date.parse(partenza + 'T00:00:00Z') - Date.parse(arrivo + 'T00:00:00Z')) / 86400000)
  return n > 0 ? n : 0
}

export function siSovrappone(p: { check_in: string; check_out: string }, arrivo: string, partenza: string): boolean {
  return p.check_in < partenza && p.check_out > arrivo
}

// Ordine fisso delle camere (Amelia → Lena); le sconosciute in coda, per nome.
export function ordinaCamere<T extends CameraMinima>(camere: T[]): T[] {
  const num = (c: CameraMinima) => ROOM_NUMBER_BY_NAME[c.name] ?? '99' + c.name
  return [...camere].sort((a, b) => num(a).localeCompare(num(b)))
}

export function camereLibere<T extends CameraMinima>(
  camere: T[], prenotazioni: PrenotazioneMinima[], arrivo: string, partenza: string,
): { libere: T[]; occupate: T[] } {
  const attive = ordinaCamere(camere.filter(c => c.active !== false))
  const occupateId = new Set(
    prenotazioni
      .filter(p => STATI_CHE_OCCUPANO.has(p.status) && siSovrappone(p, arrivo, partenza))
      .map(p => p.room_id),
  )
  return {
    libere: attive.filter(c => !occupateId.has(c.id)),
    occupate: attive.filter(c => occupateId.has(c.id)),
  }
}

// "Amelia", "Amelia e Lena", "Amelia, Allegra e Lena"
export function elencoNomi(nomi: string[]): string {
  if (nomi.length <= 1) return nomi.join('')
  return nomi.slice(0, -1).join(', ') + ' e ' + nomi[nomi.length - 1]
}

// Riga indicativa sotto le date: "2 notti · Allegra libera, Amelia e Ambra occupate"
export function frasiDisponibilita(
  camere: CameraMinima[], prenotazioni: PrenotazioneMinima[], arrivo: string, partenza: string,
): string {
  const n = notti(arrivo, partenza)
  if (n === 0) return ''
  const { libere, occupate } = camereLibere(camere, prenotazioni, arrivo, partenza)
  const nottiTesto = n === 1 ? '1 notte' : `${n} notti`
  let stato: string
  if (camere.length === 0) stato = 'camere non caricate'
  else if (occupate.length === 0) stato = 'tutte le camere libere'
  else if (libere.length === 0) stato = 'tutte le camere occupate'
  else {
    stato = `${elencoNomi(libere.map(c => c.name))} ${libere.length === 1 ? 'libera' : 'libere'}, `
      + `${elencoNomi(occupate.map(c => c.name))} ${occupate.length === 1 ? 'occupata' : 'occupate'}`
  }
  return `${nottiTesto} · ${stato}`
}
