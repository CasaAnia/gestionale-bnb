// ============================================================================
// IL GRAFICO DELLA GIORNATA (pagina Pulizie, linguetta «Oggi»; riferimento
// approvato da Ania il 01/10/2026, docs/design/pulizie-riferimento.html, 1).
//
// Un righello dalle 8 alle 20 e una riga per OGNI camera attiva. Le regole
// delle pulizie sono quelle di sempre (pulizieAperte, prossimoArrivo,
// prioritaDi): qui si decide solo DOVE disegnare.
//
// Niente false certezze (integrazione di Ania, punto 4):
//   - senza l'ora di partenza il blocco dell'ospite che parte arriva alle
//     10:00 col «?», e senza l'ora d'arrivo il filo è tratteggiato alle 15:00
//     col «?»: sono riferimenti GRAFICI (campo `indicativo`), mai dati salvati;
//   - un orario fuori dalle 8–20 si disegna sul bordo, con l'ora vera scritta;
//   - un arrivo prima della partenza non fa un blocco negativo: niente blocco
//     del tempo per pulire e una nota «arriva prima che parta»;
//   - la pulizia già fatta si segna all'ORA IN CUI È STATA SEGNATA, come un
//     segno, non come un intervallo: i minuti totali possono avere pause in
//     mezzo, e dall'ora e dai minuti non si ricostruisce quando è cominciata.
// Funzioni pure, provate con node --test.
// ============================================================================
import { pulizieAperte, prossimoArrivo, prioritaDi, type PrenotazionePulizie, type CameraPulizie, type Decisione, type Priorita } from './pulizie.ts'
import { minutiDa, oraBreve } from './schema0064.ts'
import { nomeOspite, spezzaNome } from './guestName.ts'
import { MESI_BREVI, MESI_LUNGHI } from './dateItaliane.ts'

export const INIZIO = 8 * 60, FINE = 20 * 60
export const ORE_RIGHELLO = [8, 10, 12, 14, 16, 18, 20]
export const FILI = [10, 14, 18]
export const PARTENZA_INDICATIVA = 10 * 60, ARRIVO_INDICATIVO = 15 * 60
const NOMI_PRIORITA: Record<Priorita, string> = { urgente: 'urgente', alta: 'priorità alta', flessibile: 'flessibile', nessuna_fretta: 'nessuna fretta' }

/** posizione in % sul righello, sempre fra 0 e 100 */
export const posizione = (min: number) => Math.min(100, Math.max(0, ((min - INIZIO) / (FINE - INIZIO)) * 100))
export const fuoriScala = (min: number) => min < INIZIO || min > FINE

export type Segmento =
  | { tipo: 'parte'; da: number; a: number; testo: string; indicativo: boolean }
  | { tipo: 'finestra'; da: number; a: number; testo: string; libera: boolean }
  | { tipo: 'resta'; testo: string }
  | { tipo: 'fatta'; ora: number | null; testo: string }
export type Segno =
  | { tipo: 'bagagli'; ora: number; testo: string }
  | { tipo: 'arrivo'; ora: number; testo: string; indicativo: boolean }
export type RigaGiornata = { roomId: string; nome: string; segmenti: Segmento[]; segni: Segno[]; nota: string | null; vuota: boolean }

export const cognome = (b: PrenotazionePulizie) => { const s = spezzaNome(nomeOspite(b)); return s.cognome || s.nome }
export const oraTesto = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
/** «6 ore», «5 ore 30», «45 min», «1 ora» */
export function durata(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return `${h} ${h === 1 ? 'ora' : 'ore'}${m ? ` ${m}` : ''}`
}
const giornoMeseBreve = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESI_BREVI[m - 1]}` }

/** «giovedì 1 ottobre» */
export function giornoLungo(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MESI_LUNGHI[m - 1]}`
}
/** «3 DA FARE · 1 FATTA» (la parte delle fatte va in ottone) */
export const contoGiorno = (daFare: number, fatte: number) => ({ daFare: `${daFare} da fare`, fatte: `${fatte} ${fatte === 1 ? 'fatta' : 'fatte'}` })

/** L'ora a cui la pulizia è stata segnata, in minuti: quella corretta a mano
 *  (ora_effettiva, proposta 0064) oppure created_at, ma solo se segnata nel
 *  giorno della pulizia; altrimenti non si sa. */
export function oraSegnata(e: Decisione & { ora_effettiva?: unknown }, oraDi: (istante: string) => { giorno: string; minuti: number } | null): number | null {
  const scritta = minutiDa(e.ora_effettiva)
  if (scritta !== null) return scritta
  if (!e.created_at) return null
  const r = oraDi(e.created_at)
  return r && r.giorno === (e.data_effettiva || e.data_prevista) ? r.minuti : null
}

/** Giorno e minuti a Roma di un istante del database */
export function romaDi(istante: string): { giorno: string; minuti: number } | null {
  const t = Date.parse(istante)
  if (!Number.isFinite(t)) return null
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]))
  return { giorno: `${p.year}-${p.month}-${p.day}`, minuti: Number(p.hour) * 60 + Number(p.minute) }
}

export function rigaGiornata(room: CameraPulizie, nome: string, prenotazioni: PrenotazionePulizie[], events: (Decisione & { minuti?: number | null; ora_effettiva?: unknown })[], oggi: string, conOrari: boolean): RigaGiornata {
  const segmenti: Segmento[] = [], segni: Segno[] = []
  let nota: string | null = null
  const aperte = pulizieAperte(prenotazioni, room.id, oggi, events)
  const arrivo = prossimoArrivo(prenotazioni, room.id, oggi)
  const arrivaOggi = arrivo && arrivo.giorni === 0 ? arrivo.booking : null
  const oraArrivo = arrivaOggi ? minutiDa(arrivaOggi.check_in_time) : null
  if (arrivaOggi) {
    segni.push({ tipo: 'arrivo', ora: oraArrivo ?? ARRIVO_INDICATIVO, indicativo: oraArrivo === null, testo: `${cognome(arrivaOggi)} ${oraArrivo !== null ? oraBreve(arrivaOggi.check_in_time) : '?'}` })
    const bag = conOrari ? minutiDa(arrivaOggi.bagagli_alle) : null
    if (bag !== null) segni.push({ tipo: 'bagagli', ora: bag, testo: `bagagli ${oraTesto(bag)}` })
  }
  const partenza = aperte.find(p => p.tipo !== 'soggiorno')
  const soggiorno = aperte.find(p => p.tipo === 'soggiorno')
  if (partenza) {
    let inizio = INIZIO, reale = INIZIO
    if (partenza.booking.check_out === oggi) {
      const ora = conOrari ? minutiDa(partenza.booking.check_out_time) : null
      const fine = ora ?? PARTENZA_INDICATIVA
      segmenti.push({ tipo: 'parte', da: INIZIO, a: Math.max(INIZIO, fine), indicativo: ora === null, testo: `${cognome(partenza.booking)}${ora === null ? ' ?' : ora < INIZIO || ora > FINE ? ` ${oraTesto(ora)}` : ''}` })
      inizio = Math.max(INIZIO, fine); reale = fine
    }
    if (arrivaOggi) {
      const fine = oraArrivo ?? ARRIVO_INDICATIVO
      // la durata con gli orari veri, anche fuori dal righello
      if (fine > reale) segmenti.push({ tipo: 'finestra', da: Math.min(inizio, FINE), a: Math.min(FINE, Math.max(inizio, fine)), libera: false, testo: durata(fine - reale) })
      else nota = 'arriva prima che parta'
    } else {
      const quando = arrivo ? `libera fino al ${giornoMeseBreve(arrivo.booking.check_in)}` : 'libera'
      const pr = prioritaDi(partenza, arrivo)
      if (inizio < FINE) segmenti.push({ tipo: 'finestra', da: inizio, a: FINE, libera: true, testo: `${quando} · ${NOMI_PRIORITA[pr]}` })
    }
  } else if (soggiorno) {
    segmenti.push({ tipo: 'resta', testo: `${nomeOspite(soggiorno.booking)} resta · biancheria quando esce` })
  }
  for (const e of events.filter(x => x.room_id === room.id && x.stato === 'fatta' && (x.data_effettiva || x.data_prevista) === oggi)) {
    const ora = oraSegnata(e, romaDi)
    segmenti.push({ tipo: 'fatta', ora, testo: `✓ pulita${ora !== null ? ` ${oraTesto(ora)}` : ''}${e.minuti ? ` · ${e.minuti} min` : ''}` })
  }
  return { roomId: room.id, nome, segmenti, segni, nota, vuota: !segmenti.length && !segni.length && !nota }
}

/** Spazi comuni: un segno per ogni tempo salvato oggi, all'ora del salvataggio. */
export type TempoComune = { attivita: string; minuti: number; aggiornato_at?: string | null }
export function rigaSpaziComuni(tempi: TempoComune[], oggi: string): { ora: number | null; testo: string; attivita: string }[] {
  return tempi.filter(t => t.minuti > 0).map(t => {
    const r = t.aggiornato_at ? romaDi(t.aggiornato_at) : null
    return { attivita: t.attivita, ora: r && r.giorno === oggi ? r.minuti : null, testo: '✓' }
  })
}
