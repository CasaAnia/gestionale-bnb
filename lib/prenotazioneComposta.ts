// PRENOTAZIONE COMPOSTA (09/09/2026): una sola compilazione può contenere più
// camere e, dentro una camera, più periodi legati da un cambio camera.
//
//  · periodi con lo stesso `gruppo`  = un solo soggiorno (cambio camera):
//    finiscono su bookings con lo stesso group_id, come fa oggi la scheda;
//  · gruppi diversi = camere in parallelo della stessa compilazione.
//
// Prezzi, letti e capienze vengono SEMPRE dalle regole già in uso
// (lib/tariffe e lib/prezzoNotti): questa unità compone, non inventa listini.
import { capienzaBase, capienzaCamera, lettoDaComunicare, totaleLetto, EXTRA_BED_MAX } from './tariffe.ts'
import { giorniSoggiorno, prezzoPrenotazione, tariffaMinima, type CameraTariffa } from './prezzoNotti.ts'
import { lettiPoolPrenotazione } from './lettiAggiuntivi.ts'

export type CameraComposta = CameraTariffa & { id: string; name: string }

// Come si paga il letto aggiuntivo. Il prezzo di partenza è quello delle
// regole della camera (Amelia 5, Ambra e Allegra 10, Lena compreso fino a
// tre): Ania può cambiarlo, anche per addebitarlo dove le regole non lo
// prevedono (due persone che vogliono dormire separate).
export type LettoScelto = { importo: number; criterio: 'notte' | 'ogni4' | 'totale' }

export type PeriodoComposto = {
  id: string
  gruppo: string
  roomId: string | null
  checkIn: string
  checkOut: string
  ospiti: number
  nottiLetto: string[]       // notti col letto aggiuntivo (vuoto = niente letto)
  letto: LettoScelto | null  // null = come dicono le regole della camera
  tariffa: number | null     // null = ancora da decidere; il listino la propone
}

// Quanto costa una notte di letto secondo le regole della camera (0 quando è
// compreso, come il terzo posto di Lena).
export function lettoDaRegole(camera: CameraComposta | null, ospiti: number): number {
  return totaleLetto(camera, ospiti, 1)
}

export function costoLetto(p: PeriodoComposto, camera: CameraComposta | null): number {
  const n = p.nottiLetto.length
  if (n === 0) return 0
  const scelta = p.letto ?? { importo: lettoDaRegole(camera, p.ospiti), criterio: 'notte' as const }
  if (!scelta.importo) return 0
  if (scelta.criterio === 'totale') return round2(scelta.importo)
  if (scelta.criterio === 'ogni4') return round2(scelta.importo * Math.ceil(n / 4))
  return round2(scelta.importo * n)
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export function notti(p: PeriodoComposto): number {
  return giorniSoggiorno(p.checkIn, p.checkOut).length
}

function comeBooking(p: PeriodoComposto) {
  return {
    check_in: p.checkIn, check_out: p.checkOut, num_guests: p.ospiti,
    extra_bed: p.nottiLetto.length > 0, extra_bed_dates: p.nottiLetto,
    price_per_night: p.tariffa,
  }
}

// Tariffa che il campo deve mostrare quando Ania non l'ha scritta a mano.
export function tariffaProposta(p: PeriodoComposto, camera: CameraComposta | null): number {
  return tariffaMinima(camera, comeBooking(p))
}

// Quante persone proporre appena si sceglie una camera: la sua capienza
// senza letto aggiuntivo (Amelia è singola: una persona, non due).
export function ospitiIniziali(camera: CameraComposta | null): number {
  return capienzaBase(camera)
}

// Il letto aggiuntivo non si deve spuntare a mano: se le persone superano la
// capienza della camera serve per forza, quindi si accende su tutte le notti
// del periodo (e il prezzo lo mettono le regole della camera). Se tornano
// dentro la capienza si spegne.
export function conLettoAutomatico(p: PeriodoComposto, camera: CameraComposta | null): PeriodoComposto {
  const serve = Boolean(camera) && p.ospiti > capienzaBase(camera)
  const giorni = giorniSoggiorno(p.checkIn, p.checkOut)
  if (!serve) return p.nottiLetto.length === 0 ? p : { ...p, nottiLetto: [], letto: null }
  // già acceso su alcune notti scelte a mano: si tengono, solo ripulite dalle
  // notti finite fuori dal periodo
  const dentro = p.nottiLetto.filter(n => giorni.includes(n))
  return {
    ...p,
    nottiLetto: dentro.length > 0 ? dentro : giorni,
    letto: p.letto ?? { importo: lettoDaRegole(camera, p.ospiti), criterio: 'notte' },
  }
}

export type ContoPeriodo = { totale: number; prezzoNotte: number; lettoTotale: number }

// null quando manca un dato indispensabile: un valore che manca non vale zero.
export function contoPeriodo(p: PeriodoComposto, camera: CameraComposta | null): ContoPeriodo | null {
  if (!camera || notti(p) <= 0) return null
  const conto = prezzoPrenotazione(camera, comeBooking(p))
  // Il conto della camera resta quello delle regole (anche notte per notte);
  // il letto si sostituisce con quello scelto da Ania, se l'ha cambiato.
  const senzaLetto = round2(conto.totale - conto.lettoTotale)
  const letto = costoLetto(p, camera)
  return { totale: round2(senzaLetto + letto), prezzoNotte: conto.prezzoNotte, lettoTotale: letto }
}

export function totalePieno(periodi: PeriodoComposto[], camera: (id: string | null) => CameraComposta | null): number | null {
  if (periodi.length === 0) return null
  let somma = 0
  for (const p of periodi) {
    const c = contoPeriodo(p, camera(p.roomId))
    if (c === null) return null
    somma += c.totale
  }
  return round2(somma)
}

export type RigaConto = { etichetta: string; importo: number }

export function righeConto(periodi: PeriodoComposto[], camera: (id: string | null) => CameraComposta | null): RigaConto[] {
  const righe: RigaConto[] = []
  for (const p of periodi) {
    const c = camera(p.roomId)
    const conto = contoPeriodo(p, c)
    if (!c || !conto) continue
    const n = notti(p)
    righe.push({ etichetta: `${c.name} · ${n} ${n === 1 ? 'notte' : 'notti'}`, importo: round2(conto.totale - conto.lettoTotale) })
    if (conto.lettoTotale > 0) {
      righe.push({ etichetta: `Letto aggiuntivo · ${p.nottiLetto.length} ${p.nottiLetto.length === 1 ? 'notte' : 'notti'}`, importo: conto.lettoTotale })
    }
  }
  return righe
}

// La riga da inserire in bookings: stessa convenzione di sempre
// (price_per_night = notte più economica, extra_bed_total = tutto il resto).
export function rigaDaSalvare(p: PeriodoComposto, camera: CameraComposta, groupId: string) {
  const calcolato = contoPeriodo(p, camera)
  const prezzoNotte = calcolato?.prezzoNotte ?? 0
  const totale = calcolato?.totale ?? 0
  // Convenzione di sempre di bookings: price_per_night è la notte più
  // economica, extra_bed_total è tutto il resto (letto e differenze fra notti).
  const conto = { prezzoNotte, totale, lettoTotale: round2(totale - prezzoNotte * notti(p)) }
  return {
    room_id: camera.id,
    check_in: p.checkIn,
    check_out: p.checkOut,
    num_guests: p.ospiti,
    extra_bed: p.nottiLetto.length > 0,
    extra_bed_dates: p.nottiLetto,
    price_per_night: conto.prezzoNotte,
    extra_bed_total: conto.lettoTotale,
    total_amount: conto.totale,
    group_id: groupId,
  }
}

// Un cambio camera divide il periodo: fino al giorno del cambio nella camera
// di partenza, dal giorno del cambio in quella nuova. Le notti del letto
// restano a chi le aveva davvero.
export function dividiPerCambio(p: PeriodoComposto, dal: string, nuovaCamera: string, tariffa: number | null, idNuovo: string): [PeriodoComposto, PeriodoComposto] {
  const primo: PeriodoComposto = { ...p, checkOut: dal, nottiLetto: p.nottiLetto.filter(n => n < dal) }
  const secondo: PeriodoComposto = {
    ...p, id: idNuovo, roomId: nuovaCamera, checkIn: dal, checkOut: p.checkOut,
    tariffa, nottiLetto: p.nottiLetto.filter(n => n >= dal),
  }
  return [primo, secondo]
}

// ── controlli prima di salvare ─────────────────────────────────────────────
// Restituisce le cose da correggere, in italiano, una per riga.
export function problemi(
  periodi: PeriodoComposto[],
  camera: (id: string | null) => CameraComposta | null,
  lettiGiaOccupati: Map<string, number> = new Map(),
): string[] {
  const fuori: string[] = []
  if (periodi.length === 0) fuori.push('Manca la camera.')
  for (const p of periodi) {
    const c = camera(p.roomId)
    if (!c) { fuori.push('Una camera non è stata scelta.'); continue }
    if (notti(p) <= 0) { fuori.push(`${c.name}: la partenza deve venire dopo l'arrivo.`); continue }
    if (p.ospiti < 1) fuori.push(`${c.name}: gli ospiti non possono essere zero.`)
    const max = capienzaCamera(c)
    if (p.ospiti > max) fuori.push(`${c.name} tiene al massimo ${max} ${max === 1 ? 'persona' : 'persone'}.`)
    for (const n of p.nottiLetto) {
      if (!giorniSoggiorno(p.checkIn, p.checkOut).includes(n)) {
        fuori.push(`${c.name}: una notte col letto aggiuntivo è fuori dal periodo.`)
        break
      }
    }
  }
  // stessa camera due volte nelle stesse notti, dentro questa compilazione
  const occupate = new Map<string, string>()
  for (const p of periodi) {
    const c = camera(p.roomId)
    if (!c) continue
    for (const g of giorniSoggiorno(p.checkIn, p.checkOut)) {
      const chiave = `${c.id}|${g}`
      if (occupate.has(chiave)) { fuori.push(`${c.name} risulta occupata due volte la notte del ${g.slice(8)}/${g.slice(5, 7)}.`); break }
      occupate.set(chiave, p.id)
    }
  }
  // i due letti della casa, contando anche le altre prenotazioni
  const perNotte = new Map<string, number>(lettiGiaOccupati)
  for (const p of periodi) {
    const quanti = lettiPoolPrenotazione({ room_id: p.roomId, num_guests: p.ospiti, extra_bed: p.nottiLetto.length > 0, extra_bed_dates: p.nottiLetto })
    if (quanti === 0) continue
    for (const n of p.nottiLetto) perNotte.set(n, (perNotte.get(n) || 0) + quanti)
  }
  const troppi = [...perNotte.entries()].filter(([, q]) => q > EXTRA_BED_MAX).map(([g]) => `${g.slice(8)}/${g.slice(5, 7)}`)
  if (troppi.length > 0) fuori.push(`I letti aggiuntivi sono ${EXTRA_BED_MAX}: troppi la notte del ${troppi.join(', ')}.`)
  return fuori
}

export { lettoDaComunicare }
