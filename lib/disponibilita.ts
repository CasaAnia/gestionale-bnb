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
import { cameraOspita, lettiOccupatiPerNotte, type PrenotazioneLetti } from './lettiAggiuntivi.ts'

export type CameraMinima = { id: string; name: string; active?: boolean | null; has_extra_bed?: boolean | null; base_price?: number | string | null; double_price?: number | string | null }
// num_guests / extra_bed / extra_bed_dates servono per i letti aggiuntivi condivisi
export type PrenotazioneMinima = { room_id: string; check_in: string; check_out: string; status: string } & Partial<PrenotazioneLetti>

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

export function giorniTra(arrivo: string, partenza: string): string[] {
  const out: string[] = []
  let t = Date.parse(arrivo + 'T00:00:00Z')
  const fine = Date.parse(partenza + 'T00:00:00Z')
  while (t < fine) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000 }
  return out
}

// libere = nessun soggiorno confermato sovrapposto E posto per `persone` in
// ogni notte (capienza + letti aggiuntivi non già presi da altre camere);
// occupate = un soggiorno confermato le occupa; escluse = libere ma senza
// posto per quel numero di persone.
export function camereLibere<T extends CameraMinima>(
  camere: T[], prenotazioni: PrenotazioneMinima[], arrivo: string, partenza: string, persone = 1,
): { libere: T[]; occupate: T[]; escluse: T[] } {
  const attive = ordinaCamere(camere.filter(c => c.active !== false))
  const confermate = prenotazioni.filter(p => STATI_CHE_OCCUPANO.has(p.status))
  const occupateId = new Set(confermate.filter(p => siSovrappone(p, arrivo, partenza)).map(p => p.room_id))
  const notti = giorniTra(arrivo, partenza)
  const lettiPresi = lettiOccupatiPerNotte(confermate.map(p => ({ ...p, room_id: p.room_id })))
  const libere: T[] = [], occupate: T[] = [], escluse: T[] = []
  for (const c of attive) {
    if (occupateId.has(c.id)) occupate.push(c)
    else if (cameraOspita(c, persone, notti, lettiPresi)) libere.push(c)
    else escluse.push(c)
  }
  return { libere, occupate, escluse }
}

// "Amelia", "Amelia e Lena", "Amelia, Allegra e Lena"
export function elencoNomi(nomi: string[]): string {
  if (nomi.length <= 1) return nomi.join('')
  return nomi.slice(0, -1).join(', ') + ' e ' + nomi[nomi.length - 1]
}

// Riga indicativa sotto le date: "2 notti · Allegra libera, Amelia e Ambra occupate"
export function frasiDisponibilita(
  camere: CameraMinima[], prenotazioni: PrenotazioneMinima[], arrivo: string, partenza: string, persone = 1,
): string {
  const n = notti(arrivo, partenza)
  if (n === 0) return ''
  const { libere, occupate, escluse } = camereLibere(camere, prenotazioni, arrivo, partenza, persone)
  const nottiTesto = n === 1 ? '1 notte' : `${n} notti`
  const parti: string[] = []
  if (camere.length === 0) return `${nottiTesto} · camere non caricate`
  if (occupate.length === 0 && escluse.length === 0) return `${nottiTesto} · tutte le camere libere`
  if (libere.length === 0 && escluse.length === 0) return `${nottiTesto} · tutte le camere occupate`
  if (libere.length > 0) parti.push(`${elencoNomi(libere.map(c => c.name))} ${libere.length === 1 ? 'libera' : 'libere'}`)
  if (occupate.length > 0) parti.push(`${elencoNomi(occupate.map(c => c.name))} ${occupate.length === 1 ? 'occupata' : 'occupate'}`)
  if (escluse.length > 0) parti.push(`${elencoNomi(escluse.map(c => c.name))} senza posto per ${persone}`)
  return `${nottiTesto} · ${parti.join(', ')}`
}
