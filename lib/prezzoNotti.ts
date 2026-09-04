// Prezzo del soggiorno NOTTE PER NOTTE: UNICA fonte per il conto quando le
// persone cambiano da una notte all'altra (es. Lena: prima notte in 2 a 80 €,
// seconda in 3 a 90 € → 170 €, non 2 × 90). La usano nuova prenotazione,
// modifica, scheda, calendario, conferma WhatsApp e le proposte delle
// Richieste, così tutti mostrano gli stessi numeri.
//
// Da dove vengono le persone di ogni notte di una PRENOTAZIONE (la tabella
// bookings non ha una colonna «persone per notte»): sono la stessa fonte già
// usata per i letti aggiuntivi, cioè num_guests + extra_bed_dates:
//   - nelle notti con il letto aggiuntivo ci sono num_guests persone;
//   - nelle altre notti ci sono al massimo le persone della capienza base
//     (Amelia 1, le altre 2);
//   - senza nessuna notte col letto le persone sono num_guests in tutte le
//     notti (regola di sempre: il conto resta identico a prima).
// Le richieste hanno invece persone_per_notte esplicite: passano l'array.
//
// Come si salva su bookings (nessuna migrazione, stessa convenzione già usata
// dalla RPC 0031 per le proposte): price_per_night = tariffa della notte più
// economica, extra_bed_total = tutto il resto, total_amount = somma delle
// notti. Così contoSoggiorno (price × notti + letto) torna esatto e con
// persone uguali in tutte le notti i tre valori sono IDENTICI a prima.
import { tariffaCamera, totaleLetto, capienzaBase } from './tariffe.ts'

export type CameraTariffa = {
  name?: string | null
  base_price?: number | string | null
  double_price?: number | string | null
  has_extra_bed?: boolean | null
  extra_bed_price?: number | string | null
}

export type PrenotazioneNotti = {
  check_in?: string | null
  check_out?: string | null
  num_guests?: number | string | null
  extra_bed?: boolean | null
  extra_bed_dates?: string[] | null
  price_per_night?: number | string | null
}

export type NotteSoggiorno = {
  giorno: string
  persone: number
  tariffa: number   // tariffa della camera per le persone di quella notte
  letto: number     // letto aggiuntivo ADDEBITATO in quella notte (0 se compreso)
  prezzo: number    // tariffa + letto: quanto costa davvero la notte
}

export type PrezzoNotti = {
  notti: NotteSoggiorno[]
  prezzoNotte: number       // → price_per_night (tariffa della notte più economica)
  lettoTotale: number       // → extra_bed_total (tutto ciò che supera prezzoNotte × notti)
  totale: number            // → total_amount (somma delle notti, senza sconti)
  tariffaUniforme: boolean  // la tariffa camera è la stessa in tutte le notti
  prezzoUniforme: boolean   // anche il letto: ogni notte costa uguale
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Giorni (YYYY-MM-DD) delle notti fra check-in e check-out, in ordine
export function giorniSoggiorno(checkIn?: string | null, checkOut?: string | null): string[] {
  if (!checkIn || !checkOut) return []
  const out: string[] = []
  let t = Date.parse(checkIn + 'T00:00:00Z')
  const fine = Date.parse(checkOut + 'T00:00:00Z')
  if (!isFinite(t) || !isFinite(fine)) return []
  while (t < fine) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000 }
  return out
}

// Notti in cui la prenotazione usa il letto aggiuntivo: le date salvate se
// l'array esiste (anche vuoto: nel form si possono togliere tutte), altrimenti
// tutte le notti se extra_bed è vero senza date (righe vecchie).
export function nottiConLetto(b: PrenotazioneNotti): string[] {
  const giorni = giorniSoggiorno(b.check_in, b.check_out)
  if (Array.isArray(b.extra_bed_dates)) return b.extra_bed_dates.filter(g => giorni.includes(g))
  return b.extra_bed ? giorni : []
}

// Persone di ogni notte di una prenotazione (vedi intestazione del file)
export function personePerNottePrenotazione(room: CameraTariffa | null | undefined, b: PrenotazioneNotti): number[] {
  const giorni = giorniSoggiorno(b.check_in, b.check_out)
  const n = Math.max(1, Number(b.num_guests) || 1)
  const letto = new Set(nottiConLetto(b))
  if (letto.size === 0) return giorni.map(() => n)
  const base = capienzaBase(room)
  return giorni.map(g => (letto.has(g) ? n : Math.min(n, base)))
}

// Il conto notte per notte. `tariffaBase` è la tariffa della notte più
// economica come sta nel form o nel record (price_per_night): se manca si usa
// il listino. Le notti con più persone aggiungono la differenza di listino
// (Lena: 90 − 80) e il letto solo se in quella notte viene addebitato.
export function prezzoNotti(
  room: CameraTariffa | null | undefined,
  giorni: string[],
  persone: number[],
  lettoNotti: Iterable<string>,
  tariffaBase?: number | string | null,
): PrezzoNotti {
  if (persone.length !== giorni.length) throw new Error(`Prezzo per notte: servono ${giorni.length} valori di persone, trovati ${persone.length}`)
  const pMin = persone.length ? Math.min(...persone) : 1
  const tariffaMin = tariffaCamera(room, pMin).prezzoNotte
  const baseNum = tariffaBase === undefined || tariffaBase === null || tariffaBase === '' ? NaN : Number(tariffaBase)
  const base = isFinite(baseNum) ? baseNum : tariffaMin
  const letto = new Set(lettoNotti)
  const notti = giorni.map((giorno, i) => {
    const p = persone[i]
    const tariffa = round2(base + tariffaCamera(room, p).prezzoNotte - tariffaMin)
    const l = letto.has(giorno) ? totaleLetto(room, p, 1) : 0
    return { giorno, persone: p, tariffa, letto: l, prezzo: round2(tariffa + l) }
  })
  const totale = round2(notti.reduce((s, x) => s + x.prezzo, 0))
  return {
    notti,
    prezzoNotte: base,
    lettoTotale: round2(totale - base * notti.length),
    totale,
    tariffaUniforme: notti.every(x => x.tariffa === notti[0]?.tariffa),
    prezzoUniforme: notti.every(x => x.prezzo === notti[0]?.prezzo),
  }
}

// Il conto di una prenotazione (record salvato o form): persone dai letti,
// tariffa base = price_per_night se presente
export function prezzoPrenotazione(room: CameraTariffa | null | undefined, b: PrenotazioneNotti): PrezzoNotti {
  const giorni = giorniSoggiorno(b.check_in, b.check_out)
  return prezzoNotti(room, giorni, personePerNottePrenotazione(room, b), nottiConLetto(b), b.price_per_night)
}

// Tariffa di listino della notte più economica: è il valore che il campo
// «Tariffa/notte» del form deve avere quando non è stato scritto a mano
export function tariffaMinima(room: CameraTariffa | null | undefined, b: PrenotazioneNotti): number {
  const persone = personePerNottePrenotazione(room, b)
  const pMin = persone.length ? Math.min(...persone) : Math.max(1, Number(b.num_guests) || 1)
  return tariffaCamera(room, pMin).prezzoNotte
}

// Campo «Tariffa/notte» dopo una modifica di date o notti col letto: se prima
// seguiva il listino continua a seguirlo (con le nuove persone per notte),
// se era stato scritto a mano resta com'è
export function riallineaTariffa(room: CameraTariffa | null | undefined, prima: PrenotazioneNotti, dopo: PrenotazioneNotti): number {
  const attuale = Number(prima.price_per_night)
  if (!isFinite(attuale) || attuale === tariffaMinima(room, prima)) return tariffaMinima(room, dopo)
  return attuale
}

// Campo «Tariffa/notte» all'apertura della modifica di un record salvato.
// Le prenotazioni salvate prima di questa regola con persone diverse per
// notte hanno price_per_night = tariffa delle persone massime (il bug dei
// 180 €): si riporta alla notte più economica, così il salvataggio ricalcola.
// Con persone uguali in tutte le notti, o tariffa scritta a mano, resta.
export function tariffaFormDaSalvato(room: CameraTariffa | null | undefined, b: PrenotazioneNotti): number {
  const salvata = Number(b.price_per_night)
  const persone = personePerNottePrenotazione(room, b)
  if (!isFinite(salvata) || persone.length === 0 || persone.every(p => p === persone[0])) return isFinite(salvata) ? salvata : 0
  const tariffaMax = tariffaCamera(room, Math.max(...persone)).prezzoNotte
  return salvata === tariffaMax ? tariffaMinima(room, b) : salvata
}

// ── Dettaglio per notte da mostrare («1 notte in 2 a 80 €, 1 notte in 3 a 90 €») ──
export type GruppoNotti = { notti: number; persone: number; prezzo: number }

// Notti raggruppate per (persone, prezzo) nell'ordine in cui compaiono
export function gruppiNotti(notti: NotteSoggiorno[]): GruppoNotti[] {
  const out: GruppoNotti[] = []
  for (const x of notti) {
    const g = out.find(y => y.persone === x.persone && y.prezzo === x.prezzo)
    if (g) g.notti++
    else out.push({ notti: 1, persone: x.persone, prezzo: x.prezzo })
  }
  return out
}

export const fmtEuroBreve = (n: number) => `${Number.isInteger(n) ? n : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

// «1 notte in 2 a 80 €, 1 notte in 3 a 90 €»; se le persone non cambiano
// «1 notte a 60 €, 3 notti a 75 €»
export function testoDettaglioNotti(notti: NotteSoggiorno[], fmt: (n: number) => string = fmtEuroBreve): string {
  const gruppi = gruppiNotti(notti)
  const personeVariano = gruppi.some(g => g.persone !== gruppi[0].persone)
  return gruppi
    .map(g => `${g.notti} ${g.notti === 1 ? 'notte' : 'notti'}${personeVariano ? ` in ${g.persone}` : ''} a ${fmt(g.prezzo)}`)
    .join(', ')
}

// Dettaglio da mostrare per una prenotazione SALVATA: solo se la tariffa
// cambia fra le notti E il conto notte per notte torna col prezzo pieno
// salvato (i dati storici non si reinterpretano: se non torna, null e si
// mostra come sempre). `prezzoPieno` = price × notti + letto del record.
export function dettaglioNottiSalvato(room: CameraTariffa | null | undefined, b: PrenotazioneNotti & { extra_bed_total?: number | string | null }): NotteSoggiorno[] | null {
  const pn = prezzoPrenotazione(room, b)
  if (pn.notti.length === 0 || pn.tariffaUniforme) return null
  const pieno = round2(Number(b.price_per_night || 0) * pn.notti.length + Number(b.extra_bed_total || 0))
  return Math.abs(pn.totale - pieno) < 0.005 ? pn.notti : null
}
