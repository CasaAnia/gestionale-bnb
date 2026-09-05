// Richieste di prenotazione sul calendario (pezzo 2 di 8): logica pura, senza
// interfaccia, riusata anche dai pezzi 5 (conferma) e 6 (sito).
//
//  · richiesteAperte(richieste, mese)         → aperte che toccano il mese
//  · sovrapposizioni(richiesta, confermate, altre, camere?) → conflitti divisi
//    fra prenotazioni confermate e altre richieste aperte
//  · gruppiSovrapposti(richieste di una riga) → gruppi che condividono giorni
//
// Convenzione sui giorni: un soggiorno occupa le notti da `arrivo` (compreso)
// a `partenza` (esclusa). Chi parte il 12 e chi arriva il 12 NON si toccano.
import { STATI_CHE_OCCUPANO } from './disponibilita.ts'
import { eAperta, type Richiesta } from './richieste.ts'

export type Intervallo = { arrivo: string; partenza: string }
export type PrenotazioneCalendario = {
  id: string
  room_id: string
  check_in: string
  check_out: string
  status: string
  guest_name?: string | null
  guests?: { full_name?: string | null; phone?: string | null } | null
}
export type RichiestaCalendario = Pick<Richiesta, 'id' | 'arrivo' | 'partenza' | 'camera_id' | 'stato'>

export function condividonoGiorni(a: Intervallo, b: Intervallo): boolean {
  return a.arrivo < b.partenza && b.arrivo < a.partenza
}

// Riga del calendario su cui vive una richiesta: la camera scelta, oppure
// «qualsiasi» quando non ne ha una.
export const RIGA_QUALSIASI = 'qualsiasi'
export function chiaveRiga(camera_id: string | null | undefined): string {
  return camera_id ?? RIGA_QUALSIASI
}

// ── Mesi e giorni (stringhe ISO, nessun fuso orario) ───────────────────────
const due = (n: number) => String(n).padStart(2, '0')

export function meseDi(iso: string): string { return iso.slice(0, 7) }

export function meseCorrente(adesso: Date = new Date()): string {
  return `${adesso.getFullYear()}-${due(adesso.getMonth() + 1)}`
}

export function spostaMese(mese: string, delta: number): string {
  const [a, m] = mese.split('-').map(Number)
  const tot = a * 12 + (m - 1) + delta
  return `${Math.floor(tot / 12)}-${due((tot % 12) + 1)}`
}

// Tutti i giorni del mese come stringhe YYYY-MM-DD.
export function giorniDelMese(mese: string): string[] {
  const [a, m] = mese.split('-').map(Number)
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => `${mese}-${due(i + 1)}`)
}

// Intervallo [primo giorno del mese, primo giorno del mese dopo)
export function intervalloMese(mese: string): Intervallo {
  return { arrivo: `${mese}-01`, partenza: `${spostaMese(mese, 1)}-01` }
}

export function etichettaMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  const nomi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
  return `${nomi[m - 1]} ${a}`
}

// ── Richieste aperte nel mese ───────────────────────────────────────────────
export function richiesteAperte<T extends Pick<Richiesta, 'stato'> & Intervallo>(richieste: T[], mese: string): T[] {
  const finestra = intervalloMese(mese)
  return richieste.filter(r => eAperta(r) && condividonoGiorni(r, finestra))
}

// Soggiorni che occupano davvero una camera (stessa regola di lib/disponibilita)
export function prenotazioniConfermate<T extends { status: string }>(prenotazioni: T[]): T[] {
  return prenotazioni.filter(p => STATI_CHE_OCCUPANO.has(p.status))
}

// ── Sovrapposizioni ─────────────────────────────────────────────────────────
export type Sovrapposizioni<P extends PrenotazioneCalendario, R extends RichiestaCalendario> = {
  prenotazioni: P[]   // conflitti con prenotazioni confermate: se confermata, va in conflitto
  richieste: R[]      // altre richieste aperte sulla stessa riga con giorni in comune
}

// Regole:
//  · richiesta con camera: conflitto con le confermate della stessa camera e
//    con le altre richieste aperte della stessa camera;
//  · richiesta «qualsiasi camera»: con le altre richieste «qualsiasi»; con le
//    confermate solo se, in almeno una sua notte, TUTTE le camere attive
//    sono occupate (serve l'elenco `camere`; senza, nessun conflitto con le
//    confermate perché non c'è una camera con cui confrontarla).
export function sovrapposizioni<P extends PrenotazioneCalendario, R extends RichiestaCalendario>(
  richiesta: RichiestaCalendario,
  prenotazioni: P[],
  altreRichieste: R[],
  camere?: { id: string }[],
): Sovrapposizioni<P, R> {
  const me = { arrivo: richiesta.arrivo, partenza: richiesta.partenza }
  const confermate = prenotazioniConfermate(prenotazioni)
    .filter(p => condividonoGiorni({ arrivo: p.check_in, partenza: p.check_out }, me))
  const richieste = altreRichieste.filter(r =>
    r.id !== richiesta.id && eAperta(r) && chiaveRiga(r.camera_id) === chiaveRiga(richiesta.camera_id) && condividonoGiorni(r, me))

  if (richiesta.camera_id) {
    return { prenotazioni: confermate.filter(p => p.room_id === richiesta.camera_id), richieste }
  }
  if (!camere || camere.length === 0) return { prenotazioni: [], richieste }
  const idCamere = new Set(camere.map(c => c.id))
  const piene = new Set<P>()
  for (const giorno of giorniTra(richiesta.arrivo, richiesta.partenza)) {
    const quelGiorno = confermate.filter(p => idCamere.has(p.room_id) && p.check_in <= giorno && p.check_out > giorno)
    const occupate = new Set(quelGiorno.map(p => p.room_id))
    if (occupate.size >= idCamere.size) quelGiorno.forEach(p => piene.add(p))
  }
  return { prenotazioni: [...piene], richieste }
}

export function giorniTra(arrivo: string, partenza: string): string[] {
  const out: string[] = []
  let t = Date.parse(arrivo + 'T00:00:00Z')
  const fine = Date.parse(partenza + 'T00:00:00Z')
  while (t < fine) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000 }
  return out
}

// ── Gruppi di richieste che condividono giorni (stessa riga) ────────────────
// Componenti connesse: A–B–C dove A e C non si toccano ma B tocca entrambe è
// UN gruppo solo. Gruppi ordinati per primo arrivo; dentro, per arrivo.
export function gruppiSovrapposti<T extends Intervallo & { id: string }>(richieste: T[]): T[][] {
  const n = richieste.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (condividonoGiorni(richieste[i], richieste[j])) { const a = find(i), b = find(j); if (a !== b) parent[a] = b }
  }
  const gruppi = new Map<number, T[]>()
  richieste.forEach((r, i) => { const k = find(i); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k)!.push(r) })
  return [...gruppi.values()]
    .map(g => [...g].sort((a, b) => a.arrivo.localeCompare(b.arrivo) || a.id.localeCompare(b.id)))
    .sort((a, b) => a[0].arrivo.localeCompare(b[0].arrivo))
}

export function unioneIntervalli(gruppo: Intervallo[]): Intervallo {
  return {
    arrivo: gruppo.reduce((m, r) => (r.arrivo < m ? r.arrivo : m), gruppo[0].arrivo),
    partenza: gruppo.reduce((m, r) => (r.partenza > m ? r.partenza : m), gruppo[0].partenza),
  }
}

// ── Vista a 2 settimane (blocco 2, 04/09/2026) ──────────────────────────────
// Su desktop il calendario può mostrare 14 giorni invece del mese: colonne
// larghe, etichette intere. Tutto in stringhe ISO, nessun fuso orario.
export const GIORNI_QUINDICINA = 14

export function spostaGiorni(iso: string, delta: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + delta * 86400000).toISOString().slice(0, 10)
}

export function giorniDaInizio(inizio: string, n: number = GIORNI_QUINDICINA): string[] {
  return Array.from({ length: n }, (_, i) => spostaGiorni(inizio, i))
}

// All'apertura la colonna di oggi è sempre visibile: la finestra parte 3
// giorni prima di oggi, così si vedono anche gli arrivi imminenti
// Quante caselle prima di oggi nella vista a 2 settimane: uguale in
// Richieste, Calendario e Arrivi (scelta di Ania, 05/09/2026)
export const GIORNI_PRIMA_OGGI = 3
export function inizioQuindicina(oggi: string): string {
  return spostaGiorni(oggi, -GIORNI_PRIMA_OGGI)
}

// "4 – 17 set 2026" · "28 set – 11 ott 2026" · "28 dic 2026 – 10 gen 2027"
export function etichettaPeriodo(giorni: string[]): string {
  if (giorni.length === 0) return ''
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  const p = (iso: string) => { const [a, m, g] = iso.split('-').map(Number); return { a, m, g } }
  const da = p(giorni[0]), a = p(giorni[giorni.length - 1])
  if (da.a === a.a && da.m === a.m) return `${da.g} – ${a.g} ${MESI[a.m - 1]} ${a.a}`
  if (da.a === a.a) return `${da.g} ${MESI[da.m - 1]} – ${a.g} ${MESI[a.m - 1]} ${a.a}`
  return `${da.g} ${MESI[da.m - 1]} ${da.a} – ${a.g} ${MESI[a.m - 1]} ${a.a}`
}

// Richieste aperte che toccano almeno un giorno della finestra
export function richiesteNelPeriodo<T extends Pick<Richiesta, 'stato'> & Intervallo>(richieste: T[], giorni: string[]): T[] {
  if (giorni.length === 0) return []
  const finestra = { arrivo: giorni[0], partenza: spostaGiorni(giorni[giorni.length - 1], 1) }
  return richieste.filter(r => eAperta(r) && condividonoGiorni(r, finestra))
}
