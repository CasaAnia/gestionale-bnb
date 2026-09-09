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
export type LettoScelto = {
  importo: number
  criterio: 'notte' | 'ogni4' | 'totale'
  // acceso dalla pagina perché le persone superano la capienza: solo questo si
  // può spegnere da solo. Il letto chiesto a mano (due persone che vogliono
  // dormire separate) non si tocca quando cambiano le date.
  auto?: boolean
}

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

// Quanto costa una notte di letto secondo le regole delle camere (0 quando è
// compreso, come il terzo posto di Lena).
export function lettoDaRegole(camera: CameraComposta | null, ospiti: number): number {
  return totaleLetto(camera, ospiti, 1)
}

// Quanto proporre nel campo «Quanto costa» (Ania, 09/09/2026): il prezzo del
// letto della camera — cinque euro per la singola, dieci per le altre — perché
// è quello che userà quasi sempre; quella volta che lo vende a meno lo cambia
// a mano. Dove il posto letto è già dentro il prezzo (Lena venduta come tripla,
// terzo ospite) resta zero: altrimenti si pagherebbe due volte.
export function lettoProposto(camera: CameraComposta | null, ospiti: number): number {
  const daRegole = lettoDaRegole(camera, ospiti)
  if (daRegole > 0) return daRegole
  if (ospiti > capienzaBase(camera)) return 0
  // acceso a mano stando nella capienza (due persone che dormono separate):
  // vale il prezzo del letto di quella camera
  return Number(camera?.extra_bed_price ?? 0) || 0
}

export function costoLetto(p: PeriodoComposto, camera: CameraComposta | null): number {
  const n = p.nottiLetto.length
  if (n === 0) return 0
  const scelta = p.letto ?? { importo: lettoProposto(camera, p.ospiti), criterio: 'notte' as const }
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
  const dentro = p.nottiLetto.filter(n => giorni.includes(n))
  if (!serve) {
    // Il letto messo a mano resta: si ripuliscono solo le notti uscite dal
    // periodo. Si spegne da solo soltanto quello acceso dalla pagina.
    if (p.letto?.auto) return { ...p, nottiLetto: [], letto: null }
    return dentro.length === p.nottiLetto.length ? p : { ...p, nottiLetto: dentro }
  }
  return {
    ...p,
    nottiLetto: dentro.length > 0 ? dentro : giorni,
    letto: p.letto ?? { importo: lettoProposto(camera, p.ospiti), criterio: 'notte', auto: true },
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
  const nottiPrima = p.nottiLetto.filter(n => n < dal)
  const nottiDopo = p.nottiLetto.filter(n => n >= dal)
  // «A notte» si divide da solo. «Totale concordato» e «Ogni 4 notti» no: se
  // si copiassero su tutti e due i periodi, spezzare il soggiorno farebbe
  // pagare due volte. L'accordo resta sul primo periodo e il secondo parte da
  // zero, così Ania decide se e quanto aggiungere.
  const aQuota = Boolean(p.letto) && p.letto!.criterio !== 'notte'
  // L'accordo segue le notti: se il letto è solo dopo il cambio, l'importo va
  // al secondo periodo (prima si perdeva). Con le notti da tutte e due le
  // parti e un importo a quota, l'accordo resta sul primo e il secondo parte
  // da zero: lettoDaRivedere() lo fa dire alla pagina.
  const soloDopo = nottiPrima.length === 0 && nottiDopo.length > 0
  const primo: PeriodoComposto = { ...p, checkOut: dal, nottiLetto: nottiPrima, letto: nottiPrima.length > 0 ? p.letto : null }
  const secondo: PeriodoComposto = {
    ...p, id: idNuovo, roomId: nuovaCamera, checkIn: dal, checkOut: p.checkOut,
    tariffa, nottiLetto: nottiDopo,
    letto: nottiDopo.length === 0 ? null
      : soloDopo || !aQuota ? p.letto
      : { importo: 0, criterio: p.letto!.criterio },
  }
  return [primo, secondo]
}

// C'è un letto aggiuntivo da rivedere? Due casi, e in tutti e due la pagina
// lo dice invece di far sparire un accordo in silenzio:
//  · un importo a quota rimasto a zero dopo un cambio camera;
//  · un letto chiesto ma senza più nessuna notte (per esempio spostando tutto
//    il soggiorno in altre date).
export function lettoDaRivedere(periodi: PeriodoComposto[]): boolean {
  return periodi.some(p => perche(p) !== null)
}

// Perché quel periodo è da rivedere, in parole. null = tutto a posto.
export function perche(p: PeriodoComposto): string | null {
  if (p.letto === null) return null
  if (p.nottiLetto.length === 0 && !p.letto.auto) {
    return `Il letto aggiuntivo era concordato a ${p.letto.importo} € (${etichettaCriterio(p.letto.criterio)}) ma non ha più nessuna notte.`
  }
  if (p.nottiLetto.length > 0 && p.letto.criterio !== 'notte' && !p.letto.importo) {
    return `Qui il letto aggiuntivo è rimasto senza importo: dopo il cambio camera «${etichettaCriterio(p.letto.criterio)}» va deciso di nuovo.`
  }
  return null
}

export function etichettaCriterio(c: LettoScelto['criterio']): string {
  return c === 'notte' ? 'a notte' : c === 'ogni4' ? 'ogni 4 notti' : 'totale concordato'
}

// I periodi col letto da rivedere: la pagina li segna e non lascia salvare
// finché Ania non decide (tenere l'importo o togliere il letto).
export function periodiDaRivedere(periodi: PeriodoComposto[]): { id: string; motivo: string }[] {
  return periodi.flatMap(p => { const m = perche(p); return m ? [{ id: p.id, motivo: m }] : [] })
}

// ── controlli prima di salvare ─────────────────────────────────────────────
// Restituisce le cose da correggere, in italiano, una per riga.
export function problemi(
  periodi: PeriodoComposto[],
  camera: (id: string | null) => CameraComposta | null,
  lettiGiaOccupati: Map<string, number> = new Map(),
): string[] {
  const fuori: string[] = []
  // Un letto rimasto senza notti o senza importo NON si salva in silenzio:
  // prima Ania decide (rilievo del 09/09/2026).
  for (const { motivo } of periodiDaRivedere(periodi)) fuori.push(`${motivo} Scegli se tenerlo o toglierlo.`)
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
